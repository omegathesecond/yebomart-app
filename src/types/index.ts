// Core types for YeboMart - Multi-Country Shop Management

export type UserRole = 'owner' | 'manager' | 'cashier';
export type ShopRole = 'owner' | 'admin' | 'staff';
export type PaymentMethod = 'cash' | 'momo' | 'emali' | 'card' | 'credit';
export type StockLogType = 'restock' | 'sale' | 'adjustment' | 'damaged';
// Mirrors the API's ExpenseCategory Prisma enum (api/prisma/schema.prisma).
// Stored lowercase in the app domain; the API client maps to/from UPPERCASE.
export type ExpenseCategory =
  | 'rent'
  | 'utilities'
  | 'supplies'
  | 'wages'
  | 'transport'
  | 'marketing'
  | 'repairs'
  | 'other';

// Shop - Now supports multi-country
export interface Shop {
  id: string;
  name: string;
  ownerName: string;
  ownerPhone: string; // Full phone with country code
  phoneCountryCode: string; // ISO country code for phone (e.g., 'SZ')
  countryCode: string; // Shop's operating country (e.g., 'SZ', 'ZA', 'KE')
  businessType: string; // e.g., 'spaza', 'tyre', 'beauty', 'hardware'
  assistantName: string; // AI assistant name (e.g., "Thandi")
  currency: string; // Derived from countryCode
  currencySymbol: string; // Derived from countryCode
  timezone: string;
  address?: string;
  logoUrl?: string;
  // Tax / VAT config (optional — absent on minimal shop objects, defaults to 0%).
  taxRate?: number;          // percent, e.g. 15 for 15% VAT
  taxInclusive?: boolean;    // true = sell prices already include VAT
  taxNumber?: string | null; // VAT registration number (prints on receipt)
  createdAt: Date;
  updatedAt: Date;
}

// User-Shop relationship for multi-shop support
export interface UserShop {
  id: string;
  userId: string;
  shopId: string;
  role: ShopRole;
  createdAt: Date;
}

// User/Staff
export interface User {
  id: string;
  shopId: string;
  name: string;
  phone: string;
  email?: string;
  pin: string; // 4-6 digit PIN for login
  role: UserRole;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  // Permissions
  canDiscount?: boolean;      // Can apply discounts
  maxDiscountPercent?: number; // Max discount allowed (0-100), null = unlimited for owners
  canVoid?: boolean;          // Can void sales
  canRefund?: boolean;        // Can process refunds
}

// Product
export interface Product {
  id: string;
  shopId: string;
  barcode?: string;
  name: string;
  category?: string;
  attributes?: Record<string, string | number>;  // Dynamic product attributes
  costPrice: number;
  sellPrice: number;
  // Wholesale pricing (optional)
  wholesalePrice?: number;   // Bulk price per unit
  wholesaleMinQty?: number;  // Minimum quantity for wholesale price
  quantity: number;
  reorderAt: number;
  unit: string;
  imageUrl?: string;
  // Pack pricing (optional)
  packSize?: number;    // e.g., 6 for a 6-pack
  packPrice?: number;   // price for the pack
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Sale
export interface Sale {
  id: string;
  shopId: string;
  userId: string;
  receiptNumber?: string;     // Human-readable receipt number (e.g., RCP-260212-0001)
  subtotal: number;           // Before discount
  discount: number;           // Discount amount
  discountPercent?: number;   // Discount as percentage (for display)
  discountReason?: string;    // Why discount was applied (audit)
  discountApprovedBy?: string; // Manager ID if override was needed
  tax?: number;               // VAT charged on this sale (0 for non-VAT shops)
  totalAmount: number;        // Final amount after discount (+ tax if exclusive)
  paymentMethod: PaymentMethod;
  // For CREDIT ("on the book") sales: the customer's outstanding balance AFTER
  // this sale was added to their ledger. Printed on the receipt. Undefined for
  // non-credit sales.
  customerBalance?: number;
  items: SaleItem[];
  createdAt: Date;
  syncedAt?: Date;
  localId?: string;       // Client-generated id used for offline-sync dedup
  pendingSync?: boolean;  // True while the sale is queued offline, not yet on the server
  // Linked buyer, only present when the API includes the customer relation.
  // Used to prefill the receipt email field for a past sale.
  customer?: { id?: string; name?: string; email?: string | null } | null;
}

// Sale Item
export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  quantity: number;
  originalPrice: number;      // Original product price
  unitPrice: number;          // Actual price charged (may differ if negotiated)
  totalPrice: number;
  itemDiscount?: number;      // Discount on this specific item
}

// Stock Log
export interface StockLog {
  id: string;
  productId: string;
  type: StockLogType;
  quantity: number; // positive = add, negative = remove
  previousQty: number;
  newQty: number;
  note?: string;
  userId: string;
  createdAt: Date;
}

// Expense
export interface Expense {
  id: string;
  shopId: string;
  category: ExpenseCategory;
  amount: number;
  description?: string;
  date: Date;
  /** Public R2 url of the attached receipt photo, when one was uploaded. */
  receiptUrl?: string;
  createdAt: Date;
}

// Daily Report
export interface DailyReport {
  id: string;
  shopId: string;
  date: Date;
  totalSales: number;
  totalExpenses: number;
  profit: number;
  transactions: number;
  topProducts: { name: string; quantity: number; revenue: number }[];
  lowStock: { name: string; quantity: number }[];
  aiInsight?: string;
  sentViaWhatsApp: boolean;
}

// AI Chat Message
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

// Cart Item (for POS)
export interface CartItem {
  productId: string;
  product: Product;
  quantity: number;
  isPack?: boolean;       // true if selling as pack
  customPrice?: number;   // Override price (for negotiated sales)
  itemNote?: string;      // Reason for custom price
}

// Low Stock Alert
export interface LowStockAlert {
  id: string;
  productId: string;
  productName: string;
  currentQty: number;
  reorderAt: number;
  severity: 'low' | 'critical' | 'out';
  acknowledgedAt?: Date;
  createdAt: Date;
}

// AI Insight
export interface AIInsight {
  id: string;
  type: 'sales_trend' | 'restock' | 'opportunity' | 'warning';
  title: string;
  description: string;
  productId?: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
}

// Dashboard Metrics
export interface DashboardMetrics {
  todaySales: number;
  todayTransactions: number;
  todayProfit: number;
  weekSales: number;
  monthSales: number;
  topProducts: { name: string; quantity: number; revenue: number }[];
  lowStockCount: number;
  criticalStockCount: number;
  recentSales: Sale[];
}

// Sync Queue Item
export interface SyncQueueItem {
  id: string;
  table: string;
  action: 'create' | 'update' | 'delete';
  data: unknown;
  createdAt: Date;
  attempts: number;
  lastAttempt?: Date;
  error?: string;
}

// Subscription/License
export interface Subscription {
  id: string;
  shopId: string;
  plan: 'free' | 'pro' | 'business';
  maxProducts: number;
  hasAI: boolean;
  hasWhatsApp: boolean;
  hasMultiUser: boolean;
  expiresAt?: Date;
  isActive: boolean;
}

// Eswatini specific
export const CURRENCY = 'SZL';
export const CURRENCY_SYMBOL = 'E';
export const LOCALE = 'en-SZ';
export const TIMEZONE = 'Africa/Mbabane';

// Payment methods with labels
export const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'cash', label: 'Cash', icon: '💵' },
  { value: 'momo', label: 'MoMo', icon: '📱' },
  { value: 'emali', label: 'E-Mali', icon: '💳' },
  { value: 'card', label: 'Card', icon: '💳' },
  { value: 'credit', label: 'Credit', icon: '📒' }
];

// Product categories
export const PRODUCT_CATEGORIES = [
  'Groceries',
  'Beverages',
  'Snacks',
  'Bread & Bakery',
  'Dairy',
  'Meat',
  'Vegetables',
  'Fruits',
  'Household',
  'Personal Care',
  'Airtime',
  'Other'
];

// Expense categories with labels
export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'rent', label: 'Rent' },
  { value: 'utilities', label: 'Utilities (Electricity, Water)' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'wages', label: 'Wages' },
  { value: 'transport', label: 'Transport' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'repairs', label: 'Repairs' },
  { value: 'other', label: 'Other' }
];

// Format helpers
// Currency formatter — reads from locale store persisted in localStorage
// This ensures correct currency even before React hydration completes
export function setCurrencyConfig(symbol: string, decimals: number) {
  updateCurrencyCache(symbol, decimals);
}

// Runtime currency cache — set from shop API response
let _currencySymbol = 'E';
let _currencyDecimals = 2;

// Initialize from saved shop data immediately
try {
  const auth = localStorage.getItem('yebomart-auth');
  if (auth) {
    const { state } = JSON.parse(auth);
    if (state?.shop?.currencySymbol) {
      _currencySymbol = state.shop.currencySymbol;
    }
  }
} catch {}

export function updateCurrencyCache(symbol: string, decimals: number) {
  _currencySymbol = symbol;
  _currencyDecimals = decimals;
}

export const formatCurrency = (amount: number): string => {
  const formatted = amount.toLocaleString(undefined, { minimumFractionDigits: _currencyDecimals, maximumFractionDigits: _currencyDecimals });
  return `${_currencySymbol}${formatted}`;
};

export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

export const formatTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatDateTime = (date: Date | string): string => {
  return `${formatDate(date)} ${formatTime(date)}`;
};

export const formatRelativeTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(d);
};
