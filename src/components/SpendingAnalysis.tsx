import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingDown, 
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Minus,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import type { Transaction } from '../db/schema';
import { getFinancialInsight } from '../utils/StatementBank';

ChartJS.register(ArcElement, Tooltip, Legend);

interface SpendingAnalysisProps {
  baseIncome: number;
  fixedBills: number;
  variableSpendAvg: number;
  transactions: Transaction[];
  baseCurrency: string;
}

const CHART_COLORS = [
  '#00d1ff', '#AF52DE', '#FF2D55', '#FFD600', '#00E676', 
  '#FF9500', '#5856D6', '#FF3B30'
];

type FilterMode = 'day' | 'week' | 'month' | 'year';

export default function SpendingAnalysis({ 
  baseIncome, 
  fixedBills, 
  variableSpendAvg,
  transactions,
  baseCurrency
}: SpendingAnalysisProps) {
  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [targetDate, setTargetDate] = useState(new Date());

  const getWeekOfMonth = (date: Date) => {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfMonth = date.getDate();
    return Math.ceil((dayOfMonth + startOfMonth.getDay()) / 7);
  };

  const adjustDate = (amount: number) => {
    const newDate = new Date(targetDate);
    if (filterMode === 'day') newDate.setDate(newDate.getDate() + amount);
    if (filterMode === 'week') newDate.setDate(newDate.getDate() + (amount * 7));
    if (filterMode === 'month') newDate.setMonth(newDate.getMonth() + amount);
    if (filterMode === 'year') newDate.setFullYear(newDate.getFullYear() + amount);
    setTargetDate(newDate);
  };

  const analysis = useMemo(() => {
    const filteredByDate = transactions.filter(t => {
      const tDate = new Date(t.date);
      if (t.type === 'transfer') return false;

      if (filterMode === 'day') return tDate.toDateString() === targetDate.toDateString();
      if (filterMode === 'week') {
        return tDate.getFullYear() === targetDate.getFullYear() &&
               tDate.getMonth() === targetDate.getMonth() &&
               getWeekOfMonth(tDate) === getWeekOfMonth(targetDate);
      }
      if (filterMode === 'month') {
        return tDate.getFullYear() === targetDate.getFullYear() &&
               tDate.getMonth() === targetDate.getMonth();
      }
      if (filterMode === 'year') return tDate.getFullYear() === targetDate.getFullYear();
      return true;
    });

    // Calculate Inflow and Outflow for this specific filtered period
    let periodInflow = 0;
    let periodOutflow = 0;
    const categoryTotals: Record<string, { income: number; expense: number }> = {};

    filteredByDate.forEach(t => {
      if (!categoryTotals[t.category]) {
        categoryTotals[t.category] = { income: 0, expense: 0 };
      }
      if (t.amount > 0) {
        categoryTotals[t.category].income += t.amount;
        periodInflow += t.amount;
      } else {
        categoryTotals[t.category].expense += Math.abs(t.amount);
        periodOutflow += Math.abs(t.amount);
      }
    });

    // Retention Rate Logic: Only calculate if there is data, else 0
    const retentionRate = periodInflow > 0 ? Math.max(0, ((periodInflow - periodOutflow) / periodInflow) * 100) : 0;

    // Map categories for the list/donut (Combined Inflow & Outflow)
    const allCategories = Object.entries(categoryTotals)
      .map(([name, val], index) => ({
        name,
        income: val.income,
        expense: val.expense,
        total: val.income + val.expense,
        color: CHART_COLORS[index % CHART_COLORS.length]
      }))
      .sort((a, b) => b.total - a.total);

    const totalVolume = allCategories.reduce((acc, curr) => acc + curr.total, 0);

    const highestExpense = [...allCategories].sort((a,b) => b.expense - a.expense)[0] || { name: 'None', expense: 0 };
    const lowestExpense = [...allCategories].filter(c => c.expense > 0).sort((a,b) => a.expense - b.expense)[0] || { name: 'None', expense: 0 };
    const highestIncome = [...allCategories].sort((a,b) => b.income - a.income)[0] || { name: 'None', income: 0 };
    const lowestIncome = [...allCategories].filter(c => c.income > 0).sort((a,b) => a.income - b.income)[0] || { name: 'None', income: 0 };

    // Burn Rates based on global config (keeping logic consistent with dashboard)
    const globalOutflow = fixedBills + variableSpendAvg;
    const dailyBurn = globalOutflow / 30.42;
    const weeklyBurn = globalOutflow / 4.34;
    const yearlyBurn = globalOutflow * 12;

    const insight = getFinancialInsight(
      baseIncome,
      retentionRate,
      (variableSpendAvg / (globalOutflow || 1)) * 100,
      (fixedBills / (globalOutflow || 1)) * 100,
      highestExpense.name
    );

    return {
      periodInflow,
      periodOutflow,
      retentionRate,
      dailyBurn,
      weeklyBurn,
      yearlyBurn,
      allCategories,
      totalVolume,
      highestExpense,
      lowestExpense,
      highestIncome,
      lowestIncome,
      insight,
      globalOutflow
    };
  }, [baseIncome, fixedBills, variableSpendAvg, transactions, filterMode, targetDate]);

  const chartData = {
    labels: analysis.allCategories.map(c => c.name),
    datasets: [{
      data: analysis.allCategories.map(c => c.total),
      backgroundColor: analysis.allCategories.map(c => c.color),
      borderColor: 'rgba(0,0,0,0.5)',
      borderWidth: 2,
    }]
  };

  const chartOptions = {
    cutout: '75%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const cat = analysis.allCategories[context.dataIndex];
            return `${context.label}: In +${cat.income} | Out -${cat.expense}`;
          }
        }
      }
    },
    maintainAspectRatio: false
  };

  const formatDateLabel = () => {
    if (filterMode === 'day') return targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (filterMode === 'week') return `Week ${getWeekOfMonth(targetDate)}, ${targetDate.toLocaleDateString('en-US', { month: 'short' })}`;
    if (filterMode === 'month') return targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return targetDate.getFullYear().toString();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-24"
    >
      <div className="px-1 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black tracking-tighter uppercase leading-tight text-white">Habit Analysis</h2>
          <p className="text-[10px] text-aura-subtle font-black uppercase tracking-widest">Efficiency & Burn Rate</p>
        </div>
        <div className="bg-white/5 p-1 rounded-xl border border-white/10 flex gap-1">
          {(['day', 'week', 'month', 'year'] as FilterMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setFilterMode(m)}
              className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${filterMode === m ? 'bg-white text-black' : 'text-aura-subtle'}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between bg-aura-card border border-white/10 p-4 rounded-2xl mx-1">
        <button onClick={() => adjustDate(-1)} className="p-2 bg-white/5 rounded-lg text-white active:scale-90 transition-transform">
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-aura-accent" />
          <span className="text-xs font-black text-white uppercase tracking-widest">{formatDateLabel()}</span>
        </div>
        <button onClick={() => adjustDate(1)} className="p-2 bg-white/5 rounded-lg text-white active:scale-90 transition-transform">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="bg-aura-card border border-white/10 p-6 rounded-[2.5rem] relative overflow-hidden">
        <div className="flex flex-col items-center mb-6">
          <div className="w-48 h-48 relative">
            <Doughnut data={chartData} options={chartOptions} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-[8px] font-black text-aura-subtle uppercase">Retention</p>
              <p className="text-xl font-black text-white">{analysis.retentionRate.toFixed(0)}%</p>
            </div>
          </div>
        </div>

        <div className="space-y-2 mb-6 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
          {analysis.allCategories.length > 0 ? (
            analysis.allCategories.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between text-[10px] font-bold">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="text-white/70 uppercase tracking-tighter">{cat.name}</span>
                </div>
                <div className="flex gap-2 items-center">
                  <div className="flex flex-col items-end">
                    {cat.income > 0 && <span className="text-green-400">+{cat.income.toLocaleString()}</span>}
                    {cat.expense > 0 && <span className="text-red-400">-{cat.expense.toLocaleString()}</span>}
                  </div>
                  <span className="text-aura-subtle w-8 text-right">{((cat.total / analysis.totalVolume) * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-[10px] text-center text-aura-subtle font-black uppercase py-4 tracking-widest">No activity for this period</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-6">
          <div className="space-y-1">
            <p className="text-[8px] font-black text-red-400 uppercase tracking-widest flex items-center gap-1">
              <ArrowDownRight size={10} /> Peak Spending
            </p>
            <p className="text-sm font-black text-white truncate">
              <span className="text-[10px] font-bold text-aura-subtle mr-1">{baseCurrency}</span>
              {analysis.highestExpense.expense.toLocaleString()}
            </p>
            <p className="text-[10px] font-black text-aura-subtle uppercase tracking-tighter truncate">{analysis.highestExpense.name}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[8px] font-black text-green-400 uppercase tracking-widest flex items-center gap-1">
              <ArrowUpRight size={10} /> Peak Inflow
            </p>
            <p className="text-sm font-black text-white truncate">
              <span className="text-[10px] font-bold text-aura-subtle mr-1">{baseCurrency}</span>
              {analysis.highestIncome.income.toLocaleString()}
            </p>
            <p className="text-[10px] font-black text-aura-subtle uppercase tracking-tighter truncate">{analysis.highestIncome.name}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Daily Burn', val: analysis.dailyBurn, color: 'text-red-400' },
          { label: 'Weekly Burn', val: analysis.weeklyBurn, color: 'text-orange-400' },
          { label: 'Monthly Burn', val: analysis.globalOutflow, color: 'text-white' },
          { label: 'Yearly Burn', val: analysis.yearlyBurn, color: 'text-aura-accent' }
        ].map((item) => (
          <div key={item.label} className="bg-aura-card border border-white/10 p-4 rounded-[1.5rem]">
            <p className="text-[8px] font-black uppercase tracking-widest text-aura-subtle mb-1">{item.label}</p>
            <p className={`text-lg font-black ${item.color}`}>
              <span className="text-xs font-bold opacity-60 mr-1">{baseCurrency}</span>
              {item.val.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white/5 rounded-[2rem] border border-white/5 p-6 space-y-4">
         <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-aura-subtle uppercase tracking-widest">Efficiency Nodes</span>
            <TrendingUp size={14} className="text-aura-accent" />
         </div>
         <div className="space-y-3">
            <div className="flex justify-between items-center">
               <span className="text-xs font-bold text-white/60 uppercase tracking-tighter flex items-center gap-2">
                  <TrendingDown size={12} className="text-red-500" /> Lowest Spend
               </span>
               <div className="text-right">
                <p className="text-xs font-black text-white">
                  <span className="text-[8px] font-bold text-aura-subtle mr-1">{baseCurrency}</span>
                  {analysis.lowestExpense.expense.toLocaleString()}
                </p>
                <p className="text-[8px] font-black text-aura-subtle uppercase tracking-tighter">{analysis.lowestExpense.name}</p>
               </div>
            </div>
            <div className="flex justify-between items-center">
               <span className="text-xs font-bold text-white/60 uppercase tracking-tighter flex items-center gap-2">
                  <Minus size={12} className="text-yellow-500" /> Lowest Inflow
               </span>
               <div className="text-right">
                <p className="text-xs font-black text-white">
                  <span className="text-[8px] font-bold text-aura-subtle mr-1">{baseCurrency}</span>
                  {analysis.lowestIncome.income.toLocaleString()}
                </p>
                <p className="text-[8px] font-black text-aura-subtle uppercase tracking-tighter">{analysis.lowestIncome.name}</p>
               </div>
            </div>
         </div>
      </div>

      <div className={`bg-white/5 border ${analysis.insight.color} p-5 rounded-[2rem] flex items-start gap-4 transition-colors duration-500`}>
        <div className="p-3 bg-white/5 rounded-2xl flex-shrink-0">
          {analysis.insight.icon}
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-black text-aura-subtle uppercase tracking-widest mb-1">{analysis.insight.title}</p>
          <p className="text-xs font-bold text-white/90 leading-relaxed">
            {analysis.insight.body}
          </p>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 209, 255, 0.2); border-radius: 10px; }
      `}</style>
    </motion.div>
  );
}