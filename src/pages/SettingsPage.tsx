import { useState, useEffect } from 'react';
import { db } from '../db/schema';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '../context/ToastContext';
import { Save, ArrowLeft, TrendingUp, CreditCard } from 'lucide-react';

export default function SettingsPage({ onNavigate }: { onNavigate: (p: any) => void }) {
  const { showToast } = useToast();
  const settings = useLiveQuery(() => db.settings.toArray());
  const [localSettings, setLocalSettings] = useState<any>({});

  // Helper to format number with commas
  const formatComma = (val: any) => {
    if (val === undefined || val === null) return '';
    const num = String(val).replace(/,/g, '');
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Helper to strip commas for DB storage
  const stripComma = (val: string) => Number(val.replace(/,/g, '')) || 0;

  useEffect(() => {
    if (settings) {
      const sMap = settings.reduce((acc, s) => ({ 
        ...acc, 
        [s.config_key]: formatComma(s.config_value) 
      }), {});
      setLocalSettings(sMap);
    }
  }, [settings]);

  const handleInputChange = (key: string, value: string) => {
    // Only allow digits and commas
    const cleanValue = value.replace(/[^\d]/g, '');
    setLocalSettings({ ...localSettings, [key]: formatComma(cleanValue) });
  };

  const saveSettings = async () => {
    try {
      const updates = Object.entries(localSettings).map(([key, val]) => ({
        config_key: key,
        config_value: String(stripComma(val as string))
      }));
      await db.settings.bulkPut(updates);
      showToast("FINANCIAL REALITY UPDATED", "success");
    } catch (e) {
      showToast("Save failed", "error");
    }
  };

  return (
    <div className="p-6 pt-12 space-y-8 max-w-md mx-auto">
      <div className="flex items-center gap-4 mb-2">
        <button onClick={() => onNavigate('dashboard')} className="p-3 bg-white/5 rounded-2xl border border-white/10 active:scale-90 transition-transform">
          <ArrowLeft size={20}/>
        </button>
        <h1 className="text-3xl font-black tracking-tighter">SETTINGS</h1>
      </div>

      <div className="space-y-6">
        {/* SECTION 1: INCOME */}
        <section className="bg-white/5 p-6 rounded-[2.5rem] border border-white/5">
          <h3 className="text-[10px] font-black text-aura-subtle uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <TrendingUp size={14}/> Income DNA
          </h3>
          <div className="space-y-6">
            <div className="pb-2">
              <label className="text-[10px] font-bold text-white/40 uppercase block mb-2 px-1">Monthly Take-Home</label>
              <input 
                type="text" 
                inputMode="numeric"
                value={localSettings.monthly_income || ''} 
                onChange={e => handleInputChange('monthly_income', e.target.value)} 
                className="w-full bg-black border border-white/10 p-4 rounded-xl text-aura-accent font-black outline-none focus:border-aura-accent transition-all" 
                placeholder="0"
              />
            </div>
          </div>
        </section>

        {/* SECTION 2: THE BURN */}
        <section className="bg-white/5 p-6 rounded-[2.5rem] border border-white/5">
          <h3 className="text-[10px] font-black text-aura-subtle uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <CreditCard size={14}/> The Burn
          </h3>
          <div className="space-y-6">
            <div className="pb-6 border-b border-white/5">
              <label className="text-[10px] font-bold text-white/40 uppercase block mb-2 px-1">Fixed Bills</label>
              <input 
                type="text" 
                inputMode="numeric"
                value={localSettings.fixed_bills || ''} 
                onChange={e => handleInputChange('fixed_bills', e.target.value)} 
                className="w-full bg-black border border-white/10 p-4 rounded-xl text-red-400 font-black outline-none focus:border-red-400" 
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-white/40 uppercase block mb-2 px-1">Variable Spending Habit</label>
              <input 
                type="text" 
                inputMode="numeric"
                value={localSettings.variable_spend || ''} 
                onChange={e => handleInputChange('variable_spend', e.target.value)} 
                className="w-full bg-black border border-white/10 p-4 rounded-xl text-white font-black outline-none focus:border-white/40" 
                placeholder="0"
              />
            </div>
          </div>
        </section>
      </div>

      <button onClick={saveSettings} className="w-full bg-aura-accent text-black font-black py-5 rounded-[2.5rem] flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(0,209,255,0.2)] active:scale-95 transition-transform">
        <Save size={20} /> COMMIT CHANGES
      </button>
    </div>
  );
}