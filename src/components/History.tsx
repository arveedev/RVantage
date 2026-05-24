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

  const transactions = useLiveQuery(() => 
    db.transactions.orderBy('date').reverse().filter(t => !t.is_deleted || t.is_deleted === 0).toArray()
  );

  const handleTouchStart = (id: string) => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      setActiveMenu(id);
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
        const existingTx = await db.transactions.get(t.id);
        if (!existingTx) return;

        // 1. Revert Source Account (Bank)
        const srcAcc = await db.accounts.get(existingTx.account_id);
        if (srcAcc) {
          await db.accounts.update(existingTx.account_id, {
            balance: srcAcc.balance - existingTx.amount
          });
        }

        // 2. Revert Target Account (Wallet)
        if (existingTx.type === 'transfer') {
          // Extract the target ID from the hidden separator in the category string
          const targetId = existingTx.category.includes('::') 
            ? existingTx.category.split('::')[1] 
            : existingTx.target_account_id;

          if (targetId) {
            const targetAcc = await db.accounts.get(targetId);
            if (targetAcc) {
              // The transfer ADDED to the wallet. To revert, we SUBTRACT the absolute amount.
              await db.accounts.update(targetId, {
                balance: targetAcc.balance - Math.abs(existingTx.amount)
              });
            }
          }
        }
        
        // 3. TRUE DELETE. No more tombstones. 
        await db.transactions.delete(t.id);
      });
      
      setActiveMenu(null);
      syncTransactions(); // Force push the current accurate state
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
            className="bg-white/5 border border-white/5 p-5 rounded-[1.5rem] flex justify-between items-center relative overflow-hidden select-none cursor-pointer"
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
            <div className="flex items-center gap-4 relative z-10 pointer-events-none select-none">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                t.type === 'income' ? 'bg-aura-accent/20 text-aura-accent' : 'bg-red-500/20 text-red-400'
              }`}>
                {t.type === 'income' ? <ArrowUpRight size={18}/> : <ArrowDownLeft size={18}/>}
              </div>
              <div>
                {/* Clean UI: Strip the hidden target ID out so it just says "Transfer" */}
                <p className="font-bold text-sm text-white select-none">
                  {t.category.split('::')[0]}
                </p>
                <p className="text-[10px] text-aura-subtle font-medium uppercase tracking-tighter select-none">
                  {new Date(t.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} 
                  {t.note ? ` • ${t.note}` : ''}
                </p>
              </div>
            </div>
            
            <div className="text-right relative z-10 pointer-events-none select-none">
              <p className={`font-black tabular-nums select-none ${t.type === 'income' ? 'text-aura-accent' : 'text-white'}`}>
                {t.type === 'income' ? '+' : ''}{t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              {t.synced === 0 && (
                <div className="flex items-center justify-end gap-1 mt-1">
                  <div className="w-1 h-1 bg-yellow-500 rounded-full animate-pulse" />
                  <span className="text-[8px] font-black text-yellow-500 uppercase">Syncing</span>
                </div>
              )}
            </div>

            <AnimatePresence>
              {activeMenu === t.id && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/90 backdrop-blur-sm z-20 flex items-center justify-center gap-6"
                >
                  <button onClick={(e) => { e.stopPropagation(); handleEdit(t); }} className="flex flex-col items-center gap-1 text-aura-accent active:scale-90 transition-transform">
                    <div className="p-3 bg-aura-accent/20 rounded-full"><Edit2 size={16} /></div>
                    <span className="text-[8px] font-black uppercase tracking-widest">Edit</span>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(t); }} className="flex flex-col items-center gap-1 text-red-500 active:scale-90 transition-transform">
                    <div className="p-3 bg-red-500/20 rounded-full"><Trash2 size={16} /></div>
                    <span className="text-[8px] font-black uppercase tracking-widest">Delete</span>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setActiveMenu(null); }} className="absolute top-2 right-2 p-2 text-white/40 active:scale-90">
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