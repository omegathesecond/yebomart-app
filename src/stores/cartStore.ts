import { create } from 'zustand';
import type { CartItem, Product, PaymentMethod, Sale, SaleItem } from '@/types';
import type { Customer } from '@/api/client';
import api, { NETWORK_ERROR } from '@/api/client';
import { addToSyncQueue } from '@/lib/db';
import { computeCartTotal } from '@/lib/money';
import { useSyncStore } from '@/stores/syncStore';

interface DiscountInfo {
  amount: number;
  percent?: number;
  reason?: string;
  approvedBy?: string; // Manager ID if override needed
}

interface CartState {
  items: CartItem[];
  paymentMethod: PaymentMethod;
  discount: DiscountInfo | null;
  customer: Customer | null;
  isProcessing: boolean;
  error: string | null;
  
  // Computed
  totalItems: number;
  subtotal: number;
  
  // Actions
  addItem: (product: Product, isPack?: boolean, quantity?: number) => void;
  removeItem: (productId: string, isPack?: boolean) => void;
  updateQuantity: (productId: string, quantity: number, isPack?: boolean) => void;
  setItemCustomPrice: (productId: string, price: number, note?: string, isPack?: boolean) => void;
  clearItemCustomPrice: (productId: string, isPack?: boolean) => void;
  setDiscount: (discount: DiscountInfo) => void;
  setDiscountPercent: (percent: number, reason?: string, approvedBy?: string) => void;
  setDiscountAmount: (amount: number, reason?: string, approvedBy?: string) => void;
  clearDiscount: () => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setCustomer: (customer: Customer | null) => void;
  clear: () => void;
  checkout: (userId: string, shopId: string) => Promise<Sale | null>;
}

// Helper to get item price (respects custom price, pack price, or regular price)
const getItemPrice = (item: CartItem): number => {
  if (item.customPrice !== undefined) {
    return item.customPrice;
  }
  if (item.isPack && item.product.packPrice) {
    return item.product.packPrice;
  }
  return item.product.sellPrice;
};

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  paymentMethod: 'cash',
  discount: null,
  customer: null,
  isProcessing: false,
  error: null,

  get totalItems() {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },

  get subtotal() {
    return get().items.reduce((sum, item) => sum + (getItemPrice(item) * item.quantity), 0);
  },

  addItem: (product: Product, isPack: boolean = false, quantity: number = 1) => {
    set((state) => {
      // Find existing item (match by productId AND isPack)
      const existingIndex = state.items.findIndex(
        i => i.productId === product.id && (i.isPack || false) === isPack
      );
      
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
          items: [...state.items, { productId: product.id, product, quantity, isPack }]
        };
      }
    });
  },

  removeItem: (productId: string, isPack: boolean = false) => {
    set((state) => ({
      items: state.items.filter(i => !(i.productId === productId && (i.isPack || false) === isPack))
    }));
  },

  updateQuantity: (productId: string, quantity: number, isPack: boolean = false) => {
    if (quantity <= 0) {
      get().removeItem(productId, isPack);
      return;
    }
    
    set((state) => ({
      items: state.items.map(i => 
        (i.productId === productId && (i.isPack || false) === isPack) ? { ...i, quantity } : i
      )
    }));
  },

  // Set custom price for an item (for negotiated sales)
  setItemCustomPrice: (productId: string, price: number, note?: string, isPack: boolean = false) => {
    set((state) => ({
      items: state.items.map(i => 
        (i.productId === productId && (i.isPack || false) === isPack) 
          ? { ...i, customPrice: price, itemNote: note } 
          : i
      )
    }));
  },

  // Clear custom price for an item
  clearItemCustomPrice: (productId: string, isPack: boolean = false) => {
    set((state) => ({
      items: state.items.map(i => 
        (i.productId === productId && (i.isPack || false) === isPack) 
          ? { ...i, customPrice: undefined, itemNote: undefined } 
          : i
      )
    }));
  },

  // Set discount (raw)
  setDiscount: (discount: DiscountInfo) => {
    set({ discount });
  },

  // Set discount by percentage
  setDiscountPercent: (percent: number, reason?: string, approvedBy?: string) => {
    const subtotal = get().items.reduce((sum, item) => sum + (getItemPrice(item) * item.quantity), 0);
    const amount = Math.round((subtotal * percent / 100) * 100) / 100; // Round to 2 decimals
    set({ 
      discount: { 
        amount, 
        percent, 
        reason,
        approvedBy 
      } 
    });
  },

  // Set discount by fixed amount
  setDiscountAmount: (amount: number, reason?: string, approvedBy?: string) => {
    const subtotal = get().items.reduce((sum, item) => sum + (getItemPrice(item) * item.quantity), 0);
    const percent = subtotal > 0 ? Math.round((amount / subtotal * 100) * 10) / 10 : 0;
    set({ 
      discount: { 
        amount, 
        percent, 
        reason,
        approvedBy 
      } 
    });
  },

  clearDiscount: () => {
    set({ discount: null });
  },

  setPaymentMethod: (method: PaymentMethod) => {
    set({ paymentMethod: method });
  },

  setCustomer: (customer: Customer | null) => {
    set({ customer });
  },

  clear: () => {
    set({ items: [], paymentMethod: 'cash', discount: null, customer: null, error: null });
  },

  // Checkout via API — with an offline outbox fallback.
  //
  // Online: POST the sale, clear the cart, return the server sale.
  // Offline (or transport failure mid-request): enqueue the SAME payload in the
  // Dexie syncQueue and optimistically complete the sale locally. The drain in
  // syncStore replays it on reconnect; the server dedups on `localId` so an
  // online attempt whose response was lost is never double-applied.
  checkout: async (_userId: string, _shopId: string) => {
    const { items, paymentMethod, discount, customer } = get();

    // Calculate subtotal with custom/pack pricing
    const subtotal = items.reduce((sum, item) => {
      return sum + (getItemPrice(item) * item.quantity);
    }, 0);

    const discountAmount = discount?.amount || 0;
    const totalAmount = computeCartTotal(subtotal, discountAmount);

    if (items.length === 0) return null;

    set({ isProcessing: true, error: null });

    // Stable idempotency key for this checkout. Sent on the live attempt AND any
    // queued replay so the server commits the sale exactly once.
    const localId = crypto.randomUUID();

    // Format items for API
    const saleItems = items.map(item => {
      const price = getItemPrice(item);
      const originalPrice = item.isPack && item.product.packPrice
        ? item.product.packPrice
        : item.product.sellPrice;

      if (item.isPack && item.product.packSize && item.product.packPrice) {
        return {
          productId: item.productId,
          quantity: item.quantity * item.product.packSize, // Actual units sold
          unitPrice: price / item.product.packSize, // Per-unit price
          originalPrice: originalPrice / item.product.packSize,
          isPack: true,
          packQty: item.quantity,
          itemNote: item.itemNote
        };
      }
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: price,
        originalPrice,
        itemNote: item.itemNote
      };
    });

    const payload = {
      items: saleItems,
      paymentMethod: paymentMethod.toUpperCase(),
      amountPaid: totalAmount,
      subtotal,
      discount: discountAmount,
      discountPercent: discount?.percent,
      discountReason: discount?.reason,
      discountApprovedBy: discount?.approvedBy,
      customerId: customer?.id,
      localId,
    };

    // Build receipt items BEFORE clearing cart. `saleId` is filled per-branch:
    // the server id when online, the localId when queued offline.
    const buildReceiptItems = (saleId: string): SaleItem[] =>
      items.map(item => {
        const price = getItemPrice(item);
        const originalPrice = item.isPack && item.product.packPrice
          ? item.product.packPrice
          : item.product.sellPrice;

        const productName = item.isPack && item.product.packSize && item.product.packPrice
          ? `${item.product.name} (${item.product.packSize}-Pack)`
          : item.product.name;

        return {
          id: crypto.randomUUID(),
          saleId,
          productId: item.productId,
          productName,
          quantity: item.quantity,
          originalPrice,
          unitPrice: price,
          totalPrice: price * item.quantity,
          itemDiscount: item.customPrice !== undefined ? (originalPrice - price) * item.quantity : undefined,
        };
      });

    // Optimistically complete the sale locally without hitting the network.
    // Used for the offline path: the cashier gets a receipt now; the sale is
    // POSTed on reconnect.
    const completeOffline = async (): Promise<Sale> => {
      await addToSyncQueue('sales', 'create', {
        ...payload,
        offlineAt: new Date().toISOString(),
      });
      void useSyncStore.getState().refreshPending();

      const receiptItems = buildReceiptItems(localId);
      set({ items: [], paymentMethod: 'cash', discount: null, customer: null, isProcessing: false });

      return {
        id: localId,
        localId,
        pendingSync: true,
        items: receiptItems,
        subtotal,
        discount: discountAmount,
        discountPercent: discount?.percent,
        discountReason: discount?.reason,
        totalAmount,
        paymentMethod,
        createdAt: new Date(),
      } as Sale;
    };

    // Already offline — don't bother attempting the request.
    if (!navigator.onLine) {
      return completeOffline();
    }

    try {
      // Create sale via API
      const { data, error } = await api.createSale(payload);

      if (!data) {
        // Transport failure → queue + complete offline (retryable).
        if (error === NETWORK_ERROR) {
          return completeOffline();
        }
        // Genuine server rejection (insufficient stock, etc.) → surface it.
        set({ isProcessing: false, error: error || 'Failed to process sale' });
        return null;
      }

      const receiptItems = buildReceiptItems(data.id);

      // Clear cart on success
      set({ items: [], paymentMethod: 'cash', discount: null, customer: null, isProcessing: false });

      // Return the sale with formatted items for UI
      return {
        ...data,
        items: receiptItems,
        subtotal,
        discount: discountAmount,
        discountPercent: discount?.percent,
        discountReason: discount?.reason,
        totalAmount,
        createdAt: new Date(),
      } as Sale;

    } catch (error) {
      // fetch() failures are already caught inside the api client and returned
      // as NETWORK_ERROR, so reaching here means an unexpected client error.
      // If we lost the connection, still complete offline rather than dropping
      // the sale; otherwise surface it.
      console.error('Checkout failed:', error);
      if (!navigator.onLine) {
        return completeOffline();
      }
      set({ isProcessing: false, error: 'Failed to process sale. Please try again.' });
      return null;
    }
  }
}));

// Selector helpers
export const useCartSubtotal = () => useCartStore((state) => 
  state.items.reduce((sum, item) => sum + (getItemPrice(item) * item.quantity), 0)
);

export const useCartTotal = () => useCartStore((state) => {
  const subtotal = state.items.reduce((sum, item) => sum + (getItemPrice(item) * item.quantity), 0);
  const discount = state.discount?.amount || 0;
  return computeCartTotal(subtotal, discount);
});

export const useCartDiscount = () => useCartStore((state) => state.discount);

export const useCartItemCount = () => useCartStore((state) => 
  state.items.reduce((sum, item) => sum + item.quantity, 0)
);
