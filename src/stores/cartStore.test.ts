import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { Product } from '@/types';
import type { Customer } from '@/api/client';

// Mirrors api/src/.../client.ts NETWORK_ERROR — the sentinel the outbox keys off
// to tell a retryable transport failure apart from a real server rejection.
const NETWORK_ERROR = 'Network error. Please try again.';

// Mock the network + persistence boundaries so the cart math/branching is tested
// in isolation (no fetch, no IndexedDB, no real sync store).
vi.mock('@/api/client', () => ({
  // Literal inlined here (not the const above) — vi.mock factories are hoisted
  // above top-level declarations, so they cannot close over outer variables.
  default: { createSale: vi.fn(), setSessionExpiredCallback: vi.fn() },
  NETWORK_ERROR: 'Network error. Please try again.',
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
}));
vi.mock('@/lib/db', () => ({
  addToSyncQueue: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/stores/syncStore', () => ({
  useSyncStore: { getState: () => ({ refreshPending: vi.fn() }) },
}));
// cartStore reads the active shop's tax config off useAuthStore.getState().shop.
// No shop (null) → shopTaxConfig defaults to taxRate 0, matching the "no VAT"
// assertions below untouched.
vi.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => ({ shop: null }) },
}));

import api from '@/api/client';
import { addToSyncQueue } from '@/lib/db';
import { useCartStore } from '@/stores/cartStore';

const createSale = api.createSale as unknown as Mock;

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    shopId: 'shop-1',
    name: 'Bread',
    sellPrice: 15,
    costPrice: 10,
    quantity: 100,
    reorderAt: 5,
    unit: 'each',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: overrides.id ?? 'cust-1',
    shopId: 'shop-1',
    name: 'Sipho Dlamini',
    phone: '+26878000000',
    email: null,
    address: null,
    creditLimit: 0,
    balance: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Force the cart's online/offline branch deterministically. */
function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}

beforeEach(() => {
  vi.clearAllMocks();
  setOnline(true);
  useCartStore.getState().clear();
});

// Subtotal/pricing is asserted through the checkout PAYLOAD (the path that
// actually moves money: getItemPrice → saleItems → subtotal). The store's
// `get subtotal()` accessor is intentionally not used here — zustand v5 freezes
// object-literal getters into stale values after setState, so production reads
// subtotal via the live `useCartSubtotal` selector, not the store getter.
async function checkoutPayload() {
  createSale.mockResolvedValue({ data: { id: 'srv' } });
  const sale = await useCartStore.getState().checkout('user-1', 'shop-1');
  return { payload: createSale.mock.calls[0][0], sale };
}

describe('cartStore — totals / pricing', () => {
  it('subtotal sums price × quantity across lines', async () => {
    const store = useCartStore.getState();
    store.addItem(makeProduct({ id: 'a', sellPrice: 15 }), false, 2);
    store.addItem(makeProduct({ id: 'b', sellPrice: 12 }), false, 1);

    const { payload } = await checkoutPayload();
    expect(payload.subtotal).toBe(42); // 2×15 + 1×12
  });

  it('respects a per-item custom (negotiated) price', async () => {
    const store = useCartStore.getState();
    store.addItem(makeProduct({ id: 'a', sellPrice: 15 }), false, 2);
    store.setItemCustomPrice('a', 10, 'haggled');

    const { payload } = await checkoutPayload();
    expect(payload.subtotal).toBe(20); // 2 × custom 10
    expect(payload.items[0].unitPrice).toBe(10);
  });

  it('uses pack price when an item is sold as a pack', async () => {
    const store = useCartStore.getState();
    store.addItem(makeProduct({ id: 'a', sellPrice: 12, packSize: 6, packPrice: 60 }), true, 2);

    const { payload } = await checkoutPayload();
    expect(payload.subtotal).toBe(120); // 2 packs × E60 (NOT 2 × sellPrice)
  });
});

describe('cartStore — discounts', () => {
  it('percentage discount = round2(subtotal × percent / 100)', () => {
    const store = useCartStore.getState();
    store.addItem(makeProduct({ id: 'a', sellPrice: 15 }), false, 2);
    store.addItem(makeProduct({ id: 'b', sellPrice: 12 }), false, 1); // subtotal 42

    store.setDiscountPercent(10, 'loyal customer');
    const d = useCartStore.getState().discount!;
    expect(d.amount).toBe(4.2);
    expect(d.percent).toBe(10);
    expect(d.reason).toBe('loyal customer');
  });

  it('fixed discount derives the equivalent percentage', () => {
    const store = useCartStore.getState();
    store.addItem(makeProduct({ id: 'a', sellPrice: 25 }), false, 2); // subtotal 50

    store.setDiscountAmount(10);
    const d = useCartStore.getState().discount!;
    expect(d.amount).toBe(10);
    expect(d.percent).toBe(20); // 10/50 = 20%
  });

  it('fixed discount on an empty cart yields 0% (no divide-by-zero)', () => {
    useCartStore.getState().setDiscountAmount(10);
    expect(useCartStore.getState().discount!.percent).toBe(0);
  });
});

describe('cartStore — checkout (online)', () => {
  it('POSTs once, clears the cart, and returns the server sale with no VAT added', async () => {
    createSale.mockResolvedValue({ data: { id: 'srv-1', receiptNumber: 'RCP-1' } });

    const store = useCartStore.getState();
    store.addItem(makeProduct({ id: 'a', sellPrice: 15 }), false, 2);
    store.addItem(makeProduct({ id: 'b', sellPrice: 12 }), false, 1); // subtotal 42
    store.setDiscountAmount(2); // total 40

    const sale = await useCartStore.getState().checkout('user-1', 'shop-1');

    expect(createSale).toHaveBeenCalledTimes(1);
    const payload = createSale.mock.calls[0][0];
    expect(payload.subtotal).toBe(42);
    expect(payload.discount).toBe(2);
    // amountPaid is the cart total: subtotal - discount, NO VAT (server tax = 0).
    expect(payload.amountPaid).toBe(40);
    expect(payload.paymentMethod).toBe('CASH'); // uppercased for the API enum
    expect(typeof payload.localId).toBe('string');
    expect(payload.localId.length).toBeGreaterThan(0);

    expect(sale).not.toBeNull();
    expect(sale!.id).toBe('srv-1');
    expect(sale!.totalAmount).toBe(40);
    expect(sale!.subtotal).toBe(42);
    expect(sale!.pendingSync).toBeUndefined();

    // Cart cleared on success.
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(useCartStore.getState().isProcessing).toBe(false);
  });

  it('converts a pack line into per-unit quantities/prices for the API', async () => {
    createSale.mockResolvedValue({ data: { id: 'srv-2' } });

    const store = useCartStore.getState();
    store.addItem(makeProduct({ id: 'p', sellPrice: 12, packSize: 6, packPrice: 60 }), true, 2);

    await useCartStore.getState().checkout('user-1', 'shop-1');

    const item = createSale.mock.calls[0][0].items[0];
    expect(item.quantity).toBe(12); // 2 packs × 6 units
    expect(item.unitPrice).toBe(10); // E60 / 6 units
    expect(item.isPack).toBe(true);
    expect(item.packQty).toBe(2);
  });

  it('surfaces a genuine server rejection loudly and keeps the cart intact', async () => {
    createSale.mockResolvedValue({ error: 'Insufficient stock for Bread. Available: 1' });

    const store = useCartStore.getState();
    store.addItem(makeProduct({ id: 'a', sellPrice: 15 }), false, 2);

    const sale = await useCartStore.getState().checkout('user-1', 'shop-1');

    expect(sale).toBeNull();
    expect(useCartStore.getState().error).toBe('Insufficient stock for Bread. Available: 1');
    expect(useCartStore.getState().items).toHaveLength(1); // one line (qty 2); NOT cleared — no silent drop
    expect(useCartStore.getState().isProcessing).toBe(false);
    expect(addToSyncQueue).not.toHaveBeenCalled(); // a 4xx must NOT be queued
  });

  it('returns null for an empty cart without calling the API', async () => {
    const sale = await useCartStore.getState().checkout('user-1', 'shop-1');
    expect(sale).toBeNull();
    expect(createSale).not.toHaveBeenCalled();
  });
});

describe('cartStore — checkout (credit / on the book)', () => {
  it('books the sale to the customer with amountPaid 0 and surfaces the server balance', async () => {
    createSale.mockResolvedValue({ data: { id: 'srv-c', customerBalance: 65 } });

    const store = useCartStore.getState();
    store.setCustomer(makeCustomer({ id: 'cust-9', balance: 50 }));
    store.setPaymentMethod('credit');
    store.addItem(makeProduct({ id: 'a', sellPrice: 15 }), false, 1); // total 15

    const sale = await useCartStore.getState().checkout('user-1', 'shop-1');

    expect(createSale).toHaveBeenCalledTimes(1);
    const payload = createSale.mock.calls[0][0];
    expect(payload.paymentMethod).toBe('CREDIT');
    expect(payload.amountPaid).toBe(0); // nothing tendered now
    expect(payload.customerId).toBe('cust-9');

    expect(sale).not.toBeNull();
    expect(sale!.customerBalance).toBe(65); // server figure preferred
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('refuses a credit sale with no customer attached — no API call, no queue', async () => {
    const store = useCartStore.getState();
    store.setPaymentMethod('credit');
    store.addItem(makeProduct({ id: 'a', sellPrice: 15 }), false, 1);

    const sale = await useCartStore.getState().checkout('user-1', 'shop-1');

    expect(sale).toBeNull();
    expect(createSale).not.toHaveBeenCalled();
    expect(addToSyncQueue).not.toHaveBeenCalled();
    expect(useCartStore.getState().error).toMatch(/customer/i);
    expect(useCartStore.getState().items).toHaveLength(1); // cart intact
  });

  it('offline, projects the new balance locally (current balance + sale total)', async () => {
    setOnline(false);

    const store = useCartStore.getState();
    store.setCustomer(makeCustomer({ id: 'cust-2', balance: 100 }));
    store.setPaymentMethod('credit');
    store.addItem(makeProduct({ id: 'a', sellPrice: 20 }), false, 2); // total 40

    const sale = await useCartStore.getState().checkout('user-1', 'shop-1');

    expect(createSale).not.toHaveBeenCalled();
    const queued = (addToSyncQueue as unknown as Mock).mock.calls[0][2];
    expect(queued.paymentMethod).toBe('CREDIT');
    expect(queued.amountPaid).toBe(0);
    expect(queued.customerId).toBe('cust-2');
    expect(sale!.pendingSync).toBe(true);
    expect(sale!.customerBalance).toBe(140); // 100 + 40 projected
  });

  it('offline, rejects an over-limit credit sale — no queue, surfaces error', async () => {
    setOnline(false);

    const store = useCartStore.getState();
    // balance 90 + 40 sale = 130 > limit 100 → must be refused locally.
    store.setCustomer(makeCustomer({ id: 'cust-3', balance: 90, creditLimit: 100 }));
    store.setPaymentMethod('credit');
    store.addItem(makeProduct({ id: 'a', sellPrice: 20 }), false, 2); // total 40

    const sale = await useCartStore.getState().checkout('user-1', 'shop-1');

    expect(sale).toBeNull();
    expect(createSale).not.toHaveBeenCalled();
    expect(addToSyncQueue).not.toHaveBeenCalled();
    expect(useCartStore.getState().error).toMatch(/credit limit/i);
    expect(useCartStore.getState().items).toHaveLength(1); // cart intact
  });

  it('online, rejects an over-limit credit sale before hitting the API', async () => {
    const store = useCartStore.getState();
    store.setCustomer(makeCustomer({ id: 'cust-4', balance: 90, creditLimit: 100 }));
    store.setPaymentMethod('credit');
    store.addItem(makeProduct({ id: 'a', sellPrice: 20 }), false, 2); // total 40 → 130 > 100

    const sale = await useCartStore.getState().checkout('user-1', 'shop-1');

    expect(sale).toBeNull();
    expect(createSale).not.toHaveBeenCalled();
    expect(useCartStore.getState().error).toMatch(/credit limit/i);
  });

  it('allows a credit sale that lands exactly on the limit, and one with no limit (0)', async () => {
    createSale.mockResolvedValue({ data: { id: 'srv-ok', customerBalance: 100 } });
    const store = useCartStore.getState();
    // 60 + 40 = 100 == limit 100 → allowed (only strictly-over is rejected).
    store.setCustomer(makeCustomer({ id: 'cust-5', balance: 60, creditLimit: 100 }));
    store.setPaymentMethod('credit');
    store.addItem(makeProduct({ id: 'a', sellPrice: 20 }), false, 2);

    const sale = await useCartStore.getState().checkout('user-1', 'shop-1');
    expect(sale).not.toBeNull();
    expect(createSale).toHaveBeenCalledTimes(1);

    // creditLimit 0 = unlimited → never blocked regardless of balance.
    useCartStore.getState().clear();
    store.setCustomer(makeCustomer({ id: 'cust-6', balance: 9999, creditLimit: 0 }));
    store.setPaymentMethod('credit');
    store.addItem(makeProduct({ id: 'a', sellPrice: 20 }), false, 2);
    const sale2 = await useCartStore.getState().checkout('user-1', 'shop-1');
    expect(sale2).not.toBeNull();
  });
});

describe('cartStore — checkout (offline outbox)', () => {
  it('when offline, queues the sale and completes it optimistically without the API', async () => {
    setOnline(false);

    const store = useCartStore.getState();
    store.addItem(makeProduct({ id: 'a', sellPrice: 15 }), false, 2);
    store.setDiscountAmount(5); // subtotal 30, total 25

    const sale = await useCartStore.getState().checkout('user-1', 'shop-1');

    expect(createSale).not.toHaveBeenCalled();
    expect(addToSyncQueue).toHaveBeenCalledTimes(1);
    const [table, action, queued] = (addToSyncQueue as unknown as Mock).mock.calls[0];
    expect(table).toBe('sales');
    expect(action).toBe('create');
    expect(queued.amountPaid).toBe(25);
    expect(queued.localId).toBeTruthy();
    expect(queued.offlineAt).toBeTruthy();

    expect(sale!.pendingSync).toBe(true);
    expect(sale!.id).toBe(queued.localId); // receipt id is the localId offline
    expect(sale!.totalAmount).toBe(25);
    expect(useCartStore.getState().items).toHaveLength(0); // cart cleared optimistically
  });

  it('a transport failure mid-request falls back to the offline queue (retryable)', async () => {
    // Online at checkout time, but the POST fails to reach the server.
    createSale.mockResolvedValue({ error: NETWORK_ERROR });

    const store = useCartStore.getState();
    store.addItem(makeProduct({ id: 'a', sellPrice: 20 }), false, 1);

    const sale = await useCartStore.getState().checkout('user-1', 'shop-1');

    expect(createSale).toHaveBeenCalledTimes(1);
    expect(addToSyncQueue).toHaveBeenCalledTimes(1); // queued, not lost
    expect(sale!.pendingSync).toBe(true);
    expect(useCartStore.getState().error).toBeNull(); // not surfaced as an error
  });
});
