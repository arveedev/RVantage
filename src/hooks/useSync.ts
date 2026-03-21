import { db } from '../db/schema';
import { useAuth } from '../components/AuthContext';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxOkYlb31V5-p3C8AMqeKm4aJL9ngbohGmc1XhmUKiBOciLTOK_k8iuBrfQbj_uUHKc/exec';

export function useSync() {
  const { user } = useAuth();

  const syncUser = async (userData: { id: string; username: string }) => {
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({
          action: 'syncUsers',
          data: [userData]
        }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });
      const result = await response.json();
      console.log("👤 User Profile Cloud-Synced");
      return result;
    } catch (e) {
      console.error("❌ User Sync Failed:", e);
      throw e;
    }
  };

  const refreshFromCloud = async () => {
    if (!user?.id) return;

    // Prevent refresh if a modal is likely open or user is active in transaction
    const isAdding = document.querySelector('[role="dialog"]') !== null;
    if (isAdding) {
      console.log("⏳ Sync postponed: User is active in a modal.");
      return;
    }

    try {
      const response = await fetch(`${GAS_URL}?action=getAppData&user_id=${user.id}`);
      const result = await response.json();
      
      if (result.status === 'success' && result.data) {
        // 1. Sync Accounts
        if (result.data.accounts) {
          for (const remoteAcc of result.data.accounts) {
            await db.accounts.put({
              id: remoteAcc.id,
              balance: parseFloat(remoteAcc.balance),
              name: remoteAcc.name,
              is_shared: String(remoteAcc.is_shared).toUpperCase() === 'TRUE',
              include_in_glance: String(remoteAcc.include_in_glance).toUpperCase() === 'TRUE',
              icon_marker: remoteAcc.icon_marker || 'Wallet',
              icon_color: remoteAcc.icon_color || '#00d1ff',
              user_id: user.id
            });
          }
        }
        
        // 2. Sync Settings
        if (result.data.settings) {
          for (const remoteSetting of result.data.settings) {
            await db.settings.put({
              config_key: remoteSetting.config_key,
              config_value: String(remoteSetting.config_value),
              user_id: user.id
            });
          }
        }
        
        console.log("💎 Delta-Sync Complete: Data updated.");
      }
    } catch (e) {
      console.error("❌ Cloud Refresh Failed:", e);
    }
  };

  const syncTransactions = async () => {
    if (!user?.id) return;

    const unsynced = await db.transactions.where('synced').equals(0).toArray();
    if (unsynced.length === 0) return;

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
        
        await syncAccounts();
        await refreshFromCloud();
      }
    } catch (e) {
      console.error("❌ Sync Pipeline Blocked:", e);
    }
  };

  const syncSettings = async (settingsToSync?: any[]) => {
    if (!user?.id) return;

    // If no specific settings passed, get everything for current user from local DB
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
      console.log("🏦 Accounts Cloud-Synced");
      return result;
    } catch (e) {
      console.error("❌ Accounts Sync Failed:", e);
      throw e;
    }
  };

  return { syncUser, syncTransactions, refreshFromCloud, syncSettings, syncAccounts };
}