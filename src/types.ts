export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  imageUrl?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type PaymentMethod = 'CASH' | 'QRIS' | 'TRANSFER' | 'E_WALLET';

export interface TransactionItem {
  productId: string;
  name: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  total: number;
}

export interface Transaction {
  id: string;
  invoiceNumber: string;
  date: string; // ISO String
  items: TransactionItem[];
  subtotal: number;
  discount: number; // nominal discount
  tax: number; // nominal tax
  total: number;
  paymentMethod: PaymentMethod;
  paymentAmount: number;
  changeAmount: number;
  notes?: string;
  cashierName: string;
  paymentRecipient?: PaymentRecipient;
}

export interface StoreSettings {
  storeName: string;
  logoUrl?: string;
  address: string;
  phone: string;
  cashierName: string;
  currency: string;
  theme: 'light' | 'dark';
  pin: string;
  receiptFooter: string;
  paymentRecipients?: PaymentRecipient[];
}

export interface PaymentRecipient {
  id: string;
  type: 'BANK' | 'E_WALLET';
  providerName: string;
  accountNumber: string;
  accountName: string;
  isActive: boolean;
}

export interface Expense {
  id: string;
  date: string; // ISO string
  amount: number;
  category: string; // e.g., Listrik, Gaji, Sewa, Operasional, Lainnya
  notes: string;
}


