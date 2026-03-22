import { motion } from 'framer-motion';
import { X, Info, CreditCard, Palette, Users, User, Eye, EyeOff, Loader2, Check, Trash2, Wallet, Landmark, PiggyBank, Coins, Receipt, CreditCard as CardIcon, Briefcase, Home, Car, ShoppingBag, Gift, Heart } from 'lucide-react';
import { db } from '../../db/schema';
import { useToast } from '../../context/useToast';
import { useState, useEffect } from 'react';

// Expanded color palette
const PRESET_COLORS = [
  '#00d1ff', '#00E676', '#FF3D00', '#FFD600', '#AF52DE', 
  '#FF2D55', '#795548', '#607D8B', '#E91E63', '#9C27B0', 
  '#3F51B5', '#009688', '#FFFFFF'
];

// Expanded icon list for more variety
const EXTENDED_ICONS = [
  { name: 'Wallet', icon: Wallet },
  { name: 'Landmark', icon: Landmark },
  { name: 'PiggyBank', icon: PiggyBank },
  { name: 'Coins', icon: Coins },
  { name: 'Receipt', icon: Receipt },
  { name: 'Card', icon: CardIcon },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'Home', icon: Home },
  { name: 'Car', icon: Car },
  { name: 'ShoppingBag', icon: ShoppingBag },
  { name: 'Gift', icon: Gift },
  { name: 'Heart', icon: Heart },
];

interface AccountLogicModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAccount: any;
  setEditingAccount: (a: any) => void;
  isProcessingAccount: boolean;
  setIsProcessingAccount: (v: boolean) => void;
  userId: string | undefined;
  syncAccounts: () => Promise<void>;
  config: any;
  accountIcons: { name: string; icon: any }[];
}

export default function AccountLogicModal({ 
  isOpen, 
  onClose, 
  editingAccount, 
  setEditingAccount, 
  isProcessingAccount, 
  setIsProcessingAccount, 
  userId, 
  syncAccounts, 
  config 
}: AccountLogicModalProps) {
  const { showToast } = useToast();
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    if (isOpen && editingAccount) {
      setDisplayValue(editingAccount.balance?.toString() || '');
    }
  }, [isOpen, editingAccount?.id]);

  const formatNumberForDisplay = (val: string) => {
    if (!val) return '';
    const parts = val.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join('.');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/,/g, '');
    if (/^\d*\.?\d*$/.test(rawValue)) {
      setDisplayValue(rawValue);
      const parsed = parseFloat(rawValue);
      setEditingAccount({
        ...editingAccount, 
        balance: isNaN(parsed) ? 0 : parsed
      });
    }
  };

  const handleSaveAccount = async () => {
    if (!editingAccount?.name || !userId) return;
    setIsProcessingAccount(true);
    try {
      await db.accounts.put({
        id: editingAccount.id || crypto.randomUUID(),
        name: editingAccount.name,
        balance: parseFloat(displayValue) || 0,
        is_shared: editingAccount.is_shared || false,
        include_in_glance: editingAccount.include_in_glance ?? true,
        icon_marker: editingAccount.icon_marker || 'Wallet',
        icon_color: editingAccount.icon_color || '#00d1ff',
        user_id: userId 
      });
      await syncAccounts();
      showToast("ACCOUNT UPDATED", "success");
      onClose();
    } catch (e) { 
      showToast("Operation Failed", "error"); 
    } finally { 
      setIsProcessingAccount(false); 
    }
  };

  const handleDeleteAccount = async () => {
    if (!editingAccount?.id) return;
    if (!confirm("Are you sure? This will permanently delete this account and its history.")) return;
    
    setIsProcessingAccount(true);
    try {
      await db.accounts.delete(editingAccount.id);
      await syncAccounts();
      showToast("ACCOUNT DELETED", "success");
      onClose();
    } catch (e) {
      showToast("Delete Failed", "error");
    } finally {
      setIsProcessingAccount(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[250] bg-black/95 backdrop-blur-2xl p-6 flex flex-col justify-end sm:justify-center">
      <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="max-w-md mx-auto w-full bg-aura-card border border-white/10 rounded-[3rem] p-8 shadow-3xl space-y-8 max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white">Account Logic</h2>
            <p className="text-[10px] text-aura-subtle font-bold tracking-widest uppercase">By ArVee</p>
          </div>
          <button onClick={onClose} className="p-3 bg-white/5 rounded-full text-white/40 active:scale-90"><X size={20}/></button>
        </div>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[9px] font-black opacity-40 uppercase ml-1 tracking-widest flex items-center gap-2 text-white/60"><Info size={10} /> Account Identity</label>
            <input type="text" placeholder="e.g. Cold Storage" value={editingAccount?.name || ''} onChange={e => setEditingAccount({...editingAccount, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold text-lg outline-none focus:border-aura-accent text-white" />
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black opacity-40 uppercase ml-1 tracking-widest flex items-center gap-2 text-white/60"><CreditCard size={10} /> Liquid Assets</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-aura-accent font-black text-xl">{config.base_currency}</span>
              <input 
                type="text" 
                inputMode="decimal"
                value={formatNumberForDisplay(displayValue)} 
                onChange={handleInputChange} 
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 pl-16 font-black text-4xl outline-none focus:border-aura-accent text-white tabular-nums" 
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[9px] font-black opacity-40 uppercase ml-1 tracking-widest text-white/60 flex items-center gap-2"><Palette size={10} /> Visual Marker</label>
            
            {/* Expanded Icon Grid */}
            <div className="grid grid-cols-4 gap-2">
              {EXTENDED_ICONS.map(item => (
                <button key={item.name} onClick={() => setEditingAccount({...editingAccount, icon_marker: item.name})} className={`aspect-square rounded-2xl border flex items-center justify-center transition-all ${editingAccount?.icon_marker === item.name ? 'bg-white text-black border-white scale-105' : 'bg-white/5 border-white/10 text-white/40'}`}>
                  <item.icon size={18} />
                </button>
              ))}
            </div>

            {/* Expanded Color Palette */}
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {PRESET_COLORS.map(color => (
                <button key={color} onClick={() => setEditingAccount({...editingAccount, icon_color: color})} className={`w-7 h-7 rounded-full border-2 transition-all ${editingAccount?.icon_color === color ? 'border-white scale-125' : 'border-transparent'}`} style={{ backgroundColor: color }} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button onClick={() => setEditingAccount({...editingAccount, is_shared: !editingAccount?.is_shared})} className={`flex flex-col items-center gap-2 p-4 rounded-3xl border transition-all ${editingAccount?.is_shared ? 'bg-[#00d1ff]/10 border-[#00d1ff] text-[#00d1ff]' : 'bg-transparent border-white/10 text-white/20'}`}>
              {editingAccount?.is_shared ? <Users size={20} /> : <User size={20} />}
              <span className="text-[9px] font-black uppercase">Shared</span>
            </button>
            <button onClick={() => setEditingAccount({...editingAccount, include_in_glance: !editingAccount?.include_in_glance})} className={`flex flex-col items-center gap-2 p-4 rounded-3xl border transition-all ${editingAccount?.include_in_glance ? 'bg-aura-accent/10 border-aura-accent text-aura-accent' : 'bg-transparent border-white/10 text-white/20'}`}>
              {editingAccount?.include_in_glance ? <Eye size={20} /> : <EyeOff size={20} />}
              <span className="text-[9px] font-black uppercase">In Total</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-4">
          <button disabled={isProcessingAccount} onClick={handleSaveAccount} className="w-full bg-white text-black font-black p-6 rounded-[2rem] flex items-center justify-center gap-3 shadow-[0_20px_40px_rgba(255,255,255,0.1)] active:scale-95">
            {isProcessingAccount ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} strokeWidth={3} />} 
            {editingAccount?.id ? "UPDATE DEPLOYMENT" : "INITIALIZE ACCOUNT"}
          </button>

          {/* New Delete Button */}
          {editingAccount?.id && (
            <button disabled={isProcessingAccount} onClick={handleDeleteAccount} className="w-full bg-red-500/10 text-red-500 border border-red-500/20 font-black p-4 rounded-[1.5rem] flex items-center justify-center gap-2 active:scale-95 transition-all text-[10px] uppercase tracking-widest mt-2">
              <Trash2 size={14} /> Destroy Account
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}