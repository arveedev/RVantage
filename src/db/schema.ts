import Dexie, { type Table } from 'dexie';

export interface Transaction {
  id: string; 
  date: Date;
  amount: number;
  category: string;
  account_id: string;
  is_shared: boolean;
  is_installment: boolean;
  note?: string;
  synced: number; 
  type: 'expense' | 'income';
}

export interface Account {
  id: string;
  name: string;
  balance: number;
  include_in_glance: boolean;
  is_shared: boolean;
}

export interface Setting {
  config_key: string;
  config_value: any;
  updated_at?: Date;
}

export class RVantageDB extends Dexie {
  transactions!: Table<Transaction>;
  accounts!: Table<Account>;
  settings!: Table<Setting>;

  constructor() {
    super('RVantageDB');
    
    // Version 5: Fixed settings schema to prevent DataError during sync
    this.version(5).stores({
      transactions: 'id, date, category, account_id, synced, type, is_installment',
      accounts: 'id, name, is_shared, include_in_glance',
      settings: 'config_key'
    });
  }
}

export const db = new RVantageDB();