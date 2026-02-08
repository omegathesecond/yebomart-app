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
import { db, addToSyncQueue, checkLowStock } from '@/lib/db';
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
  
  // Actions
  loadAll: (shopId: string) => Promise<void>;
  syncFromServer: (shopId: string) => Promise<void>;
  setOnlineStatus: (online: boolean) => void;
  
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

  loadAll: async (shopId: string) => {
    set({ isLoading: true });
    try {
      const [products, sales, stockLogs, alerts, insights, staff, expenses] = await Promise.all([
        db.products.where('shopId').equals(shopId).and(p => p.isActive).toArray(),
        db.sales.where('shopId').equals(shopId).reverse().sortBy('createdAt'),
        db.stockLogs.orderBy('createdAt').reverse().limit(100).toArray(),
        db.lowStockAlerts.filter(a => !a.acknowledgedAt).toArray(),
        db.aiInsights.filter(i => !i.isRead).toArray(),
        db.users.where('shopId').equals(shopId).toArray(),
        db.expenses.where('shopId').equals(shopId).toArray()
      ]);

      set({
        products,
        sales: sales.slice(0, 50),
        stockLogs,
        alerts,
        insights,
        staff,
        expenses,
        isLoading: false
      });
      
      // Auto-sync from server if local products are empty and we're online
      if (products.length === 0 && navigator.onLine) {
        console.log('No local products, syncing from server...');
        get().syncFromServer(shopId);
      }
    } catch (error) {
      console.error('Failed to load inventory data:', error);
      set({ isLoading: false });
    }
  },

  setOnlineStatus: (online: boolean) => set({ isOnline: online }),

  // Sync products from server to local IndexedDB
  syncFromServer: async (shopId: string) => {
    try {
      set({ isLoading: true });
      
      // Fetch all products from server (paginated)
      let allProducts: Product[] = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await api.getProducts({ page, limit: 100 });
        if (error || !data) break;
        
        allProducts = [...allProducts, ...data];
        hasMore = data.length === 100;
        page++;
      }
      
      if (allProducts.length > 0) {
        // Clear existing products for this shop
        await db.products.where('shopId').equals(shopId).delete();
        
        // Add all products from server
        const productsWithDates = allProducts.map(p => ({
          ...p,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        }));
        await db.products.bulkAdd(productsWithDates);
        
        // Update state
        set({ 
          products: productsWithDates.filter(p => p.isActive),
          lastSync: new Date(),
          isLoading: false 
        });
        
        console.log(`Synced ${allProducts.length} products from server`);
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Sync from server failed:', error);
      set({ isLoading: false });
    }
  },

  addProduct: async (productData) => {
    const id = crypto.randomUUID();
    const product: Product = {
      ...productData,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.products.add(product);
    await addToSyncQueue('products', 'create', product);
    
    set((state) => ({ products: [...state.products, product] }));
    return id;
  },

  updateProduct: async (id, updates) => {
    const updatedData = { ...updates, updatedAt: new Date() };
    await db.products.update(id, updatedData);
    await addToSyncQueue('products', 'update', { id, ...updatedData });
    
    set((state) => ({
      products: state.products.map((p) =>
        p.id === id ? { ...p, ...updatedData } : p
      )
    }));
  },

  deleteProduct: async (id) => {
    await db.products.update(id, { isActive: false });
    await addToSyncQueue('products', 'delete', { id });
    
    set((state) => ({
      products: state.products.filter((p) => p.id !== id)
    }));
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

  adjustStock: async (productId, quantity, type, note, userId = 'system') => {
    const product = await db.products.get(productId);
    if (!product) throw new Error('Product not found');
    
    const previousQty = product.quantity;
    let newQty: number;
    
    if (type === 'restock') {
      newQty = previousQty + Math.abs(quantity);
    } else if (type === 'adjustment') {
      newQty = quantity; // Absolute value
    } else {
      newQty = previousQty - Math.abs(quantity);
    }
    
    newQty = Math.max(0, newQty);
    
    await db.products.update(productId, {
      quantity: newQty,
      updatedAt: new Date()
    });

    const stockLog: StockLog = {
      id: crypto.randomUUID(),
      productId,
      type,
      quantity: type === 'restock' ? Math.abs(quantity) : -Math.abs(quantity),
      previousQty,
      newQty,
      note,
      userId,
      createdAt: new Date()
    };
    
    await db.stockLogs.add(stockLog);
    await addToSyncQueue('stockLogs', 'create', stockLog);
    
    // Check for low stock
    const shop = await db.shop.toCollection().first();
    if (shop) {
      await checkLowStock(shop.id);
    }
    
    // Refresh data
    if (shop) {
      await get().loadAll(shop.id);
    }
  },

  receiveStock: async (productId, quantity, note, userId) => {
    await get().adjustStock(productId, quantity, 'restock', note, userId);
  },

  acknowledgeAlert: async (alertId) => {
    await db.lowStockAlerts.update(alertId, { acknowledgedAt: new Date() });
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== alertId)
    }));
  },

  dismissAllAlerts: async () => {
    const alerts = get().alerts;
    for (const alert of alerts) {
      await db.lowStockAlerts.update(alert.id, { acknowledgedAt: new Date() });
    }
    set({ alerts: [] });
  },

  markInsightRead: async (insightId) => {
    await db.aiInsights.update(insightId, { isRead: true });
    set((state) => ({
      insights: state.insights.filter((i) => i.id !== insightId)
    }));
  },

  addStaff: async (staffData) => {
    const id = crypto.randomUUID();
    const staff: User = {
      ...staffData,
      id,
      createdAt: new Date()
    };
    
    await db.users.add(staff);
    await addToSyncQueue('users', 'create', staff);
    
    set((state) => ({ staff: [...state.staff, staff] }));
    return id;
  },

  updateStaff: async (id, updates) => {
    await db.users.update(id, updates);
    await addToSyncQueue('users', 'update', { id, ...updates });
    
    set((state) => ({
      staff: state.staff.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      )
    }));
  },

  deleteStaff: async (id) => {
    await db.users.update(id, { isActive: false });
    await addToSyncQueue('users', 'delete', { id });
    
    set((state) => ({
      staff: state.staff.filter((s) => s.id !== id)
    }));
  },

  addExpense: async (expenseData) => {
    const id = crypto.randomUUID();
    const expense: Expense = {
      ...expenseData,
      id,
      createdAt: new Date()
    };
    
    await db.expenses.add(expense);
    await addToSyncQueue('expenses', 'create', expense);
    
    set((state) => ({ expenses: [...state.expenses, expense] }));
    return id;
  },

  deleteExpense: async (id) => {
    await db.expenses.delete(id);
    await addToSyncQueue('expenses', 'delete', { id });
    
    set((state) => ({
      expenses: state.expenses.filter((e) => e.id !== id)
    }));
  },

  getDashboardMetrics: async (shopId: string) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const allSales = await db.sales.where('shopId').equals(shopId).toArray();
    
    const todaySales = allSales.filter(s => new Date(s.createdAt) >= todayStart);
    const weekSales = allSales.filter(s => new Date(s.createdAt) >= weekStart);
    const monthSales = allSales.filter(s => new Date(s.createdAt) >= monthStart);

    // Calculate totals
    const todayTotal = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
    const weekTotal = weekSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const monthTotal = monthSales.reduce((sum, s) => sum + s.totalAmount, 0);

    // Calculate profit (simplified - actual would need cost price)
    const products = await db.products.where('shopId').equals(shopId).toArray();
    let todayProfit = 0;
    
    for (const sale of todaySales) {
      for (const item of sale.items) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          todayProfit += (item.unitPrice - product.costPrice) * item.quantity;
        }
      }
    }

    // Top products
    const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
    for (const sale of todaySales) {
      for (const item of sale.items) {
        if (!productSales[item.productId]) {
          productSales[item.productId] = {
            name: item.productName,
            quantity: 0,
            revenue: 0
          };
        }
        productSales[item.productId].quantity += item.quantity;
        productSales[item.productId].revenue += item.totalPrice;
      }
    }
    
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Low stock count
    const alerts = await db.lowStockAlerts.filter(a => !a.acknowledgedAt).toArray();

    return {
      todaySales: todayTotal,
      todayTransactions: todaySales.length,
      todayProfit,
      weekSales: weekTotal,
      monthSales: monthTotal,
      topProducts,
      lowStockCount: alerts.filter(a => a.severity === 'low').length,
      criticalStockCount: alerts.filter(a => a.severity === 'critical' || a.severity === 'out').length,
      recentSales: todaySales.slice(0, 10)
    };
  },

  getSalesByDateRange: async (shopId: string, startDate: Date, endDate: Date) => {
    return db.sales
      .where('shopId')
      .equals(shopId)
      .and(s => {
        const date = new Date(s.createdAt);
        return date >= startDate && date <= endDate;
      })
      .toArray();
  }
}));
