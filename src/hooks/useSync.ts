import { db } from '../db/schema';
import { useAuth } from './useAuth'; 

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxOkYlb31V5-p3C8AMqeKm4aJL9ngbohGmc1XhmUKiBOciLTOK_k8iuBrfQbj_uUHKc/exec';

let isSyncing = false;
let lastSyncTime = 0;
const SYNC_COOLDOWN = 5000; 

export function useSync() {
  const { user } = useAuth();

  const checkCloudPin = async (pin: string) => {
    try {
      const response = await fetch(`${GAS_URL}?action=getGlobalUsers`);
      const result = await response.json();
      if (result.status === 'success' && result.data) {
        return result.data.some((remoteUser: any) => String(remoteUser.pin).trim() === String(pin).trim());
      }
      return false;
    } catch (e) {
      const localExists = await db.users.where('password').equals(pin.trim()).first();
      return !!localExists;
    }
  };

  const syncUser = async (userData: { id: string; username: string; pin?: string }) => {
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({
          action: 'syncUsers',
          data: [{ id: userData.id, username: userData.username, pin: userData.pin }]
        }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });
      const result = await response.json();
      if (result.status === 'error' && result.message === 'PIN_ALREADY_EXISTS') return result;
      return result;
    } catch (e) {
      throw e;
    }
  };

  const refreshFromCloud = async () => {
    if (!user?.id || isSyncing) return;
    
    const now = Date.now();
    if (now - lastSyncTime < SYNC_COOLDOWN) return;

    const isAdding = document.querySelector('[role="dialog"]') !== null;
    const isCommandCenterOpen = document.querySelector('[data-command-center="true"]') !== null;
    if (isAdding || isCommandCenterOpen) return;

    const unsyncedTx = await db.transactions.where('synced').equals(0).toArray();
    if (unsyncedTx.length > 0) return;

    isSyncing = true;

    try {
      const response = await fetch(`${GAS_URL}?action=getAppData&user_id=${user.id}`);
      const result = await response.json();
      
      if (result.status === 'success' && result.data) {
        if (result.data.accounts) {
          for (const remoteAcc of result.data.accounts) {
            const localAcc = await db.accounts.get(remoteAcc.id);
            const remoteBalance = parseFloat(remoteAcc.balance);
            const remoteIsShared = String(remoteAcc.is_shared).toUpperCase() === 'TRUE';
            const remoteIncludeGlance = String(remoteAcc.include_in_glance).toUpperCase() === 'TRUE';

            if (!localAcc || localAcc.balance !== remoteBalance || localAcc.name !== remoteAcc.name || localAcc.is_shared !== remoteIsShared || localAcc.include_in_glance !== remoteIncludeGlance || localAcc.icon_marker !== (remoteAcc.icon_marker || 'Wallet') || localAcc.icon_color !== (remoteAcc.icon_color || '#00d1ff')) {
              await db.accounts.put({
                id: remoteAcc.id,
                balance: remoteBalance,
                name: remoteAcc.name,
                is_shared: remoteIsShared,
                include_in_glance: remoteIncludeGlance,
                icon_marker: remoteAcc.icon_marker || 'Wallet',
                icon_color: remoteAcc.icon_color || '#00d1ff',
                user_id: user.id
              });
            }
          }
        }
        
        if (result.data.settings) {
          for (const remoteSetting of result.data.settings) {
            const localSetting = await db.settings.get({ config_key: remoteSetting.config_key, user_id: user.id });
            const remoteVal = String(remoteSetting.config_value).trim();
            if (!localSetting || localSetting.config_value !== remoteVal) {
              await db.settings.put({ config_key: remoteSetting.config_key, config_value: remoteVal, user_id: user.id });
            }
          }
        }

        if (result.data.transactions) {
          for (const remoteTx of result.data.transactions) {
            const localTx = await db.transactions.get(remoteTx.id);
            
            // STRICT OFFLINE TRUTH CHECK: If it was deleted locally, IGNORE the cloud entirely.
            if (localTx && localTx.is_deleted === 1) {
              continue; 
            }

            const isRemoteDeleted = String(remoteTx.is_deleted).toUpperCase() === 'TRUE';
            if (isRemoteDeleted) {
              if (localTx) await db.transactions.update(remoteTx.id, { is_deleted: 1 });
              continue;
            }

            if (!localTx) {
              await db.transactions.put({
                id: remoteTx.id,
                date: new Date(remoteTx.date),
                amount: parseFloat(remoteTx.amount),
                category: remoteTx.category,
                account_id: remoteTx.account_id,
                target_account_id: remoteTx.target_account_id || undefined,
                note: remoteTx.note || '',
                type: remoteTx.type,
                synced: 1,
                user_id: user.id,
                is_shared: String(remoteTx.is_shared).toUpperCase() === 'TRUE',
                is_installment: String(remoteTx.is_installment).toUpperCase() === 'TRUE',
                is_deleted: 0
              });
            }
          }
        }
        lastSyncTime = Date.now();
      }
    } catch (e) {
      console.error("❌ Cloud Refresh Failed:", e);
    } finally {
      isSyncing = false;
    }
  };

  const syncTransactions = async () => {
    if (!user?.id || isSyncing) return;

    const unsynced = await db.transactions.where('synced').equals(0).toArray();
    if (unsynced.length === 0) return;

    isSyncing = true;

    const dataRows = unsynced.map(t => [
      t.id, 
      t.date instanceof Date ? t.date.toISOString() : new Date(t.date).toISOString(), 
      t.amount, 
      t.category, 
      t.account_id, 
      t.note || '', 
      t.type,
      t.is_shared ? "TRUE" : "FALSE",
      t.is_installment ? "TRUE" : "FALSE",
      t.is_deleted ? "TRUE" : "FALSE",
      t.target_account_id || "" // Ensures target is synced
    ]);

    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({ action: 'syncTransactions', user_id: user.id, data: dataRows }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });

      const result = await response.json();
      if (result.status === 'success') {
        // DO NOT delete tombstones physically. Keep them so cloud can't resurrect them.
        const allIds = unsynced.map(t => t.id);
        await db.transactions.where('id').anyOf(allIds).modify({ synced: 1 });
      }
    } catch (e) {
      console.error("❌ Sync Pipeline Blocked:", e);
    } finally {
      isSyncing = false;
      await syncAccounts();
      await refreshFromCloud();
    }
  };

  const syncSettings = async (settingsToSync?: any[]) => {
    if (!user?.id) return;
    const allSettings = settingsToSync || await db.settings.where('user_id').equals(user.id).toArray();
    if (allSettings.length === 0) return;

    const settingsData = allSettings.map(s => ({ config_key: s.config_key, config_value: String(s.config_value) }));

    try {
      await fetch(GAS_URL, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({ action: 'syncSettings', user_id: user.id, data: settingsData }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });
    } catch (e) {
      console.error("❌ Settings Sync Failed:", e);
    }
  };

  const syncAccounts = async () => {
    if (!user?.id) return;
    const allAccounts = await db.accounts.where('user_id').equals(user.id).toArray();
    const accountData = allAccounts.map(a => ({
      id: a.id, name: a.name, balance: a.balance, is_shared: a.is_shared,
      include_in_glance: a.include_in_glance, icon_marker: a.icon_marker || 'Wallet', icon_color: a.icon_color || '#00d1ff'
    }));

    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({ action: 'syncAccounts', user_id: user.id, data: accountData }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });
      return await response.json();
    } catch (e) {
      console.error("❌ Accounts Sync Failed:", e);
    }
  };

  return { checkCloudPin, syncUser, syncTransactions, refreshFromCloud, syncSettings, syncAccounts };
}