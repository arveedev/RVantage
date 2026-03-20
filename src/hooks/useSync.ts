import { db } from '../db/schema';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxOkYlb31V5-p3C8AMqeKm4aJL9ngbohGmc1XhmUKiBOciLTOK_k8iuBrfQbj_uUHKc/exec';

export function useSync() {
  const refreshFromCloud = async () => {
    try {
      const response = await fetch(`${GAS_URL}?action=getAppData`);
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
              include_in_glance: String(remoteAcc.include_in_glance).toUpperCase() === 'TRUE'
            });
          }
        }
        
        // 2. Sync Settings
        if (result.data.settings) {
          for (const remoteSetting of result.data.settings) {
            await db.settings.put({
              config_key: remoteSetting.config_key,
              // FIX: Explicitly convert to String to prevent "15,30" from being parsed as a timestamp/date
              config_value: String(remoteSetting.config_value),
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
        body: JSON.stringify({ action: 'syncTransactions', data: dataRows }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });

      const result = await response.json();
      if (result.status === 'success') {
        const ids = unsynced.map(t => t.id);
        await db.transactions.where('id').anyOf(ids).modify({ synced: 1 });
        await refreshFromCloud();
      }
    } catch (e) {
      console.error("❌ Sync Pipeline Blocked:", e);
    }
  };

  const syncSettings = async (settingsToSync?: any[]) => {
    const allSettings = settingsToSync || await db.settings.toArray();
    if (allSettings.length === 0) return;

    const settingsData = allSettings.map(s => ({
      config_key: s.config_key,
      config_value: s.config_value
    }));

    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({ action: 'syncSettings', data: settingsData }),
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
    const allAccounts = await db.accounts.toArray();
    const accountData = allAccounts.map(a => ({
      id: a.id,
      name: a.name,
      balance: a.balance,
      is_shared: a.is_shared,
      include_in_glance: a.include_in_glance
    }));

    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({ action: 'syncAccounts', data: accountData }),
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

  return { syncTransactions, refreshFromCloud, syncSettings, syncAccounts };
}