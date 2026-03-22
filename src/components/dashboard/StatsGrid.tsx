import { ShieldCheck, Zap } from 'lucide-react';

export default function StatsGrid({ config, financialIntel }: { config: any, financialIntel: any }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 relative overflow-hidden">
        <div className="absolute -right-1 -bottom-1 text-aura-accent opacity-20"><ShieldCheck size={48} /></div>
        <span className="text-[10px] font-black text-aura-accent uppercase tracking-widest block mb-2 relative z-10">Safe-to-Spend</span>
        <p className="text-2xl font-black tabular-nums relative z-10 flex items-baseline text-white">
          <span className="text-xs opacity-70 mr-1">{config.base_currency}</span>
          {financialIntel.safe.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
      </div>
      <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 relative overflow-hidden">
        <div className="absolute -right-1 -bottom-1 text-yellow-500 opacity-20"><Zap size={48} /></div>
        <span className="text-[10px] font-black text-aura-subtle uppercase tracking-widest block mb-2 relative z-10">Inflow In</span>
        <p className="text-2xl font-black tabular-nums relative z-10 text-white">{financialIntel.daysToInflow} <span className="text-xs text-aura-subtle uppercase font-bold">Days</span></p>
      </div>
    </div>
  );
}