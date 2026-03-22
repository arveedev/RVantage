import { db } from '../db/schema';
import { useAuth } from './useAuth'; 

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxOkYlb31V5-p3C8AMqeKm4aJL9ngbohGmc1XhmUKiBOciLTOK_k8iuBrfQbj_uUHKc/exec';

// Module-level state to track sync status across all component instances
let isSyncing = false;
let lastSyncTime = 0;
const SYNC_COOLDOWN = 5000; // 5 seconds cooldown to prevent rapid loops

export function useSync() {
  const { user } = useAuth();

  // New helper to verify if a PIN is already taken in the Google Sheet
  const checkCloudPin = async (pin: string) => {
    try {
      const response = await fetch(`${GAS_URL}?action=getGlobalUsers`);
      const result = await response.json();
      if (result.status === 'success' && result.data) {
        // Strict comparison using the 'pin' key from Code.gs
        return result.data.some((remoteUser: any) => 
          String(remoteUser.pin).trim() === String(pin).trim()
        );
      }
      return false;
    } catch (e) {
      console.error("❌ Cloud PIN Check Failed:", e);
      // Fallback: Check local DB if cloud fetch fails
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
          // Data now explicitly uses 'pin' to match the backend headers
          data: [{
            id: userData.id,
            username: userData.username,
            pin: userData.pin
          }]
        }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });
      const result = await response.json();
      
      if (result.status === 'error' && result.message === 'PIN_ALREADY_EXISTS') {
        console.warn("⚠️ Sync blocked: PIN is already registered to another user.");
        return result;
      }

      console.log("👤 User Profile Cloud-Synced");
      return result;
    } catch (e) {
      console.error("❌ User Sync Failed:", e);
      throw e;
    }
  };

  const refreshFromCloud = async () => {
    if (!user?.id || isSyncing) return;
    
    // Check cooldown
    const now = Date.now();
    if (now - lastSyncTime < SYNC_COOLDOWN) return;

    // Enhanced Check: Postpone if any modal OR the Command Center is active
    const isAdding = document.querySelector('[role="dialog"]') !== null;
    const isCommandCenterOpen = document.querySelector('[data-command-center="true"]') !== null;
    
    if (isAdding || isCommandCenterOpen) {
      console.log("⏳ Sync postponed: User is active in a modal or Command Center.");
      return;
    }

    isSyncing = true;

    try {
      const response = await fetch(`${GAS_URL}?action=getAppData&user_id=${user.id}`);
      const result = await response.json();
      
      if (result.status === 'success' && result.data) {
        // --- Sync Accounts ---
        if (result.data.accounts) {
          for (const remoteAcc of result.data.accounts) {
            const localAcc = await db.accounts.get(remoteAcc.id);
            const remoteBalance = parseFloat(remoteAcc.balance);
            const remoteIsShared = String(remoteAcc.is_shared).toUpperCase() === 'TRUE';
            const remoteIncludeGlance = String(remoteAcc.include_in_glance).toUpperCase() === 'TRUE';

            if (!localAcc || 
                localAcc.balance !== remoteBalance || 
                localAcc.name !== remoteAcc.name || 
                localAcc.is_shared !== remoteIsShared || 
                localAcc.include_in_glance !== remoteIncludeGlance ||
                localAcc.icon_marker !== (remoteAcc.icon_marker || 'Wallet') ||
                localAcc.icon_color !== (remoteAcc.icon_color || '#00d1ff')) {
              
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
        
        // --- Sync Settings ---
        if (result.data.settings) {
          for (const remoteSetting of result.data.settings) {
            const localSetting = await db.settings.get({ config_key: remoteSetting.config_key, user_id: user.id });
            
            // FIXED: Force all incoming values to string. 
            // Combined with backend getDisplayValues(), this ensures "15, 30" stays "15, 30".
            const remoteVal = String(remoteSetting.config_value).trim();

            if (!localSetting || localSetting.config_value !== remoteVal) {
              await db.settings.put({
                config_key: remoteSetting.config_key,
                config_value: remoteVal,
                user_id: user.id
              });
            }
          }
        }
        
        lastSyncTime = Date.now();
        console.log("💎 Delta-Sync Complete: Data updated.");
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
      t.type
    ]);

    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({ 
          action: 'syncTransactions', 
          user_id: user.id, 
          data: dataRows 
        }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });

      const result = await response.json();
      if (result.status === 'success') {
        const ids = unsynced.map(t => t.id);
        await db.transactions.where('id').anyOf(ids).modify({ synced: 1 });
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

    const settingsData = allSettings.map(s => ({
      config_key: s.config_key,
      config_value: String(s.config_value)
    }));

    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({ 
          action: 'syncSettings', 
          user_id: user.id, 
          data: settingsData 
        }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });

      const result = await response.json();
      if (result.status === 'success') {
        console.log("⚙️ Settings Cloud-Synced");
      }
    } catch (e) {
      console.error("❌ Settings Sync Failed:", e);
    }
  };

  const syncAccounts = async () => {
    if (!user?.id) return;

    const allAccounts = await db.accounts.where('user_id').equals(user.id).toArray();
    const accountData = allAccounts.map(a => ({
      id: a.id,
      name: a.name,
      balance: a.balance,
      is_shared: a.is_shared,
      include_in_glance: a.include_in_glance,
      icon_marker: a.icon_marker || 'Wallet',
      icon_color: a.icon_color || '#00d1ff'
    }));

    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({ 
          action: 'syncAccounts', 
          user_id: user.id, 
          data: accountData 
        }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });
      const result = await response.json();
      console.log("Banks Accounts Cloud-Synced");
      return result;
    } catch (e) {
      console.error("❌ Accounts Sync Failed:", e);
      throw e;
    }
  };

  return { checkCloudPin, syncUser, syncTransactions, refreshFromCloud, syncSettings, syncAccounts };
}