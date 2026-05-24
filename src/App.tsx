import { useState, useEffect } from 'react';
import { db } from './db/schema';
import { useLiveQuery } from 'dexie-react-hooks';
import Dashboard from './components/dashboard/index';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './components/AuthContext';

// Segmented Components
import Login from './components/auth/Login';
import SetupWizard from './components/auth/SetupWizard';

function AppContent() {
  // Use a single query for synchronization stability
  const appData = useLiveQuery(async () => {
    const session = await db.session.get('current');
    const usersCount = await db.users.count();
    return { session, usersCount };
  });

  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isForcingLogin, setIsForcingLogin] = useState(false);

  // EMERGENCY TIMEOUT: 
  // If Dexie takes longer than 3 seconds, we force the Login screen 
  // so the user can at least try to "Recover Profiles" from the cloud.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!appData) {
        console.warn("⚠️ Database lag detected. Forcing Login interface...");
        setIsForcingLogin(true);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [appData]);

  // Loading state (Pre-timeout)
  if (!appData && !isForcingLogin) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#238636] border-t-transparent rounded-full animate-spin mb-6" />
        <h1 className="text-white font-black text-xl tracking-[0.5em] uppercase mb-2">ARiSe</h1>
        <p className="text-[#238636] text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">
          Synchronizing Vault...
        </p>
      </div>
    ); 
  }

  const session = appData?.session;
  const usersCount = appData?.usersCount ?? 0;
  const isAuthenticated = !!session;
  const hasUsers = usersCount > 0;

  // Logic for view routing:
  // 1. If we have a session, go to Dashboard.
  // 2. If user specifically clicked "Create New", show Setup.
  // 3. If zero users exist (and we didn't timeout), show Setup.
  // 4. Default to Login (allows for Recovery).
  
  if (isAuthenticated && !isCreatingNew) {
    return <Dashboard />;
  }

  if (isCreatingNew || (usersCount === 0 && !isForcingLogin)) {
    return (
      <SetupWizard 
        onCancel={hasUsers ? () => setIsCreatingNew(false) : undefined} 
      />
    );
  }

  return (
    <Login 
      onAuthSuccess={() => setIsCreatingNew(false)} 
      onCreateNew={() => setIsCreatingNew(true)} 
    />
  );
}

export default function App() {
  // GLOBAL TOUCH RIPPLE EFFECT
  useEffect(() => {
    const handleTouch = (e: TouchEvent) => {
      const ripple = document.createElement("div");
      ripple.className = "absolute bg-aura-accent/30 rounded-full animate-ping z-[9999] pointer-events-none";
      ripple.style.width = "40px";
      ripple.style.height = "40px";
      // Center the ripple on the touch point
      ripple.style.left = `${e.touches[0].clientX - 20}px`;
      ripple.style.top = `${e.touches[0].clientY - 20}px`;
      document.body.appendChild(ripple);
      
      // Clean up the DOM element after animation completes
      setTimeout(() => ripple.remove(), 500);
    };
    
    // Listen for touchstarts globally
    window.addEventListener('touchstart', handleTouch);
    return () => window.removeEventListener('touchstart', handleTouch);
  }, []);

  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}