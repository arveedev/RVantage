import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import type { Transaction, Account } from '../../db/schema'; 
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Zap, LogOut, Plus, Wallet, TrendingUp, PiggyBank, Landmark as BankIcon, Briefcase, ShoppingBag } from 'lucide-react';
import { useSync } from '../../hooks/useSync';
import { useToast } from '../../context/useToast';

// Sub-components
import AddTransaction from '../AddTransaction';
import CommandCenter from '../CommandCenter';
import Simulator from '../Simulator';
import AccountCard from './AccountCard';
import StatsGrid from './StatsGrid';
import ActivityLog from './ActivityLog';
import AccountLogicModal from './AccountLogicModal';

export default function Dashboard() {
  const { showToast } = useToast();
  const { refreshFromCloud, syncTransactions, syncSettings, syncAccounts } = useSync();
  
  const session = useLiveQuery(() => db.session.get('current'));
  const userId = session?.user_id;

  // Move Icons inside the component to prevent Vite HMR export errors
  const ACCOUNT_ICONS = [
    { name: 'Wallet', icon: Wallet },
    { name: 'Bank', icon: BankIcon },
    { name: 'Savings', icon: PiggyBank },
    { name: 'Work', icon: Briefcase },
    { name: 'Shopping', icon: ShoppingBag }
  ];

  const [activeTab, setActiveTab] = useState<'home' | 'simulator'>('home');
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month' | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isProcessingAccount, setIsProcessingAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Partial<Account> | null>(null);

  const [config, setConfig] = useState({
    base_currency: 'PHP',
    payday_schedule: '15, 30',
    inflation_rate: '3',
    monthly_income: '0',
    fixed_bills: '0',
    fixed_bills_list: '[]',
    deductions: '[]', 
    net_income: '0'   
  });

  const accounts = useLiveQuery(() => userId ? db.accounts.where('user_id').equals(userId).toArray() : [], [userId]);
  const rawTransactions = useLiveQuery(() => userId ? db.transactions.where('user_id').equals(userId).toArray() : [], [userId]);
  const settings = useLiveQuery(() => userId ? db.settings.where('user_id').equals(userId).toArray() : [], [userId]);

  useEffect(() => {
    if (userId) {
      const bootSequence = async () => {
        await syncTransactions();
        await syncSettings(); 
        await refreshFromCloud();
      };
      bootSequence();
    }
  }, [userId]);

  useEffect(() => {
    if (settings && settings.length > 0) {
      const getVal = (key: string, fallback: string) => {
        const found = settings.find(s => s.config_key === key);
        return found ? String(found.config_value) : fallback;
      };
      setConfig({
        base_currency: getVal('base_currency', 'PHP'),
        payday_schedule: getVal('payday_schedule', '15, 30'),
        inflation_rate: getVal('inflation_rate', '3'),
        monthly_income: getVal('monthly_income', '0'),
        fixed_bills: getVal('fixed_bills', '0'),
        fixed_bills_list: getVal('fixed_bills_list', '[]'),
        deductions: getVal('deductions', '[]'),
        net_income: getVal('net_income', '0')
      });
    }
  }, [settings]);

  const handleLogout = async () => {
    await db.session.delete('current');
    showToast("VAULT LOCKED", "success");
    window.location.reload();
  };

  const transactions = useMemo(() => {
    if (!rawTransactions) return [];
    return [...rawTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [rawTransactions]);

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
    if (nextPayday) { daysToInflow = nextPayday - todayDate; } 
    else if (paydays.length > 0) { daysToInflow = (lastDayOfMonth - todayDate) + paydays[0]; }
    return { total: totalBalance, safe: totalBalance - upcoming, daysToInflow: isNaN(daysToInflow) ? 0 : daysToInflow, variableSpendAverage };
  }, [accounts, transactions, config]);

  // Added guard to prevent rendering or booting while session is loading
  if (session === undefined || (session && !userId)) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#238636] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-aura-black pb-40 text-white selection:bg-aura-accent/30">
      <header className="sticky top-0 z-[60] bg-aura-black/80 backdrop-blur-xl border-b border-white/5 p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-aura-accent/10 border border-aura-accent/20 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(0,209,255,0.2)]">
            <Zap size={20} className="text-aura-accent" fill="currentColor" />
          </div>
          <div>
            <span className="font-black tracking-tighter uppercase text-sm block leading-none text-white">RVantage</span>
            <span className="text-[8px] font-bold text-aura-accent uppercase tracking-[0.2em]">Command v3.0</span>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 bg-white/5 rounded-full border border-white/10 active:scale-90 transition-all">
            <Settings size={20} className="text-aura-subtle" />
          </button>
          <button onClick={handleLogout} className="p-2.5 bg-red-500/10 rounded-full border border-red-500/20 active:scale-90 transition-all">
            <LogOut size={20} className="text-red-500" />
          </button>
        </div>
      </header>

      <main className="p-6 max-w-lg mx-auto relative z-[10]">
        <AnimatePresence mode="wait">
          {activeTab === 'home' ? (
            <motion.div key="home-view" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">
              <AccountCard 
                config={config} 
                financialIntel={financialIntel} 
                accounts={accounts || []} 
                showAccounts={showAccounts} 
                setShowAccounts={setShowAccounts} 
                setEditingAccount={setEditingAccount} 
                setIsAccountModalOpen={setIsAccountModalOpen} 
                accountIcons={ACCOUNT_ICONS}
              />
              <StatsGrid config={config} financialIntel={financialIntel} />
              <ActivityLog 
                config={config} 
                transactions={transactions} 
                timeFilter={timeFilter} 
                setTimeFilter={setTimeFilter} 
                setEditingTransaction={setEditingTransaction} 
                setIsModalOpen={setIsModalOpen} 
                syncTransactions={syncTransactions}
                syncAccounts={syncAccounts}
              />
            </motion.div>
          ) : (
            <Simulator 
              key="simulator-tab"
              config={config}
              financialIntel={financialIntel}
              transactions={transactions}
              baseCurrency={config.base_currency}
            />
          )}
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[#0a0a0a]/90 backdrop-blur-3xl border border-white/10 px-8 py-5 rounded-[3.5rem] flex gap-10 items-center shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100]">
        <button onClick={() => setActiveTab('home')} className={`relative flex items-center justify-center p-2 transition-all duration-500 ${activeTab === 'home' ? 'text-aura-accent scale-150' : 'text-white/20 hover:text-white/40'}`}>
          <Wallet size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
          {activeTab === 'home' && <motion.div layoutId="nav-glow" className="absolute -inset-4 bg-aura-accent/20 blur-2xl rounded-full" />}
        </button>
        <button onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }} className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-black active:scale-90 shadow-[0_10px_30px_rgba(255,255,255,0.2)] transition-all z-[110]">
          <Plus size={28} strokeWidth={3} />
        </button>
        <button onClick={() => setActiveTab('simulator')} className={`relative flex items-center justify-center p-2 transition-all duration-500 ${activeTab === 'simulator' ? 'text-aura-accent scale-150' : 'text-white/20 hover:text-white/40'}`}>
          <TrendingUp size={24} strokeWidth={activeTab === 'simulator' ? 2.5 : 2} />
          {activeTab === 'simulator' && <motion.div layoutId="nav-glow" className="absolute -inset-4 bg-aura-accent/20 blur-2xl rounded-full" />}
        </button>
      </nav>

      <AddTransaction isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingTransaction(null); }} editData={editingTransaction} />
      
      <AccountLogicModal 
        isOpen={isAccountModalOpen} 
        onClose={() => setIsAccountModalOpen(false)} 
        editingAccount={editingAccount} 
        setEditingAccount={setEditingAccount} 
        isProcessingAccount={isProcessingAccount} 
        setIsProcessingAccount={setIsProcessingAccount} 
        userId={userId} 
        syncAccounts={syncAccounts} 
        config={config}
        accountIcons={ACCOUNT_ICONS}
      />

      <AnimatePresence>
        {isSettingsOpen && <CommandCenter isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} config={config} setConfig={setConfig} />}
      </AnimatePresence>
    </div>
  );
}