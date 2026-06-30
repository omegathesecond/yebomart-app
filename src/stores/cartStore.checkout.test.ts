import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { Product } from '@/types';

// Mock the network + offline-outbox boundaries so we can assert exactly what
// the checkout sends as `amountPaid` (the cash actually tendered, NOT the total)
// — that's the field the cash-drawer Z-report reconciles against.
vi.mock('@/api/client', () => ({
  default: { createSale: vi.fn() },
  NETWORK_ERROR: 'NETWORK_ERROR',
}));
vi.mock('@/lib/db', () => ({ addToSyncQueue: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/stores/syncStore', () => ({
  useSyncStore: { getState: () => ({ refreshPending: vi.fn() }) },
}));

import api from '@/api/client';
import { addToSyncQueue } from '@/lib/db';
import { useCartStore } from '@/stores/cartStore';

const createSale = api.createSale as unknown as Mock;
const queue = addToSyncQueue as unknown as Mock;

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    shopId: 'shop-1',
    name: 'Bread',
    sellPrice: 70,
    costPrice: 40,
    quantity: 100,
    reorderAt: 5,
    unit: 'each',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset cart to a clean single-line state (sellPrice 70).
  useCartStore.setState({
    items: [{ productId: 'prod-1', product: product(), quantity: 1 }],
    paymentMethod: 'cash',
    discount: null,
    customer: null,
    isProcessing: false,
    error: null,
  } as any);
  createSale.mockResolvedValue({ data: { id: 'sale-1', receiptNumber: 'RCP-1' } });
});

describe('cartStore.checkout — cash tendered persistence', () => {
  it('sends the actual cash tendered as amountPaid for a cash sale (not the total)', async () => {
    await useCartStore.getState().checkout('user-1', 'shop-1', {
      cashReceived: 100, // customer handed over E100 for a E70 sale
      changeGiven: 30,
    });

    expect(createSale).toHaveBeenCalledTimes(1);
    const payload = createSale.mock.calls[0][0];
    expect(payload.paymentMethod).toBe('CASH');
    expect(payload.amountPaid).toBe(100); // tendered, so server derives change = 30
  });

  it('falls back to the total when no cash detail is supplied (non-cash sales)', async () => {
    useCartStore.setState({ paymentMethod: 'card' } as any);

    await useCartStore.getState().checkout('user-1', 'shop-1');

    const payload = createSale.mock.calls[0][0];
    expect(payload.paymentMethod).toBe('CARD');
    expect(payload.amountPaid).toBe(70); // the total — there is no tender for a card sale
  });

  it('ignores a tendered amount that is short of the total (guards against bad input)', async () => {
    await useCartStore.getState().checkout('user-1', 'shop-1', { cashReceived: 50, changeGiven: 0 });

    const payload = createSale.mock.calls[0][0];
    expect(payload.amountPaid).toBe(70); // 50 < 70 → fall back to total, never under-record
  });

  it('queues the tendered amount on the offline path so it persists on sync', async () => {
    createSale.mockResolvedValue({ data: null, error: 'NETWORK_ERROR' });

    await useCartStore.getState().checkout('user-1', 'shop-1', { cashReceived: 100, changeGiven: 30 });

    expect(queue).toHaveBeenCalledTimes(1);
    const [table, action, queued] = queue.mock.calls[0];
    expect(table).toBe('sales');
    expect(action).toBe('create');
    expect(queued.amountPaid).toBe(100); // the real tender rides the outbox replay
  });
});
