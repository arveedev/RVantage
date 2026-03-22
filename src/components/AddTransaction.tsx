import { useState, useEffect, useMemo } from 'react';
import { db } from '../db/schema';
import type { Transaction } from '../db/schema'; 
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ArrowUpRight, ArrowDownRight, ArrowLeftRight, Wallet, Landmark as BankIcon, PiggyBank, Briefcase, ShoppingBag, Calendar } from 'lucide-react';
import { useSync } from '../hooks/useSync';
import { useToast } from '../context/useToast';
import { useAuth } from '../hooks/useAuth';

interface Props { 
  isOpen: boolean; 
  onClose: () => void; 
  editData?: Transaction | null; 
}

const ACCOUNT_ICONS = [
  { name: 'Wallet', icon: Wallet },
  { name: 'Bank', icon: BankIcon },
  { name: 'Savings', icon: PiggyBank },
  { name: 'Work', icon: Briefcase },
  { name: 'Shopping', icon: ShoppingBag }
];

export default function AddTransaction({ isOpen, onClose, editData }: Props) {
  const { user } = useAuth(); 
  const { syncTransactions, syncAccounts } = useSync();
  const { showToast } = useToast();
  
  const [displayAmount, setDisplayAmount] = useState(""); 
  const [rawAmount, setRawAmount] = useState("");            
  const [category, setCategory] = useState("");
  const [type, setType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [targetAccountId, setTargetAccountId] = useState<string>("");
  const [transactionDate, setTransactionDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const accounts = useLiveQuery(
    () => db.accounts.where('user_id').equals(user?.id || '').toArray(),
    [user?.id]
  );
  
  const transactions = useLiveQuery(
    () => db.transactions.where('user_id').equals(user?.id || '').toArray(),
    [user?.id]
  );

  const selectedAccount = useMemo(() => 
    accounts?.find(a => a.id === selectedAccountId), 
    [accounts, selectedAccountId]
  );

  const targetAccount = useMemo(() => 
    accounts?.find(a => a.id === targetAccountId), 
    [accounts, targetAccountId]
  );

  useEffect(() => {
    if (editData && isOpen) {
      const absAmount = Math.abs(editData.amount);
      setRawAmount(absAmount.toString());
      setDisplayAmount(absAmount.toString()); 
      setCategory(editData.category);
      setTransactionDate(new Date(editData.date).toISOString().split('T')[0]);
      if (editData.category === 'Transfer' || editData.type === 'transfer') {
        setType('transfer');
      } else {
        setType(editData.amount < 0 ? 'expense' : 'income');
      }
      setSelectedAccountId(editData.account_id);
    } else if (isOpen) {
      setDisplayAmount(""); 
      setRawAmount(""); 
      setCategory(""); 
      setType('expense');
      setTransactionDate(new Date().toISOString().split('T')[0]);
      if (accounts && accounts.length > 0) {
        setSelectedAccountId(accounts[0].id);
        if (accounts.length > 1) setTargetAccountId(accounts[1].id);
      }
    }
  }, [editData, isOpen, accounts]);
  
  const suggestedCategories = useMemo(() => {
    const defaultExpense = ['Food', 'Transport', 'Bills', 'Gym', 'Groceries', 'Health', 'Subscription', 'Entertainment'];
    const defaultIncome = ['Salary', 'Freelance', 'Investment', 'Gift', 'Business', 'Refund'];
    
    if (!transactions) return type === 'income' ? defaultIncome : defaultExpense;

    const counts: Record<string, number> = {};
    transactions
      .filter(t => t.type === type && t.category !== 'Transfer')
      .forEach(t => {
        counts[t.category] = (counts[t.category] || 0) + 1;
      });

    const userCategories = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const defaults = type === 'income' ? defaultIncome : defaultExpense;
    
    return Array.from(new Set([...userCategories, ...defaults])).slice(0, 12);
  }, [transactions, type]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/,/g, '');
    if (/^\d*\.?\d*$/.test(val)) {
      setRawAmount(val);
      setDisplayAmount(val);
    }
  };

  const handleSave = async () => {
    if (!user?.id) {
      showToast("Authentication required", "error");
      return;
    }

    const numAmount = parseFloat(rawAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast("Enter valid amount", "error");
      return;
    }

    if (!selectedAccountId) {
      showToast("Select a source account", "error");
      return;
    }

    if (type === 'transfer') {
      if (!targetAccountId) {
        showToast("Select a target account", "error");
        return;
      }
      if (selectedAccountId === targetAccountId) {
        showToast("Source and Target must differ", "error");
        return;
      }
    } else {
      if (!category.trim()) {
        showToast("Please select or enter a category", "error");
        return;
      }
    }
    
    const finalAmount = type === 'expense' ? -Math.abs(numAmount) : Math.abs(numAmount);
    const finalDate = new Date(transactionDate);
    const now = new Date();
    if (finalDate.toDateString() === now.toDateString()) {
      finalDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    }

    try {
      await db.transaction('rw', [db.transactions, db.accounts], async () => {
        if (type === 'transfer') {
          const fromAcc = await db.accounts.get(selectedAccountId);
          const toAcc = await db.accounts.get(targetAccountId);

          if (fromAcc && toAcc) {
            await db.accounts.update(selectedAccountId, { balance: fromAcc.balance - numAmount });
            await db.accounts.update(targetAccountId, { balance: toAcc.balance + numAmount });

            await db.transactions.add({
              id: crypto.randomUUID(),
              user_id: user.id,
              date: finalDate,
              amount: -numAmount, 
              category: 'Transfer', 
              note: `${fromAcc.name} → ${toAcc.name}`,
              type: 'transfer',
              account_id: selectedAccountId,
              synced: 0,
              is_shared: false,
              is_installment: false
            });
          }
        } else {
          const account = await db.accounts.get(selectedAccountId);

          if (editData) {
            if (editData.account_id !== selectedAccountId) {
              const oldAccount = await db.accounts.get(editData.account_id);
              if (oldAccount) {
                  await db.accounts.update(editData.account_id, { balance: oldAccount.balance - editData.amount });
              }
              if (account) {
                  await db.accounts.update(selectedAccountId, { balance: account.balance + finalAmount });
              }
            } else if (account) {
              await db.accounts.update(selectedAccountId, {
                balance: account.balance - editData.amount + finalAmount
              });
            }

            await db.transactions.update(editData.id, {
              amount: finalAmount,
              category: category.trim(),
              type: type as any,
              account_id: selectedAccountId,
              user_id: user.id,
              date: finalDate,
              synced: 0 
            });
          } else {
            await db.transactions.add({
              id: crypto.randomUUID(),
              user_id: user.id,
              date: finalDate,
              amount: finalAmount,
              category: category.trim(),
              note: "",
              type: type as any,
              account_id: selectedAccountId,
              synced: 0,
              is_shared: false,
              is_installment: false
            });

            if (account) {
              await db.accounts.update(selectedAccountId, {
                balance: account.balance + finalAmount
              });
            }
          }
        }
      });

      showToast(editData ? "RECORD UPDATED" : "RECORDED", "success");
      
      setTimeout(() => {
        onClose();
        syncTransactions();
        syncAccounts();
      }, 500);

    } catch (e) { 
      showToast("Database Error", "error");
    }
  };

  const formatWithCommas = (val: string) => {
    if (!val) return "";
    const parts = val.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join('.');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose} 
            className="absolute inset-0 bg-black/90 backdrop-blur-xl" 
          />
          
          <motion.div 
            initial={{ y: "100%" }} 
            animate={{ y: 0 }} 
            exit={{ y: "100%" }} 
            className="relative w-full max-w-md bg-aura-card border border-white/10 rounded-[2.5rem] p-6 sm:p-8 pb-10 shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar"
          >
            <div className="flex justify-between items-center mb-6 text-white sticky top-0 bg-aura-card z-20 pb-2">
              <h2 className="text-xl font-black uppercase tracking-widest leading-none">
                {editData ? 'Edit Entry' : 'New Entry'}
              </h2>
              <button 
                onClick={onClose} 
                className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                aria-label="Close"
              >
                <X size={20}/>
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5 relative z-10">
                <button 
                  type="button"
                  onClick={() => { setType('expense'); setCategory(""); }} 
                  className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-[10px] font-black uppercase transition-all duration-200 ${
                    type === 'expense' ? 'bg-red-500 text-white shadow-lg' : 'text-white/40'
                  }`}
                >
                  <ArrowDownRight size={14} /> Expense
                </button>
                <button 
                  type="button"
                  onClick={() => { setType('income'); setCategory(""); }} 
                  className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-[10px] font-black uppercase transition-all duration-200 ${
                    type === 'income' ? 'bg-[#00E676] text-black shadow-lg' : 'text-white/40'
                  }`}
                >
                  <ArrowUpRight size={14} /> Income
                </button>
                <button 
                  type="button"
                  onClick={() => setType('transfer')} 
                  className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-[10px] font-black uppercase transition-all duration-200 ${
                    type === 'transfer' ? 'bg-white text-black shadow-lg' : 'text-white/40'
                  }`}
                >
                  <ArrowLeftRight size={14} /> Transfer
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-aura-subtle uppercase ml-1">Transaction Date</label>
                   <div className="relative group">
                      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-aura-accent">
                        <Calendar size={18} />
                      </div>
                      <input 
                        type="date" 
                        value={transactionDate}
                        onChange={(e) => setTransactionDate(e.target.value)}
                        onClick={(e) => (e.target as any).showPicker?.()}
                        className="w-full bg-white/5 border border-white/10 pl-12 p-4 rounded-2xl font-bold text-sm text-white focus:border-aura-accent focus:outline-none transition-colors block appearance-none color-scheme-dark"
                        style={{ colorScheme: 'dark' }}
                      />
                   </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-aura-subtle uppercase ml-1">Amount</label>
                  <input 
                    type="text" 
                    inputMode="decimal" 
                    value={formatWithCommas(displayAmount)} 
                    onChange={handleAmountChange} 
                    placeholder="0.00" 
                    className="w-full bg-transparent text-4xl font-black outline-none border-b border-white/10 pb-2 text-white tabular-nums placeholder:text-white/10" 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black text-aura-subtle uppercase">
                    {type === 'transfer' ? 'From Account' : 'Source Account'}
                  </label>
                  {selectedAccount && (
                    <span className="text-[10px] font-bold text-white/40">
                      BAL: {selectedAccount.balance.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                  {accounts?.map((acc) => {
                    const IconComponent = ACCOUNT_ICONS.find(i => i.name === acc.icon_marker)?.icon || Wallet;
                    const isActive = selectedAccountId === acc.id;
                    const iconColor = acc.icon_color || '#00d1ff';
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setSelectedAccountId(acc.id)}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl border whitespace-nowrap transition-all ${
                          isActive 
                            ? 'bg-white/10 border-white text-white' 
                            : 'bg-white/5 border-white/10 text-white/40'
                        }`}
                        style={isActive ? { borderColor: iconColor, color: iconColor } : {}}
                      >
                        <IconComponent size={14} style={{ color: isActive ? iconColor : 'inherit' }} />
                        <span className="text-[10px] font-black uppercase">{acc.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {type === 'transfer' && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-aura-subtle uppercase">To Account</label>
                    {targetAccount && (
                      <span className="text-[10px] font-bold text-white/40">
                        BAL: {targetAccount.balance.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                    {accounts?.filter(a => a.id !== selectedAccountId).map((acc) => {
                      const IconComponent = ACCOUNT_ICONS.find(i => i.name === acc.icon_marker)?.icon || Wallet;
                      const isActive = targetAccountId === acc.id;
                      const iconColor = acc.icon_color || '#00d1ff';
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => setTargetAccountId(acc.id)}
                          className={`flex items-center gap-2 px-4 py-3 rounded-xl border whitespace-nowrap transition-all ${
                            isActive 
                              ? 'bg-white/10 border-white text-white' 
                              : 'bg-white/5 border-white/10 text-white/40'
                          }`}
                          style={isActive ? { borderColor: iconColor, color: iconColor } : {}}
                        >
                          <IconComponent size={14} style={{ color: isActive ? iconColor : 'inherit' }} />
                          <span className="text-[10px] font-black uppercase">{acc.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {type !== 'transfer' && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-aura-subtle uppercase ml-1">Quick Select Category</label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto no-scrollbar p-1">
                    {suggestedCategories.map(cat => (
                      <button 
                        key={cat} 
                        type="button" 
                        onClick={() => setCategory(cat)}
                        className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase transition-all border ${
                          category === cat ? 'bg-white text-black border-white shadow-lg' : 'bg-white/5 text-white/40 border-white/10'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <input 
                    type="text" 
                    value={category} 
                    onChange={(e) => setCategory(e.target.value)} 
                    placeholder="Enter Category" 
                    className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl font-bold text-sm text-white focus:border-aura-accent focus:outline-none transition-colors" 
                  />
                </div>
              )}

              <button 
                onClick={handleSave} 
                className="w-full bg-white text-black py-5 rounded-[2rem] font-black uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-transform shadow-xl hover:bg-aura-accent"
              >
                <Check size={20} strokeWidth={3}/> {editData ? 'Update Record' : 'Confirm Entry'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}