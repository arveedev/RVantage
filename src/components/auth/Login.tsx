import { useState } from 'react';
import { db } from '../../db/schema';
import { motion } from 'framer-motion';
import { Lock, RefreshCw, Loader2 } from 'lucide-react';
import { useToast } from '../../context/useToast';

interface LoginProps {
  onAuthSuccess: () => void;
  onCreateNew: () => void;
}

export default function Login({ onAuthSuccess, onCreateNew }: LoginProps) {
  const { showToast } = useToast();
  const [isRecovering, setIsRecovering] = useState(false);
  const [pin, setPin] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbxOkYlb31V5-p3C8AMqeKm4aJL9ngbohGmc1XhmUKiBOciLTOK_k8iuBrfQbj_uUHKc/exec';

  const handlePinSubmit = async () => {
    const cleanPin = pin.trim();
    if (cleanPin.length < 4) return;
    
    try {
      // Find user by PIN locally
      const user = await db.users.where('password').equals(cleanPin).first();
      
      if (user) {
        setIsLoggingIn(true);
        try {
          // Artificial delay for security feel/synchronization
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Use a transaction to ensure both session and last_login update together
          await db.transaction('rw', [db.session, db.users], async () => {
            await db.session.put({ id: 'current', user_id: user.id });
            await db.users.update(user.id, { last_login: new Date() });
          });
          
          showToast(`WELCOME BACK, ${user.username.toUpperCase()}`, "success");
          
          // Final safety delay to let App state catch up
          setTimeout(() => {
            onAuthSuccess();
          }, 200);
          
        } catch (e) {
          showToast("AUTHENTICATION ERROR", "error");
          setIsLoggingIn(false);
        }
      } else {
        showToast("INVALID PIN NUMBER", "error");
        setPin("");
      }
    } catch (err) {
      console.error("Login Query Error:", err);
      showToast("DATABASE ERROR - PLEASE REFRESH", "error");
    }
  };

  const handleRecoverProfiles = async () => {
    setIsRecovering(true);
    try {
      const response = await fetch(`${GAS_URL}?action=getGlobalUsers`);
      const result = await response.json();
      
      if (result.status === 'success' && result.data && result.data.length > 0) {
        // Atomic transaction for all recovered users
        await db.transaction('rw', db.users, async () => {
          for (const remoteUser of result.data) {
            await db.users.put({
              id: remoteUser.id,
              username: String(remoteUser.username).trim(),
              // Map 'pin' from cloud to 'password' locally - Ensure it is String
              password: String(remoteUser.pin || remoteUser.password).trim(),
              last_login: new Date(remoteUser.last_login || Date.now())
            });
          }
        });

        showToast(`${result.data.length} PROFILES RECOVERED`, "success");
        
        // Wait 2 seconds to ensure Dexie has finalized the file write
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        showToast("NO PROFILES FOUND IN CLOUD", "error");
      }
    } catch (e) {
      console.error("Recovery Error:", e);
      showToast("RECOVERY FAILED - CHECK CONNECTION", "error");
    } finally {
      setIsRecovering(false);
    }
  };

  if (isLoggingIn) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="mb-8"
        >
          <Loader2 className="text-[#238636]" size={64} />
        </motion.div>
        <h2 className="text-2xl font-black text-white uppercase tracking-[0.3em]">Decrypting Vault...</h2>
        <p className="text-white/40 text-xs mt-4 uppercase tracking-widest">Loading secure data environment</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-[#111] p-8 rounded-[2.5rem] border border-white/10 shadow-2xl text-center"
      >
        <div className="w-16 h-16 bg-[#238636]/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock className="text-[#238636]" size={28} />
        </div>
        
        <h2 className="text-3xl font-black mb-2 tracking-tighter text-white uppercase">Vault Access</h2>
        <p className="text-white/40 text-xs mb-8 font-black uppercase tracking-[0.2em]">Enter security PIN to identify profile</p>
        
        <div className="mb-8">
          <input 
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder="••••••"
            autoFocus
            className="w-full bg-black/50 border border-white/10 p-5 rounded-2xl mb-4 outline-none focus:border-[#238636] transition-all text-white font-bold text-center text-3xl tracking-[0.5em]"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
          />

          <button 
            onClick={handlePinSubmit}
            disabled={pin.length < 4}
            className="w-full py-5 bg-white text-black font-black rounded-2xl uppercase tracking-widest disabled:opacity-30 disabled:grayscale transition-all active:scale-95"
          >
            Authenticate
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <button 
            onClick={onCreateNew}
            className="text-[10px] font-black text-white/40 hover:text-white transition-colors uppercase tracking-[0.3em]"
          >
            + Create New Vault Profile
          </button>

          <button 
            onClick={handleRecoverProfiles}
            disabled={isRecovering}
            className="flex items-center justify-center gap-2 text-[10px] font-black text-[#238636]/60 hover:text-[#238636] transition-colors uppercase tracking-[0.3em] disabled:opacity-50"
          >
            <RefreshCw size={12} className={isRecovering ? "animate-spin" : ""} />
            {isRecovering ? "Syncing..." : "Recover Profiles from Cloud"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}