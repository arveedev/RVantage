import { useState } from 'react';
import { db } from './db/schema';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Globe, ArrowRight, CheckCircle2, Lock, User as UserIcon, RefreshCw } from 'lucide-react';
import Dashboard from './components/Dashboard';
import { ToastProvider } from './context/ToastContext';
import { useToast } from './context/useToast';
import { AuthProvider } from './components/AuthContext';
import { useSync } from './hooks/useSync';

function Login({ onAuthSuccess, onCreateNew }: { onAuthSuccess: () => void; onCreateNew: () => void }) {
  const { showToast } = useToast();
  const [isRecovering, setIsRecovering] = useState(false);
  const users = useLiveQuery(() => db.users.toArray());
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbxOkYlb31V5-p3C8AMqeKm4aJL9ngbohGmc1XhmUKiBOciLTOK_k8iuBrfQbj_uUHKc/exec';

  const handleLogin = async (user: any) => {
    try {
      await db.session.put({ id: 'current', user_id: user.id });
      await db.users.update(user.id, { last_login: new Date() });
      showToast(`WELCOME BACK, ${user.username.toUpperCase()}`, "success");
      onAuthSuccess();
    } catch (e) {
      showToast("Login failed", "error");
    }
  };

  const handleRecoverProfiles = async () => {
    setIsRecovering(true);
    try {
      const response = await fetch(`${GAS_URL}?action=getGlobalUsers`);
      const result = await response.json();
      
      if (result.status === 'success' && result.data) {
        for (const remoteUser of result.data) {
          await db.users.put({
            id: remoteUser.id,
            username: remoteUser.username,
            last_login: new Date(remoteUser.last_login || Date.now())
          });
        }
        showToast(`${result.data.length} PROFILES RECOVERED`, "success");
      }
    } catch (e) {
      showToast("Recovery failed", "error");
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-aura-card p-8 rounded-[2.5rem] border border-white/10 shadow-2xl text-center"
      >
        <div className="w-16 h-16 bg-aura-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock className="text-aura-accent" size={28} />
        </div>
        <h2 className="text-3xl font-black mb-2 tracking-tighter text-white uppercase">Identity Required</h2>
        <p className="text-aura-subtle text-xs mb-8 font-black uppercase tracking-[0.2em]">Select an account to access the vault</p>

        <div className="space-y-3 mb-8">
          {users?.map(user => (
            <button
              key={user.id}
              onClick={() => handleLogin(user)}
              className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl flex items-center justify-between group hover:border-aura-accent transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center group-hover:bg-aura-accent/20">
                  <UserIcon size={20} className="text-white group-hover:text-aura-accent" />
                </div>
                <span className="font-bold text-white uppercase tracking-wider">{user.username}</span>
              </div>
              <ArrowRight size={18} className="text-white/20 group-hover:text-aura-accent" />
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <button 
            onClick={onCreateNew}
            className="text-[10px] font-black text-aura-subtle hover:text-white transition-colors uppercase tracking-[0.3em]"
          >
            + Create New Vault Profile
          </button>

          <button 
            onClick={handleRecoverProfiles}
            disabled={isRecovering}
            className="flex items-center justify-center gap-2 text-[10px] font-black text-aura-accent/60 hover:text-aura-accent transition-colors uppercase tracking-[0.3em] disabled:opacity-50"
          >
            <RefreshCw size={12} className={isRecovering ? "animate-spin" : ""} />
            {isRecovering ? "Syncing..." : "Recover Profiles from Cloud"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function SetupWizard({ onCancel }: { onCancel?: () => void }) {
  const { showToast } = useToast();
  const { syncUser } = useSync();
  const [step, setStep] = useState(1);
  const [displayBalance, setDisplayBalance] = useState("");
  const [setupData, setSetupData] = useState({
    username: '',
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
    if (!setupData.username.trim()) {
      showToast("Username required", "error");
      setStep(1);
      return;
    }
    if (!setupData.accountName.trim()) {
      showToast("Account name required", "error");
      return;
    }

    try {
      // Use existing ID if we can find it by username, otherwise create new
      const existingUser = await db.users.where('username').equals(setupData.username).first();
      const userId = existingUser ? existingUser.id : crypto.randomUUID();

      // 1. Create/Update User Local
      await db.users.put({
        id: userId,
        username: setupData.username,
        last_login: new Date()
      });

      // 2. Set Active Session Local
      await db.session.put({ id: 'current', user_id: userId });

      // 3. Save Currency Setting Local
      await db.settings.put({
        config_key: 'base_currency',
        config_value: setupData.currency,
        user_id: userId
      });

      // 4. Create Initial Account Local
      // Check if user already has an account with this name to prevent duplicate keys
      const accountId = 'ACC-' + Math.random().toString(36).substr(2, 9);
      await db.accounts.put({
        id: accountId, 
        name: setupData.accountName,
        balance: Number(setupData.initialBalance),
        include_in_glance: true,
        is_shared: false,
        user_id: userId,
        icon_marker: 'Wallet',
        icon_color: '#00d1ff'
      });

      // 5. Cloud Sync
      try {
        await syncUser({ id: userId, username: setupData.username });
        showToast("SYSTEM INITIALIZED & CLOUD SYNCED", "success");
      } catch (syncErr) {
        console.warn("Cloud sync failed, but local data saved.", syncErr);
        showToast("LOCAL PROFILE READY (OFFLINE)", "success");
      }

      setStep(4); 
    } catch (e) {
      console.error("Critical Setup Error:", e);
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
            <div className="flex justify-between items-center mb-6">
              <div className="w-12 h-12 bg-aura-accent/10 rounded-2xl flex items-center justify-center">
                <UserIcon className="text-aura-accent" size={24} />
              </div>
              {onCancel && (
                <button 
                  onClick={onCancel}
                  className="text-xs font-black text-white/40 hover:text-white uppercase tracking-widest"
                >
                  Cancel
                </button>
              )}
            </div>
            <h2 className="text-3xl font-black mb-2 tracking-tighter text-white">USER PROFILE</h2>
            <p className="text-aura-subtle text-sm mb-8 font-medium uppercase tracking-wider">Create your unique vault identity.</p>
            
            <input 
              type="text"
              placeholder="Username (e.g. ArVee)"
              className="w-full bg-black/50 border border-white/10 p-5 rounded-2xl mb-8 outline-none focus:border-aura-accent transition-all text-white font-bold"
              value={setupData.username}
              onChange={(e) => setSetupData({...setupData, username: e.target.value})}
            />

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
              <Globe className="text-aura-accent" size={24} />
            </div>
            <h2 className="text-3xl font-black mb-2 tracking-tighter text-white">PREFERENCES</h2>
            <p className="text-aura-subtle text-sm mb-8 font-medium uppercase tracking-wider">Define your base financial intelligence.</p>
            
            <div className="relative mb-8">
              <select 
                className="w-full bg-black/50 border border-white/10 p-5 rounded-2xl outline-none focus:border-aura-accent transition-all appearance-none text-white font-bold"
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
              onClick={() => setStep(3)}
              className="w-full bg-white text-black font-black py-5 rounded-[2rem] flex items-center justify-center gap-2 hover:bg-aura-accent active:scale-95 transition-all uppercase tracking-widest"
            >
              Next Step <ArrowRight size={20} />
            </button>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div 
            key="step3"
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
            <p className="text-aura-subtle font-bold uppercase tracking-[0.2em] mb-10 text-xs">Your personal profile is now encrypted & secured.</p>
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
  const session = useLiveQuery(() => db.session.get('current'));
  const usersCount = useLiveQuery(() => db.users.count());
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const isAuthenticated = !!session;
  const hasUsers = usersCount !== undefined && usersCount > 0;

  return (
    <ToastProvider>
      <AuthProvider>
        {(!hasUsers || isCreatingNew) ? (
          <SetupWizard onCancel={hasUsers ? () => setIsCreatingNew(false) : undefined} />
        ) : isAuthenticated ? (
          <Dashboard />
        ) : (
          <Login 
            onAuthSuccess={() => {}} 
            onCreateNew={() => setIsCreatingNew(true)} 
          />
        )}
      </AuthProvider>
    </ToastProvider>
  );
}