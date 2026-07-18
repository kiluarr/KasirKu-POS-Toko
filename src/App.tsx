import { useState, useEffect } from 'react';
import { 
  Lock, 
  Unlock, 
  Delete, 
  ShieldAlert, 
  Sparkles, 
  Store,
  FolderOpen
} from 'lucide-react';
import { StoreSettings } from './types';
import { getSettings, seedInitialProductsIfEmpty } from './lib/db';
import BottomNav from './components/BottomNav';
import BerandaView from './components/BerandaView';
import KasirView from './components/KasirView';
import RiwayatView from './components/RiwayatView';
import LaporanView from './components/LaporanView';
import PengaturanView from './components/PengaturanView';
import ProdukView from './components/ProdukView';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('beranda');
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [showSplash, setShowSplash] = useState<boolean>(true);
  
  // Security lock screen
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [pinError, setPinError] = useState<boolean>(false);

  // Overlay state for Product CRUD
  const [isProductCrudOpen, setIsProductCrudOpen] = useState<boolean>(false);

  // Tab and modal change handler
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setIsProductCrudOpen(false);
  };

  // Automatically close product CRUD overlay modal when changing navigation tabs
  useEffect(() => {
    setIsProductCrudOpen(false);
  }, [activeTab]);

  // Splash screen timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000); // 2 seconds splash screen
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    async function initializePOS() {
      try {
        // Seed initial foods & drinks products if DB is empty
        await seedInitialProductsIfEmpty();
        
        // Fetch loaded settings
        const currentSettings = await getSettings();
        setSettings(currentSettings);

        // If no PIN is configured, bypass the security gate
        if (!currentSettings.pin) {
          setIsUnlocked(true);
        }
      } catch (err) {
        console.error('Error during POS database boot:', err);
      }
    }
    initializePOS();
  }, []);

  // Update live settings reactively across child views
  const handleUpdateSettings = (newSettings: StoreSettings) => {
    setSettings(newSettings);
  };

  // Numpad input handler
  const handleNumpadPress = (num: string) => {
    setPinError(false);
    if (enteredPin.length < 8) {
      const nextPin = enteredPin + num;
      setEnteredPin(nextPin);

      // Auto-validate if it reaches stored pin size
      if (settings && nextPin === settings.pin) {
        setTimeout(() => {
          setIsUnlocked(true);
          setEnteredPin('');
        }, 150);
      } else if (settings && nextPin.length === settings.pin.length) {
        // Incorrect PIN after reaching target length
        setTimeout(() => {
          setPinError(true);
          setEnteredPin('');
        }, 200);
      }
    }
  };

  const handleNumpadBackspace = () => {
    setEnteredPin(enteredPin.slice(0, -1));
  };

  const handleNumpadClear = () => {
    setEnteredPin('');
    setPinError(false);
  };

  // SPLASH SCREEN LOADING & BRANDING
  if (showSplash || !settings) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-between p-8 text-slate-100 font-sans select-none">
        {/* Top Spacer */}
        <div />

        {/* Center Logo and Branding */}
        <div className="flex flex-col items-center space-y-6 text-center">
          <div className="relative">
            {/* Outer ambient pulsing glow */}
            <div className="absolute -inset-6 bg-emerald-500/20 rounded-full blur-2xl animate-pulse" />
            
            {/* Inner logo frame */}
            <div className="relative inline-flex p-5 bg-gradient-to-tr from-emerald-950 to-slate-900 border-2 border-emerald-500/60 text-emerald-400 rounded-3xl shadow-2xl shadow-emerald-950/80 scale-110">
              <Store className="w-10 h-10 animate-pulse" />
            </div>
            
            {/* Tiny accent spark icon */}
            <div className="absolute -top-1 -right-1 p-1 bg-emerald-500 text-slate-950 rounded-full shadow border-2 border-slate-950">
              <Sparkles className="w-3.5 h-3.5 fill-current animate-bounce" />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <h1 className="text-3xl font-black text-white tracking-wider uppercase">KasirPro POS</h1>
            <p className="text-xs text-emerald-400 font-extrabold tracking-widest uppercase font-mono">Sistem Kasir Pintar & Modern</p>
          </div>
        </div>

        {/* Bottom loading status */}
        <div className="flex flex-col items-center space-y-4 w-full max-w-xs">
          <div className="w-full bg-slate-900/80 h-1.5 rounded-full overflow-hidden border border-slate-850/60 p-[1px]">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full rounded-full animate-progress-bar" />
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-[9px] text-slate-400 font-extrabold tracking-widest uppercase font-mono">
              {!settings ? 'Menghubungkan Database...' : 'Menyiapkan Aplikasi Kasir...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // RENDER PIN SECURITY GATE
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-xs w-full text-center space-y-6">
          
          {/* Logo Brand */}
          <div className="space-y-2">
            <div className="inline-flex p-3.5 bg-emerald-950/80 border border-emerald-800/40 text-emerald-400 rounded-2xl shadow-xl shadow-emerald-950/60">
              <Store className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight uppercase">KasirPro POS</h1>
            <p className="text-xs text-slate-400">Masukkan PIN Keamanan untuk Membuka Kasir</p>
          </div>

          {/* Dots Indicator */}
          <div className="flex justify-center gap-3 py-2">
            {Array.from({ length: settings.pin.length }).map((_, idx) => (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                  idx < enteredPin.length
                    ? 'bg-emerald-400 border-emerald-400 scale-125 shadow-md shadow-emerald-400/50'
                    : 'bg-transparent border-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Error message */}
          {pinError && (
            <div className="py-1.5 px-3 bg-red-950/40 border border-red-900/30 rounded-xl flex items-center justify-center gap-1.5 text-xs text-red-400 animate-pulse">
              <ShieldAlert className="w-4 h-4" /> PIN salah! Harap coba kembali.
            </div>
          )}

          {/* Secure numpad matrix layout */}
          <div className="grid grid-cols-3 gap-3 pt-4">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                onClick={() => handleNumpadPress(num)}
                className="h-14 bg-slate-900 hover:bg-slate-850 text-xl font-extrabold text-slate-100 rounded-2xl border border-slate-850/60 active:scale-95 transition-all select-none cursor-pointer"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleNumpadClear}
              className="h-14 bg-slate-950 hover:bg-slate-900 text-xs font-bold text-slate-500 rounded-2xl active:scale-95 transition-all select-none cursor-pointer"
            >
              C
            </button>
            <button
              onClick={() => handleNumpadPress('0')}
              className="h-14 bg-slate-900 hover:bg-slate-850 text-xl font-extrabold text-slate-100 rounded-2xl border border-slate-850/60 active:scale-95 transition-all select-none cursor-pointer"
            >
              0
            </button>
            <button
              onClick={handleNumpadBackspace}
              className="h-14 bg-slate-955 text-slate-400 hover:text-slate-200 rounded-2xl flex items-center justify-center active:scale-95 transition-all select-none cursor-pointer"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          {/* Lock status banner */}
          <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest pt-2">
            🔒 SECURED OFFLINE DIRECTORY
          </p>
        </div>
      </div>
    );
  }

  // RENDER APP ONCE UNLOCKED
  const renderTabContent = () => {
    switch (activeTab) {
      case 'beranda':
        return (
          <BerandaView
            setTab={handleTabChange}
            settings={settings}
            onOpenProductCRUD={() => setIsProductCrudOpen(true)}
            onLock={() => setIsUnlocked(false)}
          />
        );
      case 'kasir':
        return <KasirView settings={settings} />;
      case 'riwayat':
        return <RiwayatView settings={settings} />;
      case 'laporan':
        return <LaporanView settings={settings} />;
      case 'pengaturan':
        return (
          <PengaturanView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onLock={() => setIsUnlocked(false)}
          />
        );
      default:
        return null;
    }
  };

  // Support conditional Light vs Dark Mode styling context wrapper
  const themeClass = settings.theme === 'light' ? 'theme-light bg-gray-50 text-slate-900' : 'theme-dark bg-slate-950 text-slate-100';

  return (
    <div className={`min-h-screen ${themeClass} font-sans antialiased overflow-x-hidden selection:bg-emerald-500 selection:text-slate-950`}>
      
      {/* Active Tab View */}
      <main className="w-full">
        {renderTabContent()}
      </main>



      {/* Product CRUD manager Modal sheet overlay (accessible from Beranda Quick Action / Pengaturan link) */}
      {isProductCrudOpen && (
        <div className="fixed inset-0 z-50">
          <ProdukView
            settings={settings}
            onClose={() => setIsProductCrudOpen(false)}
          />
        </div>
      )}

      {/* Static persistent Bottom Mobile Navigation Panel */}
      {!isProductCrudOpen && (
        <BottomNav currentTab={activeTab} setTab={handleTabChange} />
      )}
    </div>
  );
}
