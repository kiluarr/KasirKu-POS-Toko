import { useState, useEffect } from 'react';
import { 
  Search, 
  Trash2, 
  Filter, 
  Receipt, 
  Calendar, 
  X,
  CreditCard,
  DollarSign,
  QrCode,
  FileText
} from 'lucide-react';
import { Transaction, StoreSettings, PaymentMethod } from '../types';
import { getAllTransactions, deleteTransaction } from '../lib/db';
import StrukModal from './StrukModal';

interface RiwayatViewProps {
  settings: StoreSettings;
}

export default function RiwayatView({ settings }: RiwayatViewProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('Semua');
  const [dateFilter, setDateFilter] = useState<string>(''); // YYYY-MM-DD format

  // Receipt Modal State
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  useEffect(() => {
    loadTransactions();
  }, []);

  async function loadTransactions() {
    try {
      const list = await getAllTransactions();
      setTransactions(list);
    } catch (err) {
      console.error('Error loading transactions in history:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleDelete = async (id: string, invoiceNo: string) => {
    const confirmDelete = window.confirm(`Apakah Anda yakin ingin menghapus transaksi "${invoiceNo}" secara permanen? Data penjualan ini akan hilang dari laporan.`);
    if (!confirmDelete) return;

    try {
      await deleteTransaction(id);
      loadTransactions(); // refresh
    } catch (err) {
      console.error('Error deleting transaction:', err);
    }
  };

  const formatNum = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num).replace('Rp', settings.currency);
  };

  // Filter application
  const filteredTransactions = transactions.filter((tx) => {
    // 1. Invoice/Cashier search matches
    const matchesSearch =
      tx.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.cashierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tx.notes && tx.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    // 2. Payment Method filter
    const matchesMethod = methodFilter === 'Semua' || tx.paymentMethod === methodFilter;

    // 3. Date filter
    let matchesDate = true;
    if (dateFilter) {
      const txDateStr = new Date(tx.date).toISOString().slice(0, 10); // YYYY-MM-DD
      matchesDate = txDateStr === dateFilter;
    }

    return matchesSearch && matchesMethod && matchesDate;
  });

  // Calculate stats on filtered list
  const totalFilteredSales = filteredTransactions.reduce((acc, tx) => acc + tx.total, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-24">
      {/* Top Header Title */}
      <div className="bg-slate-900 border-b border-emerald-950 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-bold text-white">Riwayat Transaksi</h2>
        </div>
        <span className="text-xs bg-emerald-950 text-emerald-400 font-extrabold px-2.5 py-1 rounded-full border border-emerald-850/45">
          Total: {transactions.length} Nota
        </span>
      </div>

      {/* Filter Options Subheader */}
      <div className="p-4 bg-slate-900/40 border-b border-slate-900 space-y-3">
        {/* Search Input bar */}
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Cari Invoice, kasir, meja..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 text-xs text-slate-200 pl-9 pr-4 py-2.5 rounded-xl border border-slate-800 focus:border-emerald-600 focus:outline-none placeholder-slate-550"
          />
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Method Filter selector */}
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Saluran Pembayaran</span>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="w-full bg-slate-950 text-xs text-slate-300 px-3 py-2 rounded-xl border border-slate-800 focus:border-emerald-600 focus:outline-none"
            >
              <option value="Semua">Semua Pembayaran</option>
              <option value="CASH">Tunai / Cash</option>
              <option value="QRIS">QRIS</option>
              <option value="TRANSFER">Bank Transfer</option>
              <option value="E_WALLET">E-Wallet</option>
            </select>
          </div>

          {/* Date Picker filter */}
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Filter Tanggal</span>
            <div className="relative flex items-center">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full bg-slate-950 text-xs text-slate-300 px-3 py-2 rounded-xl border border-slate-800 focus:border-emerald-600 focus:outline-none cursor-pointer pr-8"
              />
              {dateFilter && (
                <button
                  onClick={() => setDateFilter('')}
                  className="absolute right-2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sum up indicators of active search */}
      {(searchQuery || methodFilter !== 'Semua' || dateFilter) && (
        <div className="px-5 py-2.5 bg-emerald-950/20 border-b border-emerald-950/45 text-xs text-slate-300 flex justify-between items-center">
          <span>Hasil pencarian disaring ({filteredTransactions.length} item)</span>
          <span className="font-extrabold text-emerald-400">Omzet filter: {formatNum(totalFilteredSales)}</span>
        </div>
      )}

      {/* Historic Logs Listing */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-slate-500 text-xs">Memuat data riwayat...</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-16 text-slate-500 space-y-2">
            <Receipt className="w-10 h-10 mx-auto text-slate-800" />
            <p className="text-xs">Belum ada transaksi terekam pada pencarian ini.</p>
          </div>
        ) : (
          filteredTransactions.map((tx) => {
            const formattedDate = new Date(tx.date).toLocaleDateString('id-ID', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });
            const formattedTime = new Date(tx.date).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={tx.id}
                className="bg-slate-900/60 border border-slate-850 hover:border-emerald-900/40 rounded-2xl p-4 flex justify-between items-center transition-all"
              >
                {/* Info block */}
                <div className="space-y-1.5 max-w-[65%]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-xs">{tx.invoiceNumber}</span>
                    <span className="text-[10px] bg-slate-850 px-1.5 py-0.5 rounded text-slate-400 uppercase tracking-wider font-mono font-bold">
                      {tx.paymentMethod}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex flex-col space-y-0.5">
                    <span>Kasir: <span className="text-slate-300 font-semibold">{tx.cashierName}</span></span>
                    <span>Waktu: {formattedDate} - {formattedTime}</span>
                    {tx.paymentRecipient && (
                      <span className="text-[10px] text-slate-400">
                        Ke: <span className="font-semibold text-slate-300">{tx.paymentRecipient.providerName}</span> ({tx.paymentRecipient.accountNumber})
                      </span>
                    )}
                    {tx.notes && <span className="italic text-slate-500 text-[10px]">Catatan: {tx.notes}</span>}
                  </div>
                </div>

                {/* Operations */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="font-extrabold text-white text-sm">{formatNum(tx.total)}</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setSelectedTx(tx)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-emerald-950/40 hover:text-emerald-400 rounded-lg text-[10px] font-bold text-slate-300 flex items-center gap-1 cursor-pointer border border-slate-750"
                    >
                      Struk
                    </button>
                    <button
                      onClick={() => handleDelete(tx.id, tx.invoiceNumber)}
                      className="p-1.5 bg-red-950/40 text-red-400 hover:bg-red-900/40 rounded-lg transition-colors cursor-pointer border border-red-900/10"
                      title="Hapus Transaksi"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Popup Struk Receipt view when requested */}
      {selectedTx && (
        <StrukModal
          transaction={selectedTx}
          settings={settings}
          onClose={() => setSelectedTx(null)}
        />
      )}
    </div>
  );
}
