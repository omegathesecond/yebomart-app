import { create } from 'zustand';
import type { CartItem, Product, PaymentMethod, Sale, SaleItem } from '@/types';
import api from '@/api/client';

interface CartState {
  items: CartItem[];
  paymentMethod: PaymentMethod;
  isProcessing: boolean;
  error: string | null;
  
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
  isProcessing: false,
  error: null,

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
    set({ items: [], paymentMethod: 'cash', error: null });
  },

  // Checkout via API
  checkout: async (_userId: string, _shopId: string) => {
    const { items, paymentMethod } = get();
    const subtotal = items.reduce((sum, item) => sum + (item.product.sellPrice * item.quantity), 0);
    
    if (items.length === 0) return null;
    
    set({ isProcessing: true, error: null });
    
    try {
      // Format items for API
      const saleItems = items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.product.sellPrice
      }));

      // Create sale via API (API expects uppercase payment method)
      const { data, error } = await api.createSale({
        items: saleItems,
        paymentMethod: paymentMethod.toUpperCase(),
        amountPaid: subtotal
      });

      if (error || !data) {
        set({ isProcessing: false, error: error || 'Failed to process sale' });
        return null;
      }

      // Clear cart on success
      set({ items: [], paymentMethod: 'cash', isProcessing: false });

      // Return the sale with formatted items for UI
      return {
        ...data,
        items: items.map(item => ({
          id: crypto.randomUUID(),
          saleId: data.id,
          productId: item.productId,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.sellPrice,
          totalPrice: item.product.sellPrice * item.quantity
        })),
        totalAmount: subtotal,
        createdAt: new Date()
      } as Sale;
      
    } catch (error) {
      console.error('Checkout failed:', error);
      set({ isProcessing: false, error: 'Failed to process sale. Please try again.' });
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
