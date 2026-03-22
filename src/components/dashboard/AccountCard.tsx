import { motion, AnimatePresence } from 'framer-motion';
import { Wallet } from 'lucide-react';
import type { Account } from '../../db/schema';

interface AccountCardProps {
  config: any;
  financialIntel: any;
  accounts: Account[];
  showAccounts: boolean;
  setShowAccounts: (v: boolean) => void;
  setEditingAccount: (a: any) => void;
  setIsAccountModalOpen: (v: boolean) => void;
  accountIcons: { name: string; icon: any }[];
}

export default function AccountCard({ config, financialIntel, accounts, showAccounts, setShowAccounts, setEditingAccount, setIsAccountModalOpen, accountIcons }: AccountCardProps) {
  return (
    <>
      <div 
        onClick={() => setShowAccounts(!showAccounts)}
        className="bg-aura-card p-8 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden active:scale-[0.98] transition-all cursor-pointer"
      >
        <div className="absolute top-0 right-0 p-6 opacity-10"><Wallet size={48} /></div>
        <span className="text-aura-subtle font-black uppercase tracking-[0.2em] text-[10px]">Total Liquidity</span>
        <h1 className="text-5xl font-black tracking-tighter mt-2 tabular-nums flex items-baseline text-white">
          <span className="text-aura-accent text-xl font-bold opacity-70 mr-2">{config.base_currency}</span>
          {financialIntel.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </h1>
      </div>

      <AnimatePresence>
        {showAccounts && (
          <motion.section initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex flex-col gap-4 overflow-hidden">
            <div className="flex justify-between items-center px-2">
              <span className="text-[10px] font-black text-aura-subtle uppercase tracking-widest">Active Accounts</span>
              <button onClick={(e) => { e.stopPropagation(); setEditingAccount({ include_in_glance: true, is_shared: false, icon_marker: 'Wallet', icon_color: '#00d1ff' }); setIsAccountModalOpen(true); }} className="text-aura-accent text-[10px] font-black uppercase">+ Add Account</button>
            </div>
            <div className="overflow-x-auto flex gap-4 no-scrollbar pb-2 -mx-2 px-2">
              {accounts?.map((acc) => {
                const IconComponent = accountIcons.find(i => i.name === acc.icon_marker)?.icon || Wallet;
                const customColor = acc.icon_color || '#00d1ff';
                return (
                  <div key={acc.id} onClick={(e) => { e.stopPropagation(); setEditingAccount(acc); setIsAccountModalOpen(true); }} className="min-w-[160px] bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col gap-2 active:scale-95 transition-all" style={{ borderLeft: `4px solid ${customColor}` }}>
                    <div className="flex justify-between items-center text-aura-subtle">
                      <IconComponent size={14} style={{ color: customColor }} />
                      <span className="text-[9px] font-black uppercase tracking-tighter">{acc.is_shared ? 'Shared' : 'Private'}</span>
                    </div>
                    <p className="text-[10px] font-bold text-aura-subtle truncate">{acc.name}</p>
                    <p className="text-sm font-black tabular-nums flex items-baseline text-white">
                      <span className="text-[10px] opacity-70 mr-1">{config.base_currency}</span> 
                      {acc.balance.toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}