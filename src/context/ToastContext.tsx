import React, { createContext, useContext, useState, ReactNode, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastContextType {
  showToast: (msg: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; type: ToastType; visible: boolean }>({
    msg: '',
    type: 'success',
    visible: false,
  });
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string, type: ToastType = 'success') => {
    // Clear any existing timer to prevent premature closing of new toast
    if (timerRef.current) clearTimeout(timerRef.current);
    
    setToast({ msg, type, visible: true });
    
    timerRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <AnimatePresence>
        {toast.visible && (
          <motion.div 
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-10 left-1/2 z-[999] px-6 py-3 rounded-full flex items-center gap-3 border shadow-2xl backdrop-blur-xl min-w-[280px] justify-center ${
              toast.type === 'success' ? 'bg-aura-accent/20 border-aura-accent text-aura-accent' : 
              toast.type === 'error' ? 'bg-red-500/20 border-red-500 text-red-500' : 
              'bg-white/10 border-white/20 text-white'
            }`}
          >
            {toast.type === 'success' && <Check size={18} strokeWidth={3} />}
            {toast.type === 'error' && <AlertCircle size={18} />}
            {toast.type === 'info' && <Info size={18} />}
            <span className="text-[10px] font-black uppercase tracking-[0.15em]">{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};