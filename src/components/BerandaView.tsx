import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  ShoppingCart, 
  DollarSign, 
  Package, 
  AlertTriangle, 
  ArrowRight, 
  Calendar, 
  Activity, 
  Award,
  Clock,
  ChevronRight,
  Lock,
  Receipt
} from 'lucide-react';
import { Product, Transaction, StoreSettings } from '../types';
import { getAllProducts, getAllTransactions } from '../lib/db';

interface BerandaViewProps {
  setTab: (tab: string) => void;
  settings: StoreSettings;
  onOpenProductCRUD: () => void;
  onLock?: () => void;
}

export default function BerandaView({ setTab, settings, onOpenProductCRUD, onLock }: BerandaViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const prodList = await getAllProducts();
        const txList = await getAllTransactions();
        setProducts(prodList);
        setTransactions(txList);
      } catch (err) {
        console.error('Error loading Beranda data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Determine Greeting based on current time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return 'Selamat Pagi ☀️';
    if (hour >= 11 && hour < 15) return 'Selamat Siang 🌤️';
    if (hour >= 15 && hour < 18) return 'Selamat Sore ⛅';
    return 'Selamat Malam 🌙';
  };

  // 1. STATS CALCULATION (FOR TODAY)
  const todayStr = new Date().toDateString();

  const todayTransactions = transactions.filter(tx => {
    return new Date(tx.date).toDateString() === todayStr;
  });

  const totalOmzetToday = todayTransactions.reduce((acc, tx) => acc + tx.total, 0);
  const totalTransactionsToday = todayTransactions.length;

  const totalItemsSoldToday = todayTransactions.reduce((acc, tx) => {
    return acc + tx.items.reduce((sum, item) => sum + item.quantity, 0);
  }, 0);

  // Profit Today = Sum of ((sellingPrice - costPrice) * quantity) for all sold items
  const totalProfitToday = todayTransactions.reduce((acc, tx) => {
    const txProfit = tx.items.reduce((sum, item) => {
      const itemProfit = (item.sellingPrice - item.costPrice) * item.quantity;
      return sum + itemProfit;
    }, 0);
    // Deduct discount proportionally from profit
    // Since discount is applied on subtotal, let's subtract it from profit
    return acc + (txProfit - tx.discount);
  }, 0);

  // Format money helper
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace('Rp', settings.currency);
  };

  // 2. LOW STOCK INDICATORS
  const lowStockThreshold = 10;
  const lowStockProducts = products.filter(p => p.stock <= lowStockThreshold);

  // 3. BEST SELLING PRODUCTS (from all-time transactions)
  const bestSellersMap: Record<string, { name: string; qty: number; totalRev: number }> = {};
  transactions.forEach(tx => {
    tx.items.forEach(item => {
      if (!bestSellersMap[item.productId]) {
        bestSellersMap[item.productId] = { name: item.name, qty: 0, totalRev: 0 };
      }
      bestSellersMap[item.productId].qty += item.quantity;
      bestSellersMap[item.productId].totalRev += item.total;
    });
  });

  const bestSellersList = Object.entries(bestSellersMap)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 4);

  // 4. PAYMENT METHODS BREAKDOWN
  const paymentSummary = {
    CASH: { count: 0, total: 0 },
    QRIS: { count: 0, total: 0 },
    TRANSFER: { count: 0, total: 0 },
    E_WALLET: { count: 0, total: 0 },
  };

  transactions.forEach(tx => {
    if (paymentSummary[tx.paymentMethod]) {
      paymentSummary[tx.paymentMethod].count++;
      paymentSummary[tx.paymentMethod].total += tx.total;
    }
  });

  // 5. CHART DATA (LAST 7 DAYS)
  const getLast7DaysData = () => {
    const list = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toDateString();
      const label = d.toLocaleDateString('id-ID', { weekday: 'short' });
      
      const dayTxs = transactions.filter(tx => new Date(tx.date).toDateString() === dateStr);
      const dayOmzet = dayTxs.reduce((sum, tx) => sum + tx.total, 0);
      
      list.push({ label, omzet: dayOmzet });
    }
    return list;
  };

  const chartData = getLast7DaysData();
  const maxOmzetInChart = Math.max(...chartData.map(c => c.omzet), 100000); // at least 100k to scale nicely

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* Top Banner Hero */}
      <div className="relative bg-gradient-to-b from-emerald-950/80 to-slate-950 px-6 pt-8 pb-6 border-b border-emerald-900/30">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.15),rgba(0,0,0,0))]"></div>
        <div className="relative max-w-md mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-800/40 uppercase tracking-wider">
                🏪 {settings.storeName}
              </span>
              <h1 className="text-xl font-bold text-white mt-2 tracking-tight">
                {getGreeting()}
              </h1>
              <p className="text-slate-400 text-xs mt-0.5">Petugas: <span className="text-slate-200 font-medium">{settings.cashierName}</span></p>
            </div>
            <div className="flex items-center gap-3">
              {onLock && (
                <button
                  onClick={onLock}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-red-400 hover:text-red-300 text-xs font-bold rounded-xl border border-slate-800/80 shadow-md transition-all active:scale-95 cursor-pointer"
                  title="Kunci POS"
                >
                  <Lock className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                  <span>Kunci</span>
                </button>
              )}
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] text-emerald-400 font-mono tracking-wider">OFFLINE PRO</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-md mx-auto px-5 mt-4 space-y-6">
        
        {/* STATS BENTO GRID */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400" /> Kinerja Hari Ini
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {/* Omzet Card */}
            <div className="bg-slate-900/70 border border-emerald-950/60 p-4 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <DollarSign className="w-12 h-12 text-emerald-400" />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Omzet Harian</p>
              <h3 className="text-base font-extrabold text-white mt-1 tracking-tight">{formatMoney(totalOmzetToday)}</h3>
              <p className="text-[9px] text-emerald-400 mt-1 flex items-center gap-0.5">
                <TrendingUp className="w-2.5 h-2.5" /> Real-time dari transaksi
              </p>
            </div>

            {/* Profit Card */}
            <div className="bg-slate-900/70 border border-emerald-950/60 p-4 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingUp className="w-12 h-12 text-emerald-500" />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Estimasi Untung</p>
              <h3 className="text-base font-extrabold text-emerald-400 mt-1 tracking-tight">{formatMoney(totalProfitToday)}</h3>
              <p className="text-[9px] text-slate-400 mt-1">Setelah dikurangi modal</p>
            </div>

            {/* Total Transaksi */}
            <div className="bg-slate-900/40 border border-slate-800/60 p-3.5 rounded-xl flex items-center gap-3">
              <div className="p-2 bg-slate-800 rounded-lg text-emerald-400">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Transaksi</p>
                <p className="text-sm font-bold text-white">{totalTransactionsToday} Nota</p>
              </div>
            </div>

            {/* Barang Terjual */}
            <div className="bg-slate-900/40 border border-slate-800/60 p-3.5 rounded-xl flex items-center gap-3">
              <div className="p-2 bg-slate-800 rounded-lg text-emerald-400">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Barang Terjual</p>
                <p className="text-sm font-bold text-white">{totalItemsSoldToday} Pcs</p>
              </div>
            </div>
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="bg-gradient-to-r from-emerald-950/80 to-slate-900 border border-emerald-900/40 p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-sm text-white">Butuh Transaksi Cepat?</h3>
              <p className="text-[11px] text-slate-400">Mulai transaksi baru atau tambahkan produk baru langsung.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTab('kasir')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-950/50"
            >
              <ShoppingCart className="w-3.5 h-3.5" /> Transaksi Baru <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onOpenProductCRUD}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition-all cursor-pointer border border-slate-700"
            >
              Kelola Produk
            </button>
          </div>
        </div>

        {/* LOW STOCK ALERTS */}
        {lowStockProducts.length > 0 && (
          <div className="bg-amber-950/30 border border-amber-900/40 p-4 rounded-2xl space-y-2.5">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <h3 className="font-bold text-xs uppercase tracking-wider">Perhatian: Stok Menipis ({lowStockProducts.length})</h3>
            </div>
            <div className="max-h-24 overflow-y-auto divide-y divide-amber-950/50 pr-1">
              {lowStockProducts.map(p => (
                <div key={p.id} className="flex items-center justify-between py-1.5 text-xs text-amber-200/80">
                  <span className="truncate max-w-[180px] font-medium">{p.name}</span>
                  <span className="bg-amber-950 px-2 py-0.5 rounded text-[10px] font-bold text-amber-400 border border-amber-900/40">
                    Sisa {p.stock} pcs
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7-DAY REVENUE GRAPH (PURE SVG CHART) */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-widest text-slate-400">Grafik Omzet Harian</h3>
              <p className="text-[10px] text-slate-500">Perkembangan penjualan 7 hari terakhir</p>
            </div>
            <Calendar className="w-4 h-4 text-slate-500" />
          </div>

          {/* Simple custom visual bar chart representation */}
          <div className="flex justify-between items-end h-28 pt-2 px-1">
            {chartData.map((day, idx) => {
              const barHeightPercent = Math.min((day.omzet / maxOmzetInChart) * 100, 100);
              return (
                <div key={idx} className="flex flex-col items-center flex-1 group">
                  <div className="relative w-full flex justify-center">
                    {/* Tooltip on hover */}
                    <span className="absolute -top-7 scale-0 group-hover:scale-100 bg-emerald-950 text-emerald-300 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-800/60 z-10 whitespace-nowrap transition-transform duration-200">
                      {formatMoney(day.omzet)}
                    </span>
                  </div>
                  {/* Bar */}
                  <div className="w-5 bg-slate-800 hover:bg-emerald-900 rounded-t-sm transition-all duration-300 relative overflow-hidden h-20 flex items-end">
                    <div 
                      className="w-full bg-emerald-500 group-hover:bg-emerald-400 rounded-t-sm transition-all duration-500"
                      style={{ height: `${barHeightPercent}%` }}
                    />
                  </div>
                  {/* Label */}
                  <span className="text-[9px] text-slate-400 mt-2 font-medium uppercase">{day.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* BEST SELLING PRODUCTS SECTION */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-widest text-slate-400">Produk Terlaris</h3>
              <p className="text-[10px] text-slate-500">Berdasarkan volume penjualan barang</p>
            </div>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>

          {bestSellersList.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500">
              Belum ada data penjualan barang.
            </div>
          ) : (
            <div className="space-y-3">
              {bestSellersList.map((item, index) => {
                const totalQtyAllTime = Math.max(...bestSellersList.map(i => i.qty));
                const widthPercent = (item.qty / totalQtyAllTime) * 100;

                return (
                  <div key={item.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-200 truncate max-w-[200px]">
                        {index + 1}. {item.name}
                      </span>
                      <span className="font-bold text-emerald-400 shrink-0">{item.qty} terjual</span>
                    </div>
                    {/* Horizontal progress meter */}
                    <div className="w-full h-2 bg-slate-850 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* PAYMENT METHOD BREAKDOWN */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl">
          <h3 className="font-bold text-xs uppercase tracking-widest text-slate-400 mb-3.5">Metode Pembayaran</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {Object.entries(paymentSummary).map(([method, data]) => {
              const totalAmount = data.total;
              return (
                <div key={method} className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/40 flex justify-between items-center">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 tracking-wider block">{method}</span>
                    <span className="text-xs font-extrabold text-white">{formatMoney(totalAmount)}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0 font-medium bg-slate-900 px-1.5 py-0.5 rounded">
                    {data.count} tx
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* RECENT TRANSACTIONS */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="font-bold text-xs uppercase tracking-widest text-slate-400">Transaksi Terbaru</h3>
            <button 
              onClick={() => setTab('riwayat')}
              className="text-emerald-400 hover:text-emerald-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-0.5"
            >
              Semua <ChevronRight className="w-3" />
            </button>
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500">
              Belum ada transaksi terekam.
            </div>
          ) : (
            <div className="divide-y divide-slate-850">
              {transactions.slice(0, 3).map((tx) => (
                <div key={tx.id} className="py-2.5 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-slate-200 block">{tx.invoiceNumber}</span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(tx.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} • {tx.paymentMethod}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-white block">{formatMoney(tx.total)}</span>
                    <span className="text-[9px] text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded font-semibold">Sukses</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
