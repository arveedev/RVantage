import { useState, useEffect, useMemo } from 'react';
import { db } from '../db/schema';
import type { Transaction } from '../db/schema'; 
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useSync } from '../hooks/useSync';
import { useToast } from '../context/ToastContext';

interface Props { 
  isOpen: boolean; 
  onClose: () => void; 
  editData?: Transaction | null; 
}

export default function AddTransaction({ isOpen, onClose, editData }: Props) {
  const { syncTransactions } = useSync();
  const { showToast } = useToast();
  
  const [displayAmount, setDisplayAmount] = useState(""); 
  const [rawAmount, setRawAmount] = useState("");         
  const [category, setCategory] = useState("");
  const [type, setType] = useState<'expense' | 'income'>('expense');

  useEffect(() => {
    if (editData && isOpen) {
      const absAmount = Math.abs(editData.amount);
      setRawAmount(absAmount.toString());
      setDisplayAmount(absAmount.toLocaleString('en-US'));
      setCategory(editData.category);
      setType(editData.amount < 0 ? 'expense' : 'income');
    } else if (isOpen) {
      setDisplayAmount(""); 
      setRawAmount(""); 
      setCategory(""); 
      setType('expense');
    }
  }, [editData, isOpen]);

  const transactions = useLiveQuery(() => db.transactions.toArray());
  
  const suggestedCategories = useMemo(() => {
    const defaults = ['Food', 'Salary', 'Transport', 'Bills', 'Gym'];
    if (!transactions) return defaults;
    const unique = Array.from(new Set(transactions.map(t => t.category)));
    return Array.from(new Set([...unique, ...defaults])).slice(0, 5);
  }, [transactions]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/,/g, ''); 
    if (!isNaN(Number(value)) || value === "") {
      setRawAmount(value);
      const formatted = value === "" ? "" : Number(value).toLocaleString('en-US');
      setDisplayAmount(formatted);
    }
  };

  const handleSave = async () => {
    const numAmount = parseFloat(rawAmount);
    
    if (!numAmount || numAmount <= 0) {
      showToast("Enter valid amount", "error");
      return;
    }
    if (!category.trim()) {
      showToast("Pick a category", "error");
      return;
    }
    
    const finalAmount = type === 'expense' ? -Math.abs(numAmount) : Math.abs(numAmount);

    try {
      await db.transaction('rw', [db.transactions, db.accounts], async () => {
        const account = await db.accounts.get('ACC-001');

        if (editData) {
          await db.transactions.update(editData.id, {
            amount: finalAmount,
            category: category.trim(),
            type,
            synced: 0 
          });

          if (account) {
            await db.accounts.update('ACC-001', {
              balance: account.balance - editData.amount + finalAmount
            });
          }
        } else {
          const id = crypto.randomUUID();
          await db.transactions.add({
            id,
            date: new Date(),
            amount: finalAmount,
            category: category.trim(),
            note: "",
            type,
            account_id: 'ACC-001',
            synced: 0,
            is_shared: false,
            is_installment: false
          });

          if (account) {
            await db.accounts.update('ACC-001', {
              balance: account.balance + finalAmount
            });
          }
        }
      });

      showToast(editData ? "RECORD UPDATED" : `${type.toUpperCase()} RECORDED`, "success");
      
      setTimeout(() => {
        onClose();
        syncTransactions();
      }, 500);

    } catch (e) { 
      showToast("Database Error", "error");
    }
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
            className="relative w-full max-w-md bg-aura-card border border-white/10 rounded-[2.5rem] p-8 pb-12 shadow-2xl overflow-hidden"
          >
            <div className="flex justify-between items-center mb-6 text-white">
              <h2 className="text-xl font-black uppercase tracking-widest leading-none">
                {editData ? 'Edit Entry' : 'New Entry'}
              </h2>
              <button onClick={onClose} className="p-2 bg-white/5 rounded-full">
                <X size={20}/>
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5 relative z-10">
                <button 
                  type="button"
                  onClick={() => setType('expense')} 
                  className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-[10px] font-black uppercase transition-all duration-200 ${
                    type === 'expense' ? 'bg-red-500 text-white shadow-lg' : 'text-white/40'
                  }`}
                >
                  <ArrowDownRight size={14} /> Expense
                </button>
                <button 
                  type="button"
                  onClick={() => setType('income')} 
                  className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-[10px] font-black uppercase transition-all duration-200 ${
                    type === 'income' ? 'bg-[#00d1ff] text-[#000000] shadow-lg' : 'text-white/40'
                  }`}
                >
                  <ArrowUpRight size={14} /> Income
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-aura-subtle uppercase ml-1">Amount</label>
                <input 
                  type="text" 
                  inputMode="decimal" 
                  value={displayAmount} 
                  onChange={handleAmountChange} 
                  placeholder="0.00" 
                  autoFocus
                  className="w-full bg-transparent text-5xl font-black outline-none border-b border-white/10 pb-4 text-white tabular-nums placeholder:text-white/10" 
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-aura-subtle uppercase ml-1">Quick Select</label>
                <div className="flex flex-wrap gap-2">
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

              <button 
                onClick={handleSave} 
                className="w-full bg-white text-black py-5 rounded-[2rem] font-black uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-transform shadow-xl hover:bg-[#00d1ff]"
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