import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Check, Landmark, Calendar, Percent, 
  Plus, Trash2, Calculator, RotateCcw, Loader2 
} from 'lucide-react';
import { db } from '../db/schema';
import { useSync } from '../hooks/useSync';
import { useToast } from '../context/useToast';
import { useAuth } from '../hooks/useAuth';

interface Deduction {
  id: string;
  label: string;
  amount: number;
}

interface Bill {
  id: string;
  label: string;
  amount: number;
}

interface CommandCenterProps {
  isOpen: boolean;
  onClose: () => void;
  config: any;
  setConfig: (config: any) => void;
}

const CURRENCIES = [
  { code: 'PHP', label: 'Philippine Peso (₱)', symbol: '₱' },
  { code: 'USD', label: 'US Dollar ($)', symbol: '$' },
  { code: 'EUR', label: 'Euro (€)', symbol: '€' }
];

export default function CommandCenter({ isOpen, onClose, config, setConfig }: CommandCenterProps) {
  const { user } = useAuth();
  const { syncSettings } = useSync();
  const { showToast } = useToast();
  
  const [localDeductions, setLocalDeductions] = useState<Deduction[]>([]);
  const [localBills, setLocalBills] = useState<Bill[]>([]);
  const [grossIncome, setGrossIncome] = useState(config.monthly_income || "0");
  const [localSchedule, setLocalSchedule] = useState(config.payday_schedule || "15, 30");
  const [localCurrency, setLocalCurrency] = useState(config.base_currency || "PHP");
  const [localInflation, setLocalInflation] = useState(config.inflation_rate || "0");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (config.deductions) {
      try {
        setLocalDeductions(JSON.parse(config.deductions));
      } catch (e) {
        setLocalDeductions([]);
      }
    }
    
    if (config.fixed_bills_list) {
      try {
        setLocalBills(JSON.parse(config.fixed_bills_list));
      } catch (e) {
        setLocalBills([]);
      }
    } else if (config.fixed_bills && config.fixed_bills !== "0") {
      setLocalBills([{ id: 'legacy-fixed', label: 'Fixed Bills', amount: Number(config.fixed_bills) }]);
    }

    setGrossIncome(config.monthly_income || "0");
    setLocalSchedule(config.payday_schedule || "15, 30");
    setLocalCurrency(config.base_currency || "PHP");
    setLocalInflation(config.inflation_rate || "0");
  }, [config, isOpen]);

  const totalDeductions = localDeductions.reduce((sum, d) => sum + d.amount, 0);
  const totalFixedBills = localBills.reduce((sum, b) => sum + b.amount, 0);
  const netIncome = Math.max(0, Number(grossIncome) - totalDeductions);

  const addDeduction = () => {
    const newDec = { id: crypto.randomUUID(), label: "New Deduction", amount: 0 };
    setLocalDeductions([...localDeductions, newDec]);
  };

  const updateDeduction = (id: string, field: keyof Deduction, value: string | number) => {
    setLocalDeductions(prev => prev.map(d => 
      d.id === id ? { ...d, [field]: field === 'amount' ? Number(value) : value } : d
    ));
  };

  const removeDeduction = (id: string) => {
    setLocalDeductions(prev => prev.filter(d => d.id !== id));
  };

  const addBill = () => {
    const newBill = { id: crypto.randomUUID(), label: "New Bill", amount: 0 };
    setLocalBills([...localBills, newBill]);
  };

  const updateBill = (id: string, field: keyof Bill, value: string | number) => {
    setLocalBills(prev => prev.map(b => 
      b.id === id ? { ...b, [field]: field === 'amount' ? Number(value) : value } : b
    ));
  };

  const removeBill = (id: string) => {
    setLocalBills(prev => prev.filter(b => b.id !== id));
  };

  const handleReset = () => {
    if (window.confirm("RESET ALL PARAMETERS TO DEFAULT?")) {
      setLocalDeductions([]);
      setLocalBills([]);
      setGrossIncome("0");
      setLocalSchedule("15, 30");
      setLocalCurrency("PHP");
      setLocalInflation("0");
      
      const defaultConfig = {
        ...config,
        base_currency: 'PHP',
        inflation_rate: '0',
        payday_schedule: '15, 30',
        fixed_bills: '0',
        fixed_bills_list: '[]',
        deductions: '[]',
        monthly_income: '0',
        net_income: '0'
      };
      
      setConfig(defaultConfig);
      showToast("SYSTEM RESET", "info");
    }
  };

  const handleSave = async () => {
    if (!user?.id) {
      showToast("User session not found", "error");
      return;
    }

    // Precise Change Detection against the ORIGINAL config props
    const currentDeductionsStr = JSON.stringify(localDeductions);
    const currentBillsStr = JSON.stringify(localBills);
    
    const hasDeductionsChanged = currentDeductionsStr !== (config.deductions || '[]');
    const hasBillsChanged = currentBillsStr !== (config.fixed_bills_list || '[]');
    const hasIncomeChanged = String(grossIncome) !== String(config.monthly_income || "0");
    const hasCurrencyChanged = localCurrency !== (config.base_currency || 'PHP');
    const hasScheduleChanged = String(localSchedule) !== String(config.payday_schedule || '15, 30');
    const hasInflationChanged = localInflation !== (config.inflation_rate || '0');
    
    if (
      !hasDeductionsChanged && 
      !hasBillsChanged && 
      !hasIncomeChanged && 
      !hasCurrencyChanged && 
      !hasScheduleChanged &&
      !hasInflationChanged
    ) {
      showToast("NO CHANGES MADE", "info");
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      const updatedConfig = {
        ...config,
        base_currency: localCurrency,
        inflation_rate: localInflation,
        monthly_income: String(grossIncome),
        deductions: currentDeductionsStr,
        fixed_bills_list: currentBillsStr,
        fixed_bills: String(totalFixedBills),
        net_income: String(netIncome),
        payday_schedule: String(localSchedule).trim() // Force string clean
      };

      const keys = Object.keys(updatedConfig);
      const settingsToSync = keys.map(key => ({ 
        config_key: key, 
        config_value: String(updatedConfig[key as keyof typeof updatedConfig]),
        user_id: user.id 
      }));

      // Save to IndexedDB
      for (const item of settingsToSync) {
        await db.settings.put(item);
      }

      // Sync to Cloud
      await syncSettings(settingsToSync);
      
      setConfig(updatedConfig);
      showToast("SYSTEM RECONFIGURED", "success");
      onClose();
    } catch (e) {
      console.error("Save Error:", e);
      showToast("Save Failed", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const formatNumber = (val: any) => {
    const num = String(val).replace(/,/g, '');
    if (!num || isNaN(Number(num))) return "";
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const cleanNumber = (val: string) => val.replace(/,/g, '');

  const currentCurrency = CURRENCIES.find(c => c.code === localCurrency) || CURRENCIES[0];

  const paydayDates = String(localSchedule || "15, 30").split(',').map((s: string) => s.trim()).filter(Boolean);
  const payCount = paydayDates.length || 1;
  const basePayPerPeriod = Math.floor(netIncome / payCount);
  const lastPayPeriod = netIncome - (basePayPerPeriod * (payCount - 1));

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex flex-col"
          data-command-center="true"
        >
          <div className="p-6 flex justify-between items-center bg-black/40 border-b border-white/5">
            <div>
              <h2 className="text-2xl font-black tracking-tighter text-white uppercase">Command Center</h2>
              <p className="text-[10px] text-aura-subtle font-black tracking-[0.2em] uppercase">System Parameters</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleReset} className="p-3 bg-white/5 rounded-full text-white/40 hover:text-red-400 transition-colors"><RotateCcw size={20} /></button>
              <button onClick={onClose} className="p-3 bg-white/5 rounded-full text-white/40"><X size={24} /></button>
            </div>
          </div>

          <div className="flex-1 p-6 space-y-8 overflow-y-auto no-scrollbar pb-32">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-aura-subtle uppercase tracking-widest flex items-center gap-2"><Landmark size={12}/> Currency</label>
                <select 
                  value={localCurrency} 
                  onChange={e => setLocalCurrency(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-xl font-bold text-white outline-none"
                >
                  {CURRENCIES.map(c => <option key={c.code} value={c.code} className="bg-[#111]">{c.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-aura-subtle uppercase tracking-widest flex items-center gap-2"><Percent size={12}/> Inflation</label>
                <input 
                  type="number" value={localInflation} 
                  onChange={e => setLocalInflation(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-xl font-bold text-white outline-none"
                />
              </div>
            </div>

            <div className="space-y-4 p-6 bg-white/5 rounded-[2rem] border border-white/10">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-aura-accent uppercase tracking-widest">Gross Monthly Income</label>
                <Calculator size={16} className="text-aura-accent" />
              </div>
              <input 
                type="text" inputMode="decimal"
                value={formatNumber(grossIncome)} 
                onChange={e => setGrossIncome(cleanNumber(e.target.value))} 
                className="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-2xl font-black text-white outline-none focus:border-aura-accent"
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-aura-subtle uppercase tracking-widest">Monthly Deductions</label>
                <button onClick={addDeduction} className="flex items-center gap-1 text-[10px] font-black text-aura-accent bg-aura-accent/10 px-3 py-1 rounded-full border border-aura-accent/20">
                  <Plus size={12}/> ADD ITEM
                </button>
              </div>
              
              <div className="space-y-3">
                {localDeductions.map((d) => (
                  <div key={d.id} className="flex gap-2 items-center bg-white/5 p-2 rounded-2xl border border-white/5">
                    <input 
                      type="text" value={d.label}
                      onChange={(e) => updateDeduction(d.id, 'label', e.target.value)}
                      onFocus={(e) => { if (e.target.value === "New Deduction") updateDeduction(d.id, 'label', ''); }}
                      className="flex-1 bg-transparent p-3 text-xs font-bold text-white outline-none"
                      placeholder="e.g. Tax"
                    />
                    <div className="w-32 relative">
                      <input 
                        type="text" inputMode="decimal"
                        value={formatNumber(d.amount)}
                        onChange={(e) => updateDeduction(d.id, 'amount', cleanNumber(e.target.value))}
                        className="w-full bg-black/40 p-3 rounded-xl text-xs font-black text-right text-aura-accent outline-none pr-4"
                        placeholder="0"
                      />
                    </div>
                    <button onClick={() => removeDeduction(d.id)} className="p-3 text-red-500/50 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 p-6 bg-aura-accent/5 rounded-[2rem] border border-aura-accent/10">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-aura-subtle uppercase tracking-widest flex items-center gap-2"><Calendar size={12}/> Payday Schedule</label>
                <input 
                  type="text" value={localSchedule} 
                  onChange={e => setLocalSchedule(e.target.value)} 
                  className="w-full bg-black/40 border border-white/10 p-4 rounded-xl font-bold text-white outline-none" 
                  placeholder="15, 30" 
                />
              </div>

              <div className="pt-4 border-t border-white/5 space-y-3">
                <div className="flex justify-between text-[10px] font-black uppercase">
                  <span className="text-aura-subtle">Total Deductions</span>
                  <span className="text-red-400">-{currentCurrency.symbol}{totalDeductions.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[10px] font-black uppercase">
                  <span className="text-aura-subtle">Total Net Pay</span>
                  <span className="text-white">{currentCurrency.symbol}{netIncome.toLocaleString()}</span>
                </div>
                <div className="h-px bg-white/5 my-2" />
                {paydayDates.map((date: string, idx: number) => (
                  <div key={idx} className="flex justify-between text-xs font-bold">
                    <span className="text-aura-subtle">Day {date} Inflow</span>
                    <span className="text-aura-accent">
                      {currentCurrency.symbol}{(idx === payCount - 1 ? lastPayPeriod : basePayPerPeriod).toLocaleString(undefined, { 
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2 
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-aura-subtle uppercase tracking-widest">Monthly Fixed Bills</label>
                <button onClick={addBill} className="flex items-center gap-1 text-[10px] font-black text-aura-accent bg-aura-accent/10 px-3 py-1 rounded-full border border-aura-accent/20">
                  <Plus size={12}/> ADD BILL
                </button>
              </div>
              
              <div className="space-y-3">
                {localBills.map((b) => (
                  <div key={b.id} className="flex gap-2 items-center bg-white/5 p-2 rounded-2xl border border-white/5">
                    <input 
                      type="text" value={b.label}
                      onChange={(e) => updateBill(b.id, 'label', e.target.value)}
                      onFocus={(e) => { if (e.target.value === "New Bill") updateBill(b.id, 'label', ''); }}
                      className="flex-1 bg-transparent p-3 text-xs font-bold text-white outline-none"
                      placeholder="e.g. Rent"
                    />
                    <div className="w-32 relative">
                      <input 
                        type="text" inputMode="decimal"
                        value={formatNumber(b.amount)}
                        onChange={(e) => updateBill(b.id, 'amount', cleanNumber(e.target.value))}
                        className="w-full bg-black/40 p-3 rounded-xl text-xs font-black text-right text-white outline-none pr-4"
                        placeholder="0"
                      />
                    </div>
                    <button onClick={() => removeBill(b.id)} className="p-3 text-red-500/50 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>

              {localBills.length > 0 && (
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center">
                  <span className="text-[10px] font-black text-aura-subtle uppercase tracking-widest">Total Fixed Bills</span>
                  <span className="text-sm font-black text-white">{currentCurrency.symbol}{totalFixedBills.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 bg-aura-black/80 backdrop-blur-xl border-t border-white/5">
            <button 
              onClick={handleSave} 
              disabled={isSaving}
              className="w-full bg-white text-black font-black p-6 rounded-[2rem] flex items-center justify-center gap-3 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:scale-100"
            >
              {isSaving ? (
                <>
                  <Loader2 size={20} className="animate-spin" /> SYNCHRONIZING CORE...
                </>
              ) : (
                <>
                  <Check size={20} strokeWidth={3} /> COMMIT SYSTEM UPDATE
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}