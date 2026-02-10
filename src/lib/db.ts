import Dexie, { type Table } from 'dexie';
import type { 
  Shop, 
  User, 
  Product, 
  Sale, 
  SaleItem,
  StockLog,
  Expense,
  DailyReport,
  ChatMessage,
  LowStockAlert,
  AIInsight,
  SyncQueueItem,
  Subscription
} from '@/types';

export class YeboMartDB extends Dexie {
  shop!: Table<Shop>;
  users!: Table<User>;
  products!: Table<Product>;
  sales!: Table<Sale>;
  saleItems!: Table<SaleItem>;
  stockLogs!: Table<StockLog>;
  expenses!: Table<Expense>;
  dailyReports!: Table<DailyReport>;
  chatMessages!: Table<ChatMessage>;
  lowStockAlerts!: Table<LowStockAlert>;
  aiInsights!: Table<AIInsight>;
  syncQueue!: Table<SyncQueueItem>;
  subscription!: Table<Subscription>;

  constructor() {
    super('YeboMartDB');

    this.version(1).stores({
      shop: 'id',
      users: 'id, shopId, phone, role, isActive',
      products: 'id, shopId, barcode, name, category, isActive',
      sales: 'id, shopId, userId, createdAt, syncedAt',
      saleItems: 'id, saleId, productId',
      stockLogs: 'id, productId, type, createdAt',
      expenses: 'id, shopId, category, date',
      dailyReports: 'id, shopId, date, [shopId+date]',
      chatMessages: 'id, createdAt',
      lowStockAlerts: 'id, productId, severity, acknowledgedAt',
      aiInsights: 'id, type, isRead, createdAt',
      syncQueue: 'id, table, createdAt, attempts',
      subscription: 'id, shopId, plan'
    });
  }
}

export const db = new YeboMartDB();

// Add to sync queue for offline operations
export async function addToSyncQueue(table: string, action: 'create' | 'update' | 'delete', data: unknown) {
  await db.syncQueue.add({
    id: crypto.randomUUID(),
    table,
    action,
    data,
    createdAt: new Date(),
    attempts: 0
  });
}

// Get pending sync items
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  return db.syncQueue.where('attempts').below(5).toArray();
}

// Mark sync item as completed
export async function removeSyncItem(id: string) {
  await db.syncQueue.delete(id);
}

// Update sync item after failed attempt
export async function updateSyncAttempt(id: string, error: string) {
  const item = await db.syncQueue.get(id);
  if (item) {
    await db.syncQueue.update(id, {
      attempts: item.attempts + 1,
      lastAttempt: new Date(),
      error
    });
  }
}

// Check low stock and create alerts
export async function checkLowStock(shopId: string) {
  const products = await db.products
    .where('shopId')
    .equals(shopId)
    .and(p => p.isActive)
    .toArray();

  for (const product of products) {
    if (product.quantity <= 0 || product.quantity <= product.reorderAt) {
      const existingAlert = await db.lowStockAlerts
        .where('productId')
        .equals(product.id)
        .and(a => !a.acknowledgedAt)
        .first();

      if (!existingAlert) {
        const severity = product.quantity === 0 ? 'out' : 
                        product.quantity <= product.reorderAt * 0.5 ? 'critical' : 'low';
        
        await db.lowStockAlerts.add({
          id: crypto.randomUUID(),
          productId: product.id,
          productName: product.name,
          currentQty: product.quantity,
          reorderAt: product.reorderAt,
          severity,
          createdAt: new Date()
        });
      }
    }
  }
}

// Seed demo data for first launch
export async function seedDemoData() {
  const existingShop = await db.shop.count();
  if (existingShop > 0) return;

  const shopId = crypto.randomUUID();
  const userId = crypto.randomUUID();

  // Demo shop
  await db.shop.add({
    id: shopId,
    name: 'Siphiwe Tuck Shop',
    ownerName: 'Siphiwe Dlamini',
    ownerPhone: '+26876123456',
    businessType: 'spaza',
    assistantName: 'Thandi',
    currency: 'SZL',
    timezone: 'Africa/Mbabane',
    address: 'Main Street, Manzini',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // Demo user (owner)
  await db.users.add({
    id: userId,
    shopId,
    name: 'Siphiwe Dlamini',
    phone: '+26876123456',
    pin: '1234',
    role: 'owner',
    isActive: true,
    createdAt: new Date()
  });

  // Demo subscription
  await db.subscription.add({
    id: crypto.randomUUID(),
    shopId,
    plan: 'pro',
    maxProducts: 1000,
    hasAI: true,
    hasWhatsApp: true,
    hasMultiUser: true,
    isActive: true
  });

  // Demo products
  const products = [
    { name: 'Bread (White)', category: 'Bread & Bakery', costPrice: 12, sellPrice: 15, quantity: 25, reorderAt: 10, barcode: '6001234567890' },
    { name: 'Milk 1L', category: 'Dairy', costPrice: 18, sellPrice: 22, quantity: 15, reorderAt: 8, barcode: '6001234567891' },
    { name: 'Eggs (6 pack)', category: 'Dairy', costPrice: 28, sellPrice: 35, quantity: 12, reorderAt: 5 },
    { name: 'Coca-Cola 500ml', category: 'Beverages', costPrice: 8, sellPrice: 12, quantity: 48, reorderAt: 20 },
    { name: 'Fanta Orange 500ml', category: 'Beverages', costPrice: 8, sellPrice: 12, quantity: 36, reorderAt: 20 },
    { name: 'Simba Chips', category: 'Snacks', costPrice: 6, sellPrice: 10, quantity: 30, reorderAt: 15 },
    { name: 'Sugar 2.5kg', category: 'Groceries', costPrice: 45, sellPrice: 55, quantity: 8, reorderAt: 5 },
    { name: 'Cooking Oil 750ml', category: 'Groceries', costPrice: 32, sellPrice: 42, quantity: 10, reorderAt: 5 },
    { name: 'Rice 2kg', category: 'Groceries', costPrice: 35, sellPrice: 45, quantity: 12, reorderAt: 6 },
    { name: 'Tomatoes 1kg', category: 'Vegetables', costPrice: 15, sellPrice: 22, quantity: 5, reorderAt: 5 },
    { name: 'Onions 1kg', category: 'Vegetables', costPrice: 12, sellPrice: 18, quantity: 8, reorderAt: 5 },
    { name: 'MTN Airtime E10', category: 'Airtime', costPrice: 9, sellPrice: 10, quantity: 100, reorderAt: 20 },
    { name: 'MTN Airtime E25', category: 'Airtime', costPrice: 22.5, sellPrice: 25, quantity: 50, reorderAt: 10 }
  ];

  for (const p of products) {
    await db.products.add({
      id: crypto.randomUUID(),
      shopId,
      name: p.name,
      category: p.category,
      costPrice: p.costPrice,
      sellPrice: p.sellPrice,
      quantity: p.quantity,
      reorderAt: p.reorderAt,
      barcode: p.barcode,
      unit: 'each',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Demo sales
  const productList = await db.products.where('shopId').equals(shopId).toArray();
  const now = new Date();
  
  for (let i = 0; i < 10; i++) {
    const saleId = crypto.randomUUID();
    const randomProducts = productList.slice(0, Math.floor(Math.random() * 3) + 1);
    let total = 0;
    const items: SaleItem[] = [];

    for (const product of randomProducts) {
      const qty = Math.floor(Math.random() * 3) + 1;
      const itemTotal = qty * product.sellPrice;
      total += itemTotal;
      
      items.push({
        id: crypto.randomUUID(),
        saleId,
        productId: product.id,
        productName: product.name,
        quantity: qty,
        originalPrice: product.sellPrice,
        unitPrice: product.sellPrice,
        totalPrice: itemTotal
      });
    }

    const saleDate = new Date(now.getTime() - (i * 3600000)); // Each hour back

    await db.sales.add({
      id: saleId,
      shopId,
      userId,
      subtotal: total,
      discount: 0,
      totalAmount: total,
      paymentMethod: i % 3 === 0 ? 'momo' : 'cash',
      items,
      createdAt: saleDate
    });

    for (const item of items) {
      await db.saleItems.add(item);
    }
  }

  // Demo AI insights
  await db.aiInsights.bulkAdd([
    {
      id: crypto.randomUUID(),
      type: 'sales_trend',
      title: 'Sales are up 15%!',
      description: 'Your sales this week are 15% higher than last week. Great work! Beverages are driving most of the growth.',
      isRead: false,
      createdAt: new Date()
    },
    {
      id: crypto.randomUUID(),
      type: 'restock',
      title: 'Restock bread soon',
      description: 'Based on your sales pattern, you\'ll run out of bread in about 2 days. Consider restocking before the weekend rush.',
      productId: productList.find(p => p.name.includes('Bread'))?.id,
      isRead: false,
      createdAt: new Date()
    }
  ]);

  // Check and create low stock alerts
  await checkLowStock(shopId);

  console.log('YeboMart demo data seeded successfully');
}

// Initialize DB
export async function initializeDatabase() {
  try {
    await db.open();
    await seedDemoData();
    console.log('YeboMart database initialized');
    return true;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    return false;
  }
}

// Get shop data
export async function getShop(): Promise<Shop | undefined> {
  return db.shop.toCollection().first();
}

// Get current user
export async function getCurrentUser(userId?: string): Promise<User | undefined> {
  if (userId) {
    return db.users.get(userId);
  }
  return db.users.where('isActive').equals(1).first();
}
