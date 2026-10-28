// Shared API response models used by the client and the screens that render them.

export interface ReturnSaleItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  remainingCents: number;
}

export interface ReturnSale {
  id: string;
  receiptNumber: string;
  totalAmount: number;
  paymentMethod: string;
  customerId?: string;
  items: ReturnSaleItem[];
  createdAt: string;
  user?: { name: string };
}

export interface ReturnItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  restockable: boolean;
  restocked: boolean;
}

export interface Return {
  id: string;
  saleId?: string;
  customerId?: string;
  customer?: { id: string; name: string };
  creditReversal?: { id: string; amount: number; customerId: string; returnId: string };
  reason: string;
  type: 'REFUND' | 'EXCHANGE' | 'STORE_CREDIT';
  refundAmount: number;
  settlementMethod?: string;
  settlementReference?: string;
  cashSessionId?: string;
  status: 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED';
  notes?: string;
  items: ReturnItem[];
  exchangeItems?: Array<Pick<ReturnItem, 'id' | 'productId' | 'productName' | 'quantity' | 'unitPrice'>>;
  createdAt: string;
  processedAt?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  taxId?: string;
  currency?: string;
  paymentTerms?: string;
  leadTimeDays?: number;
  notes?: string;
  isActive: boolean;
  // Accounts payable — what this shop currently owes the supplier. Mirrors
  // Supplier.balance on the API (bumped by PO receipts, paid down by
  // recordPayment on a PO). Positive = we owe them.
  balance: number;
  products?: Array<{
    productId: string;
    product?: { id: string; name: string; barcode?: string };
  }>;
  _count?: {
    products: number;
    orders: number;
  };
  createdAt: string;
}

export interface POItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  receivedQty: number;
}

export interface PurchaseOrder {
  id: string;
  orderNumber?: string;
  supplierId: string;
  status: 'DRAFT' | 'SENT' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED';
  subtotal: number;
  tax: number;
  totalAmount: number;
  // Accounts payable — cumulative cost value received so far vs. paid to the
  // supplier so far. Mirrors PurchaseOrder.amountReceived/amountPaid on the
  // API. Balance due is derived client-side (see computeBalanceDue).
  amountReceived: number;
  amountPaid: number;
  orderDate: string;
  expectedDate?: string;
  receivedDate?: string;
  notes?: string;
  supplier?: { id: string; name: string; phone?: string; currency?: string };
  items?: POItem[];
  _count?: { items: number };
}

export interface StaffDetailData {
  user: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    lastLoginAt?: string;
  };
  stats: {
    period: { start: string; end: string };
    totalRevenue: number;
    transactionCount: number;
    averageTransaction: number;
    largestTransaction: number;
    voidCount: number;
    voidRate: number;
  };
  dailySales: Array<{
    date: string;
    transactions: number;
    revenue: number;
  }>;
  recentSales: Array<{
    id: string;
    totalAmount: number;
    status: string;
    paymentMethod: string;
    itemCount: number;
    createdAt: string;
  }>;
  insights: Array<{
    type: 'positive' | 'warning' | 'info';
    text: string;
  }>;
}

