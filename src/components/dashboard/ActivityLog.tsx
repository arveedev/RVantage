import { useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReceiptText, ArrowLeftRight, ArrowUpRight, ArrowDownRight, Trash2, X } from 'lucide-react';
import { db } from '../../db/schema';
import type { Transaction } from '../../db/schema';

interface ActivityLogProps {
  config: any;
  transactions: Transaction[];
  timeFilter: string;
  setTimeFilter: (f: any) => void;
  setEditingTransaction: (t: any) => void;
  setIsModalOpen: (v: boolean) => void;
  syncTransactions: () => Promise<void>;
  syncAccounts: () => Promise<void>;
}

export default function ActivityLog({ config, transactions, timeFilter, setTimeFilter, setEditingTransaction, setIsModalOpen, syncTransactions, syncAccounts }: ActivityLogProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const longPressTimer = useRef<any>(null);

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
      if (acc) {
        await db.accounts.update(t.account_id, { balance: acc.balance - t.amount });
      }
    });
    setDeletingId(null);
    await syncTransactions();
    await syncAccounts();
  };

  return (
    <section className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] overflow-hidden flex flex-col">
      <div className="p-6 pb-4 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-[10px] font-black text-aura-subtle uppercase tracking-widest flex items-center gap-2"><ReceiptText size={14}/> Activity Log</h3>
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
            {(['day', 'week', 'month', 'all'] as const).map((f) => (
              <button key={f} onClick={() => setTimeFilter(f)} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${timeFilter === f ? 'bg-white text-black' : 'text-aura-subtle'}`}>{f}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pb-6 overflow-y-auto max-h-[400px] no-scrollbar space-y-3">
        {filteredTransactions.map((t) => {
          const isTransfer = t.type === 'transfer' || t.category === 'Transfer';
          const isIncome = t.amount > 0 && !isTransfer;
          const isExpense = t.amount < 0 && !isTransfer;
          let iconStyle = isIncome ? { backgroundColor: 'rgba(0, 230, 118, 0.15)', color: '#00E676' } : isExpense ? { backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' } : { color: "rgba(255,255,255,0.6)" };
          let amountStyle = isIncome ? { color: "#00E676" } : isExpense ? { color: "#ef4444" } : { color: "rgba(255,255,255,0.6)" };
          let Icon = isIncome ? ArrowUpRight : isExpense ? ArrowDownRight : ArrowLeftRight;

          return (
            <motion.div key={t.id} layout className="relative" onPointerDown={() => startPress(t.id)} onPointerUp={endPress} onPointerLeave={endPress}>
              <div onClick={() => !deletingId && (setEditingTransaction(t), setIsModalOpen(true))} className={`flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 transition-all duration-300 ${deletingId === t.id ? '-translate-x-20 opacity-50' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={iconStyle}><Icon size={18} /></div>
                  <div>
                    <p className="text-sm font-bold leading-tight text-white">{t.category}</p>
                    {isTransfer && t.note && <p className="text-[10px] text-aura-accent/70 font-medium lowercase">{t.note}</p>}
                    <p className="text-[10px] text-aura-subtle uppercase font-bold">{new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                  </div>
                </div>
                <p className="font-black tabular-nums flex items-baseline" style={amountStyle}>
                  <span className="text-[10px] opacity-70 mr-1">{config.base_currency}</span>
                  {Math.abs(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
          );
        })}
      </div>
    </section>
  );
}