import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownLeft, Calendar, Clock } from 'lucide-react';

export default function History() {
  const transactions = useLiveQuery(() => 
    db.transactions.orderBy('date').reverse().toArray()
  );

  if (!transactions || transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-aura-subtle opacity-40">
        <Clock size={48} strokeWidth={1} className="mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em]">No Activity Yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      <h3 className="text-[10px] font-black text-aura-subtle uppercase tracking-[0.2em] px-1">Transaction History</h3>
      
      <div className="space-y-3">
        {transactions.map((t) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={t.id}
            className="bg-white/5 border border-white/5 p-5 rounded-[1.5rem] flex justify-between items-center"
          >
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                t.type === 'income' ? 'bg-aura-accent/20 text-aura-accent' : 'bg-red-500/20 text-red-400'
              }`}>
                {t.type === 'income' ? <ArrowUpRight size={18}/> : <ArrowDownLeft size={18}/>}
              </div>
              <div>
                <p className="font-bold text-sm text-white">{t.category}</p>
                <p className="text-[10px] text-aura-subtle font-medium uppercase tracking-tighter">
                  {new Date(t.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} • {t.note || 'No description'}
                </p>
              </div>
            </div>
            
            <div className="text-right">
              <p className={`font-black tabular-nums ${t.type === 'income' ? 'text-aura-accent' : 'text-white'}`}>
                {t.type === 'income' ? '+' : ''}{t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              {t.synced === 0 && (
                <div className="flex items-center justify-end gap-1 mt-1">
                  <div className="w-1 h-1 bg-yellow-500 rounded-full animate-pulse" />
                  <span className="text-[8px] font-black text-yellow-500 uppercase">Syncing</span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}