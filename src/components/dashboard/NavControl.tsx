import { motion } from 'framer-motion';
import { Wallet, Plus, TrendingUp } from 'lucide-react';

interface NavControlProps {
  activeTab: 'home' | 'simulator';
  setActiveTab: (tab: 'home' | 'simulator') => void;
  onAddClick: () => void;
}

export default function NavControl({ activeTab, setActiveTab, onAddClick }: NavControlProps) {
  return (
    <nav className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[#0a0a0a]/90 backdrop-blur-3xl border border-white/10 px-8 py-5 rounded-[3.5rem] flex gap-10 items-center shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100]">
      {/* Home / Wallet Tab */}
      <button 
        onClick={() => setActiveTab('home')} 
        className={`relative flex items-center justify-center p-2 transition-all duration-500 ${
          activeTab === 'home' ? 'text-aura-accent scale-150' : 'text-white/20 hover:text-white/40'
        }`}
      >
        <Wallet size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
        {activeTab === 'home' && (
          <motion.div 
            layoutId="nav-glow" 
            className="absolute -inset-4 bg-aura-accent/20 blur-2xl rounded-full" 
          />
        )}
      </button>

      {/* Main Action Button (Plus) */}
      <button 
        onClick={onAddClick}
        className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-black active:scale-90 shadow-[0_10px_30px_rgba(255,255,255,0.2)] transition-all z-[110]"
      >
        <Plus size={28} strokeWidth={3} />
      </button>

      {/* Simulator / Trends Tab */}
      <button 
        onClick={() => setActiveTab('simulator')} 
        className={`relative flex items-center justify-center p-2 transition-all duration-500 ${
          activeTab === 'simulator' ? 'text-aura-accent scale-150' : 'text-white/20 hover:text-white/40'
        }`}
      >
        <TrendingUp size={24} strokeWidth={activeTab === 'simulator' ? 2.5 : 2} />
        {activeTab === 'simulator' && (
          <motion.div 
            layoutId="nav-glow" 
            className="absolute -inset-4 bg-aura-accent/20 blur-2xl rounded-full" 
          />
        )}
      </button>
    </nav>
  );
}