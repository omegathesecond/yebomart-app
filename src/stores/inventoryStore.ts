import { create } from 'zustand';
import type { 
  Product, 
  Sale, 
  StockLog, 
  LowStockAlert, 
  AIInsight, 
  DashboardMetrics,
  User,
  Expense
} from '@/types';
import api from '@/api/client';
import { getSyncContext } from '@/lib/outboxContext';

let loadRevision = 0;
let snapshotContext: ReturnType<typeof getSyncContext> = null;

interface InventoryState {
  products: Product[];
  sales: Sale[];
  stockLogs: StockLog[];
  alerts: LowStockAlert[];
  insights: AIInsight[];
  insightsLoading: boolean;
  insightsError: string | null;
  staff: User[];
  expenses: Expense[];
  isLoading: boolean;
  lastSync: Date | null;
  isOnline: boolean;
  error: string | null;
  
  // Actions
  loadAll: (shopId: string) => Promise<boolean>;
  syncError: string | null;
  hasSnapshot: (shopId: string) => boolean;
  setOnlineStatus: (online: boolean) => void;
  clearError: () => void;
  clearAll: () => void;
  
  // Products
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateProduct: (id: string, updates: Partial<Omit<Product, 'quantity'>>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  searchProducts: (query: string) => Product[];
  getProductByBarcode: (barcode: string) => Product | undefined;
  
  // Stock
  adjustStock: (productId: string, quantity: number, type: StockLog['type'], note?: string, userId?: string) => Promise<void>;
  receiveStock: (productId: string, quantity: number, note?: string, costPrice?: number) => Promise<void>;
  
  // Alerts
  acknowledgeAlert: (alertId: string) => Promise<void>;
  dismissAllAlerts: () => Promise<void>;
  
  // Insights
  loadInsights: () => Promise<void>;
  markInsightRead: (insightId: string) => Promise<void>;
  
  // Staff
  addStaff: (staff: Omit<User, 'id' | 'createdAt'>) => Promise<string>;
  updateStaff: (id: string, updates: Partial<User>) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
  
  // Expenses
  loadExpenses: () => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'fundingSource'> & { fundingSource: 'OUTSIDE_TILL' | 'TILL_CASH'; submissionKey: string }) => Promise<string>;
  updateExpense: (id: string, updates: Partial<Omit<Expense, 'id' | 'createdAt' | 'shopId'>>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  
  // Dashboard
  getDashboardMetrics: (shopId: string) => Promise<DashboardMetrics>;
  
  // Sales
  createSale: (items: Parameters<typeof api.createSale>[0]['items'], paymentMethod: string, amountPaid: number) => Promise<Sale | null>;
  getSalesByDateRange: (shopId: string, startDate: Date, endDate: Date) => Promise<Sale[]>;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  products: [],
  sales: [],
  stockLogs: [],
  alerts: [],
  insights: [],
  insightsLoading: false,
  insightsError: null,
  staff: [],
  expenses: [],
  isLoading: false,
  lastSync: null,
  isOnline: navigator.onLine,
  error: null,
  syncError: null,

  hasSnapshot: (shopId) => !!get().lastSync && snapshotContext !== null &&
    snapshotContext === getSyncContext() && snapshotContext.shopId === shopId,

  // Load all data directly from API
  loadAll: async (_shopId: string) => {
    const context = getSyncContext();
    if (!context || (_shopId && context.shopId !== _shopId)) {
      get().clearAll();
      return false;
    }
    if (snapshotContext !== context) {
      get().clearAll();
      snapshotContext = context;
    }
    const revision = ++loadRevision;
    const current = () => revision === loadRevision && getSyncContext() === context;
    set({ isLoading: true });
    try {
      // Fetch products from API
      let allProducts: Product[] = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await api.getProducts({ page, limit: 100 });
        if (error || !Array.isArray(data)) {
          throw new Error(error || 'Failed to load products.');
        }
        
        if (!current()) return false;
        allProducts = [...allProducts, ...data];
        hasMore = data.length === 100;
        page++;
      }

      // Fetch sales
      const { data: salesData, error: salesError } = await api.getSales();
      if (!current()) return false;
      if (salesError || !Array.isArray(salesData)) throw new Error(salesError || 'Failed to load sales.');
      const sales = salesData.map((s) => ({
        ...s,
        createdAt: new Date(s.createdAt),
        paymentMethod: (s.paymentMethod?.toLowerCase() || 'cash') as Sale['paymentMethod'],
        items: s.items || [],
      }));

      // Fetch staff
      const { data: staffData, error: staffError } = await api.getStaff();
      if (!current()) return false;
      if (staffError || !Array.isArray(staffData)) throw new Error(staffError || 'Failed to load staff.');
      const staff: User[] = staffData.map(u => ({
        id: u.id,
        shopId: u.shopId || context.shopId,
        name: u.name,
        phone: u.phone,
        email: u.email || undefined,
        pin: u.pin || '',
        role: String(u.role).toLowerCase() as User['role'],
        isActive: u.isActive !== false,
        lastLogin: u.lastLoginAt ? new Date(u.lastLoginAt) : undefined,
        createdAt: new Date(u.createdAt),
      }));

      // Fetch expenses (API scopes to the caller's shop automatically)
      const { data: expensesData, error: expensesError } = await api.listExpenses({ limit: 100 });
      if (!current()) return false;
      if (expensesError || !Array.isArray(expensesData?.expenses)) throw new Error(expensesError || 'Failed to load expenses.');

      // Calculate low stock alerts from products
      const alerts: LowStockAlert[] = allProducts
        .filter(p => p.isActive && p.quantity <= p.reorderAt)
        .map(p => ({
          id: `alert-${p.id}`,
          productId: p.id,
          productName: p.name,
          currentQty: p.quantity,
          reorderAt: p.reorderAt,
          severity: p.quantity === 0 ? 'out' as const : 
                   p.quantity <= p.reorderAt * 0.5 ? 'critical' as const : 'low' as const,
          createdAt: new Date()
        }));

      set({
        products: allProducts.filter(p => p.isActive),
        sales: sales.slice(0, 50),
        staff,
        expenses: expensesData.expenses,
        alerts,
        isLoading: false,
        syncError: null,
        lastSync: new Date()
      });
      return true;
    } catch (error) {
      if (current()) set({ isLoading: false, syncError: error instanceof Error ? error.message : 'Failed to load shop data. Check your connection.' });
      return false;
    }
  },

  setOnlineStatus: (online: boolean) => set({ isOnline: online }),
  clearError: () => set({ error: null }),
  
  // Clear all data (call on logout)
  clearAll: () => {
    ++loadRevision;
    snapshotContext = null;
    set({
      syncError: null,
      products: [],
      sales: [],
      stockLogs: [],
      alerts: [],
      insights: [],
      insightsLoading: false,
      insightsError: null,
      staff: [],
      expenses: [],
      isLoading: false,
      lastSync: null,
      error: null
    });
  },

  // Products - Direct API calls
  addProduct: async (productData) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await api.createProduct(productData);
      if (error || !data) {
        set({ error: error || 'Failed to create product', isLoading: false });
        throw new Error(error || 'Failed to create product');
      }
      
      set((state) => ({ 
        products: [...state.products, data],
        isLoading: false 
      }));
      return data.id;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  updateProduct: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await api.updateProduct(id, updates);
      if (error || !data) {
        set({ error: error || 'Failed to update product', isLoading: false });
        throw new Error(error || 'Failed to update product');
      }
      
      set((state) => ({
        products: state.products.map((p) =>
          p.id === id ? { ...p, ...data } : p
        ),
        isLoading: false
      }));
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  deleteProduct: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await api.deleteProduct(id);
      if (error) {
        set({ error, isLoading: false });
        throw new Error(error);
      }
      
      set((state) => ({
        products: state.products.filter((p) => p.id !== id),
        isLoading: false
      }));
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  searchProducts: (query: string) => {
    if (!query.trim()) return get().products;
    const lowerQuery = query.toLowerCase();
    return get().products.filter(p => 
      p.name.toLowerCase().includes(lowerQuery) ||
      p.category?.toLowerCase().includes(lowerQuery) ||
      p.barcode?.includes(query)
    );
  },

  getProductByBarcode: (barcode: string) => {
    return get().products.find(p => p.barcode === barcode);
  },

  // Stock - Direct API calls
  adjustStock: async (productId, quantity, type, note) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await api.adjustStock(productId, {
        type,
        quantity,
        note
      });
      
      if (error || !data) {
        set({ error: error || 'Failed to adjust stock', isLoading: false });
        throw new Error(error || 'Failed to adjust stock');
      }
      
      // Update local state with new product data
      set((state) => ({
        products: state.products.map((p) =>
          p.id === productId ? { ...p, quantity: data.product?.quantity ?? p.quantity } : p
        ),
        isLoading: false
      }));
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  // Receive stock through the purpose-built /api/stock/receive endpoint (NOT
  // adjustStock, which is for shrinkage/counts only). When costPrice is given,
  // the API persists it so margins computed from cost stay correct.
  receiveStock: async (productId, quantity, note, costPrice) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await api.receiveStock(productId, { quantity, note, costPrice });

      if (error || !data) {
        set({ error: error || 'Failed to receive stock', isLoading: false });
        throw new Error(error || 'Failed to receive stock');
      }

      // The endpoint returns a single-item batch: [{ product, stockLog }].
      const updated = Array.isArray(data) ? data[0]?.product : (data as unknown as { product: Product })?.product;

      set((state) => ({
        products: state.products.map((p) =>
          p.id === productId
            ? {
                ...p,
                quantity: updated?.quantity ?? p.quantity,
                costPrice: updated?.costPrice ?? p.costPrice,
              }
            : p
        ),
        isLoading: false,
      }));
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  // Alerts - Local only (calculated from products)
  acknowledgeAlert: async (alertId) => {
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== alertId)
    }));
  },

  dismissAllAlerts: async () => {
    set({ alerts: [] });
  },

  // Insights - Fetched from the AI insights endpoint (GET /api/ai/insights)
  loadInsights: async () => {
    set({ insightsLoading: true, insightsError: null });
    const { data, error } = await api.getInsights();
    if (error || !data) {
      set({
        insightsLoading: false,
        insightsError: error || 'Failed to load insights',
      });
      return;
    }

    // The endpoint returns rich insight objects ({ title, insight, action,
    // priority }); map them onto the store's AIInsight shape so the dashboard
    // and markInsightRead keep working off a single type.
    const insights: AIInsight[] = (data.insights || []).map((item, index) => ({
      id: `insight-${index}`,
      type: item.priority === 'high' ? 'warning' : 'opportunity',
      title: item.title,
      description: item.insight,
      data: { action: item.action, priority: item.priority },
      isRead: false,
      createdAt: new Date(),
    }));

    set({ insights, insightsLoading: false, insightsError: null });
  },

  markInsightRead: async (insightId) => {
    set((state) => ({
      insights: state.insights.filter((i) => i.id !== insightId)
    }));
  },

  // Staff - Would need API endpoints
  addStaff: async (staffData) => {
    try {
      const response = await api.createStaff({
        name: staffData.name,
        phone: staffData.phone,
        pin: staffData.pin,
        role: staffData.role.toUpperCase()
      });
      
      if (response.error || !response.data) {
        set({ error: response.error || 'Failed to add staff' });
        const err = new Error(response.error || 'Failed to add staff');
        Object.assign(err, { details: response.details });
        throw err;
      }
      
      const data = response.data;
      
      const staff: User = {
        id: data.id,
        shopId: staffData.shopId,
        name: data.name,
        phone: data.phone,
        pin: data.pin || '',
        role: data.role?.toLowerCase() as User['role'] || 'cashier',
        isActive: data.isActive ?? true,
        createdAt: new Date(data.createdAt)
      };
      set((state) => ({ staff: [...state.staff, staff] }));
      return data.id;
    } catch (e: unknown) {
      console.error('Failed to add staff:', e);
      throw e;
    }
  },

  updateStaff: async (id, updates) => {
    try {
      const response = await api.updateStaff(id, {
        ...updates,
        role: updates.role?.toUpperCase()
      });
      
      if (response.error) {
        set({ error: response.error || 'Failed to update staff' });
        const err = new Error(response.error);
        Object.assign(err, { details: response.details });
        throw err;
      }
      
      set((state) => ({
        staff: state.staff.map((s) =>
          s.id === id ? { ...s, ...updates } : s
        )
      }));
    } catch (e: unknown) {
      console.error('Failed to update staff:', e);
      throw e;
    }
  },

  deleteStaff: async (id) => {
    try {
      const { error } = await api.deleteStaff(id);
      
      if (error) {
        set({ error: error || 'Failed to delete staff' });
        throw new Error(error);
      }
      
      set((state) => ({
        staff: state.staff.filter((s) => s.id !== id)
      }));
    } catch (e: unknown) {
      console.error('Failed to delete staff:', e);
      throw e;
    }
  },

  // Expenses - Direct API calls (GET /api/expenses, POST/DELETE managerAuth)
  loadExpenses: async () => {
    const { data, error } = await api.listExpenses({ limit: 100 });
    if (error || !data) {
      set({ error: error || 'Failed to load expenses' });
      return;
    }
    set({ expenses: data.expenses });
  },

  addExpense: async (expenseData) => {
    const { data, error, code } = await api.createExpense({
      fundingSource: expenseData.fundingSource,
      cashSessionId: expenseData.cashSessionId ?? undefined,
      submissionKey: expenseData.submissionKey,
      category: expenseData.category,
      amount: expenseData.amount,
      description: expenseData.description,
      date: new Date(expenseData.date).toISOString(),
      // The API's create schema rejects an empty-string uri, so only send a
      // receipt when one was actually uploaded.
      ...(expenseData.receiptUrl ? { receiptUrl: expenseData.receiptUrl } : {}),
    });
    if (error || !data) {
      set({ error: error || 'Failed to record expense' });
      throw Object.assign(new Error(error || 'Failed to record expense'), { code });
    }
    // Refresh from the API so totals/order stay authoritative
    await get().loadExpenses();
    return data.id;
  },

  updateExpense: async (id, updates) => {
    const { error } = await api.updateExpense(id, {
      category: updates.category,
      amount: updates.amount,
      description: updates.description,
      date: updates.date ? new Date(updates.date).toISOString() : undefined,
      // '' is meaningful here: it detaches an existing receipt. Only omit
      // the key when the caller didn't mention receiptUrl at all.
      ...(updates.receiptUrl === undefined ? {} : { receiptUrl: updates.receiptUrl }),
    });
    if (error) {
      set({ error });
      throw new Error(error);
    }
    await get().loadExpenses();
  },

  deleteExpense: async (id) => {
    const { error } = await api.deleteExpense(id);
    if (error) {
      set({ error: error || 'Failed to delete expense' });
      throw new Error(error || 'Failed to delete expense');
    }
    await get().loadExpenses();
  },

  // Dashboard metrics from API
  getDashboardMetrics: async () => {
    try {
      const { data } = await api.getDailyReport();
      // The daily-report API nests figures under `summary` and already
      // returns netProfit = grossProfit - totalExpenses.
      const summary = data?.summary;
      if (summary) {
        return {
          todaySales: summary.totalSales || 0,
          todayTransactions: summary.totalTransactions || 0,
          todayProfit: summary.netProfit || 0,
          weekSales: 0,
          monthSales: 0,
          topProducts: data.topProducts || [],
          lowStockCount: get().alerts.filter(a => a.severity === 'low').length,
          criticalStockCount: get().alerts.filter(a => a.severity === 'critical' || a.severity === 'out').length,
          recentSales: get().sales.slice(0, 10)
        };
      }
    } catch (e: unknown) {
      console.error('Failed to get dashboard metrics:', e);
    }

    // Fallback: calculate from local state
    const products = get().products;
    const sales = get().sales;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const todaySales = sales.filter(s => new Date(s.createdAt) >= todayStart);
    const todayTotal = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);

    let todayProfit = 0;
    for (const sale of todaySales) {
      for (const item of sale.items) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          todayProfit += (item.unitPrice - product.costPrice) * item.quantity;
        }
      }
    }

    // Net of today's expenses, mirroring the API's netProfit
    const todayExpenses = get().expenses
      .filter(e => new Date(e.date) >= todayStart)
      .reduce((sum, e) => sum + e.amount, 0);
    todayProfit -= todayExpenses;

    const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
    for (const sale of todaySales) {
      for (const item of sale.items) {
        if (!productSales[item.productId]) {
          productSales[item.productId] = { name: item.productName, quantity: 0, revenue: 0 };
        }
        productSales[item.productId].quantity += item.quantity;
        productSales[item.productId].revenue += item.totalPrice;
      }
    }
    
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      todaySales: todayTotal,
      todayTransactions: todaySales.length,
      todayProfit,
      weekSales: 0,
      monthSales: 0,
      topProducts,
      lowStockCount: get().alerts.filter(a => a.severity === 'low').length,
      criticalStockCount: get().alerts.filter(a => a.severity === 'critical' || a.severity === 'out').length,
      recentSales: todaySales.slice(0, 10)
    };
  },

  // Create sale via API
  createSale: async (items, paymentMethod, amountPaid) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await api.createSale({ items, paymentMethod, amountPaid });
      if (error || !data) {
        set({ error: error || 'Failed to create sale', isLoading: false });
        return null;
      }
      
      // Update local state
      set((state) => ({
        sales: [data, ...state.sales].slice(0, 50),
        // Update product quantities
        products: state.products.map(p => {
          const soldItem = items.find((i) => i.productId === p.id);
          if (soldItem) {
            return { ...p, quantity: Math.max(0, p.quantity - soldItem.quantity) };
          }
          return p;
        }),
        isLoading: false
      }));
      
      return data;
    } catch {
      set({ isLoading: false, error: 'Failed to process sale' });
      return null;
    }
  },

  getSalesByDateRange: async (_shopId: string, startDate: Date, endDate: Date) => {
    try {
      const { data } = await api.getSales({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });
      return (data || []).map((s) => ({
        ...s,
        createdAt: new Date(s.createdAt)
      }));
    } catch {
      return [];
    }
  }
}));
