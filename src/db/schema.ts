import Dexie, { type Table } from 'dexie';

export interface User {
  id: string;
  username: string;
  password?: string; 
  last_login: Date;
}

export interface Session {
  id: string; // Always 'current'
  user_id: string;
}

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
  type: 'expense' | 'income' | 'transfer';
  user_id: string; 
}

export interface Account {
  id: string;
  name: string;
  balance: number;
  include_in_glance: boolean;
  is_shared: boolean;
  icon_marker?: string;
  icon_color?: string;
  user_id: string; 
}

export interface Setting {
  config_key: string; 
  config_value: string;
  user_id: string; 
}

export class RVantageDB extends Dexie {
  users!: Table<User>;
  session!: Table<Session>;
  transactions!: Table<Transaction>;
  accounts!: Table<Account>;
  settings!: Table<Setting>;

  constructor() {
    super('RVantageDB');
    
    this.version(8).stores({
      users: 'id, username',
      session: 'id, user_id',
      transactions: 'id, date, category, account_id, synced, type, is_installment, user_id',
      accounts: 'id, name, balance, is_shared, include_in_glance, icon_marker, icon_color, user_id',
      settings: 'config_key, user_id'
    });
  }
}

export const db = new RVantageDB();