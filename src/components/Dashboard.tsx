import { useState, useEffect, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import type { Transaction, Account } from '../db/schema'; 
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, TrendingUp, ShieldCheck, Zap, ReceiptText, 
  ArrowUpRight, ArrowDownRight, Trash2, X, CreditCard, 
  Settings, Landmark, Percent, Calendar, Plus, 
  PiggyBank, Landmark as BankIcon, Briefcase, ShoppingBag,
  Loader2, Check, Info, Eye, EyeOff, Users, User
} from 'lucide-react';
import { useSync } from '../hooks/useSync';
import { useToast } from '../context/ToastContext';
import AddTransaction from './AddTransaction';
import GhostForecast from './GhostForecast';

const ACCOUNT_ICONS = [
  { name: 'Wallet', icon: Wallet },
  { name: 'Bank', icon: BankIcon },
  { name: 'Savings', icon: PiggyBank },
  { name: 'Work', icon: Briefcase },
  { name: 'Shopping', icon: ShoppingBag }
];

const CURRENCIES = [
  { code: 'PHP', label: 'Philippines (PHP ₱)', country: 'Philippines' },
  { code: 'USD', label: 'United States (USD $)', country: 'United States' },
  { code: 'EUR', label: 'Euro Zone (EUR €)', country: 'Germany' },
  { code: 'GBP', label: 'United Kingdom (GBP £)', country: 'United Kingdom' },
  { code: 'JPY', label: 'Japan (JPY ¥)', country: 'Japan' },
  { code: 'AUD', label: 'Australia (AUD $)', country: 'Australia' },
  { code: 'CAD', label: 'Canada (CAD $)', country: 'Canada' },
  { code: 'SGD', label: 'Singapore (SGD $)', country: 'Singapore' },
];


export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'home' | 'simulator'>('home');
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month' | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isProcessingAccount, setIsProcessingAccount] = useState(false);
  
  const [editingAccount, setEditingAccount] = useState<Partial<Account> | null>(null);

const [config, setConfig] = useState({
  base_currency: 'PHP',
  payday_schedule: '15, 30',
  inflation_rate: '3',
  monthly_income: '0',
  fixed_bills: '0'
});

  const { refreshFromCloud, syncTransactions, syncSettings, syncAccounts } = useSync();
  const { showToast } = useToast();
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const formatNumber = (val: any) => {
    if (val === null || val === undefined || val === '') return '';
    const str = String(val).replace(/,/g, '');
    return str.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const cleanNumber = (val: string) => val.replace(/,/g, '');

  useEffect(() => {
    const bootSequence = async () => {
      await syncTransactions();
      await refreshFromCloud();
    };
    bootSequence();
  }, []);

  const accounts = useLiveQuery(() => db.accounts.toArray());
  const rawTransactions = useLiveQuery(() => db.transactions.toArray());
  const settings = useLiveQuery(() => db.settings.toArray());

useEffect(() => {
  if (settings && settings.length > 0) {
    const getVal = (key: string, fallback: string) => {
      const found = settings.find(s => s.config_key === key);
      if (!found) return fallback;
      
      let val = found.config_value;

      // 1. SPECIFIC FIX FOR PAYDAY SCHEDULE
      if (key === 'payday_schedule') {
        const strVal = String(val);
        // If the string is unusually long (like your timestamp 20261024...)
        // we ignore the corrupted sync value and keep the local fallback or 
        // try to see if it's a valid date to extract the day.
        if (strVal.length > 10 && !strVal.includes(',')) {
          const d = new Date(val);
          return !isNaN(d.getTime()) ? String(d.getDate()) : fallback;
        }
        return strVal || fallback;
      }
      
      return String(val) || fallback;
    };

    setConfig({
      base_currency: getVal('base_currency', 'PHP'),
      payday_schedule: getVal('payday_schedule', '10, 25'),
      inflation_rate: getVal('inflation_rate', '3'),
      monthly_income: getVal('monthly_income', '0'),
      fixed_bills: getVal('fixed_bills', '0')
    });
  }
}, [settings]);

  const transactions = useMemo(() => {
    if (!rawTransactions) return [];
    return [...rawTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [rawTransactions]);

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    const now = new Date();
    return transactions.filter(t => {
      const d = new Date(t.date);
      if (timeFilter === 'day') return d.toDateString() === now.toDateString();
      if (timeFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return d >= weekAgo;
      }
      if (timeFilter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      return true;
    });
  }, [transactions, timeFilter]);

  const financialIntel = useMemo(() => {
    if (!accounts || !transactions) return { total: 0, safe: 0, daysToInflow: 0, variableSpendAverage: 0 };
    
    const totalBalance = accounts.reduce((acc, curr) => curr.include_in_glance ? acc + curr.balance : acc, 0);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const variableSpendAverage = transactions
      .filter(t => new Date(t.date) >= thirtyDaysAgo && t.amount < 0 && !t.is_installment)
      .reduce((acc, t) => acc + Math.abs(t.amount), 0) / 30;
      
    const upcoming = transactions.filter(t => new Date(t.date) > new Date() && t.amount < 0).reduce((acc, t) => acc + Math.abs(t.amount), 0);
    
    const scheduleStr = String(config.payday_schedule || '15,30');
    const paydays = scheduleStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)).sort((a, b) => a - b);
    
    const now = new Date();
    const todayDate = now.getDate();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    
    let daysToInflow = 0;
    const nextPayday = paydays.find(d => d > todayDate);

    if (nextPayday) {
        daysToInflow = nextPayday - todayDate;
    } else if (paydays.length > 0) {
        daysToInflow = (lastDayOfMonth - todayDate) + paydays[0];
    }

    return { total: totalBalance, safe: totalBalance - upcoming, daysToInflow: isNaN(daysToInflow) ? 0 : daysToInflow, variableSpendAverage };
  }, [accounts, transactions, config]);

  const handleSaveConfig = async () => {
    try {
      const keys = Object.keys(config) as Array<keyof typeof config>;
      const settingsToSync = keys.map(key => ({ config_key: key, config_value: String(config[key]) }));
      for (const item of settingsToSync) {
        await db.settings.put(item);
      }
      await syncSettings(settingsToSync);
      showToast("SYSTEM RECONFIGURED", "success");
      setIsSettingsOpen(false);
    } catch (e) { 
      showToast("Save Failed", "error"); 
    }
  };

  const handleSaveAccount = async () => {
    if (!editingAccount?.name) return;
    setIsProcessingAccount(true);
    try {
      const newAcc: Account = {
        id: editingAccount.id || crypto.randomUUID(),
        name: editingAccount.name,
        balance: editingAccount.balance || 0,
        is_shared: editingAccount.is_shared || false,
        include_in_glance: editingAccount.include_in_glance !== undefined ? editingAccount.include_in_glance : true
      };
      await db.accounts.put(newAcc);
      await syncAccounts();
      showToast("ACCOUNT UPDATED", "success");
      setIsAccountModalOpen(false);
      setEditingAccount(null);
    } catch (e) {
      showToast("Operation Failed", "error");
    } finally {
      setIsProcessingAccount(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    setIsProcessingAccount(true);
    try {
      await db.accounts.delete(id);
      await syncAccounts();
      showToast("ACCOUNT REMOVED", "error");
      setIsAccountModalOpen(false);
    } catch (e) {
      showToast("Termination Failed", "error");
    } finally {
      setIsProcessingAccount(false);
    }
  };

  const startPress = (id: string) => {
    longPressTimer.current = setTimeout(() => {
      if (window.navigator.vibrate) window.navigator.vibrate(50);
      setDeletingId(id);
    }, 600);
  };
  const endPress = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };

  const handleDelete = async (t: Transaction) => {
    await db.transaction('rw', [db.transactions, db.accounts], async () => {
      await db.transactions.delete(t.id);
      const acc = await db.accounts.get(t.account_id);
      if (acc) await db.accounts.update(t.account_id, { balance: acc.balance - t.amount });
    });
    setDeletingId(null);
    syncTransactions();
    syncAccounts();
  };

  const renderHome = () => (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">
      <div 
        onClick={() => setShowAccounts(!showAccounts)}
        className="bg-aura-card p-8 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden active:scale-[0.98] transition-all cursor-pointer"
      >
        <div className="absolute top-0 right-0 p-6 opacity-10"><Wallet size={48} /></div>
        <span className="text-aura-subtle font-black uppercase tracking-[0.2em] text-[10px]">Total Liquidity</span>
        <h1 className="text-5xl font-black tracking-tighter mt-2 tabular-nums">
          <span className="text-aura-accent text-xl mr-2 font-bold">{config.base_currency}</span>
          {financialIntel.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </h1>
      </div>

      <AnimatePresence>
        {showAccounts && (
          <motion.section 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-col gap-4 overflow-hidden"
          >
            <div className="flex justify-between items-center px-2">
              <span className="text-[10px] font-black text-aura-subtle uppercase tracking-widest">Active Accounts</span>
              <button onClick={() => { setEditingAccount({ include_in_glance: true, is_shared: false }); setIsAccountModalOpen(true); }} className="text-aura-accent text-[10px] font-black uppercase">+ Add Account</button>
            </div>
            <div className="overflow-x-auto flex gap-4 no-scrollbar pb-2 -mx-2 px-2">
              {accounts?.map((acc) => {
                return (
                  <div key={acc.id} onClick={() => { setEditingAccount(acc); setIsAccountModalOpen(true); }} className="min-w-[160px] bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col gap-2 active:scale-95 transition-all">
                    <div className="flex justify-between items-center text-aura-subtle">
                      <span className="text-[9px] font-black uppercase tracking-tighter">{acc.is_shared ? 'Shared' : 'Private'}</span>
                    </div>
                    <p className="text-[10px] font-bold text-aura-subtle truncate">{acc.name}</p>
                    <p className="text-sm font-black tabular-nums">{config.base_currency} {acc.balance.toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 relative overflow-hidden">
          <div className="absolute -right-2 -bottom-2 text-aura-accent/10"><ShieldCheck size={64} /></div>
          <span className="text-[10px] font-black text-aura-subtle uppercase tracking-widest block mb-2">Safe-to-Spend</span>
          <p className="text-2xl font-black tabular-nums">{config.base_currency}{financialIntel.safe.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 relative overflow-hidden">
          <div className="absolute -right-2 -bottom-2 text-yellow-500/10"><Zap size={64} /></div>
          <span className="text-[10px] font-black text-aura-subtle uppercase tracking-widest block mb-2">Inflow In</span>
          <p className="text-2xl font-black tabular-nums">{financialIntel.daysToInflow} <span className="text-xs text-aura-subtle uppercase font-bold">Days</span></p>
        </div>
      </div>

      <section className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] overflow-hidden flex flex-col">
        <div className="p-6 pb-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-[10px] font-black text-aura-subtle uppercase tracking-widest flex items-center gap-2">
              <ReceiptText size={14}/> Activity Log
            </h3>
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
              {(['day', 'week', 'month', 'all'] as const).map((f) => (
                <button key={f} onClick={() => setTimeFilter(f)} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${timeFilter === f ? 'bg-white text-black' : 'text-aura-subtle'}`}>{f}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 pb-6 overflow-y-auto max-h-[400px] no-scrollbar space-y-3">
          {filteredTransactions.map((t) => (
            <motion.div key={t.id} layout className="relative" onPointerDown={() => startPress(t.id)} onPointerUp={endPress} onPointerLeave={endPress}>
              <div onClick={() => !deletingId && (setEditingTransaction(t), setIsModalOpen(true))} className={`flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 transition-all duration-300 ${deletingId === t.id ? '-translate-x-20 opacity-50' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.amount < 0 ? 'bg-red-500/10 text-red-500' : 'bg-aura-accent/10 text-aura-accent'}`}>
                    {t.amount < 0 ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                  </div>
                  <div>
                    <p className="text-sm font-bold leading-tight">{t.category}</p>
                    <p className="text-[10px] text-aura-subtle uppercase font-bold">{new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                  </div>
                </div>
                <p className={`font-black tabular-nums ${t.amount < 0 ? 'text-white' : 'text-aura-accent'}`}>
                  {t.amount < 0 ? '-' : '+'}{config.base_currency}{Math.abs(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <AnimatePresence>
                {deletingId === t.id && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="absolute right-0 top-0 bottom-0 flex gap-2">
                    <button onClick={() => handleDelete(t)} className="w-16 h-full bg-red-600 rounded-2xl flex items-center justify-center text-white"><Trash2 size={20}/></button>
                    <button onClick={() => setDeletingId(null)} className="w-12 h-full bg-white/10 rounded-2xl flex items-center justify-center text-white"><X size={18}/></button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </section>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-aura-black pb-40 text-white selection:bg-aura-accent/30">
<header className="sticky top-0 z-[60] bg-aura-black/80 backdrop-blur-xl border-b border-white/5 p-4 flex justify-between items-center">
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 bg-aura-accent/10 border border-aura-accent/20 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(0,209,255,0.2)]">
      <Zap size={20} className="text-aura-accent" fill="currentColor" />
    </div>
    <div>
      <span className="font-black tracking-tighter uppercase text-sm block leading-none">RVantage</span>
      <span className="text-[8px] font-bold text-aura-subtle uppercase tracking-[0.2em]">Command v3.0</span>
    </div>
  </div>
  <div className="flex gap-3 items-center">
    <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 bg-white/5 rounded-full border border-white/10 active:scale-90 transition-all">
      <Settings size={20} className="text-aura-subtle" />
    </button>
  </div>
</header>

      <main className="p-6 max-w-lg mx-auto relative z-[10]">
        <AnimatePresence mode="wait">
          {activeTab === 'home' ? renderHome() : (
            <GhostForecast 
              variableSpendAvg={financialIntel.variableSpendAverage} 
              baseIncome={Number(config.monthly_income)}
              fixedBills={Number(config.fixed_bills)}
              inflation={Number(config.inflation_rate)}
              currentBalance={financialIntel.total}
            />
          )}
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[#0a0a0a]/90 backdrop-blur-3xl border border-white/10 px-8 py-5 rounded-[3.5rem] flex gap-10 items-center shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100]">
        <button onClick={() => setActiveTab('home')} className={`relative flex items-center justify-center p-2 transition-all duration-500 ${activeTab === 'home' ? 'text-aura-accent scale-150' : 'text-white/20 hover:text-white/40'}`}>
          <Wallet size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
          {activeTab === 'home' && (
            <motion.div layoutId="nav-glow" className="absolute -inset-4 bg-aura-accent/20 blur-2xl rounded-full" transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }} />
          )}
        </button>

        <button onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }} className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-black active:scale-90 shadow-[0_10px_30px_rgba(255,255,255,0.2)] transition-all z-[110]">
          <Plus size={28} strokeWidth={3} />
        </button>

        <button onClick={() => setActiveTab('simulator')} className={`relative flex items-center justify-center p-2 transition-all duration-500 ${activeTab === 'simulator' ? 'text-aura-accent scale-150' : 'text-white/20 hover:text-white/40'}`}>
          <TrendingUp size={24} strokeWidth={activeTab === 'simulator' ? 2.5 : 2} />
          {activeTab === 'simulator' && (
            <motion.div layoutId="nav-glow" className="absolute -inset-4 bg-aura-accent/20 blur-2xl rounded-full" transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }} />
          )}
        </button>
      </nav>

      <AddTransaction isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingTransaction(null); }} editData={editingTransaction} />

      <AnimatePresence>
        {isAccountModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[250] bg-black/95 backdrop-blur-2xl p-6 flex flex-col justify-end sm:justify-center">
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="max-w-md mx-auto w-full bg-aura-card border border-white/10 rounded-[3rem] p-8 shadow-3xl space-y-8">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black italic tracking-tighter uppercase">Account Logic</h2>
                  <p className="text-[10px] text-aura-subtle font-bold tracking-widest uppercase">Configuration Node</p>
                </div>
                <button onClick={() => setIsAccountModalOpen(false)} className="p-3 bg-white/5 rounded-full text-white/40 active:scale-90 transition-transform"><X size={20}/></button>
              </div>
              <div className="space-y-6">
                <div className="space-y-2 group">
                  <label className="text-[9px] font-black opacity-40 uppercase ml-1 tracking-widest flex items-center gap-2"><Info size={10} /> Account Identity</label>
                  <input type="text" placeholder="e.g. Cold Storage" value={editingAccount?.name || ''} onChange={e => setEditingAccount({...editingAccount, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold text-lg outline-none focus:border-aura-accent focus:bg-white/10 transition-all text-white placeholder:text-white/10" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black opacity-40 uppercase ml-1 tracking-widest flex items-center gap-2"><CreditCard size={10} /> Liquid Assets</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-aura-accent font-black text-xl">{config.base_currency}</span>
                    <input type="text" value={formatNumber(editingAccount?.balance)} onChange={e => setEditingAccount({...editingAccount, balance: Number(cleanNumber(e.target.value))})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 pl-16 font-black text-4xl outline-none focus:border-aura-accent transition-all text-white tabular-nums" />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[9px] font-black opacity-40 uppercase ml-1 tracking-widest">Visual Marker</label>
                  <div className="flex justify-between gap-2">
                    {ACCOUNT_ICONS.map(item => (
                      <button key={item.name} onClick={() => setEditingAccount({...editingAccount})} className={`flex-1 aspect-square rounded-2xl border flex items-center justify-center transition-all duration-300 ${editingAccount?.icon === item.name ? 'bg-white text-black border-white shadow-xl scale-110' : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'}`}>
                        <item.icon size={20} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-4 pt-2">
                  <label className="text-[9px] font-black opacity-40 uppercase ml-1 tracking-widest">Toggle States</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setEditingAccount({...editingAccount, is_shared: !editingAccount?.is_shared})} className={`flex flex-col items-center gap-2 p-4 rounded-3xl border transition-all duration-300 ${editingAccount?.is_shared ? 'bg-[#00d1ff]/10 border-[#00d1ff] text-[#00d1ff]' : 'bg-transparent border-white/10 text-white/20'}`}>
                      {editingAccount?.is_shared ? <Users size={20} /> : <User size={20} />}
                      <span className="text-[9px] font-black uppercase">Shared</span>
                    </button>
                    <button onClick={() => setEditingAccount({...editingAccount, include_in_glance: !editingAccount?.include_in_glance})} className={`flex flex-col items-center gap-2 p-4 rounded-3xl border transition-all duration-300 ${editingAccount?.include_in_glance ? 'bg-aura-accent/10 border-aura-accent text-aura-accent' : 'bg-transparent border-white/10 text-white/20'}`}>
                      {editingAccount?.include_in_glance ? <Eye size={20} /> : <EyeOff size={20} />}
                      <span className="text-[9px] font-black uppercase">In Total</span>
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 pt-4">
                <button disabled={isProcessingAccount} onClick={handleSaveAccount} className="w-full bg-white text-black font-black p-6 rounded-[2rem] flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 shadow-[0_20px_40px_rgba(255,255,255,0.1)] hover:bg-aura-accent">
                  {isProcessingAccount ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} strokeWidth={3} />} 
                  {editingAccount?.id ? "UPDATE DEPLOYMENT" : "INITIALIZE ACCOUNT"}
                </button>
                {editingAccount?.id && (
                  <button disabled={isProcessingAccount} onClick={() => handleDeleteAccount(editingAccount.id!)} className="w-full bg-red-600/10 text-red-500 font-black p-4 rounded-[2rem] flex items-center justify-center gap-3 border border-red-500/20 active:scale-95 transition-all disabled:opacity-50">
                    {isProcessingAccount ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />} TERMINATE DATA
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSettingsOpen && (
  <motion.div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex flex-col">
    <div className="p-6 flex justify-between items-center bg-black/40 border-b border-white/5">
      <div>
        <h2 className="text-2xl font-black tracking-tighter text-white uppercase">Command Center</h2>
        <p className="text-[10px] text-aura-subtle font-black tracking-[0.2em] uppercase">System Parameters</p>
      </div>
      <button onClick={() => setIsSettingsOpen(false)} className="p-3 bg-white/5 rounded-full text-white/40"><X size={24} /></button>
    </div>

    <div className="flex-1 p-6 space-y-8 overflow-y-auto no-scrollbar pb-32">
      {/* Currency Section */}
      <div className="space-y-4">
        <label className="text-[10px] font-black text-aura-subtle uppercase tracking-[0.2em] flex items-center gap-2">
          <Landmark size={12} className="text-aura-accent"/> Regional Currency
        </label>
        <select 
          value={config.base_currency} 
          onChange={e => setConfig({...config, base_currency: e.target.value})} 
          className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl font-bold focus:border-aura-accent outline-none appearance-none text-white"
        >
          {CURRENCIES.map(c => <option key={c.code} value={c.code} className="bg-[#111]">{c.label}</option>)}
        </select>
      </div>

      {/* Payday Section - Preserves Comma Format */}
      <div className="space-y-4">
        <label className="text-[10px] font-black text-aura-subtle uppercase tracking-[0.2em] flex items-center gap-2">
          <Calendar size={12} className="text-aura-accent"/> Payday Schedule
        </label>
        <input 
  type="text" 
  value={config.payday_schedule} // This will now use the sanitized version
  onChange={e => setConfig({...config, payday_schedule: e.target.value})} 
  className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl font-bold focus:border-aura-accent outline-none text-white" 
  placeholder="e.g. 10, 25" 
/>
        <p className="text-[8px] text-white/20 uppercase font-bold px-1">Separate dates with commas for multi-inflow tracking.</p>
      </div>

      {/* Manual Inflation Section */}
      <div className="space-y-4">
        <label className="text-[10px] font-black text-aura-subtle uppercase tracking-[0.2em] flex items-center gap-2">
          <Percent size={12} className="text-aura-accent"/> Manual Inflation Rate (%)
        </label>
        <input 
          type="number" 
          value={config.inflation_rate} 
          onChange={e => setConfig({...config, inflation_rate: e.target.value})} 
          className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl font-bold focus:border-aura-accent outline-none transition-all text-white" 
        />
      </div>

      {/* Income & Bills */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-4">
          <label className="text-[10px] font-black text-aura-subtle uppercase tracking-[0.2em]">Monthly Income</label>
          <input 
            type="text" 
            value={formatNumber(config.monthly_income)} 
            onChange={e => setConfig({...config, monthly_income: cleanNumber(e.target.value)})} 
            className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl font-bold text-white outline-none" 
          />
        </div>
        <div className="space-y-4">
          <label className="text-[10px] font-black text-aura-subtle uppercase tracking-[0.2em]">Fixed Bills</label>
          <input 
            type="text" 
            value={formatNumber(config.fixed_bills)} 
            onChange={e => setConfig({...config, fixed_bills: cleanNumber(e.target.value)})} 
            className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl font-bold text-white outline-none" 
          />
        </div>
      </div>
    </div>

    <div className="p-6 bg-aura-black/80 backdrop-blur-xl border-t border-white/5">
      <button onClick={handleSaveConfig} className="w-full bg-white text-black font-black p-6 rounded-[2rem] flex items-center justify-center gap-3 active:scale-95 transition-all">
        <Check size={20} strokeWidth={3} /> SAVE CONFIGURATION
      </button>
    </div>
  </motion.div>
)}
      </AnimatePresence>
    </div>
  );
}