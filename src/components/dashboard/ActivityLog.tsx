import { useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ReceiptText, 
  ArrowLeftRight, 
  ArrowUpRight, 
  ArrowDownRight, 
  Trash2, 
  X, 
  TrendingUp, 
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Calendar
} from 'lucide-react';
import { db } from '../../db/schema';
import type { Transaction } from '../../db/schema';

interface ActivityLogProps {
  config: any;
  transactions: Transaction[];
  timeFilter: 'day' | 'week' | 'month' | 'year' | 'all';
  setTimeFilter: (f: any) => void;
  setEditingTransaction: (t: any) => void;
  setIsModalOpen: (v: boolean) => void;
  syncTransactions: () => Promise<void>;
  syncAccounts: () => Promise<void>;
}

export default function ActivityLog({ 
  config, 
  transactions, 
  timeFilter, 
  setTimeFilter, 
  setEditingTransaction, 
  setIsModalOpen, 
  syncTransactions, 
  syncAccounts 
}: ActivityLogProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState(new Date());
  const longPressTimer = useRef<any>(null);

  const getWeekOfMonth = (date: Date) => {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfMonth = date.getDate();
    return Math.ceil((dayOfMonth + startOfMonth.getDay()) / 7);
  };

  const adjustDate = (amount: number) => {
    const newDate = new Date(targetDate);
    if (timeFilter === 'day') newDate.setDate(newDate.getDate() + amount);
    if (timeFilter === 'week') newDate.setDate(newDate.getDate() + (amount * 7));
    if (timeFilter === 'month') newDate.setMonth(newDate.getMonth() + amount);
    if (timeFilter === 'year') newDate.setFullYear(newDate.getFullYear() + amount);
    setTargetDate(newDate);
  };

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    
    const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return sorted.filter(t => {
      const d = new Date(t.date);
      if (timeFilter === 'all') return true;
      if (timeFilter === 'day') return d.toDateString() === targetDate.toDateString();
      if (timeFilter === 'week') {
        return d.getFullYear() === targetDate.getFullYear() &&
               d.getMonth() === targetDate.getMonth() &&
               getWeekOfMonth(d) === getWeekOfMonth(targetDate);
      }
      if (timeFilter === 'month') return d.getMonth() === targetDate.getMonth() && d.getFullYear() === targetDate.getFullYear();
      if (timeFilter === 'year') return d.getFullYear() === targetDate.getFullYear();
      return true;
    });
  }, [transactions, timeFilter, targetDate]);

  const totals = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      const isTransfer = t.type === 'transfer' || t.category === 'Transfer';
      if (isTransfer) return acc;
      if (t.amount > 0) { acc.income += t.amount; } 
      else { acc.expense += Math.abs(t.amount); }
      return acc;
    }, { income: 0, expense: 0 });
  }, [filteredTransactions]);

  const formatDateLabel = () => {
    if (timeFilter === 'all') return "All History";
    if (timeFilter === 'day') return targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (timeFilter === 'week') return `Week ${getWeekOfMonth(targetDate)}, ${targetDate.toLocaleDateString('en-US', { month: 'short' })}`;
    if (timeFilter === 'month') return targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return targetDate.getFullYear().toString();
  };

  const startPress = (id: string) => {
    longPressTimer.current = setTimeout(() => {
      if (window.navigator.vibrate) window.navigator.vibrate(50);
      setDeletingId(id);
    }, 600);
  };

  const endPress = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };

  const handleDelete = async (t: Transaction) => {
    try {
      await db.transaction('rw', [db.transactions, db.accounts], async () => {
        const acc = await db.accounts.get(t.account_id);
        if (acc) {
          await db.accounts.update(t.account_id, { balance: acc.balance - t.amount });
        }
        await db.transactions.delete(t.id);
      });
      setDeletingId(null);
      await syncTransactions();
      await syncAccounts();
    } catch (error) {
      console.error("Delete failed", error);
    }
  };

  return (
    <section className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] overflow-hidden flex flex-col">
      <div className="p-6 pb-4 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-[10px] font-black text-aura-subtle uppercase tracking-widest flex items-center gap-2">
            <ReceiptText size={14}/> Activity Log
          </h3>
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
            {(['day', 'week', 'month', 'year', 'all'] as const).map((f) => (
              <button 
                key={f} 
                onClick={() => setTimeFilter(f)} 
                className={`px-2 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${
                  timeFilter === f ? 'bg-white text-black' : 'text-aura-subtle'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* New Adjustable Date Picker for History */}
        {timeFilter !== 'all' && (
          <div className="flex items-center justify-between bg-white/5 border border-white/5 p-3 rounded-2xl">
            <button onClick={() => adjustDate(-1)} className="p-2 hover:bg-white/5 rounded-lg text-white transition-colors">
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-2">
              <Calendar size={12} className="text-aura-accent" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">{formatDateLabel()}</span>
            </div>
            <button onClick={() => adjustDate(1)} className="p-2 hover:bg-white/5 rounded-lg text-white transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 border border-white/5 p-3 rounded-2xl">
            <p className="text-[8px] font-black text-aura-subtle uppercase tracking-tighter mb-1 flex items-center gap-1">
              <TrendingUp size={10} className="text-[#00E676]"/> Period Income
            </p>
            <p className="text-sm font-black text-[#00E676] tabular-nums">
              <span className="text-[8px] opacity-60 mr-1">{config.base_currency}</span>
              {totals.income.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white/5 border border-white/5 p-3 rounded-2xl">
            <p className="text-[8px] font-black text-aura-subtle uppercase tracking-tighter mb-1 flex items-center gap-1">
              <TrendingDown size={10} className="text-[#ef4444]"/> Period Expense
            </p>
            <p className="text-sm font-black text-[#ef4444] tabular-nums">
              <span className="text-[8px] opacity-60 mr-1">{config.base_currency}</span>
              {totals.expense.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-6 overflow-y-auto max-h-[400px] no-scrollbar space-y-3">
        {filteredTransactions.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">No activities for this {timeFilter}</p>
          </div>
        ) : (
          filteredTransactions.map((t) => {
            const isTransfer = t.type === 'transfer' || t.category === 'Transfer';
            const isIncome = t.amount > 0 && !isTransfer;
            const isExpense = t.amount < 0 && !isTransfer;
            
            let iconStyle = isIncome 
              ? { backgroundColor: 'rgba(0, 230, 118, 0.15)', color: '#00E676' } 
              : isExpense 
                ? { backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' } 
                : { backgroundColor: 'rgba(255, 255, 255, 0.05)', color: "rgba(255,255,255,0.6)" };
            
            let amountStyle = isIncome ? { color: "#00E676" } : isExpense ? { color: "#ef4444" } : { color: "rgba(255,255,255,0.6)" };
            let Icon = isIncome ? ArrowUpRight : isExpense ? ArrowDownRight : ArrowLeftRight;

            return (
              <motion.div key={t.id} layout className="relative" onPointerDown={() => startPress(t.id)} onPointerUp={endPress} onPointerLeave={endPress}>
                <div onClick={() => !deletingId && (setEditingTransaction(t), setIsModalOpen(true))} className={`flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 transition-all duration-300 active:scale-[0.98] ${deletingId === t.id ? '-translate-x-20 opacity-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={iconStyle}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold leading-tight text-white">{t.category}</p>
                      {t.note && <p className="text-[10px] text-aura-accent/70 font-medium lowercase truncate max-w-[120px]">{t.note}</p>}
                      <p className="text-[10px] text-aura-subtle uppercase font-bold">
                        {new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black tabular-nums flex items-baseline justify-end" style={amountStyle}>
                      <span className="text-[10px] opacity-70 mr-1">{config.base_currency}</span>
                      {Math.abs(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    {t.synced === 0 && <span className="text-[8px] text-orange-400 font-bold uppercase opacity-50">Local Only</span>}
                  </div>
                </div>

                <AnimatePresence>
                  {deletingId === t.id && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="absolute right-0 top-0 bottom-0 flex gap-2">
                      <button onClick={() => handleDelete(t)} className="w-16 h-full bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform">
                        <Trash2 size={20}/>
                      </button>
                      <button onClick={() => setDeletingId(null)} className="w-12 h-full bg-white/10 rounded-2xl flex items-center justify-center text-white">
                        <X size={18}/>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>
    </section>
  );
}