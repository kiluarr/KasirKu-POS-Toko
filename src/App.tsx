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
      <div className="min-h-screen bg-gradient-to-tr from-[#001D39] to-[#0A4174] flex flex-col items-center justify-between p-8 text-white font-sans select-none relative overflow-hidden">
        {/* Decorative background circle glows */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#7BBDE8]/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#4E8EA2]/20 rounded-full blur-3xl animate-pulse" />
        
        {/* Top Spacer */}
        <div />
 
        {/* Center Logo and Branding */}
        <div className="flex flex-col items-center space-y-5 text-center relative z-10">
          <div className="relative">
            {/* Center Logo Card - mimicking FreshCart mockup */}
            <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center shadow-[0_12px_40px_rgba(0,0,0,0.12)] scale-110 transition-all">
              <Store className="w-12 h-12 text-[#0A4174]" />
            </div>
            
            {/* Tiny accent spark icon */}
            <div className="absolute -top-1 -right-1 p-1 bg-white text-[#0A4174] rounded-full shadow-lg border-2 border-[#0A4174]">
              <Sparkles className="w-3.5 h-3.5 fill-current animate-bounce" />
            </div>
          </div>
 
          <div className="space-y-1.5 pt-4">
            <h1 className="text-3xl font-black text-white tracking-tight">KasirPro</h1>
            <p className="text-[#7BBDE8] font-extrabold tracking-widest uppercase text-[10px]">Sistem Kasir Pintar & Modern</p>
          </div>
        </div>
 
        {/* Bottom loading status */}
        <div className="flex flex-col items-center space-y-4 w-full max-w-xs relative z-10">
          <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden p-[1px]">
            <div className="bg-white h-full rounded-full animate-progress-bar" />
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] text-slate-200 font-bold tracking-wider uppercase">
              {!settings ? 'Menghubungkan Database...' : 'Menyiapkan Aplikasi Kasir...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // RENDER PIN SECURITY GATE
  if (!isUnlocked) {
    const isLight = settings.theme === 'light';
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-300 ${
        isLight ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100'
      }`}>
        <div className="max-w-xs w-full text-center space-y-6">
          
          {/* Logo Brand */}
          <div className="space-y-2">
            <div className={`inline-flex p-4 rounded-3xl shadow-md transition-all ${
              isLight 
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-100' 
                : 'bg-emerald-950/80 border border-emerald-800/40 text-emerald-400 shadow-md shadow-emerald-950/40'
            }`}>
              <Store className="w-8 h-8" />
            </div>
            <h1 className={`text-2xl font-black tracking-tight uppercase mt-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>KasirPro POS</h1>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Masukkan PIN Keamanan untuk Membuka Kasir</p>
          </div>

          {/* Dots Indicator */}
          <div className="flex justify-center gap-3 py-2">
            {Array.from({ length: settings.pin.length }).map((_, idx) => (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                  idx < enteredPin.length
                    ? isLight 
                      ? 'bg-emerald-500 border-emerald-500 scale-125 shadow-md shadow-emerald-300'
                      : 'bg-emerald-400 border-emerald-400 scale-125 shadow-md shadow-emerald-400/50'
                    : isLight
                      ? 'bg-transparent border-slate-300'
                      : 'bg-transparent border-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Error message */}
          {pinError && (
            <div className={`py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs animate-pulse ${
              isLight 
                ? 'bg-red-50 border border-red-100 text-red-600' 
                : 'bg-red-950/40 border border-red-900/30 text-red-400'
            }`}>
              <ShieldAlert className="w-4 h-4" /> PIN salah! Harap coba kembali.
            </div>
          )}

          {/* Secure numpad matrix layout */}
          <div className="grid grid-cols-3 gap-3 pt-4">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                onClick={() => handleNumpadPress(num)}
                className={`h-14 text-xl font-extrabold rounded-2xl border active:scale-95 transition-all select-none cursor-pointer ${
                  isLight
                    ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200/60 shadow-sm'
                    : 'bg-slate-900 hover:bg-slate-850 text-slate-100 border-slate-850/60'
                }`}
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleNumpadClear}
              className={`h-14 text-xs font-bold rounded-2xl active:scale-95 transition-all select-none cursor-pointer ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-500'
                  : 'bg-slate-950 hover:bg-slate-900 text-slate-500'
              }`}
            >
              C
            </button>
            <button
              onClick={() => handleNumpadPress('0')}
              className={`h-14 text-xl font-extrabold rounded-2xl border active:scale-95 transition-all select-none cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200/60 shadow-sm'
                  : 'bg-slate-900 hover:bg-slate-850 text-slate-100 border-slate-850/60'
              }`}
            >
              0
            </button>
            <button
              onClick={handleNumpadBackspace}
              className={`h-14 rounded-2xl flex items-center justify-center active:scale-95 transition-all select-none cursor-pointer ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  : 'bg-slate-950 hover:bg-slate-900 text-slate-400'
              }`}
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          {/* Lock status banner */}
          <p className={`text-[10px] font-mono uppercase tracking-widest pt-2 ${
            isLight ? 'text-slate-400' : 'text-slate-500'
          }`}>
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
        <BottomNav currentTab={activeTab} setTab={handleTabChange} theme={settings.theme} />
      )}
    </div>
  );
}
