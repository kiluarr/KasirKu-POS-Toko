import React, { useState, useRef } from 'react';
import { 
  Settings, 
  Store, 
  MapPin, 
  Phone, 
  User, 
  DollarSign, 
  FileText, 
  ShieldAlert, 
  Database, 
  Trash2, 
  Info,
  Sun,
  Moon,
  FileDown,
  FileUp,
  Image as ImageIcon,
  Lock,
  AlertTriangle,
  Plus,
  Check,
  CreditCard,
  Wallet,
  X
} from 'lucide-react';
import { StoreSettings, PaymentRecipient } from '../types';
import { saveSettings, resetDatabase, getAllProducts, getAllTransactions, saveProduct, saveTransaction } from '../lib/db';

interface PengaturanViewProps {
  settings: StoreSettings;
  onUpdateSettings: (newSettings: StoreSettings) => void;
  onLock?: () => void;
}

export default function PengaturanView({ settings, onUpdateSettings, onLock }: PengaturanViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom DB Reset Modal State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [confirmPin, setConfirmPin] = useState('');
  const [resetError, setResetError] = useState('');

  // Local Form state initialized from settings props
  const [storeName, setStoreName] = useState(settings.storeName);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || '');
  const [address, setAddress] = useState(settings.address);
  const [phone, setPhone] = useState(settings.phone);
  const [cashierName, setCashierName] = useState(settings.cashierName);
  const [currency, setCurrency] = useState(settings.currency);
  const [theme, setTheme] = useState<'light' | 'dark'>(settings.theme);
  const [pin, setPin] = useState(settings.pin);
  const [receiptFooter, setReceiptFooter] = useState(settings.receiptFooter);

  // Local state for payment recipients
  const [paymentRecipients, setPaymentRecipients] = useState<PaymentRecipient[]>(settings.paymentRecipients || []);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newType, setNewType] = useState<'BANK' | 'E_WALLET'>('BANK');
  const [newProviderName, setNewProviderName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newAccountName, setNewAccountName] = useState('');

  const [saving, setSaving] = useState(false);

  const handleAddRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProviderName.trim() || !newAccountNumber.trim() || !newAccountName.trim()) {
      alert('Harap lengkapi semua isian rekening!');
      return;
    }
    const item: PaymentRecipient = {
      id: Date.now().toString(),
      type: newType,
      providerName: newProviderName.trim(),
      accountNumber: newAccountNumber.trim(),
      accountName: newAccountName.trim(),
      isActive: true,
    };
    setPaymentRecipients([...paymentRecipients, item]);
    setNewProviderName('');
    setNewAccountNumber('');
    setNewAccountName('');
    setShowAddForm(false);
  };

  const handleToggleRecipient = (id: string) => {
    setPaymentRecipients(prev => prev.map(item => item.id === id ? { ...item, isActive: !item.isActive } : item));
  };

  const handleDeleteRecipient = (id: string) => {
    setPaymentRecipients(prev => prev.filter(item => item.id !== id));
  };

  // Instant visual theme propagation
  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    onUpdateSettings({
      ...settings,
      theme: newTheme
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    const updatedSettings: StoreSettings = {
      storeName: storeName.trim(),
      logoUrl: logoUrl.trim(),
      address: address.trim(),
      phone: phone.trim(),
      cashierName: cashierName.trim(),
      currency: currency.trim() || 'Rp',
      theme,
      pin: pin.trim() || '1234',
      receiptFooter: receiptFooter.trim(),
      paymentRecipients,
    };

    try {
      await saveSettings(updatedSettings);
      onUpdateSettings(updatedSettings);
      alert('Konfigurasi Pengaturan KasirPro berhasil diperbarui!');
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Gagal memperbarui pengaturan.');
    } finally {
      setSaving(false);
    }
  };

  // BACKUP DATABASE (JSON EXPORTER)
  const handleBackup = async () => {
    try {
      const allProducts = await getAllProducts();
      const allTransactions = await getAllTransactions();

      const backupObj = {
        version: 1,
        appName: 'KasirPro',
        timestamp: new Date().toISOString(),
        settings: {
          storeName,
          logoUrl,
          address,
          phone,
          cashierName,
          currency,
          theme,
          pin,
          receiptFooter
        },
        products: allProducts,
        transactions: allTransactions
      };

      const jsonStr = JSON.stringify(backupObj, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const d = new Date();
      const filename = `backup_kasirpro_${d.getFullYear()}${String(d.getMonth()+1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Backup error:', err);
      alert('Gagal memproses backup database.');
    }
  };

  // RESTORE DATABASE (JSON IMPORTER)
  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileRestoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);

        if (parsed.appName !== 'KasirPro') {
          alert('Format berkas tidak valid! Harap pilih file cadangan KasirPro (.json) yang sah.');
          return;
        }

        const confirmRestore = window.confirm(
          `Apakah Anda yakin ingin me-restore cadangan "${file.name}"? Proses ini akan menimpa seluruh produk dan riwayat transaksi saat ini.`
        );
        if (!confirmRestore) return;

        // Restore Settings
        if (parsed.settings) {
          await saveSettings(parsed.settings);
          onUpdateSettings(parsed.settings);
        }

        // Restore Products
        if (Array.isArray(parsed.products)) {
          for (const prod of parsed.products) {
            await saveProduct(prod);
          }
        }

        // Restore Transactions
        if (Array.isArray(parsed.transactions)) {
          for (const tx of parsed.transactions) {
            await saveTransaction(tx);
          }
        }

        alert('Database KasirPro berhasil dipulihkan secara penuh! Aplikasi akan direfresh.');
        window.location.reload();
      } catch (err) {
        console.error('Restore database error:', err);
        alert('Gagal mengimpor file backup. Format file tidak valid.');
      }
    };
    reader.readAsText(file);
  };

  // FULL SYSTEM RESET DATA
  const triggerFullReset = () => {
    setConfirmPin('');
    setResetError('');
    setIsResetModalOpen(true);
  };

  const executeFullReset = async () => {
    if (confirmPin !== settings.pin) {
      setResetError('PIN keamanan salah! Otentikasi gagal.');
      return;
    }

    try {
      await resetDatabase();
      setIsResetModalOpen(false);
      window.location.reload();
    } catch (err) {
      console.error('Reset error:', err);
      setResetError('Gagal menghapus database. Silakan muat ulang.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-24">
      {/* Top Header */}
      <div className="bg-slate-900 border-b border-emerald-950 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-bold text-white">Pengaturan KasirPro</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-slate-950 text-slate-400 px-2.5 py-1 rounded-full border border-slate-800">
            V1.0.0 Stable
          </span>
        </div>
      </div>

      {/* Main Settings Panel Forms scroll area */}
      <div className="flex-1 overflow-y-auto p-5">
        <form onSubmit={handleSave} className="space-y-6 max-w-md mx-auto">
          
          {/* STORE PROFILE */}
          <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Store className="w-4 h-4 text-emerald-400" /> Profil Toko & Kontak
            </h3>

            {/* Store Name input */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Nama Toko / Outlet</span>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-850 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Logo Image URL */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-slate-500" /> URL Logo Toko (Opsional)
              </span>
              <input
                type="url"
                placeholder="https://link_gambar_logo.png"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="w-full bg-slate-950 text-xs text-slate-300 px-3 py-2.5 rounded-xl border border-slate-850 focus:border-emerald-500 focus:outline-none font-mono"
              />
            </div>

            {/* Address Area */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-500" /> Alamat Fisik Toko
              </span>
              <textarea
                required
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2 rounded-xl border border-slate-850 focus:border-emerald-500 focus:outline-none resize-none"
              />
            </div>

            {/* WhatsApp */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-500" /> No. WhatsApp Toko
              </span>
              <input
                type="text"
                required
                placeholder="Contoh: 0812345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-850 focus:border-emerald-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* APPLICATION CONFIGS */}
          <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <User className="w-4 h-4 text-emerald-400" /> Personalisasi & Cetakan
            </h3>

            {/* Cashier Name */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Nama Kasir default</span>
              <input
                type="text"
                required
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
                className="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-850 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Currency */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-slate-500" /> Simbol Mata Uang
              </span>
              <input
                type="text"
                required
                maxLength={4}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-850 focus:border-emerald-500 focus:outline-none font-bold"
              />
            </div>

            {/* Receipt Footer Msg */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-500" /> Pesan Kaki Struk (Receipt Footer)
              </span>
              <textarea
                rows={2}
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                className="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2 rounded-xl border border-slate-850 focus:border-emerald-500 focus:outline-none resize-none"
              />
            </div>

            {/* Theme selector */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Mode Tema Visual</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    theme === 'light'
                      ? 'bg-white text-slate-950 border-white'
                      : 'bg-slate-950 text-slate-400 border-slate-850 hover:bg-slate-850'
                  }`}
                >
                  <Sun className="w-4 h-4" /> Terang (Light)
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    theme === 'dark'
                      ? 'bg-emerald-950/45 text-emerald-400 border-emerald-700/80'
                      : 'bg-slate-950 text-slate-400 border-slate-850 hover:bg-slate-850'
                  }`}
                >
                  <Moon className="w-4 h-4" /> Hijau Gelap (Dark)
                </button>
              </div>
            </div>
          </div>

          {/* REKENING PENERIMA PEMBAYARAN */}
          <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-emerald-400" /> Rekening Pembayaran
              </h3>
              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-950/45 text-emerald-400 hover:bg-emerald-900/20 rounded-lg text-[10px] font-bold border border-emerald-800/40 transition-colors cursor-pointer"
              >
                {showAddForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                {showAddForm ? 'Tutup Form' : 'Tambah Rekening'}
              </button>
            </div>

            {/* Form Tambah Rekening Baru */}
            {showAddForm && (
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850 space-y-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Kategori</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewType('BANK')}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        newType === 'BANK'
                          ? 'bg-emerald-950/55 text-emerald-400 border-emerald-800/60'
                          : 'bg-slate-900 text-slate-400 border-slate-850 hover:bg-slate-850'
                      }`}
                    >
                      Bank Transfer
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewType('E_WALLET')}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        newType === 'E_WALLET'
                          ? 'bg-emerald-950/55 text-emerald-400 border-emerald-800/60'
                          : 'bg-slate-900 text-slate-400 border-slate-850 hover:bg-slate-850'
                      }`}
                    >
                      E-Wallet / E-Money
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Penyedia / Bank</span>
                    <input
                      type="text"
                      placeholder="e.g. BCA, OVO, GoPay, Mandiri"
                      value={newProviderName}
                      onChange={(e) => setNewProviderName(e.target.value)}
                      className="w-full bg-slate-900 text-xs text-slate-200 px-2.5 py-2 rounded-lg border border-slate-850 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Nomor Rekening / HP</span>
                    <input
                      type="text"
                      placeholder="e.g. 123456789 or 0812..."
                      value={newAccountNumber}
                      onChange={(e) => setNewAccountNumber(e.target.value)}
                      className="w-full bg-slate-900 text-xs text-slate-200 px-2.5 py-2 rounded-lg border border-slate-850 focus:border-emerald-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Nama Pemilik Rekening</span>
                  <input
                    type="text"
                    placeholder="e.g. Budi Santoso"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    className="w-full bg-slate-900 text-xs text-slate-200 px-2.5 py-2 rounded-lg border border-slate-850 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddRecipient}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold rounded-lg transition-colors cursor-pointer uppercase tracking-wider"
                >
                  Simpan Rekening Ini
                </button>
              </div>
            )}

            {/* List Rekening Pembayaran */}
            {paymentRecipients.length === 0 ? (
              <div className="text-center py-4 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                Belum ada rekening pembayaran terdaftar. Silakan tambahkan rekening bank atau e-wallet Anda.
              </div>
            ) : (
              <div className="space-y-2">
                {paymentRecipients.map((recipient) => (
                  <div
                    key={recipient.id}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      recipient.isActive
                        ? 'bg-slate-950/60 border-slate-800'
                        : 'bg-slate-950/20 border-slate-900 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-lg ${
                        recipient.type === 'BANK' ? 'bg-blue-950/40 text-blue-400' : 'bg-purple-950/40 text-purple-400'
                      }`}>
                        {recipient.type === 'BANK' ? <CreditCard className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-white">{recipient.providerName}</span>
                          <span className="text-[8px] uppercase font-bold px-1.5 py-0.5 bg-slate-850 text-slate-400 rounded">
                            {recipient.type === 'BANK' ? 'Bank' : 'E-Wallet'}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-300 font-bold">{recipient.accountNumber}</p>
                        <p className="text-[9px] text-slate-400">a.n. {recipient.accountName}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Checkbox Status Aktif */}
                      <button
                        type="button"
                        onClick={() => handleToggleRecipient(recipient.id)}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                          recipient.isActive
                            ? 'bg-emerald-950/50 border-emerald-800/40 text-emerald-400'
                            : 'bg-slate-900 border-slate-850 text-slate-500 hover:text-slate-300'
                        }`}
                        title={recipient.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>

                      {/* Hapus Rekening */}
                      <button
                        type="button"
                        onClick={() => handleDeleteRecipient(recipient.id)}
                        className="p-1.5 bg-slate-900 hover:bg-red-950/50 border border-slate-850 hover:border-red-900/30 text-slate-500 hover:text-red-400 rounded-lg transition-all cursor-pointer"
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

          {/* SECURITY PIN */}
          <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <ShieldAlert className="w-4 h-4 text-emerald-400" /> PIN Keamanan Otentikasi
            </h3>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">PIN Penjaga Gudang / Admin</span>
              <input
                type="password"
                required
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-850 focus:border-emerald-500 focus:outline-none font-mono"
              />
              <p className="text-[9px] text-slate-500 italic mt-1">Digunakan untuk menyetujui proses sensitif seperti reset database.</p>
            </div>
          </div>

          {/* Settings Save action */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-950/40 disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan Semua Pengaturan'}
          </button>

          {/* SYSTEM OPERATIONS DATABASE MANAGEMENT */}
          <div className="bg-slate-900/30 border border-slate-850 p-4 rounded-2xl space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-slate-400" /> Sinkronisasi Database Offline (IndexedDB)
            </h3>
            <p className="text-[10px] text-slate-500">
              KasirPro berjalan sepenuhnya offline di peramban Anda. Anda disarankan melakukan backup data secara berkala agar aman.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleBackup}
                className="flex items-center justify-center gap-1 px-3 py-2 bg-slate-850 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-emerald-400" /> Backup Data (.json)
              </button>
              <button
                type="button"
                onClick={handleRestoreClick}
                className="flex items-center justify-center gap-1 px-3 py-2 bg-slate-850 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <FileUp className="w-3.5 h-3.5 text-blue-400" /> Restore Data
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileRestoreChange}
                className="hidden"
              />
            </div>

            <div className="pt-2 border-t border-slate-850/60">
              <button
                type="button"
                onClick={triggerFullReset}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-red-950/40 hover:bg-red-900/40 text-red-400 text-xs font-bold rounded-xl transition-all cursor-pointer border border-red-900/20"
              >
                <Trash2 className="w-3.5 h-3.5" /> Reset Seluruh Data POS
              </button>
            </div>
          </div>

          {/* ABOUT APP DETAILS */}
          <div className="bg-slate-900/20 border border-slate-850 p-3.5 rounded-xl flex items-start gap-3">
            <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-[10px] text-slate-500 leading-relaxed">
              <span className="font-extrabold text-slate-300 block">Tentang Aplikasi KasirPro</span>
              KasirPro adalah aplikasi Point of Sale (POS) modular, professional, offline-first, dan installable. Semua data disimpan sepenuhnya di perangkat lokal Anda menggunakan teknologi IndexedDB yang aman.
            </div>
          </div>

        </form>
      </div>

      {/* Custom Database Reset Confirmation Modal Overlay */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-slate-900 border border-red-900/40 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center space-y-5">
            <div className="w-14 h-14 bg-red-950/60 border border-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            
            <div className="space-y-2">
              <h3 className="font-extrabold text-white text-base">⚠️ PERINGATAN SANGAT KRITIS</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Anda akan menghapus seluruh data produk, riwayat transaksi, dan pengaturan selamanya dari perangkat ini. Data tidak dapat dipulihkan!
              </p>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Masukkan PIN Keamanan (PIN Anda saat ini: <span className="text-emerald-400 font-mono font-black underline">{settings.pin}</span>):
              </label>
              <input
                type="password"
                maxLength={8}
                placeholder={`Ketik ${settings.pin} di sini`}
                value={confirmPin}
                onChange={(e) => {
                  setConfirmPin(e.target.value);
                  setResetError('');
                }}
                className="w-full bg-slate-950 text-center font-extrabold text-sm tracking-widest text-slate-100 py-2.5 rounded-xl border border-slate-800 focus:border-red-500 focus:outline-none"
              />
              {resetError && (
                <p className="text-[10px] text-red-400 text-center mt-1 animate-pulse">
                  {resetError}
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Batalkan
              </button>
              <button
                type="button"
                onClick={executeFullReset}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-lg shadow-red-950/50"
              >
                Ya, Reset Seluruh POS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
