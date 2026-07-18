import { useState, useEffect } from 'react';
import { 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  CheckCircle, 
  QrCode, 
  CreditCard, 
  DollarSign, 
  FileText,
  ScanLine,
  X,
  Sparkles,
  ShoppingBag,
  Copy,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Product, CartItem, PaymentMethod, Transaction, StoreSettings } from '../types';
import { getAllProducts, saveProduct, saveTransaction } from '../lib/db';
import StrukModal from './StrukModal';

interface KasirViewProps {
  settings: StoreSettings;
}

export default function KasirView({ settings }: KasirViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');

  // Transaction settings
  const [discountPercent, setDiscountPercent] = useState(0);
  const [applyTax, setApplyTax] = useState(true);
  const [txNotes, setTxNotes] = useState('');

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('');

  // Success Modal & Receipt
  const [showReceipt, setShowReceipt] = useState(false);
  const [showTransferPopup, setShowTransferPopup] = useState(false);
  const [copiedField, setCopiedField] = useState<'total' | 'account' | null>(null);
  const [activeTransaction, setActiveTransaction] = useState<Transaction | null>(null);

  // Barcode / Scanner simulation state
  const [showScanSimulator, setShowScanSimulator] = useState(false);

  // Loaded Categories
  const categories = ['Semua', 'Makanan', 'Minuman', 'Camilan', 'Lainnya'];

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const list = await getAllProducts();
      setProducts(list);
    } catch (err) {
      console.error('Error loading products for register:', err);
    }
  }

  // Adding item to cart
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert(`Stok untuk "${product.name}" habis!`);
      return;
    }

    const existingIndex = cart.findIndex((item) => item.product.id === product.id);

    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty >= product.stock) {
        alert(`Jumlah pembelian melebihi sisa stok produk (${product.stock} pcs).`);
        return;
      }
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += 1;
      setCart(updatedCart);
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  // Decreasing cart quantity
  const decreaseQuantity = (productId: string) => {
    const existingIndex = cart.findIndex((item) => item.product.id === productId);
    if (existingIndex > -1) {
      const updatedCart = [...cart];
      if (updatedCart[existingIndex].quantity > 1) {
        updatedCart[existingIndex].quantity -= 1;
        setCart(updatedCart);
      } else {
        removeFromCart(productId);
      }
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  // Cart Subtotal (without discounts/taxes)
  const cartSubtotal = cart.reduce((acc, item) => acc + item.product.sellingPrice * item.quantity, 0);
  
  // Calculate proportional nominal discount
  const nominalDiscount = (cartSubtotal * discountPercent) / 100;
  
  // Tax 11% (applied on subtotal minus discount)
  const taxableAmount = Math.max(cartSubtotal - nominalDiscount, 0);
  const nominalTax = applyTax ? Math.round(taxableAmount * 0.11) : 0;
  
  // Final Total
  const cartTotal = Math.max(taxableAmount + nominalTax, 0);

  // Auto-set pre-defined cash payment shortcuts based on total
  const getCashShortcuts = () => {
    if (cartTotal <= 0) return [];
    const baseShortcuts = [cartTotal];
    
    // Add next clean round figures
    const roundUps = [5000, 10000, 20000, 50000, 100000];
    roundUps.forEach((round) => {
      const val = Math.ceil(cartTotal / round) * round;
      if (val > cartTotal && !baseShortcuts.includes(val)) {
        baseShortcuts.push(val);
      }
    });

    return [...new Set(baseShortcuts)].sort((a, b) => a - b).slice(0, 4);
  };

  // Simulate scanning of barcode
  const handleSimulateScan = (barcode: string) => {
    const matched = products.find((p) => p.barcode === barcode || p.sku === barcode);
    if (matched) {
      addToCart(matched);
      setShowScanSimulator(false);
      // Brief feedback
      confetti({
        particleCount: 15,
        spread: 30,
        origin: { y: 0.8 }
      });
    } else {
      alert(`Produk dengan Barcode/SKU "${barcode}" tidak terdaftar.`);
    }
  };

  // Submit payment & complete transaction
  const handleCheckoutSubmit = async () => {
    if (cart.length === 0) {
      alert('Keranjang belanja kosong!');
      return;
    }

    if (paymentAmount < cartTotal && paymentMethod === 'CASH') {
      alert('Jumlah pembayaran kurang dari total tagihan!');
      return;
    }

    // Set auto-payment amount for cashless methods
    const finalPaymentAmount = paymentMethod === 'CASH' ? paymentAmount : cartTotal;
    const changeAmount = Math.max(finalPaymentAmount - cartTotal, 0);

    // Generate Invoice Number format: INV-YYMMDD-HHMMSS
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const invoiceNo = `INV-${yy}${mm}${dd}-${hh}${min}${ss}`;

    const transactionItems = cart.map((item) => ({
      productId: item.product.id,
      name: item.product.name,
      quantity: item.quantity,
      costPrice: item.product.costPrice,
      sellingPrice: item.product.sellingPrice,
      total: item.product.sellingPrice * item.quantity,
    }));

    const selectedRecipient = settings.paymentRecipients?.find((r) => r.id === selectedRecipientId);

    const transaction: Transaction = {
      id: `tx-${Date.now()}`,
      invoiceNumber: invoiceNo,
      date: now.toISOString(),
      items: transactionItems,
      subtotal: cartSubtotal,
      discount: nominalDiscount,
      tax: nominalTax,
      total: cartTotal,
      paymentMethod,
      paymentAmount: finalPaymentAmount,
      changeAmount,
      notes: txNotes.trim(),
      cashierName: settings.cashierName,
      paymentRecipient: selectedRecipient,
    };

    try {
      // 1. Deduct Product stock in IndexedDB
      for (const item of cart) {
        const prod = products.find((p) => p.id === item.product.id);
        if (prod) {
          const updatedProd = { ...prod, stock: Math.max(prod.stock - item.quantity, 0) };
          await saveProduct(updatedProd);
        }
      }

      // 2. Save Transaction to IndexedDB
      await saveTransaction(transaction);

      // 3. Trigger professional success celebration
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });

      // 4. Open Receipt view or show Transfer Instructions Info Popup
      setActiveTransaction(transaction);
      if (paymentMethod === 'CASH') {
        setShowReceipt(true);
      } else {
        setShowTransferPopup(true);
      }
      setIsCheckoutOpen(false);

      // Reset cart and checkout values
      setCart([]);
      setDiscountPercent(0);
      setTxNotes('');
      setPaymentAmount(0);
      setApplyTax(true);

      // Reload products list to reflect newly deducted inventory stocks
      loadProducts();
    } catch (err) {
      console.error('Error completing transaction:', err);
      alert('Gagal memproses transaksi. Periksa database.');
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery);

    const matchesCategory = selectedCategory === 'Semua' || p.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const formatNum = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num).replace('Rp', settings.currency);
  };

  const renderDeterministicQR = (text: string) => {
    const size = 15;
    const grid = [];
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }

    for (let r = 0; r < size; r++) {
      const row = [];
      for (let c = 0; c < size; c++) {
        const isFinderTopLeft = r < 5 && c < 5;
        const isFinderTopRight = r < 5 && c >= size - 5;
        const isFinderBottomLeft = r >= size - 5 && c < 5;

        if (isFinderTopLeft || isFinderTopRight || isFinderBottomLeft) {
          const innerR = r === 0 || r === 4 || c === 0 || c === 4 || (r === 2 && c === 2);
          const innerR_TR = r === 0 || r === 4 || c === size - 1 || c === size - 5 || (r === 2 && c === size - 3);
          const innerR_BL = r === size - 1 || r === size - 5 || c === 0 || c === 4 || (r === size - 3 && c === 2);
          
          if (isFinderTopLeft) row.push(innerR || (r >= 1 && r <= 3 && c >= 1 && c <= 3 && !(r === 2 && c === 2) === false));
          else if (isFinderTopRight) row.push(innerR_TR || (r >= 1 && r <= 3 && c >= size - 4 && c <= size - 2 && !(r === 2 && c === size - 3) === false));
          else row.push(innerR_BL || (r >= size - 4 && r <= size - 2 && c >= 1 && c <= 3 && !(r === size - 3 && c === 2) === false));
        } else {
          const bitIndex = r * size + c;
          const val = ((hash >> (bitIndex % 32)) & 1) === 1;
          row.push(val);
        }
      }
      grid.push(row);
    }

    return (
      <svg viewBox={`0 0 ${size} ${size}`} className="w-32 h-32 mx-auto border p-1 bg-white rounded-lg shadow-inner">
        {grid.map((row, rIdx) =>
          row.map((active, cIdx) => (
            <rect
              key={`${rIdx}-${cIdx}`}
              x={cIdx}
              y={rIdx}
              width="1.05"
              height="1.05"
              fill={active ? '#000000' : '#FFFFFF'}
            />
          ))
        )}
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-16">
      {/* Top Header Grid Area */}
      <div className="bg-slate-900 border-b border-emerald-950 px-5 py-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-white flex items-center gap-1.5">
          <ShoppingBag className="w-4.5 h-4.5 text-emerald-400" />
          Mesin Kasir Pro
        </h2>
        <button
          onClick={() => setShowScanSimulator(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-400 border border-emerald-800/40 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
        >
          <ScanLine className="w-3.5 h-3.5" /> Barcode Scanner
        </button>
      </div>

      {/* Main Register Workspace Split */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Left Side: Product Selector Grid */}
        <div className="flex-1 flex flex-col border-r border-slate-900 overflow-y-auto max-h-[50vh] md:max-h-[calc(100vh-120px)] p-4 space-y-4">
          
          {/* Fast search input */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Cari nama, SKU, atau barcode produk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 text-xs text-slate-200 pl-9 pr-4 py-2.5 rounded-xl border border-slate-800 focus:border-emerald-600 focus:outline-none placeholder-slate-550"
            />
          </div>

          {/* Horizontal Category Pill selector */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide whitespace-nowrap cursor-pointer transition-all ${
                  selectedCategory === cat
                    ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-850'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Real Products Loop */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              Tidak ada produk yang terdaftar untuk pencarian/kategori ini.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredProducts.map((p) => {
                const isOutOfStock = p.stock <= 0;
                const isLowStock = p.stock > 0 && p.stock <= 10;

                return (
                  <button
                    key={p.id}
                    disabled={isOutOfStock}
                    onClick={() => addToCart(p)}
                    className={`bg-slate-900/60 hover:bg-slate-900 border border-slate-850/80 rounded-2xl p-3.5 flex flex-col justify-between text-left transition-all active:scale-95 select-none relative overflow-hidden group cursor-pointer ${
                      isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                          {p.category}
                        </span>
                        <span className={`text-[9px] font-bold ${
                          isOutOfStock ? 'text-red-400' : isLowStock ? 'text-amber-400' : 'text-slate-500'
                        }`}>
                          Stok: {p.stock}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-200 line-clamp-2 min-h-[32px] group-hover:text-emerald-400 transition-colors">
                        {p.name}
                      </h4>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                      <span className="text-xs font-black text-white">{formatNum(p.sellingPrice)}</span>
                      <span className="p-1 bg-emerald-950/80 border border-emerald-900/35 text-emerald-400 rounded-lg group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all">
                        <Plus className="w-3.5 h-3.5" />
                      </span>
                    </div>

                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px]">
                        <span className="text-[10px] font-bold bg-red-950 text-red-400 border border-red-800/40 px-2 py-1 rounded">HABIS</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Interactive Shopping Cart */}
        <div className="w-full md:w-[360px] bg-slate-900 border-t md:border-t-0 md:border-l border-emerald-950/40 flex flex-col max-h-[50vh] md:max-h-[calc(100vh-120px)]">
          {/* Cart Header */}
          <div className="px-4 py-3.5 border-b border-emerald-950/50 flex justify-between items-center bg-emerald-950/10">
            <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-widest">
              Keranjang Belanja ({cart.reduce((sum, item) => sum + item.quantity, 0)})
            </span>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-[10px] font-bold text-red-400 hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" /> Bersihkan
              </button>
            )}
          </div>

          {/* Cart Scroll Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-12">
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-850 mb-3 text-slate-700">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <p className="text-xs">Keranjang kosong. Pilih produk di sebelah kiri.</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.product.id} className="flex justify-between items-center bg-slate-950/50 p-2.5 rounded-xl border border-slate-850">
                  <div className="max-w-[60%] space-y-0.5">
                    <span className="text-[9px] text-slate-500 font-mono tracking-wider">{item.product.sku}</span>
                    <h5 className="text-xs font-bold text-slate-200 line-clamp-1">{item.product.name}</h5>
                    <span className="text-xs font-extrabold text-emerald-400">{formatNum(item.product.sellingPrice * item.quantity)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => decreaseQuantity(item.product.id)}
                      className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold text-white w-4 text-center">{item.quantity}</span>
                    <button
                      onClick={() => addToCart(item.product.id === item.product.id ? item.product : item.product)}
                      className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Bottom Summary Panel */}
          {cart.length > 0 && (
            <div className="p-4 border-t border-slate-800 bg-slate-950/50 space-y-3">
              {/* Discount Selector */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Diskon Pembelian</span>
                <div className="flex gap-1">
                  {[0, 5, 10, 15].map((p) => (
                    <button
                      key={p}
                      onClick={() => setDiscountPercent(p)}
                      className={`px-2 py-1 rounded text-[10px] font-bold ${
                        discountPercent === p
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Tax Switch */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Terapkan Pajak (11% PB1)</span>
                <button
                  onClick={() => setApplyTax(!applyTax)}
                  className={`w-10 h-5 rounded-full transition-colors relative flex items-center ${
                    applyTax ? 'bg-emerald-500 justify-end' : 'bg-slate-800 justify-start'
                  }`}
                >
                  <span className="w-4 h-4 bg-white rounded-full mx-0.5 shadow"></span>
                </button>
              </div>

              {/* Pricing breakdown */}
              <div className="space-y-1 text-xs pt-2 border-t border-slate-850/60">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span>{formatNum(cartSubtotal)}</span>
                </div>
                {nominalDiscount > 0 && (
                  <div className="flex justify-between text-red-400">
                    <span>Diskon ({discountPercent}%):</span>
                    <span>-{formatNum(nominalDiscount)}</span>
                  </div>
                )}
                {nominalTax > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Pajak (11%):</span>
                    <span>{formatNum(nominalTax)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-white pt-1 border-t border-slate-850">
                  <span>TOTAL:</span>
                  <span className="text-base text-emerald-400">{formatNum(cartTotal)}</span>
                </div>
              </div>

              {/* Checkout Trigger */}
              <button
                onClick={() => {
                  setPaymentAmount(cartTotal);
                  setIsCheckoutOpen(true);
                  
                  // Auto-select first active payment recipient based on default selected payment method
                  if (paymentMethod === 'TRANSFER') {
                    const bRecipients = settings.paymentRecipients?.filter(r => r.type === 'BANK' && r.isActive) || [];
                    setSelectedRecipientId(bRecipients[0]?.id || '');
                  } else if (paymentMethod === 'E_WALLET') {
                    const wRecipients = settings.paymentRecipients?.filter(r => r.type === 'E_WALLET' && r.isActive) || [];
                    setSelectedRecipientId(wRecipients[0]?.id || '');
                  } else {
                    setSelectedRecipientId('');
                  }
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-lg shadow-emerald-950/40 mt-1"
              >
                Bayar & Simpan Nota
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Checkout Screen Modal Panel */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-emerald-900/40 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-emerald-950/50 flex items-center justify-between">
              <h3 className="font-bold text-emerald-400 text-sm">Metode Pembayaran & Selesaikan</h3>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="p-1 rounded bg-slate-850 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {/* Grand total reminder */}
              <div className="text-center bg-slate-950/80 p-4 rounded-xl border border-slate-850">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Total Belanjaan</span>
                <h4 className="text-2xl font-black text-emerald-400 mt-1">{formatNum(cartTotal)}</h4>
              </div>

              {/* Payment Methods selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Metode</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'CASH', label: 'Tunai / Cash', icon: DollarSign },
                    { id: 'QRIS', label: 'QRIS Digital', icon: QrCode },
                    { id: 'TRANSFER', label: 'Bank Transfer', icon: CreditCard },
                    { id: 'E_WALLET', label: 'E-Wallet (OVO/GoPay)', icon: Sparkles },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isActive = paymentMethod === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(item.id as PaymentMethod);
                          if (item.id !== 'CASH') setPaymentAmount(cartTotal);
                          
                          // Set default active recipient based on newly chosen payment method
                          if (item.id === 'TRANSFER') {
                            const bRecipients = settings.paymentRecipients?.filter(r => r.type === 'BANK' && r.isActive) || [];
                            setSelectedRecipientId(bRecipients[0]?.id || '');
                          } else if (item.id === 'E_WALLET') {
                            const wRecipients = settings.paymentRecipients?.filter(r => r.type === 'E_WALLET' && r.isActive) || [];
                            setSelectedRecipientId(wRecipients[0]?.id || '');
                          } else {
                            setSelectedRecipientId('');
                          }
                        }}
                        className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-emerald-950/50 border-emerald-500 text-emerald-400'
                            : 'bg-slate-950 border-slate-855 text-slate-400 hover:bg-slate-850'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Payment Recipient Selector */}
              {(paymentMethod === 'TRANSFER' || paymentMethod === 'E_WALLET') && (() => {
                const typeFilter = paymentMethod === 'TRANSFER' ? 'BANK' : 'E_WALLET';
                const activeRecipients = settings.paymentRecipients?.filter(r => r.type === typeFilter && r.isActive) || [];
                
                if (activeRecipients.length === 0) {
                  return (
                    <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-xl text-xs text-red-400">
                      ⚠️ Belum ada rekening penerima aktif untuk metode ini. Silakan tambahkan rekening bank/e-wallet Anda di menu Pengaturan.
                    </div>
                  );
                }

                return (
                  <div className="space-y-2 p-3 bg-slate-950/80 border border-slate-850 rounded-xl">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                      Rekening Penerima ({paymentMethod === 'TRANSFER' ? 'Bank' : 'E-Wallet'}):
                    </label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {activeRecipients.map((rec) => {
                        const isSelected = selectedRecipientId === rec.id;
                        return (
                          <button
                            key={rec.id}
                            type="button"
                            onClick={() => setSelectedRecipientId(rec.id)}
                            className={`w-full p-2.5 rounded-lg border text-left flex items-center justify-between transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-950/30 border-emerald-500/80 text-emerald-400'
                                : 'bg-slate-900 border-slate-850 text-slate-300 hover:bg-slate-850'
                            }`}
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-white">{rec.providerName}</span>
                                <span className="text-[9px] font-mono font-black text-slate-400">{rec.accountNumber}</span>
                              </div>
                              <p className="text-[10px] text-slate-400">a.n. {rec.accountName}</p>
                            </div>
                            {isSelected && (
                              <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 font-black text-[10px]">
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Custom notes input */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                  <FileText className="w-3 h-3 text-slate-500" /> Catatan Transaksi (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Meja 12, Dibawa pulang..."
                  value={txNotes}
                  onChange={(e) => setTxNotes(e.target.value)}
                  className="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-850 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Amount input ONLY for Cash Method */}
              {paymentMethod === 'CASH' && (
                <div className="space-y-3 pt-2 border-t border-slate-850">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Uang Diterima (Cash)</label>
                    <input
                      type="number"
                      required
                      min={cartTotal}
                      placeholder="0"
                      value={paymentAmount || ''}
                      onChange={(e) => setPaymentAmount(Number(e.target.value))}
                      className="w-full bg-slate-950 text-base font-extrabold text-emerald-400 px-4 py-3 rounded-xl border border-slate-800 focus:border-emerald-500 focus:outline-none text-right"
                    />
                  </div>

                  {/* Quick Cash shortcut selections */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Uang Pas / Nominal Cepat</span>
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                      {getCashShortcuts().map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setPaymentAmount(amt)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer shrink-0"
                        >
                          {formatNum(amt)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Change auto-calculation display */}
                  <div className="flex justify-between items-center p-3.5 bg-emerald-950/20 border border-emerald-900/30 rounded-xl text-xs">
                    <span className="text-slate-400">Kembalian Anda:</span>
                    <span className="text-base font-extrabold text-emerald-400">
                      {paymentAmount >= cartTotal ? formatNum(paymentAmount - cartTotal) : 'Kurang'}
                    </span>
                  </div>
                </div>
              )}

              {/* Actions footer submit */}
              <div className="pt-4 border-t border-slate-800 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCheckoutOpen(false)}
                  className="flex-1 py-3 text-center text-slate-300 bg-slate-800 hover:bg-slate-750 text-xs font-bold rounded-xl"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={handleCheckoutSubmit}
                  disabled={paymentMethod === 'CASH' && paymentAmount < cartTotal}
                  className="flex-1 py-3 text-center text-white bg-emerald-600 hover:bg-emerald-500 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/30"
                >
                  Selesaikan Transaksi
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Barcode scanner mockup look-up modal */}
      {showScanSimulator && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-emerald-800/40 rounded-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-emerald-950/60">
              <h3 className="font-bold text-emerald-400 text-xs uppercase tracking-wider flex items-center gap-1">
                <ScanLine className="w-4 h-4 text-emerald-400" /> Barcode Reader
              </h3>
              <button
                onClick={() => setShowScanSimulator(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Pilih salah satu produk terdaftar untuk mensimulasikan hasil scanning barcode/SKU:
            </p>
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSimulateScan(p.barcode)}
                  className="w-full text-left py-2 flex justify-between items-center text-xs hover:text-emerald-400 transition-colors"
                >
                  <div>
                    <span className="font-bold text-slate-200 block">{p.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">Barcode: {p.barcode}</span>
                  </div>
                  <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono uppercase shrink-0">
                    Scan {p.sku}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Transfer Payment Instructions Info Popup */}
      {showTransferPopup && activeTransaction && (
        <div className="fixed inset-0 z-[90] bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in animate-duration-200">
          <div className="bg-slate-900 border border-emerald-800/40 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-emerald-950/50 bg-emerald-950/20 flex items-center justify-between">
              <h3 className="font-bold text-emerald-400 text-sm flex items-center gap-2">
                <QrCode className="w-4.5 h-4.5 text-emerald-400" />
                Instruksi Pembayaran Non-Tunai
              </h3>
              <button
                onClick={() => {
                  setShowTransferPopup(false);
                  setShowReceipt(true);
                }}
                className="p-1 rounded bg-slate-850 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-center">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Total Tagihan</span>
                <div className="flex items-center justify-center gap-2">
                  <h4 className="text-3xl font-black text-emerald-400">{formatNum(activeTransaction.total)}</h4>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(activeTransaction.total.toString());
                      setCopiedField('total');
                      setTimeout(() => setCopiedField(null), 2000);
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white active:bg-slate-700 transition-colors cursor-pointer"
                    title="Salin nominal"
                  >
                    {copiedField === 'total' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                {copiedField === 'total' && (
                  <span className="text-[10px] text-emerald-400 font-bold block animate-pulse">Nominal disalin!</span>
                )}
              </div>

              {activeTransaction.paymentMethod === 'QRIS' ? (
                <div className="bg-slate-950/80 border border-slate-850 p-5 rounded-2xl space-y-4">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">QRIS Dinamis</span>
                  <div className="flex justify-center">
                    {renderDeterministicQR(activeTransaction.invoiceNumber)}
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-xs font-black text-white">Scan QRIS untuk membayar</p>
                    <p className="text-[10px] text-slate-400">Pindai kode QR di atas melalui aplikasi m-banking atau e-wallet (GoPay, OVO, Dana, dll.)</p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950/80 border border-slate-850 p-5 rounded-2xl space-y-4 text-left">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Metode Pembayaran</span>
                    <span className="px-2.5 py-1 bg-emerald-950/50 border border-emerald-800/40 text-emerald-400 rounded-lg text-[10px] font-black uppercase">
                      {activeTransaction.paymentMethod === 'TRANSFER' ? 'Transfer Bank' : 'E-Wallet'}
                    </span>
                  </div>

                  {activeTransaction.paymentRecipient ? (
                    <div className="space-y-3 pt-1">
                      <div>
                        <span className="text-[10px] text-slate-500 font-semibold uppercase block">Penyedia / Bank</span>
                        <p className="text-sm font-black text-white">{activeTransaction.paymentRecipient.providerName}</p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase block">Nomor Rekening / HP</span>
                        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl">
                          <span className="text-sm font-mono font-black text-white select-all">
                            {activeTransaction.paymentRecipient.accountNumber}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(activeTransaction.paymentRecipient?.accountNumber || '');
                              setCopiedField('account');
                              setTimeout(() => setCopiedField(null), 2000);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white active:bg-slate-700 transition-colors cursor-pointer"
                            title="Salin nomor"
                          >
                            {copiedField === 'account' ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        {copiedField === 'account' && (
                          <span className="text-[10px] text-emerald-400 font-bold block text-right animate-pulse">Nomor rekening disalin!</span>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 font-semibold uppercase block">Nama Pemilik Rekening</span>
                        <p className="text-xs font-bold text-slate-200">a.n. {activeTransaction.paymentRecipient.accountName}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <p className="text-xs text-red-400">⚠️ Rekening penerima tidak terpilih atau tidak diatur.</p>
                      <p className="text-[10px] text-slate-500 mt-1">Gunakan detail transfer manual atau atur di menu Pengaturan.</p>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-emerald-950/20 border border-emerald-900/30 p-3 rounded-xl text-left">
                <p className="text-[10px] text-slate-300 leading-normal">
                  💡 <strong>Tip Kasir:</strong> Tunjukkan detail di atas kepada pelanggan untuk menyelesaikan transfer. Setelah pembayaran diverifikasi masuk, tekan tombol di bawah ini untuk melihat dan mencetak struk belanja.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowTransferPopup(false);
                  setShowReceipt(true);
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-lg shadow-emerald-950/40"
              >
                Selesai & Cetak Struk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed Receipt Modal view */}
      {showReceipt && activeTransaction && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col justify-center items-center">
          {/* Confetti celebration indicator card */}
          <div className="max-w-md w-full px-5 text-center mb-4 space-y-1">
            <div className="inline-flex p-3 bg-emerald-950 border border-emerald-800/30 text-emerald-400 rounded-full animate-bounce">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-lg font-black text-white tracking-tight pt-1">✅ Transaksi Berhasil!</h2>
            <p className="text-xs text-slate-400">Stok otomatis diperbarui & nota berhasil diarsipkan.</p>
          </div>

          <StrukModal
            transaction={activeTransaction}
            settings={settings}
            onClose={() => {
              setShowReceipt(false);
              setActiveTransaction(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
