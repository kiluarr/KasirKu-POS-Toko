import { Product, Transaction, StoreSettings, Expense } from '../types';

const DB_NAME = 'KasirProDB';
const DB_VERSION = 2;

let dbInstance: IDBDatabase | null = null;
let useFallback = false;
let memoryDb: Record<string, any> = {
  products: {},
  transactions: {},
  settings: {}
};

// Check if IndexedDB is supported at module load
try {
  if (typeof indexedDB === 'undefined' || !indexedDB) {
    useFallback = true;
  }
} catch (e) {
  useFallback = true;
}

// Fallback storage utility that gracefully degrades from LocalStorage to in-memory dictionary
const fallbackStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return memoryDb[key] || null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      memoryDb[key] = value;
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      delete memoryDb[key];
    }
  },
  clear(): void {
    try {
      localStorage.clear();
    } catch (e) {
      memoryDb = { products: {}, transactions: {}, settings: {} };
    }
  }
};

function getFallbackData<T>(key: string, defaultVal: T): T {
  const data = fallbackStorage.getItem(key);
  if (!data) return defaultVal;
  try {
    return JSON.parse(data);
  } catch (e) {
    return defaultVal;
  }
}

function saveFallbackData<T>(key: string, data: T): void {
  fallbackStorage.setItem(key, JSON.stringify(data));
}

export function initDB(): Promise<IDBDatabase> {
  if (useFallback) {
    return Promise.reject(new Error('IndexedDB fallback active'));
  }
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.warn('IndexedDB failed to open, switching to fallback storage');
        useFallback = true;
        reject(request.error || new Error('IndexedDB open error'));
      };

      request.onsuccess = () => {
        dbInstance = request.result;
        resolve(dbInstance);
      };

      request.onupgradeneeded = (event) => {
        const db = request.result;

        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('transactions')) {
          const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
          txStore.createIndex('date', 'date', { unique: false });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }

        if (!db.objectStoreNames.contains('expenses')) {
          const expStore = db.createObjectStore('expenses', { keyPath: 'id' });
          expStore.createIndex('date', 'date', { unique: false });
        }
      };
    } catch (err) {
      console.warn('IndexedDB exception on open, switching to fallback:', err);
      useFallback = true;
      reject(err);
    }
  });
}

// Helper generic store access
function getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<{ store: IDBObjectStore, transaction: IDBTransaction }> {
  return initDB().then((db) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    return { store, transaction };
  });
}

// PRODUCTS API
export async function getAllProducts(): Promise<Product[]> {
  if (useFallback) {
    return getFallbackData<Product[]>('kasirpro_products', []);
  }
  try {
    const { store } = await getStore('products', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn('getAllProducts IndexedDB failed, using fallback:', err);
    useFallback = true;
    return getFallbackData<Product[]>('kasirpro_products', []);
  }
}

export async function saveProduct(product: Product): Promise<void> {
  if (useFallback) {
    const products = getFallbackData<Product[]>('kasirpro_products', []);
    const idx = products.findIndex(p => p.id === product.id);
    if (idx >= 0) {
      products[idx] = product;
    } else {
      products.push(product);
    }
    saveFallbackData('kasirpro_products', products);
    return;
  }
  try {
    const { store } = await getStore('products', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(product);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('saveProduct IndexedDB failed, using fallback:', err);
    useFallback = true;
    const products = getFallbackData<Product[]>('kasirpro_products', []);
    const idx = products.findIndex(p => p.id === product.id);
    if (idx >= 0) {
      products[idx] = product;
    } else {
      products.push(product);
    }
    saveFallbackData('kasirpro_products', products);
  }
}

export async function deleteProduct(id: string): Promise<void> {
  if (useFallback) {
    const products = getFallbackData<Product[]>('kasirpro_products', []);
    const filtered = products.filter(p => p.id !== id);
    saveFallbackData('kasirpro_products', filtered);
    return;
  }
  try {
    const { store } = await getStore('products', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('deleteProduct IndexedDB failed, using fallback:', err);
    useFallback = true;
    const products = getFallbackData<Product[]>('kasirpro_products', []);
    const filtered = products.filter(p => p.id !== id);
    saveFallbackData('kasirpro_products', filtered);
  }
}

// TRANSACTIONS API
export async function getAllTransactions(): Promise<Transaction[]> {
  if (useFallback) {
    const list = getFallbackData<Transaction[]>('kasirpro_transactions', []);
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return list;
  }
  try {
    const { store } = await getStore('transactions', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const list = request.result || [];
        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        resolve(list);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn('getAllTransactions IndexedDB failed, using fallback:', err);
    useFallback = true;
    const list = getFallbackData<Transaction[]>('kasirpro_transactions', []);
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return list;
  }
}

export async function saveTransaction(transaction: Transaction): Promise<void> {
  if (useFallback) {
    const txs = getFallbackData<Transaction[]>('kasirpro_transactions', []);
    const idx = txs.findIndex(t => t.id === transaction.id);
    if (idx >= 0) {
      txs[idx] = transaction;
    } else {
      txs.push(transaction);
    }
    saveFallbackData('kasirpro_transactions', txs);
    return;
  }
  try {
    const { store } = await getStore('transactions', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(transaction);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('saveTransaction IndexedDB failed, using fallback:', err);
    useFallback = true;
    const txs = getFallbackData<Transaction[]>('kasirpro_transactions', []);
    const idx = txs.findIndex(t => t.id === transaction.id);
    if (idx >= 0) {
      txs[idx] = transaction;
    } else {
      txs.push(transaction);
    }
    saveFallbackData('kasirpro_transactions', txs);
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  if (useFallback) {
    const txs = getFallbackData<Transaction[]>('kasirpro_transactions', []);
    const filtered = txs.filter(t => t.id !== id);
    saveFallbackData('kasirpro_transactions', filtered);
    return;
  }
  try {
    const { store } = await getStore('transactions', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('deleteTransaction IndexedDB failed, using fallback:', err);
    useFallback = true;
    const txs = getFallbackData<Transaction[]>('kasirpro_transactions', []);
    const filtered = txs.filter(t => t.id !== id);
    saveFallbackData('kasirpro_transactions', filtered);
  }
}

// SETTINGS API
const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'KasirPro Utama',
  address: 'Jl. Sudirman No. 45, Jakarta',
  phone: '081234567890',
  cashierName: 'Kasir Utama',
  currency: 'Rp',
  theme: 'light', // default theme
  pin: '1234',
  receiptFooter: 'Terima Kasih Atas Kunjungan Anda!',
  logoUrl: '',
  paymentRecipients: []
};

export async function getSettings(): Promise<StoreSettings> {
  if (useFallback) {
    return getFallbackData<StoreSettings>('kasirpro_settings', DEFAULT_SETTINGS);
  }
  try {
    const { store } = await getStore('settings', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get('store_settings');
      request.onsuccess = () => {
        resolve(request.result || DEFAULT_SETTINGS);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn('getSettings IndexedDB failed, using fallback:', err);
    useFallback = true;
    return getFallbackData<StoreSettings>('kasirpro_settings', DEFAULT_SETTINGS);
  }
}

export async function saveSettings(settings: StoreSettings): Promise<void> {
  if (useFallback) {
    saveFallbackData('kasirpro_settings', settings);
    return;
  }
  try {
    const { store } = await getStore('settings', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(settings, 'store_settings');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('saveSettings IndexedDB failed, using fallback:', err);
    useFallback = true;
    saveFallbackData('kasirpro_settings', settings);
  }
}

// RESET DATABASE
export async function resetDatabase(): Promise<void> {
  fallbackStorage.clear();
  if (useFallback) {
    return Promise.resolve();
  }
  try {
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
    }
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        reject(request.error);
      };
      request.onblocked = () => {
        console.warn('Database deletion blocked. Force resolving.');
        resolve();
      };
    });
  } catch (err) {
    console.warn('resetDatabase IndexedDB failed, fallback cleared anyway:', err);
    return Promise.resolve();
  }
}

// SEED INITIAL PRODUCTS IF EMPTY
export async function seedInitialProductsIfEmpty(): Promise<void> {
  // Dinonaktifkan: aplikasi harus selalu mulai kosong, tanpa data contoh
  return;
}
  
  const products = await getAllProducts();
  if (products.length > 0) return;

  const initialProducts: Product[] = [
    {
      id: 'p1',
      name: 'Kopi Susu Gula Aren',
      sku: 'KOP-001',
      barcode: '8991234560012',
      category: 'Minuman',
      costPrice: 8000,
      sellingPrice: 18000,
      stock: 50,
    },
    {
      id: 'p2',
      name: 'Roti Bakar Cokelat Keju',
      sku: 'ROT-002',
      barcode: '8991234560029',
      category: 'Makanan',
      costPrice: 10000,
      sellingPrice: 22000,
      stock: 30,
    },
    {
      id: 'p3',
      name: 'Ice Green Tea Latte',
      sku: 'GTE-003',
      barcode: '8991234560036',
      category: 'Minuman',
      costPrice: 9000,
      sellingPrice: 20000,
      stock: 40,
    },
    {
      id: 'p4',
      name: 'Kentang Goreng Krispi',
      sku: 'FFR-004',
      barcode: '8991234560043',
      category: 'Camilan',
      costPrice: 7000,
      sellingPrice: 15000,
      stock: 8, // Low stock on purpose to trigger low stock alerts!
    },
    {
      id: 'p5',
      name: 'Nasi Goreng Spesial',
      sku: 'NAS-005',
      barcode: '8991234560050',
      category: 'Makanan',
      costPrice: 12000,
      sellingPrice: 25000,
      stock: 25,
    },
  ];

  for (const product of initialProducts) {
    await saveProduct(product);
  }
}

// EXPENSES API
export async function getAllExpenses(): Promise<Expense[]> {
  if (useFallback) {
    return getFallbackData<Expense[]>('kasirpro_expenses', []);
  }
  try {
    const { store } = await getStore('expenses', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn('getAllExpenses IndexedDB failed, using fallback:', err);
    useFallback = true;
    return getFallbackData<Expense[]>('kasirpro_expenses', []);
  }
}

export async function saveExpense(expense: Expense): Promise<void> {
  if (useFallback) {
    const expenses = getFallbackData<Expense[]>('kasirpro_expenses', []);
    const idx = expenses.findIndex(e => e.id === expense.id);
    if (idx >= 0) {
      expenses[idx] = expense;
    } else {
      expenses.push(expense);
    }
    saveFallbackData('kasirpro_expenses', expenses);
    return;
  }
  try {
    const { store } = await getStore('expenses', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(expense);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('saveExpense IndexedDB failed, using fallback:', err);
    useFallback = true;
    const expenses = getFallbackData<Expense[]>('kasirpro_expenses', []);
    const idx = expenses.findIndex(e => e.id === expense.id);
    if (idx >= 0) {
      expenses[idx] = expense;
    } else {
      expenses.push(expense);
    }
    saveFallbackData('kasirpro_expenses', expenses);
  }
}

export async function deleteExpense(id: string): Promise<void> {
  if (useFallback) {
    const expenses = getFallbackData<Expense[]>('kasirpro_expenses', []);
    const filtered = expenses.filter(e => e.id !== id);
    saveFallbackData('kasirpro_expenses', filtered);
    return;
  }
  try {
    const { store } = await getStore('expenses', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('deleteExpense IndexedDB failed, using fallback:', err);
    useFallback = true;
    const expenses = getFallbackData<Expense[]>('kasirpro_expenses', []);
    const filtered = expenses.filter(e => e.id !== id);
    saveFallbackData('kasirpro_expenses', filtered);
  }
}

