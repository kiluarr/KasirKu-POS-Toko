import { Home, ShoppingCart, History, BarChart3, Settings } from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  setTab: (tab: string) => void;
}

export default function BottomNav({ currentTab, setTab }: BottomNavProps) {
  const navItems = [
    { id: 'beranda', label: 'Beranda', icon: Home },
    { id: 'kasir', label: 'Kasir', icon: ShoppingCart },
    { id: 'riwayat', label: 'Riwayat', icon: History },
    { id: 'laporan', label: 'Laporan', icon: BarChart3 },
    { id: 'pengaturan', label: 'Pengaturan', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-emerald-800/30 shadow-2xl pb-safe">
      <div className="max-w-md mx-auto px-6 h-16 flex items-center justify-between">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => setTab(item.id)}
              className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-300 ${
                isActive
                  ? 'text-emerald-400 bg-emerald-950/45 scale-110'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              <span className="text-[10px] mt-1 font-medium tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
