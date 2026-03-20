import { useState } from 'react';
import { db } from './db/schema';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Globe, ArrowRight, CheckCircle2 } from 'lucide-react';
import Dashboard from './components/Dashboard';
import { ToastProvider, useToast } from './context/ToastContext';

function SetupWizard() {
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [displayBalance, setDisplayBalance] = useState("");
  const [setupData, setSetupData] = useState({
    currency: 'PHP',
    accountName: 'Main Checking',
    initialBalance: 0
  });

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/,/g, '');
    if (!isNaN(Number(value)) || value === "") {
      const numValue = value === "" ? 0 : Number(value);
      setSetupData({ ...setupData, initialBalance: numValue });
      setDisplayBalance(value === "" ? "" : numValue.toLocaleString('en-US'));
    }
  };

  const handleCompleteSetup = async () => {
    if (!setupData.accountName.trim()) {
      showToast("Account name required", "error");
      return;
    }

    try {
      // 1. Save Currency Setting
      await db.settings.add({
        config_key: 'base_currency',
        config_value: setupData.currency,
      });

      // 2. Create Initial Account
      await db.accounts.add({
        id: 'ACC-001', 
        name: setupData.accountName,
        balance: Number(setupData.initialBalance),
        include_in_glance: true,
        is_shared: false
      });

      showToast("SYSTEM INITIALIZED", "success");
      setStep(4); 
    } catch (e) {
      showToast("Initialization failed", "error");
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md bg-aura-card p-8 rounded-[2.5rem] border border-white/10 shadow-2xl"
          >
            <div className="w-12 h-12 bg-aura-accent/10 rounded-2xl flex items-center justify-center mb-6">
              <Globe className="text-aura-accent" size={24} />
            </div>
            <h2 className="text-3xl font-black mb-2 tracking-tighter text-white">SELECT CURRENCY</h2>
            <p className="text-aura-subtle text-sm mb-8 font-medium uppercase tracking-wider">Define your base financial intelligence.</p>
            
            <div className="relative">
              <select 
                className="w-full bg-black/50 border border-white/10 p-5 rounded-2xl mb-8 outline-none focus:border-aura-accent transition-all appearance-none text-white font-bold"
                value={setupData.currency}
                onChange={(e) => setSetupData({...setupData, currency: e.target.value})}
              >
                <option value="PHP">Philippine Peso (PHP)</option>
                <option value="USD">US Dollar (USD)</option>
                <option value="EUR">Euro (EUR)</option>
              </select>
              <div className="absolute right-5 top-6 pointer-events-none text-aura-subtle">
                <ArrowRight size={18} className="rotate-90" />
              </div>
            </div>

            <button 
              onClick={() => setStep(2)}
              className="w-full bg-white text-black font-black py-5 rounded-[2rem] flex items-center justify-center gap-2 hover:bg-aura-accent active:scale-95 transition-all uppercase tracking-widest"
            >
              Next Step <ArrowRight size={20} />
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="w-full max-w-md bg-aura-card p-8 rounded-[2.5rem] border border-white/10 shadow-2xl"
          >
            <div className="w-12 h-12 bg-aura-accent/10 rounded-2xl flex items-center justify-center mb-6">
              <Wallet className="text-aura-accent" size={24} />
            </div>
            <h2 className="text-3xl font-black mb-2 tracking-tighter text-white">PRIMARY VAULT</h2>
            <p className="text-aura-subtle text-sm mb-8 font-medium uppercase tracking-wider">Setup your main cash or bank account.</p>
            
            <div className="space-y-4 mb-8">
              <input 
                type="text"
                placeholder="Account Name (e.g. GCash)"
                className="w-full bg-black/50 border border-white/10 p-5 rounded-2xl outline-none focus:border-aura-accent transition-all text-white font-bold"
                value={setupData.accountName}
                onChange={(e) => setSetupData({...setupData, accountName: e.target.value})}
              />
              <div className="relative">
                <input 
                  type="text"
                  inputMode="decimal"
                  placeholder="Current Balance"
                  className="w-full bg-black/50 border border-white/10 p-5 rounded-2xl outline-none focus:border-aura-accent transition-all text-white font-bold tabular-nums"
                  value={displayBalance}
                  onChange={handleBalanceChange}
                />
              </div>
            </div>

            <button 
              onClick={handleCompleteSetup}
              className="w-full bg-white text-black font-black py-5 rounded-[2rem] flex items-center justify-center gap-2 hover:bg-aura-accent active:scale-95 transition-all uppercase tracking-widest"
            >
              Initialize Engine <CheckCircle2 size={20} />
            </button>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div 
            key="step4"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="w-24 h-24 bg-aura-accent rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(0,209,255,0.3)]">
              <CheckCircle2 size={48} className="text-black" />
            </div>
            <h2 className="text-4xl font-black mb-3 text-white tracking-tighter">VAULT READY</h2>
            <p className="text-aura-subtle font-bold uppercase tracking-[0.2em] mb-10 text-xs">Your local data is now encrypted & secured.</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-12 py-5 bg-transparent border-2 border-aura-accent text-aura-accent rounded-full font-black uppercase tracking-widest hover:bg-aura-accent hover:text-black transition-all active:scale-90"
            >
              Launch Dashboard
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const accounts = useLiveQuery(() => db.accounts.toArray());
  const settings = useLiveQuery(() => db.settings.toArray());

  const isReady = accounts && accounts.length > 0 && settings && settings.length > 0;

  return (
    <ToastProvider>
      {isReady ? <Dashboard /> : <SetupWizard />}
    </ToastProvider>
  );
}