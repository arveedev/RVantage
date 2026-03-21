import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, FastForward } from 'lucide-react';
import SpendingAnalysis from './SpendingAnalysis';
import GhostForecast from './GhostForecast';
import type { Transaction } from '../db/schema';

interface SimulatorProps {
  config: any;
  financialIntel: {
    total: number;
    variableSpendAverage: number;
  };
  transactions: Transaction[];
  baseCurrency: string;
}

export default function Simulator({ 
  config, 
  financialIntel, 
  transactions, 
  baseCurrency 
}: SimulatorProps) {
  const [view, setView] = useState<'analysis' | 'forecast'>('analysis');

  // Transform single config values into the Entity Arrays required by GhostForecast
  const incomeArray = [{
    userId: 'primary',
    label: 'Base Income',
    amount: Number(config.net_income || config.monthly_income || 0)
  }];

  const billsArray = [{
    userId: 'primary',
    label: 'Fixed Bills',
    amount: Number(config.fixed_bills || 0)
  }];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6"
    >
      <div className="flex bg-white/5 p-1.5 rounded-[2rem] border border-white/10 backdrop-blur-md">
        <button
          onClick={() => setView('analysis')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
            view === 'analysis' 
              ? 'bg-white text-black shadow-lg shadow-white/5' 
              : 'text-aura-subtle hover:text-white'
          }`}
        >
          <PieChart size={14} />
          Analysis
        </button>
        <button
          onClick={() => setView('forecast')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
            view === 'forecast' 
              ? 'bg-white text-black shadow-lg shadow-white/5' 
              : 'text-aura-subtle hover:text-white'
          }`}
        >
          <FastForward size={14} />
          Forecast
        </button>
      </div>

      <AnimatePresence mode="wait">
        {view === 'analysis' ? (
          <motion.div
            key="analysis-view"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            <SpendingAnalysis 
              baseIncome={Number(config.net_income || config.monthly_income || 0)}
              fixedBills={Number(config.fixed_bills || 0)}
              variableSpendAvg={financialIntel.variableSpendAverage}
              transactions={transactions}
              baseCurrency={baseCurrency}
            />
          </motion.div>
        ) : (
          <motion.div
            key="forecast-view"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            <GhostForecast 
              variableSpendAvg={financialIntel.variableSpendAverage} 
              incomes={incomeArray} 
              bills={billsArray}
              inflation={Number(config.inflation_rate || 0)}
              currentBalance={financialIntel.total}
              baseCurrency={baseCurrency}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}