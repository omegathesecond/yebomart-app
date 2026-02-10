// Core types for YeboMart - Eswatini Shop Management

export type UserRole = 'owner' | 'manager' | 'cashier';
export type PaymentMethod = 'cash' | 'momo' | 'emali' | 'card';
export type StockLogType = 'restock' | 'sale' | 'adjustment' | 'damaged';
export type ExpenseCategory = 'rent' | 'utilities' | 'supplies' | 'wages' | 'other';

// Shop
export interface Shop {
  id: string;
  name: string;
  ownerName: string;
  ownerPhone: string; // WhatsApp number
  businessType: string; // e.g., 'spaza', 'tyre', 'beauty', 'hardware'
  assistantName: string; // AI assistant name (e.g., "Thandi")
  currency: string;
  timezone: string;
  address?: string;
  logoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
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
}

// Product
export interface Product {
  id: string;
  shopId: string;
  barcode?: string;
  name: string;
  category?: string;
  costPrice: number;
  sellPrice: number;
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
  totalAmount: number;
  paymentMethod: PaymentMethod;
  items: SaleItem[];
  createdAt: Date;
  syncedAt?: Date;
}

// Sale Item
export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
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
  isPack?: boolean;  // true if selling as pack
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
  { value: 'card', label: 'Card', icon: '💳' }
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
  { value: 'other', label: 'Other' }
];

// Format helpers
export const formatSZL = (amount: number): string => {
  return `E${amount.toFixed(2)}`;
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
