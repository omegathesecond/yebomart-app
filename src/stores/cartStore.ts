import { create } from 'zustand';
import type { CartItem, Product, PaymentMethod, Sale, SaleItem } from '@/types';
import { db, addToSyncQueue, checkLowStock } from '@/lib/db';

interface CartState {
  items: CartItem[];
  paymentMethod: PaymentMethod;
  
  // Computed
  totalItems: number;
  subtotal: number;
  
  // Actions
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  clear: () => void;
  checkout: (userId: string, shopId: string) => Promise<Sale | null>;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  paymentMethod: 'cash',

  get totalItems() {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },

  get subtotal() {
    return get().items.reduce((sum, item) => sum + (item.product.sellPrice * item.quantity), 0);
  },

  addItem: (product: Product, quantity: number = 1) => {
    set((state) => {
      const existingIndex = state.items.findIndex(i => i.productId === product.id);
      
      if (existingIndex >= 0) {
        // Update existing item
        const newItems = [...state.items];
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          quantity: newItems[existingIndex].quantity + quantity
        };
        return { items: newItems };
      } else {
        // Add new item
        return {
          items: [...state.items, { productId: product.id, product, quantity }]
        };
      }
    });
  },

  removeItem: (productId: string) => {
    set((state) => ({
      items: state.items.filter(i => i.productId !== productId)
    }));
  },

  updateQuantity: (productId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    
    set((state) => ({
      items: state.items.map(i => 
        i.productId === productId ? { ...i, quantity } : i
      )
    }));
  },

  setPaymentMethod: (method: PaymentMethod) => {
    set({ paymentMethod: method });
  },

  clear: () => {
    set({ items: [], paymentMethod: 'cash' });
  },

  checkout: async (userId: string, shopId: string) => {
    const { items, paymentMethod, subtotal } = get();
    
    if (items.length === 0) return null;
    
    try {
      const saleId = crypto.randomUUID();
      const now = new Date();
      
      // Create sale items
      const saleItems: SaleItem[] = items.map(item => ({
        id: crypto.randomUUID(),
        saleId,
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.product.sellPrice,
        totalPrice: item.product.sellPrice * item.quantity
      }));

      // Create sale
      const sale: Sale = {
        id: saleId,
        shopId,
        userId,
        totalAmount: subtotal,
        paymentMethod,
        items: saleItems,
        createdAt: now
      };

      // Save to database
      await db.sales.add(sale);
      for (const item of saleItems) {
        await db.saleItems.add(item);
      }

      // Update product quantities and create stock logs
      for (const item of items) {
        const product = await db.products.get(item.productId);
        if (product) {
          const newQty = Math.max(0, product.quantity - item.quantity);
          
          await db.products.update(item.productId, {
            quantity: newQty,
            updatedAt: now
          });

          await db.stockLogs.add({
            id: crypto.randomUUID(),
            productId: item.productId,
            type: 'sale',
            quantity: -item.quantity,
            previousQty: product.quantity,
            newQty,
            userId,
            createdAt: now
          });
        }
      }

      // Check for low stock alerts
      await checkLowStock(shopId);

      // Add to sync queue for when online
      await addToSyncQueue('sales', 'create', sale);

      // Clear cart
      set({ items: [], paymentMethod: 'cash' });

      return sale;
    } catch (error) {
      console.error('Checkout failed:', error);
      return null;
    }
  }
}));

// Selector helpers
export const useCartTotal = () => useCartStore((state) => 
  state.items.reduce((sum, item) => sum + (item.product.sellPrice * item.quantity), 0)
);

export const useCartItemCount = () => useCartStore((state) => 
  state.items.reduce((sum, item) => sum + item.quantity, 0)
);
