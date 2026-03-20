import { useState, useMemo } from 'react';
import { calculateGhostForecast } from '../utils/forecaster';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, AlertCircle, CheckCircle2, ReceiptText, 
  ArrowDownRight, ArrowUpRight, Plus, Minus
} from 'lucide-react';

interface GhostForecastProps {
  variableSpendAvg: number;
  baseIncome: number;
  fixedBills: number;
  inflation: number;
  currentBalance: number;
}

export default function GhostForecast({ 
  variableSpendAvg, 
  baseIncome, 
  fixedBills, 
  inflation,
  currentBalance 
}: GhostForecastProps) {
  const [displayPrice, setDisplayPrice] = useState("");
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [term, setTerm] = useState(12);
  const [interest, setInterest] = useState(0);
  const [isCash, setIsCash] = useState(true);
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);

  const handlePriceChange = (val: string) => {
    const raw = val.replace(/[^0-9.]/g, '');
    const num = Number(raw);
    setPurchasePrice(num);
    setDisplayPrice(raw ? num.toLocaleString('en-US') : "");
  };

  const forecast = useMemo(() => calculateGhostForecast({
    currentBalance: currentBalance,
    monthlyIncome: baseIncome,
    fixedBills: fixedBills,
    variableSpend: variableSpendAvg,
    purchasePrice,
    interestRate: interest,
    termMonths: term,
    isCash,
    inflation
  }), [currentBalance, baseIncome, fixedBills, variableSpendAvg, purchasePrice, interest, term, isCash, inflation]);

  const displayForecast = isCash ? forecast.slice(0, 6) : forecast.slice(0, term + 1);

  const maxBal = Math.max(...displayForecast.map(d => d.balance));
  const minBal = Math.min(...displayForecast.map(d => d.balance));
  const range = (maxBal - minBal) || 1;
  const chartPoints = displayForecast.map((d, i) => 
    `${(i / (displayForecast.length - 1)) * 100},${100 - ((d.balance - minBal) / range) * 100}`
  ).join(' ');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center px-1">
        <div>
          <h1 className="text-2xl font-black tracking-tighter uppercase leading-tight text-white">Ghost Forecast</h1>
          <p className="text-[10px] text-aura-subtle font-black uppercase tracking-widest">
            {isCash ? 'Immediate Purchase' : `Amortized: ${term} Months`}
          </p>
        </div>
      </div>

      <div className="bg-aura-card border border-white/10 p-6 rounded-[2.5rem] shadow-2xl overflow-hidden relative">
        <div className="absolute inset-0 bg-aura-accent/5 pointer-events-none" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-aura-subtle mb-6 text-center">Liquidity Trajectory</p>
        <div className="h-24 w-full relative">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
            <motion.polyline 
              initial={{ pathLength: 0 }} 
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              fill="none" 
              stroke="currentColor" 
              strokeWidth="3" 
              strokeLinecap="round" 
              className="text-aura-accent"
              points={chartPoints} 
            />
          </svg>
        </div>
        <div className="flex justify-between mt-4 text-[8px] font-black text-aura-subtle uppercase tracking-widest">
          <span>START</span>
          <span>END OF TERM</span>
        </div>
      </div>

      <div className="bg-aura-card border border-white/10 p-6 rounded-[2.5rem] space-y-6 shadow-2xl relative overflow-hidden">
        <div className="flex bg-black/50 p-1 rounded-xl border border-white/5 relative z-10">
          <button onClick={() => setIsCash(true)} className={`flex-1 py-3 rounded-lg text-[10px] font-black transition-all ${isCash ? 'bg-white text-black shadow-lg' : 'text-aura-subtle'}`}>FULL CASH</button>
          <button onClick={() => setIsCash(false)} className={`flex-1 py-3 rounded-lg text-[10px] font-black transition-all ${!isCash ? 'bg-white text-black shadow-lg' : 'text-aura-subtle'}`}>INSTALLMENT</button>
        </div>

        <div className="relative z-10">
          <label className="text-[10px] font-black text-aura-subtle uppercase tracking-widest block mb-2 px-1">Principal amount</label>
          <div className="relative">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-aura-accent font-black text-xs">PHP</span>
            <input type="text" inputMode="decimal" value={displayPrice} onChange={(e) => handlePriceChange(e.target.value)} className="w-full bg-black border border-white/10 p-5 pl-16 rounded-2xl text-2xl font-black outline-none focus:border-aura-accent transition-all text-white" placeholder="0.00" />
          </div>
        </div>

        {!isCash && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-6 pt-4 border-t border-white/5 relative z-10">
            {/* Term Stepper */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-aura-subtle uppercase tracking-widest block px-1">Payment Term (Months)</label>
              <div className="flex items-center gap-4">
                <button onClick={() => setTerm(Math.max(3, term - 3))} className="p-4 bg-white/5 rounded-2xl border border-white/10 text-white active:scale-95 transition-transform"><Minus size={18}/></button>
                <div className="flex-1 text-center bg-black/30 py-4 rounded-2xl border border-white/5 font-black text-aura-accent">{term} MO</div>
                <button onClick={() => setTerm(Math.min(60, term + 3))} className="p-4 bg-white/5 rounded-2xl border border-white/10 text-white active:scale-95 transition-transform"><Plus size={18}/></button>
              </div>
            </div>

            {/* Interest Stepper */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-aura-subtle uppercase tracking-widest block px-1">Interest Rate (%)</label>
              <div className="flex items-center gap-4">
                <button onClick={() => setInterest(Math.max(0, interest - 0.5))} className="p-4 bg-white/5 rounded-2xl border border-white/10 text-white active:scale-95 transition-transform"><Minus size={18}/></button>
                <div className="flex-1 text-center bg-black/30 py-4 rounded-2xl border border-white/5 font-black text-aura-accent">{interest.toFixed(1)}%</div>
                <button onClick={() => setInterest(Math.min(50, interest + 0.5))} className="p-4 bg-white/5 rounded-2xl border border-white/10 text-white active:scale-95 transition-transform"><Plus size={18}/></button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-[10px] font-black text-aura-subtle uppercase tracking-widest flex items-center gap-2">
            <ReceiptText size={14} /> Full {isCash ? '6-Month' : `${term}-Month`} Burn Projection
          </h3>
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
          {displayForecast.map((monthData) => (
            <div key={monthData.month} className={`bg-white/5 border rounded-[2rem] transition-all overflow-hidden ${expandedMonth === monthData.month ? 'border-aura-accent/40 bg-white/[0.07]' : 'border-white/5'}`}>
              <button onClick={() => setExpandedMonth(expandedMonth === monthData.month ? null : monthData.month)} className="w-full p-6 flex items-center justify-between">
                <div className="text-left">
                  <p className="text-[10px] font-black text-aura-subtle uppercase mb-1">Month {monthData.month}</p>
                  <p className={`text-xl font-black tabular-nums ${monthData.status === 'danger' ? 'text-red-500' : 'text-white'}`}>PHP {monthData.balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                </div>
                <ChevronDown size={18} className={`text-aura-subtle transition-transform ${expandedMonth === monthData.month ? 'rotate-180 text-aura-accent' : ''}`} />
              </button>

              <AnimatePresence>
                {expandedMonth === monthData.month && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="px-6 pb-6 border-t border-white/5 pt-5 space-y-4 bg-black/20">
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-aura-subtle flex items-center gap-1"><ArrowUpRight size={12} className="text-green-400"/> Monthly Income</span>
                        <span className="text-green-400">+ {baseIncome.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-aura-subtle flex items-center gap-1"><ArrowDownRight size={12} className="text-red-400"/> Fixed Bills</span>
                        <span className="text-red-400">- {fixedBills.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-aura-subtle flex items-center gap-1"><ArrowDownRight size={12} className="text-white/40"/> Avg Habit Spend</span>
                        <span className="text-white/60">- {variableSpendAvg.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                      {!isCash && purchasePrice > 0 && monthData.month <= term && monthData.month > 0 && (
                        <div className="flex justify-between text-xs bg-aura-accent/10 p-3 rounded-xl border border-aura-accent/20">
                          <span className="text-aura-accent font-black uppercase tracking-tighter">Ghost Payment</span>
                          <span className="font-black text-aura-accent">- {monthData.installment.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                    </div>
                    <div className="pt-2">
                      {monthData.status === 'danger' ? (
                        <div className="flex items-center gap-2 text-red-500 bg-red-500/10 p-3 rounded-xl border border-red-500/20 text-[10px] font-black uppercase tracking-widest"><AlertCircle size={14} /> Critical: Over Limit</div>
                      ) : (
                        <div className="flex items-center gap-2 text-aura-accent bg-aura-accent/10 p-3 rounded-xl border border-aura-accent/20 text-[10px] font-black uppercase tracking-widest"><CheckCircle2 size={14} /> Within Buffer</div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 209, 255, 0.2);
          border-radius: 10px;
        }
      `}</style>
    </motion.div>
  );
}