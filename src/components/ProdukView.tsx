import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  Package, 
  Check, 
  AlertCircle,
  FileSpreadsheet,
  Grid
} from 'lucide-react';
import { Product, StoreSettings } from '../types';
import { getAllProducts, saveProduct, deleteProduct } from '../lib/db';

interface ProdukViewProps {
  onClose?: () => void; // If rendered as modal
  settings: StoreSettings;
}

export default function ProdukView({ onClose, settings }: ProdukViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Semua');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formCategory, setFormCategory] = useState('Makanan');
  const [formCostPrice, setFormCostPrice] = useState(0);
  const [formSellingPrice, setFormSellingPrice] = useState(0);
  const [formStock, setFormStock] = useState(0);

  // Loaded Categories
  const categories = ['Makanan', 'Minuman', 'Camilan', 'Lainnya'];

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const list = await getAllProducts();
      setProducts(list);
    } catch (err) {
      console.error('Error loading products:', err);
    }
  }

  // Generate a random but structured SKU if empty
  const generateSku = () => {
    const prefix = formCategory.slice(0, 3).toUpperCase();
    const randNum = Math.floor(100 + Math.random() * 900);
    setFormSku(`${prefix}-${randNum}`);
  };

  // Generate random Barcode
  const generateBarcode = () => {
    const prefix = '899';
    const rand = Math.floor(1000000000 + Math.random() * 9000000000);
    setFormBarcode(`${prefix}${rand}`);
  };

  const handleOpenForm = (product?: Product) => {
    if (product) {
      setEditingId(product.id);
      setFormName(product.name);
      setFormSku(product.sku);
      setFormBarcode(product.barcode);
      setFormCategory(product.category);
      setFormCostPrice(product.costPrice);
      setFormSellingPrice(product.sellingPrice);
      setFormStock(product.stock);
    } else {
      setEditingId(null);
      setFormName('');
      setFormSku('');
      setFormBarcode('');
      setFormCategory('Makanan');
      setFormCostPrice(0);
      setFormSellingPrice(0);
      setFormStock(0);
    }
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      alert('Nama produk tidak boleh kosong!');
      return;
    }

    const skuToSave = formSku.trim() || `PRO-${Date.now().toString().slice(-4)}`;
    const barcodeToSave = formBarcode.trim() || `899${Date.now().toString()}`;

    const newProduct: Product = {
      id: editingId || `p-${Date.now()}`,
      name: formName.trim(),
      sku: skuToSave,
      barcode: barcodeToSave,
      category: formCategory,
      costPrice: Number(formCostPrice),
      sellingPrice: Number(formSellingPrice),
      stock: Number(formStock),
    };

    try {
      await saveProduct(newProduct);
      setIsFormOpen(false);
      loadProducts();
    } catch (err) {
      console.error('Error saving product:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProduct(id);
      loadProducts();
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  };

  // Filters
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery);

    const matchesCategory = categoryFilter === 'Semua' || p.category === categoryFilter;

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

  return (
    <div className="fixed inset-0 z-40 bg-slate-950 text-slate-100 flex flex-col h-screen overflow-hidden pb-16">
      {/* Top Bar Header */}
      <div className="bg-slate-900 border-b border-emerald-950 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-bold text-white">Kelola Persediaan Produk</h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Filter / Actions Subheader */}
      <div className="p-4 bg-slate-900/50 space-y-3 border-b border-slate-900">
        <div className="flex gap-2">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Cari nama, SKU, atau barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 text-xs text-slate-200 pl-9 pr-4 py-2.5 rounded-xl border border-slate-800 focus:border-emerald-600 focus:outline-none placeholder-slate-550"
            />
          </div>

          {/* Add product button */}
          <button
            onClick={() => handleOpenForm()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/40 shrink-0"
          >
            <Plus className="w-4 h-4" /> Tambah
          </button>
        </div>

        {/* Category horizontal filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 pr-4 no-scrollbar">
          {['Semua', ...categories].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                categoryFilter === cat
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-slate-500 space-y-2">
            <Grid className="w-10 h-10 mx-auto text-slate-700" />
            <p className="text-xs">Tidak ditemukan produk yang cocok.</p>
          </div>
        ) : (
          filteredProducts.map((p) => {
            const isLowStock = p.stock <= 10;
            return (
              <div
                key={p.id}
                className="bg-slate-900 border border-slate-800/80 rounded-xl p-3.5 flex justify-between items-start hover:border-emerald-900/50 transition-all"
              >
                <div className="space-y-1.5 max-w-[70%]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                      {p.category}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{p.sku}</span>
                  </div>
                  <h3 className="text-sm font-bold text-white line-clamp-1">{p.name}</h3>
                  <div className="space-y-0.5 text-[11px] text-slate-400">
                    <div className="flex justify-between w-48">
                      <span>Modal:</span>
                      <span className="font-medium text-slate-300">{formatNum(p.costPrice)}</span>
                    </div>
                    <div className="flex justify-between w-48">
                      <span>Jual:</span>
                      <span className="font-extrabold text-emerald-400">{formatNum(p.sellingPrice)}</span>
                    </div>
                    <div className="flex justify-between w-48 pt-0.5 border-t border-slate-800/40">
                      <span>Barcode:</span>
                      <span className="font-mono text-[10px] text-slate-500">{p.barcode}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end justify-between h-20">
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      isLowStock
                        ? 'bg-red-950/60 text-red-400 border border-red-900/30'
                        : 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/20'
                    }`}
                  >
                    Stok: {p.stock}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenForm(p)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
                      title="Edit Produk"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(p.id)}
                      className="p-2 bg-red-950/50 hover:bg-red-900/60 text-red-400 rounded-lg transition-colors cursor-pointer"
                      title="Hapus Produk"
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

      {/* Full screen form Modal overlays */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-emerald-900/45 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-emerald-950/60 flex items-center justify-between">
              <h3 className="font-bold text-emerald-400 text-sm">
                {editingId ? 'Edit Detail Produk' : 'Tambah Produk Baru'}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Product Name */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block">
                  Nama Produk <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kopi Susu Aren"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* SKU & Barcode */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block flex justify-between">
                    <span>SKU</span>
                    <button
                      type="button"
                      onClick={generateSku}
                      className="text-[10px] text-emerald-400 hover:underline"
                    >
                      Acak
                    </button>
                  </label>
                  <input
                    type="text"
                    placeholder="KOP-001"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800 focus:border-emerald-500 focus:outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block flex justify-between">
                    <span>Barcode</span>
                    <button
                      type="button"
                      onClick={generateBarcode}
                      className="text-[10px] text-emerald-400 hover:underline"
                    >
                      Acak
                    </button>
                  </label>
                  <input
                    type="text"
                    placeholder="899123456..."
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    className="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800 focus:border-emerald-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Category selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block">
                  Kategori
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormCategory(cat)}
                      className={`py-2 text-center text-[10px] font-bold rounded-lg border transition-all ${
                        formCategory === cat
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-700'
                          : 'bg-slate-950 text-slate-400 border-slate-850 hover:bg-slate-850'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pricing details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block">
                    Harga Modal (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="8000"
                    value={formCostPrice || ''}
                    onChange={(e) => setFormCostPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide block">
                    Harga Jual (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="15000"
                    value={formSellingPrice || ''}
                    onChange={(e) => setFormSellingPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 text-xs text-emerald-400 px-3 py-2.5 rounded-xl border border-emerald-800 focus:border-emerald-500 focus:outline-none font-extrabold"
                  />
                </div>
              </div>

              {Number(formSellingPrice) < Number(formCostPrice) && (
                <div className="text-[10px] text-amber-400 bg-amber-950/40 border border-amber-900/30 p-2.5 rounded-xl flex items-start gap-1.5 leading-relaxed">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
                  <span><strong>Peringatan:</strong> Harga jual lebih rendah dari harga modal! Pastikan ini adalah tindakan yang Anda inginkan.</span>
                </div>
              )}

              {/* Inventory Stock */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block">
                  Jumlah Stok Barang
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="50"
                  value={formStock || ''}
                  onChange={(e) => setFormStock(Number(e.target.value))}
                  className="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-800 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 py-2.5 text-center text-slate-300 bg-slate-850 hover:bg-slate-800 text-xs font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-center text-white bg-emerald-600 hover:bg-emerald-500 text-xs font-bold rounded-xl cursor-pointer"
                >
                  {editingId ? 'Simpan Perubahan' : 'Tambah Produk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Deletion Confirmation Modal Overlay */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-red-900/30 rounded-2xl w-full max-w-xs shadow-2xl p-5 text-center space-y-4">
            <div className="w-12 h-12 bg-red-950/40 border border-red-900/20 text-red-400 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-white text-sm">Hapus Produk?</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Apakah Anda yakin ingin menghapus produk ini? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (deleteConfirmId) {
                    await handleDelete(deleteConfirmId);
                    setDeleteConfirmId(null);
                  }
                }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
