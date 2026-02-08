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

interface InventoryState {
  products: Product[];
  sales: Sale[];
  stockLogs: StockLog[];
  alerts: LowStockAlert[];
  insights: AIInsight[];
  staff: User[];
  expenses: Expense[];
  isLoading: boolean;
  lastSync: Date | null;
  isOnline: boolean;
  error: string | null;
  
  // Actions
  loadAll: (shopId: string) => Promise<void>;
  setOnlineStatus: (online: boolean) => void;
  clearError: () => void;
  
  // Products
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  searchProducts: (query: string) => Product[];
  getProductByBarcode: (barcode: string) => Product | undefined;
  
  // Stock
  adjustStock: (productId: string, quantity: number, type: StockLog['type'], note?: string, userId?: string) => Promise<void>;
  receiveStock: (productId: string, quantity: number, note?: string, userId?: string) => Promise<void>;
  
  // Alerts
  acknowledgeAlert: (alertId: string) => Promise<void>;
  dismissAllAlerts: () => Promise<void>;
  
  // Insights
  markInsightRead: (insightId: string) => Promise<void>;
  
  // Staff
  addStaff: (staff: Omit<User, 'id' | 'createdAt'>) => Promise<string>;
  updateStaff: (id: string, updates: Partial<User>) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
  
  // Expenses
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => Promise<string>;
  deleteExpense: (id: string) => Promise<void>;
  
  // Dashboard
  getDashboardMetrics: (shopId: string) => Promise<DashboardMetrics>;
  
  // Sales
  createSale: (items: any[], paymentMethod: string, amountPaid: number) => Promise<Sale | null>;
  getSalesByDateRange: (shopId: string, startDate: Date, endDate: Date) => Promise<Sale[]>;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  products: [],
  sales: [],
  stockLogs: [],
  alerts: [],
  insights: [],
  staff: [],
  expenses: [],
  isLoading: false,
  lastSync: null,
  isOnline: navigator.onLine,
  error: null,

  // Load all data directly from API
  loadAll: async (_shopId: string) => {
    set({ isLoading: true, error: null });
    try {
      // Fetch products from API
      let allProducts: Product[] = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await api.getProducts({ page, limit: 100 });
        if (error || !data) {
          if (error) set({ error });
          break;
        }
        
        allProducts = [...allProducts, ...data];
        hasMore = data.length === 100;
        page++;
      }

      // Fetch sales
      const { data: salesData } = await api.getSales();
      const sales = (salesData || []).map((s: any) => ({
        ...s,
        createdAt: new Date(s.createdAt),
        paymentMethod: s.paymentMethod?.toLowerCase() || 'cash',
        items: s.items || [],
      }));

      // Fetch staff
      const { data: staffData, error: staffError } = await api.getStaff();
      console.log('[inventoryStore] Staff API response:', { staffData, staffError });
      const staffArray = Array.isArray(staffData) ? staffData : [];
      let staff: User[] = [];
      try {
        staff = staffArray.map((u: any) => {
          console.log('[inventoryStore] Mapping user:', u);
          return {
            id: u.id,
            shopId: u.shopId || _shopId,
            name: u.name || '',
            phone: u.phone || '',
            email: u.email || undefined,
            pin: u.pin || '',
            role: (String(u.role || 'CASHIER').toLowerCase()) as any,
            isActive: u.isActive !== false,
            lastLogin: u.lastLoginAt ? new Date(u.lastLoginAt) : undefined,
            createdAt: u.createdAt ? new Date(u.createdAt) : new Date()
          };
        });
      } catch (mapError) {
        console.error('[inventoryStore] Error mapping staff:', mapError);
      }
      console.log('[inventoryStore] Mapped staff:', staff);

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
        alerts,
        isLoading: false,
        lastSync: new Date()
      });
      
    } catch (error) {
      console.error('Failed to load inventory data:', error);
      set({ isLoading: false, error: 'Failed to load data. Check your connection.' });
    }
  },

  setOnlineStatus: (online: boolean) => set({ isOnline: online }),
  clearError: () => set({ error: null }),

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
  adjustStock: async (productId, quantity, type, note, _userId = 'system') => {
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

  receiveStock: async (productId, quantity, note, userId) => {
    await get().adjustStock(productId, quantity, 'restock', note, userId);
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

  // Insights - Local only for now
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
        (err as any).details = response.details;
        throw err;
      }
      
      const data = response.data;
      
      const staff: User = {
        id: data.id,
        shopId: staffData.shopId,
        name: data.name,
        phone: data.phone,
        pin: data.pin || '',
        role: data.role?.toLowerCase() as any || 'cashier',
        isActive: data.isActive ?? true,
        createdAt: new Date(data.createdAt)
      };
      set((state) => ({ staff: [...state.staff, staff] }));
      return data.id;
    } catch (e: any) {
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
        (err as any).details = response.details;
        throw err;
      }
      
      set((state) => ({
        staff: state.staff.map((s) =>
          s.id === id ? { ...s, ...updates } : s
        )
      }));
    } catch (e: any) {
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
    } catch (e: any) {
      console.error('Failed to delete staff:', e);
      throw e;
    }
  },

  // Expenses - Would need API endpoints
  addExpense: async (expenseData) => {
    // TODO: Add API endpoint for expenses
    const id = crypto.randomUUID();
    const expense: Expense = {
      ...expenseData,
      id,
      createdAt: new Date()
    };
    set((state) => ({ expenses: [...state.expenses, expense] }));
    return id;
  },

  deleteExpense: async (id) => {
    set((state) => ({
      expenses: state.expenses.filter((e) => e.id !== id)
    }));
  },

  // Dashboard metrics from API
  getDashboardMetrics: async (_shopId: string) => {
    try {
      const { data } = await api.getDailyReport();
      if (data) {
        return {
          todaySales: data.totalSales || 0,
          todayTransactions: data.transactionCount || 0,
          todayProfit: data.profit || 0,
          weekSales: 0,
          monthSales: 0,
          topProducts: data.topProducts || [],
          lowStockCount: get().alerts.filter(a => a.severity === 'low').length,
          criticalStockCount: get().alerts.filter(a => a.severity === 'critical' || a.severity === 'out').length,
          recentSales: get().sales.slice(0, 10)
        };
      }
    } catch (e) {
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
          const soldItem = items.find((i: any) => i.productId === p.id);
          if (soldItem) {
            return { ...p, quantity: Math.max(0, p.quantity - soldItem.quantity) };
          }
          return p;
        }),
        isLoading: false
      }));
      
      return data;
    } catch (err) {
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
      return (data || []).map((s: any) => ({
        ...s,
        createdAt: new Date(s.createdAt)
      }));
    } catch {
      return [];
    }
  }
}));
