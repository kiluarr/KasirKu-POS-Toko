import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Calendar, 
  Download, 
  Share2, 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  Package, 
  FileText,
  Eye,
  ChevronRight,
  ArrowRight,
  X,
  Plus,
  Trash2,
  ArrowDownRight,
  Receipt
} from 'lucide-react';
import jsPDF from 'jspdf';
import { Transaction, StoreSettings, Product, Expense } from '../types';
import { getAllTransactions, getAllProducts, getAllExpenses, saveExpense, deleteExpense } from '../lib/db';

interface LaporanViewProps {
  settings: StoreSettings;
}

type PeriodPreset = 'Harian' | 'Mingguan' | 'Bulanan' | 'Tahunan' | 'Custom';

export default function LaporanView({ settings }: LaporanViewProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter Period States
  const [period, setPeriod] = useState<PeriodPreset>('Bulanan');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // PDF Preview State
  const [pdfPreviewData, setPdfPreviewData] = useState<string | null>(null);

  // Expense Management State
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expAmount, setExpAmount] = useState<string>('');
  const [expCategory, setExpCategory] = useState<string>('Operasional');
  const [expNotes, setExpNotes] = useState<string>('');
  const [expDate, setExpDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const txs = await getAllTransactions();
      const prods = await getAllProducts();
      const exps = await getAllExpenses();
      setTransactions(txs);
      setProducts(prods);
      setExpenses(exps);
    } catch (err) {
      console.error('Error loading report data:', err);
    } finally {
      setLoading(false);
    }
  }

  // Get start/end range dates based on Period selection
  const getFilterBounds = () => {
    const start = new Date();
    const end = new Date();
    
    // Set boundaries to extreme hours for exact overlaps
    end.setHours(23, 59, 59, 999);

    if (period === 'Harian') {
      start.setHours(0, 0, 0, 0);
    } else if (period === 'Mingguan') {
      // 7 days ago
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else if (period === 'Bulanan') {
      // 30 days ago
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
    } else if (period === 'Tahunan') {
      // 365 days ago
      start.setDate(start.getDate() - 365);
      start.setHours(0, 0, 0, 0);
    } else if (period === 'Custom') {
      const s = startDate ? new Date(startDate) : new Date(0); // Epoch start if blank
      s.setHours(0, 0, 0, 0);
      const e = endDate ? new Date(endDate) : new Date();
      e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }

    return { start, end };
  };

  const { start: boundsStart, end: boundsEnd } = getFilterBounds();

  // Filter transactions within the active boundaries
  const filteredTxs = transactions.filter((tx) => {
    const txDate = new Date(tx.date);
    return txDate >= boundsStart && txDate <= boundsEnd;
  });

  // Filter expenses within the active boundaries
  const filteredExpenses = expenses.filter((exp) => {
    const expDate = new Date(exp.date);
    return expDate >= boundsStart && expDate <= boundsEnd;
  });

  // Calculate Metrics from real transactions & expenses
  const totalOmzet = filteredTxs.reduce((sum, tx) => sum + tx.total, 0);
  const totalTxCount = filteredTxs.length;

  const totalItemsSold = filteredTxs.reduce((sum, tx) => {
    return sum + tx.items.reduce((acc, i) => acc + i.quantity, 0);
  }, 0);

  const grossProfit = filteredTxs.reduce((sum, tx) => {
    const txCost = tx.items.reduce((acc, i) => acc + (i.costPrice * i.quantity), 0);
    // Profit of items minus any overarching discounts
    const txProfit = Math.max(tx.total - txCost, 0);
    return sum + txProfit;
  }, 0);

  const totalExpenseAmount = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const netProfit = grossProfit - totalExpenseAmount;

  const avgTransactionAmount = totalTxCount > 0 ? Math.round(totalOmzet / totalTxCount) : 0;

  // Best Selling Products for the filtered duration
  const bestProductsMap: Record<string, { name: string; qty: number; totalSales: number }> = {};
  filteredTxs.forEach((tx) => {
    tx.items.forEach((item) => {
      if (!bestProductsMap[item.productId]) {
        bestProductsMap[item.productId] = { name: item.name, qty: 0, totalSales: 0 };
      }
      bestProductsMap[item.productId].qty += item.quantity;
      bestProductsMap[item.productId].totalSales += item.total;
    });
  });

  const bestProductsList = Object.entries(bestProductsMap)
    .map(([id, val]) => ({ id, ...val }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // Payment channel distribution
  const paymentSummary = {
    CASH: 0,
    QRIS: 0,
    TRANSFER: 0,
    E_WALLET: 0,
  };

  filteredTxs.forEach((tx) => {
    if (paymentSummary[tx.paymentMethod] !== undefined) {
      paymentSummary[tx.paymentMethod] += tx.total;
    }
  });

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace('Rp', settings.currency);
  };

  // Compile PDF document structure using jsPDF natively
  const buildPdfDoc = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Custom Professional Header Styling
    doc.setFillColor(16, 185, 129); // Green primary Accent
    doc.rect(0, 0, pageWidth, 40, 'F');

    // Title Texts
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('LAPORAN PENJUALAN KASIRPRO', 15, 20);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Toko: ${settings.storeName} | Kasir: ${settings.cashierName}`, 15, 28);
    doc.text(`Alamat: ${settings.address} | Telp: ${settings.phone}`, 15, 34);

    // Filter range details
    doc.setTextColor(50, 50, 50);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('PERIODE LAPORAN:', 15, 52);
    doc.setFont('Helvetica', 'normal');
    
    const formattedRange = `${boundsStart.toLocaleDateString('id-ID')} s/d ${boundsEnd.toLocaleDateString('id-ID')}`;
    doc.text(`${period.toUpperCase()} (${formattedRange})`, 55, 52);

    // Draw Metrics Boxes
    const boxY = 60;
    const boxWidth = 56;
    const boxHeight = 25;

    // Box 1: Total Omzet
    doc.setFillColor(243, 244, 246);
    doc.rect(15, boxY, boxWidth, boxHeight, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('PENDAPATAN KOTOR', 18, boxY + 8);
    doc.setFontSize(11);
    doc.setTextColor(16, 185, 129); // Green
    doc.text(formatMoney(totalOmzet), 18, boxY + 18);

    // Box 2: Total Pengeluaran
    doc.setFillColor(243, 244, 246);
    doc.rect(76, boxY, boxWidth, boxHeight, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('TOTAL PENGELUARAN', 79, boxY + 8);
    doc.setFontSize(11);
    doc.setTextColor(239, 68, 68); // Red
    doc.text(formatMoney(totalExpenseAmount), 79, boxY + 18);

    // Box 3: Estimasi Keuntungan Bersih
    doc.setFillColor(243, 244, 246);
    doc.rect(137, boxY, boxWidth, boxHeight, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('ESTIMASI LABA BERSIH', 140, boxY + 8);
    doc.setFontSize(11);
    doc.setTextColor(netProfit >= 0 ? 16 : 239, netProfit >= 0 ? 185 : 68, netProfit >= 0 ? 129 : 68);
    doc.text(formatMoney(netProfit), 140, boxY + 18);

    // Box 3 & 4 Mini
    doc.setTextColor(50, 50, 50);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Total Transaksi: ${totalTxCount} Nota`, 15, boxY + 34);
    doc.text(`Total Barang Terjual: ${totalItemsSold} Pcs`, 110, boxY + 34);

    // Table Header
    let tableY = boxY + 45;
    doc.setFillColor(51, 65, 85); // Slate gray for headers
    doc.rect(15, tableY, pageWidth - 30, 8, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'bold');
    doc.text('TANGGAL', 18, tableY + 6);
    doc.text('NO. INVOICE', 55, tableY + 6);
    doc.text('METODE', 110, tableY + 6);
    doc.text('TOTAL TAGIHAN', pageWidth - 20, tableY + 6, { align: 'right' });

    // Table rows of transactions
    doc.setTextColor(50, 50, 50);
    doc.setFont('Helvetica', 'normal');
    let currentY = tableY + 14;

    filteredTxs.forEach((tx, idx) => {
      // Prevent overflow, add new pages if necessary
      if (currentY > 270) {
        doc.addPage();
        currentY = 20;
        
        // Redraw small subheader table rows
        doc.setFillColor(51, 65, 85);
        doc.rect(15, currentY, pageWidth - 30, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('Helvetica', 'bold');
        doc.text('TANGGAL', 18, currentY + 6);
        doc.text('NO. INVOICE', 55, currentY + 6);
        doc.text('METODE', 110, currentY + 6);
        doc.text('TOTAL TAGIHAN', pageWidth - 20, currentY + 6, { align: 'right' });
        
        currentY += 14;
        doc.setTextColor(50, 50, 50);
        doc.setFont('Helvetica', 'normal');
      }

      const rowDateStr = new Date(tx.date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
      
      doc.text(rowDateStr, 18, currentY);
      doc.text(tx.invoiceNumber, 55, currentY);
      doc.text(tx.paymentMethod, 110, currentY);
      doc.text(formatMoney(tx.total), pageWidth - 20, currentY, { align: 'right' });

      // Add a thin row divider line
      doc.setDrawColor(220, 220, 220);
      doc.line(15, currentY + 3, pageWidth - 15, currentY + 3);

      currentY += 8;
    });

    // Add Expense Table Section in PDF if there are expenses
    if (filteredExpenses.length > 0) {
      // Add section spacing
      currentY += 12;

      // Check for page overflow
      if (currentY > 240) {
        doc.addPage();
        currentY = 25;
      }

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(239, 68, 68); // Red for Expenses heading
      doc.text('DAFTAR PENGELUARAN UANG', 15, currentY);
      currentY += 6;

      // Table Header for Expenses
      doc.setFillColor(156, 163, 175); // Gray for expenses header
      doc.rect(15, currentY, pageWidth - 30, 8, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('Helvetica', 'bold');
      doc.text('TANGGAL', 18, currentY + 6);
      doc.text('KATEGORI', 55, currentY + 6);
      doc.text('CATATAN / KETERANGAN', 95, currentY + 6);
      doc.text('NOMINAL', pageWidth - 20, currentY + 6, { align: 'right' });

      currentY += 14;
      doc.setTextColor(50, 50, 50);
      doc.setFont('Helvetica', 'normal');

      filteredExpenses.forEach((exp) => {
        // Prevent overflow, add new pages if necessary
        if (currentY > 270) {
          doc.addPage();
          currentY = 20;

          // Redraw small subheader table rows
          doc.setFillColor(156, 163, 175);
          doc.rect(15, currentY, pageWidth - 30, 8, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('Helvetica', 'bold');
          doc.text('TANGGAL', 18, currentY + 6);
          doc.text('KATEGORI', 55, currentY + 6);
          doc.text('CATATAN / KETERANGAN', 95, currentY + 6);
          doc.text('NOMINAL', pageWidth - 20, currentY + 6, { align: 'right' });

          currentY += 14;
          doc.setTextColor(50, 50, 50);
          doc.setFont('Helvetica', 'normal');
        }

        const expDateStr = new Date(exp.date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });

        doc.text(expDateStr, 18, currentY);
        doc.text(exp.category, 55, currentY);
        
        // Truncate notes if too long to prevent overlapping
        const noteStr = exp.notes.length > 35 ? exp.notes.slice(0, 32) + '...' : exp.notes;
        doc.text(noteStr, 95, currentY);
        
        doc.text(`-${formatMoney(exp.amount)}`, pageWidth - 20, currentY, { align: 'right' });

        // Add a thin row divider line
        doc.setDrawColor(240, 240, 240);
        doc.line(15, currentY + 3, pageWidth - 15, currentY + 3);

        currentY += 8;
      });
    }

    // Signatures / Footer elements
    if (currentY > 240) {
      doc.addPage();
      currentY = 25;
    }

    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Laporan digenerate secara otomatis pada ${new Date().toLocaleString('id-ID')}`, 15, currentY + 20);

    return doc;
  };

  const generatePdfBlobUrl = (shouldDownload = false) => {
    const doc = buildPdfDoc();
    // Output options
    if (shouldDownload) {
      doc.save(`Laporan-POS-${period}-${Date.now()}.pdf`);
    } else {
      const stringData = doc.output('datauristring');
      setPdfPreviewData(stringData);
    }
  };

  const handleSharePdf = async () => {
    const doc = buildPdfDoc();
    const pdfBlob = doc.output('blob');
    const file = new File([pdfBlob], `Laporan-${period}.pdf`, { type: 'application/pdf' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Laporan Penjualan ${settings.storeName}`,
          text: `Berikut rangkuman laporan penjualan periode ${period} dari ${settings.storeName}.`,
        });
      } catch (err) {
        console.error('Error sharing PDF', err);
      }
    } else {
      alert('Fitur pembagian file PDF tidak didukung di browser ini. Unduh PDF secara manual sebagai gantinya.');
    }
  };

  // Graph values calculation (for revenue bars)
  const getSubPeriodChartData = () => {
    // Generate 6 sub-period intervals based on the start & end range
    const intervals = [];
    const stepMs = (boundsEnd.getTime() - boundsStart.getTime()) / 6;

    for (let i = 0; i < 6; i++) {
      const stepStart = new Date(boundsStart.getTime() + i * stepMs);
      const stepEnd = new Date(boundsStart.getTime() + (i + 1) * stepMs);
      const label = stepStart.toLocaleDateString('id-ID', { month: '2-digit', day: '2-digit' });

      const stepTxs = transactions.filter((t) => {
        const d = new Date(t.date);
        return d >= stepStart && d <= stepEnd;
      });

      const stepRev = stepTxs.reduce((sum, t) => sum + t.total, 0);
      intervals.push({ label, amount: stepRev });
    }
    return intervals;
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(expAmount);
    if (!amountNum || amountNum <= 0) return;

    const newExpense: Expense = {
      id: 'exp_' + Date.now(),
      date: expDate ? new Date(expDate).toISOString() : new Date().toISOString(),
      amount: amountNum,
      category: expCategory,
      notes: expNotes.trim() || 'Tanpa catatan'
    };

    try {
      await saveExpense(newExpense);
      setExpAmount('');
      setExpNotes('');
      setShowExpenseModal(false);
      
      const updated = await getAllExpenses();
      setExpenses(updated);
    } catch (err) {
      console.error('Error saving expense:', err);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pengeluaran ini?')) return;
    try {
      await deleteExpense(id);
      const updated = await getAllExpenses();
      setExpenses(updated);
    } catch (err) {
      console.error('Error deleting expense:', err);
    }
  };

  const chartPoints = getSubPeriodChartData();
  const maxChartVal = Math.max(...chartPoints.map((p) => p.amount), 50000);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-24">
      {/* Top Header */}
      <div className="bg-slate-900 border-b border-emerald-950 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-bold text-white">Analisis Laporan POS</h2>
        </div>
        <Calendar className="w-4.5 h-4.5 text-slate-500" />
      </div>

      {/* Time-Range Filters & custom date inputs */}
      <div className="p-4 bg-slate-900/40 border-b border-slate-900 space-y-3.5">
        <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
          {(['Harian', 'Mingguan', 'Bulanan', 'Tahunan', 'Custom'] as PeriodPreset[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                period === p
                  ? 'bg-emerald-500 text-slate-950 font-black'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-750'
              }`}
            >
              {p === 'Harian'
                ? 'Hari Ini'
                : p === 'Mingguan'
                ? '7 Hari Ini'
                : p === 'Bulanan'
                ? 'Bulan Ini'
                : p === 'Tahunan'
                ? 'Tahun Ini'
                : 'Rentang Khusus'}
            </button>
          ))}
        </div>

        {period === 'Custom' && (
          <div className="grid grid-cols-2 gap-3 pt-1 animate-fade-in">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mulai Tanggal</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-950 text-xs text-slate-300 px-3 py-2 rounded-xl border border-slate-800 focus:border-emerald-600 focus:outline-none cursor-pointer"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Hingga Tanggal</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-950 text-xs text-slate-300 px-3 py-2 rounded-xl border border-slate-800 focus:border-emerald-600 focus:outline-none cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Stats Scroll area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        
        {/* BIG NUMBERS SCOREBOARD */}
        <div className="grid grid-cols-2 gap-3">
          {/* Omzet Card */}
          <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between">
            <div>
              <span className="text-[9px] text-slate-450 font-bold uppercase tracking-widest block">Pendapatan Kotor</span>
              <h3 className="text-base font-black text-white mt-1">{formatMoney(totalOmzet)}</h3>
            </div>
            <span className="text-[9px] text-slate-500 mt-2 flex items-center gap-0.5">
              <TrendingUp className="w-2.5 h-2.5 text-emerald-450" /> Total tagihan
            </span>
          </div>

          {/* Laba Kotor Card */}
          <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between">
            <div>
              <span className="text-[9px] text-sky-400 font-bold uppercase tracking-widest block">Laba Kotor</span>
              <h3 className="text-base font-black text-sky-400 mt-1">{formatMoney(grossProfit)}</h3>
            </div>
            <span className="text-[9px] text-slate-500 mt-2">Omset minus modal barang</span>
          </div>

          {/* Pengeluaran Card */}
          <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between">
            <div>
              <span className="text-[9px] text-rose-400 font-bold uppercase tracking-widest block">Pengeluaran Uang</span>
              <h3 className="text-base font-black text-rose-400 mt-1">{formatMoney(totalExpenseAmount)}</h3>
            </div>
            <span className="text-[9px] text-slate-500 mt-2">Biaya operasional / belanja</span>
          </div>

          {/* Profits Card */}
          <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between">
            <div>
              <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest block">Laba Bersih</span>
              <h3 className={`text-base font-black mt-1 ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatMoney(netProfit)}</h3>
            </div>
            <span className="text-[9px] text-slate-500 mt-2">Laba kotor dikurang pengeluaran</span>
          </div>

          {/* Transactions Card */}
          <div className="bg-slate-900/50 border border-slate-850 p-3.5 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-slate-800 rounded-lg text-emerald-400 shrink-0">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[9px] text-slate-400">Total Nota</p>
              <p className="text-sm font-bold text-white">{totalTxCount} Transaksi</p>
            </div>
          </div>

          {/* Average Basket Size */}
          <div className="bg-slate-900/50 border border-slate-850 p-3.5 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-slate-800 rounded-lg text-emerald-400 shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[9px] text-slate-400">Rerata Tiket</p>
              <p className="text-sm font-bold text-white">{formatMoney(avgTransactionAmount)}</p>
            </div>
          </div>
        </div>

        {/* CUSTOM REVENUE BAR GRAPH REPRESENTATION */}
        <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3.5">Trend Volume Omzet</h3>
          <div className="flex justify-between items-end h-28 pt-2">
            {chartPoints.map((pt, idx) => {
              const hPercent = (pt.amount / maxChartVal) * 100;
              return (
                <div key={idx} className="flex flex-col items-center flex-1 group">
                  <span className="text-[9px] text-emerald-400 font-bold mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatMoney(pt.amount)}
                  </span>
                  <div className="w-4 bg-slate-800 hover:bg-emerald-900 rounded-t-sm h-16 flex items-end">
                    <div 
                      className="w-full bg-emerald-500 group-hover:bg-emerald-400 rounded-t-sm"
                      style={{ height: `${hPercent}%` }}
                    />
                  </div>
                  <span className="text-[8px] text-slate-500 mt-2">{pt.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* PRODUCT LEADERBOARD */}
        <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Produk Terlaris Periode Ini</h3>
          {bestProductsList.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">Tidak ada penjualan barang selama periode ini.</p>
          ) : (
            <div className="space-y-3 pt-1">
              {bestProductsList.map((item, idx) => {
                const maxQty = Math.max(...bestProductsList.map((i) => i.qty));
                const widthPct = (item.qty / maxQty) * 100;
                return (
                  <div key={item.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 truncate max-w-[200px]">{idx + 1}. {item.name}</span>
                      <span className="font-bold text-emerald-400">{item.qty} pcs sold</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${widthPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* PAYMENT METHOD SPLIT */}
        <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3.5">Sebaran Transaksi Masuk</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {Object.entries(paymentSummary).map(([method, total]) => (
              <div key={method} className="bg-slate-950/40 p-3 rounded-xl border border-slate-850/60 flex justify-between items-center text-xs">
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">{method}</span>
                  <span className="font-black text-white">{formatMoney(total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PEMAKAIAN & PENGELUARAN UANG */}
        <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Pemakaian & Pengeluaran Uang</h3>
              <p className="text-[10px] text-slate-500">Mencatat operasional, sewa, gaji, belanja modal, dll.</p>
            </div>
            <button
              onClick={() => setShowExpenseModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-950/50 hover:bg-emerald-900/30 text-emerald-400 border border-emerald-800/40 rounded-xl text-[10px] font-black transition-all cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Catat Baru
            </button>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="text-center py-6">
              <Receipt className="w-8 h-8 text-slate-600 mx-auto opacity-50 mb-1.5" />
              <p className="text-xs text-slate-500">Tidak ada pengeluaran uang tercatat pada periode ini.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
              {filteredExpenses.map((exp) => (
                <div key={exp.id} className="bg-slate-950/45 border border-slate-850/60 p-2.5 rounded-xl flex items-start justify-between gap-3 text-xs">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider uppercase ${
                        exp.category === 'Gaji' ? 'bg-indigo-950/80 text-indigo-400 border border-indigo-900/40' :
                        exp.category === 'Listrik' ? 'bg-amber-950/80 text-amber-400 border border-amber-900/40' :
                        exp.category === 'Sewa' ? 'bg-purple-950/80 text-purple-400 border border-purple-900/40' :
                        exp.category === 'Operasional' ? 'bg-sky-950/80 text-sky-400 border border-sky-900/40' :
                        exp.category === 'Belanja Modal' ? 'bg-rose-950/80 text-rose-400 border border-rose-900/40' :
                        'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}>
                        {exp.category}
                      </span>
                      <span className="text-[9px] text-slate-500">
                        {new Date(exp.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 truncate leading-tight font-medium" title={exp.notes}>
                      {exp.notes}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-rose-400 whitespace-nowrap">
                      -{formatMoney(exp.amount)}
                    </span>
                    <button
                      onClick={() => handleDeleteExpense(exp.id)}
                      className="p-1 rounded hover:bg-rose-950/35 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PDF AUDIT GENERATION TOOLS */}
        <div className="bg-gradient-to-r from-emerald-950/65 to-slate-900 border border-emerald-900/40 p-4 rounded-2xl space-y-3.5">
          <div>
            <h3 className="font-extrabold text-sm text-white flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-400" /> Ekspor Audit Laporan PDF
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Ciptakan salinan dokumen audit komprehensif berisi seluruh daftar rincian riwayat penjualan transaksi.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => generatePdfBlobUrl(false)}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" /> Preview PDF
            </button>
            <button
              onClick={() => generatePdfBlobUrl(true)}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-lg shadow-emerald-950/50"
            >
              <Download className="w-3.5 h-3.5" /> Unduh PDF
            </button>
            <button
              onClick={handleSharePdf}
              className="col-span-2 flex items-center justify-center gap-1.5 py-2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800/40 text-emerald-400 text-xs font-bold rounded-xl cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" /> Bagikan File PDF Laporan
            </button>
          </div>
        </div>

      </div>

      {/* PDF Interactive Preview In-App Modal Overlay */}
      {/* Modal Tambah Pengeluaran */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="font-extrabold text-xs text-emerald-400 uppercase tracking-widest">Catat Pengeluaran Uang</h4>
              <button
                onClick={() => {
                  setShowExpenseModal(false);
                  setExpAmount('');
                  setExpNotes('');
                }}
                className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-450 font-bold uppercase tracking-wider block">Nominal Pengeluaran ({settings.currency})</label>
                <input
                  type="number"
                  required
                  min="100"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="Contoh: 15000"
                  className="w-full bg-slate-950 text-slate-100 text-sm font-bold px-3 py-2 rounded-xl border border-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-450 font-bold uppercase tracking-wider block">Kategori</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full bg-slate-950 text-slate-255 text-xs px-3 py-2 rounded-xl border border-slate-800 focus:border-emerald-600 focus:outline-none cursor-pointer"
                >
                  <option value="Operasional">Operasional</option>
                  <option value="Sewa">Sewa</option>
                  <option value="Gaji">Gaji / Upah</option>
                  <option value="Listrik">Listrik & Internet</option>
                  <option value="Belanja Modal">Belanja Barang / Modal</option>
                  <option value="Lain-lain">Lain-lain</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-450 font-bold uppercase tracking-wider block">Tanggal</label>
                <input
                  type="date"
                  required
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full bg-slate-950 text-slate-200 text-xs px-3 py-2 rounded-xl border border-slate-800 focus:border-emerald-600 focus:outline-none cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-450 font-bold uppercase tracking-wider block">Catatan / Keterangan</label>
                <textarea
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  placeholder="Contoh: Beli kantong kresek mini"
                  rows={2}
                  className="w-full bg-slate-950 text-slate-300 text-xs px-3 py-2 rounded-xl border border-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowExpenseModal(false);
                    setExpAmount('');
                    setExpNotes('');
                  }}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-650 hover:bg-emerald-600 text-white text-xs font-black rounded-lg cursor-pointer shadow-md shadow-emerald-950/40"
                >
                  Simpan Pengeluaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pdfPreviewData && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-emerald-900/40 rounded-2xl w-full max-w-lg h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-emerald-950/60 flex items-center justify-between">
              <h4 className="font-bold text-xs text-emerald-400 uppercase tracking-widest">Lembar Pratinjau PDF Laporan</h4>
              <button
                onClick={() => setPdfPreviewData(null)}
                className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Embedded Iframe PDF viewer */}
            <div className="flex-1 bg-white">
              <iframe
                src={pdfPreviewData}
                title="PDF Laporan Penjualan"
                className="w-full h-full border-none"
              />
            </div>

            <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setPdfPreviewData(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  generatePdfBlobUrl(true);
                  setPdfPreviewData(null);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg"
              >
                Unduh PDF Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
