import { useEffect, useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema'; 
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, ArrowDownLeft, Clock, Edit2, Trash2 } from 'lucide-react';
import { useSync } from '../hooks/useSync';

interface HistoryProps {
  setEditingTransaction?: (t: any) => void;
  setIsModalOpen?: (v: boolean) => void;
}

export default function History({ setEditingTransaction, setIsModalOpen }: HistoryProps = {}) {
  const { refreshFromCloud, syncTransactions } = useSync();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    refreshFromCloud();
  }, []);

  // Soft Delete Filter: Only show active transactions (is_deleted === 0)
  const transactions = useLiveQuery(() => 
    db.transactions.orderBy('date').reverse().filter(t => t.is_deleted === 0).toArray()
  );

  const handleTouchStart = (id: string) => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      setActiveMenu(id);
      // Haptic feedback if supported by browser
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const handleEdit = (t: any) => {
    setActiveMenu(null);
    if (setEditingTransaction && setIsModalOpen) {
      setEditingTransaction(t);
      setIsModalOpen(true);
    }
  };

  const handleDelete = async (t: any) => {
    if(!confirm("Are you sure you want to delete this transaction?")) return;
    
    try {
      await db.transaction('rw', [db.transactions, db.accounts], async () => {
        
        // 1. Revert Source Account Balance
        const acc = await db.accounts.get(t.account_id);
        if (acc) {
          // Mathematically perfect reversal: subtracting the original amount.
          // Expense (-500) -> balance - (-500) = balance + 500
          // Income (+500) -> balance - (+500) = balance - 500
          await db.accounts.update(t.account_id, {
            balance: acc.balance - t.amount
          });
        }

        // 2. Revert Target Account Balance (If it was a transfer)
        if (t.type === 'transfer' && t.category.startsWith('Transfer_To_')) {
          const targetId = t.category.replace('Transfer_To_', '');
          const targetAcc = await db.accounts.get(targetId);
          if (targetAcc) {
            // A transfer added Math.abs(t.amount) to the target. Subtract it to reverse.
            await db.accounts.update(targetId, {
              balance: targetAcc.balance - Math.abs(t.amount)
            });
          }
        }
        
        // 3. Soft Delete (Tombstone) the record
        await db.transactions.update(t.id, { is_deleted: 1, synced: 0 });
      });
      
      setActiveMenu(null);
      syncTransactions(); // Trigger cloud deletion process safely
    } catch(e) {
      console.error("Deletion failed:", e);
    }
  };

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
            // Strict selection blockers for iOS/Android touch
            className="bg-white/5 border border-white/5 p-5 rounded-[1.5rem] flex justify-between items-center relative overflow-hidden"
            style={{ 
              WebkitTouchCallout: 'none', 
              WebkitUserSelect: 'none', 
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent'
            }}
            onContextMenu={(e) => e.preventDefault()}
            onTouchStart={() => handleTouchStart(t.id)}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchEnd} 
            onMouseDown={() => handleTouchStart(t.id)}
            onMouseUp={handleTouchEnd}
            onMouseLeave={handleTouchEnd}
          >
            <div className="flex items-center gap-4 relative z-10 pointer-events-none">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                t.type === 'income' ? 'bg-aura-accent/20 text-aura-accent' : 'bg-red-500/20 text-red-400'
              }`}>
                {t.type === 'income' ? <ArrowUpRight size={18}/> : <ArrowDownLeft size={18}/>}
              </div>
              <div>
                <p className="font-bold text-sm text-white">
                  {t.category.startsWith('Transfer_To_') ? 'Transfer' : t.category}
                </p>
                <p className="text-[10px] text-aura-subtle font-medium uppercase tracking-tighter">
                  {new Date(t.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} • {t.note || 'No description'}
                </p>
              </div>
            </div>
            
            <div className="text-right relative z-10 pointer-events-none">
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

            {/* Long Press Menu Overlay */}
            <AnimatePresence>
              {activeMenu === t.id && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/90 backdrop-blur-sm z-20 flex items-center justify-center gap-6"
                >
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleEdit(t); }} 
                    className="flex flex-col items-center gap-1 text-aura-accent active:scale-90 transition-transform"
                  >
                    <div className="p-3 bg-aura-accent/20 rounded-full"><Edit2 size={16} /></div>
                    <span className="text-[8px] font-black uppercase tracking-widest">Edit</span>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(t); }} 
                    className="flex flex-col items-center gap-1 text-red-500 active:scale-90 transition-transform"
                  >
                    <div className="p-3 bg-red-500/20 rounded-full"><Trash2 size={16} /></div>
                    <span className="text-[8px] font-black uppercase tracking-widest">Delete</span>
                  </button>
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); setActiveMenu(null); }}
                    className="absolute top-2 right-2 p-2 text-white/40 active:scale-90"
                  >
                    <span className="text-[8px] font-black uppercase">Cancel</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        ))}
      </div>
    </div>
  );
}