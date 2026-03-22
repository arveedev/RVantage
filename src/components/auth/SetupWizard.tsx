import { useState } from 'react';
import { db } from '../../db/schema';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Globe, ArrowRight, CheckCircle2, Lock, User as UserIcon } from 'lucide-react';
import { useToast } from '../../context/useToast';
import { useSync } from '../../hooks/useSync';

interface SetupWizardProps {
  onCancel?: () => void;
}

export default function SetupWizard({ onCancel }: SetupWizardProps) {
  const { showToast } = useToast();
  const { syncUser, checkCloudPin, syncSettings } = useSync();
  const [step, setStep] = useState(1);
  const [isInitializing, setIsInitializing] = useState(false);
  const [displayBalance, setDisplayBalance] = useState("");
  const [setupData, setSetupData] = useState({
    username: '',
    pin: '',
    confirmPin: '',
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

  const handlePinStepNext = async () => {
    const cleanPin = setupData.pin.trim();
    
    if (cleanPin.length < 4 || cleanPin.length > 6) {
      showToast("PIN MUST BE 4-6 DIGITS", "error");
      return;
    }
    if (!/^\d+$/.test(cleanPin)) {
      showToast("PIN MUST BE NUMERIC ONLY", "error");
      return;
    }
    if (cleanPin !== setupData.confirmPin.trim()) {
      showToast("PINS DO NOT MATCH", "error");
      return;
    }
    
    try {
      setIsInitializing(true);
      const localPinExists = await db.users.where('password').equals(cleanPin).first();
      if (localPinExists) {
        showToast("PIN ALREADY IN USE LOCALLY", "error");
        setIsInitializing(false);
        return;
      }

      const cloudPinExists = await checkCloudPin(cleanPin);
      if (cloudPinExists) {
        showToast("PIN ALREADY REGISTERED IN CLOUD", "error");
        setIsInitializing(false);
        return;
      }

      setStep(3);
    } catch (err) {
      console.error("Security Check Error:", err);
      showToast("ERROR VERIFYING PIN - TRY AGAIN", "error");
    } finally {
      setIsInitializing(false);
    }
  };

  const handleCompleteSetup = async () => {
    if (!setupData.username.trim()) {
      showToast("Username required", "error");
      setStep(1);
      return;
    }
    if (!setupData.accountName.trim()) {
      showToast("Account name required", "error");
      setStep(4);
      return;
    }

    setIsInitializing(true);
    const userId = crypto.randomUUID();

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const syncResult = await syncUser({ 
        id: userId, 
        username: setupData.username.trim(), 
        pin: setupData.pin.trim() 
      });

      if (syncResult.status === 'error' && syncResult.message === 'PIN_ALREADY_EXISTS') {
        showToast("SECURITY BREACH: PIN TAKEN IN CLOUD", "error");
        setStep(2);
        setIsInitializing(false);
        return;
      }

      await db.users.put({
        id: userId,
        username: setupData.username.trim(),
        password: setupData.pin.trim(),
        last_login: new Date()
      });

      await db.session.put({ id: 'current', user_id: userId });

      // Initialize Core Settings
      const initialSettings = [
        { config_key: 'base_currency', config_value: setupData.currency, user_id: userId },
        { config_key: 'payday_schedule', config_value: '15, 30', user_id: userId },
        { config_key: 'inflation_rate', config_value: '0', user_id: userId },
        { config_key: 'monthly_income', config_value: '0', user_id: userId },
        { config_key: 'net_income', config_value: '0', user_id: userId }
      ];

      for (const setting of initialSettings) {
        await db.settings.put(setting);
      }

      // Sync these initial settings to Cloud immediately
      await syncSettings(initialSettings);

      const accountId = 'ACC-' + Math.random().toString(36).substring(2, 11);
      await db.accounts.put({
        id: accountId, 
        name: setupData.accountName.trim(),
        balance: Number(setupData.initialBalance),
        include_in_glance: true,
        is_shared: false,
        user_id: userId,
        icon_marker: 'Wallet',
        icon_color: '#00d1ff'
      });

      showToast("SYSTEM INITIALIZED & CLOUD SYNCED", "success");
      setStep(5); 
    } catch (e) {
      console.error("Setup Error:", e);
      showToast("Initialization failed", "error");
    } finally {
      setIsInitializing(false);
    }
  };

  if (isInitializing && step !== 2) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="mb-8"
        >
          <div className="w-20 h-20 border-4 border-[#238636] border-t-transparent rounded-full animate-spin" />
        </motion.div>
        <h2 className="text-2xl font-black text-white uppercase tracking-[0.3em]">Building Vault</h2>
        <p className="text-white/40 text-xs mt-4 uppercase tracking-widest">Encrypting profile & generating secure ledgers</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full max-w-md bg-[#111] p-8 rounded-[2.5rem] border border-white/10 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <div className="w-12 h-12 bg-[#238636]/10 rounded-2xl flex items-center justify-center"><UserIcon className="text-[#238636]" size={24} /></div>
              {onCancel && <button onClick={onCancel} className="text-xs font-black text-white/40 hover:text-white uppercase tracking-widest">Cancel</button>}
            </div>
            <h2 className="text-3xl font-black mb-2 tracking-tighter text-white">USER PROFILE</h2>
            <p className="text-white/40 text-sm mb-8 font-medium uppercase tracking-wider">Create your unique vault identity.</p>
            <input type="text" placeholder="Username (e.g. ArVee)" className="w-full bg-black/50 border border-white/10 p-5 rounded-2xl mb-8 outline-none focus:border-[#238636] transition-all text-white font-bold" value={setupData.username} onChange={(e) => setSetupData({...setupData, username: e.target.value})} />
            <button onClick={() => { if(!setupData.username.trim()) { showToast("USERNAME REQUIRED", "error"); return; } setStep(2); }} className="w-full bg-white text-black font-black py-5 rounded-[2rem] flex items-center justify-center gap-2 hover:bg-[#238636] active:scale-95 transition-all uppercase tracking-widest">Next Step <ArrowRight size={20} /></button>
          </motion.div>
        )}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="w-full max-w-md bg-[#111] p-8 rounded-[2.5rem] border border-white/10 shadow-2xl">
            <div className="w-12 h-12 bg-[#238636]/10 rounded-2xl flex items-center justify-center mb-6"><Lock className="text-[#238636]" size={24} /></div>
            <h2 className="text-3xl font-black mb-2 tracking-tighter text-white">SECURITY PIN</h2>
            <p className="text-white/40 text-sm mb-8 font-medium uppercase tracking-wider">Set a 4-6 digit numeric password.</p>
            <div className="space-y-4 mb-8">
              <input type="password" inputMode="numeric" maxLength={6} placeholder="Set 4-6 Digit PIN" className="w-full bg-black/50 border border-white/10 p-5 rounded-2xl outline-none focus:border-[#238636] transition-all text-white font-bold tracking-[0.3em]" value={setupData.pin} onChange={(e) => setSetupData({...setupData, pin: e.target.value.replace(/\D/g, '')})} />
              <input type="password" inputMode="numeric" maxLength={6} placeholder="Confirm PIN" className="w-full bg-black/50 border border-white/10 p-5 rounded-2xl outline-none focus:border-[#238636] transition-all text-white font-bold tracking-[0.3em]" value={setupData.confirmPin} onChange={(e) => setSetupData({...setupData, confirmPin: e.target.value.replace(/\D/g, '')})} />
            </div>
            <button 
              disabled={isInitializing}
              onClick={handlePinStepNext} 
              className={`w-full ${isInitializing ? 'bg-white/20' : 'bg-white'} text-black font-black py-5 rounded-[2rem] flex items-center justify-center gap-2 hover:bg-[#238636] active:scale-95 transition-all uppercase tracking-widest`}
            >
              {isInitializing ? 'Verifying...' : 'Next Step'} <ArrowRight size={20} />
            </button>
          </motion.div>
        )}
        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="w-full max-w-md bg-[#111] p-8 rounded-[2.5rem] border border-white/10 shadow-2xl">
            <div className="w-12 h-12 bg-[#238636]/10 rounded-2xl flex items-center justify-center mb-6"><Globe className="text-[#238636]" size={24} /></div>
            <h2 className="text-3xl font-black mb-2 tracking-tighter text-white">PREFERENCES</h2>
            <p className="text-white/40 text-sm mb-8 font-medium uppercase tracking-wider">Define your base financial intelligence.</p>
            <div className="relative mb-8">
              <select className="w-full bg-black/50 border border-white/10 p-5 rounded-2xl outline-none focus:border-[#238636] transition-all appearance-none text-white font-bold" value={setupData.currency} onChange={(e) => setSetupData({...setupData, currency: e.target.value})}>
                <option value="PHP">Philippine Peso (PHP)</option>
                <option value="USD">US Dollar (USD)</option>
                <option value="EUR">Euro (EUR)</option>
              </select>
              <div className="absolute right-5 top-6 pointer-events-none text-white/40"><ArrowRight size={18} className="rotate-90" /></div>
            </div>
            <button onClick={() => setStep(4)} className="w-full bg-white text-black font-black py-5 rounded-[2rem] flex items-center justify-center gap-2 hover:bg-[#238636] active:scale-95 transition-all uppercase tracking-widest">Next Step <ArrowRight size={20} /></button>
          </motion.div>
        )}
        {step === 4 && (
          <motion.div key="step4" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="w-full max-w-md bg-[#111] p-8 rounded-[2.5rem] border border-white/10 shadow-2xl">
            <div className="w-12 h-12 bg-[#238636]/10 rounded-2xl flex items-center justify-center mb-6"><Wallet className="text-[#238636]" size={24} /></div>
            <h2 className="text-3xl font-black mb-2 tracking-tighter text-white">PRIMARY VAULT</h2>
            <p className="text-white/40 text-sm mb-8 font-medium uppercase tracking-wider">Setup your main cash or bank account.</p>
            <div className="space-y-4 mb-8">
              <input type="text" placeholder="Account Name (e.g. GCash)" className="w-full bg-black/50 border border-white/10 p-5 rounded-2xl outline-none focus:border-[#238636] transition-all text-white font-bold" value={setupData.accountName} onChange={(e) => setSetupData({...setupData, accountName: e.target.value})} />
              <input type="text" inputMode="decimal" placeholder="Current Balance" className="w-full bg-black/50 border border-white/10 p-5 rounded-2xl outline-none focus:border-[#238636] transition-all text-white font-bold tabular-nums" value={displayBalance} onChange={handleBalanceChange} />
            </div>
            <button onClick={handleCompleteSetup} className="w-full bg-white text-black font-black py-5 rounded-[2rem] flex items-center justify-center gap-2 hover:bg-[#238636] active:scale-95 transition-all uppercase tracking-widest">Initialize Engine <CheckCircle2 size={20} /></button>
          </motion.div>
        )}
        {step === 5 && (
          <motion.div key="step5" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
            <div className="w-24 h-24 bg-[#238636] rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(35,134,54,0.3)]"><CheckCircle2 size={48} className="text-black" /></div>
            <h2 className="text-4xl font-black mb-3 text-white tracking-tighter">VAULT READY</h2>
            <p className="text-white/40 font-bold uppercase tracking-[0.2em] mb-10 text-xs">Your personal profile is now encrypted & secured with your PIN.</p>
            <button onClick={() => window.location.reload()} className="px-12 py-5 bg-transparent border-2 border-[#238636] text-[#238636] rounded-full font-black uppercase tracking-widest hover:bg-[#238636] hover:text-black transition-all active:scale-90">Launch Dashboard</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}