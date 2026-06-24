import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { Product } from '@/types';

// Mock the network boundary so we assert the store calls the purpose-built
// /api/stock/receive endpoint (NOT adjustStock) and folds the response — new
// quantity AND costPrice — back into local state.
vi.mock('@/api/client', () => ({
  default: { receiveStock: vi.fn(), adjustStock: vi.fn() },
}));

import api from '@/api/client';
import { useInventoryStore } from '@/stores/inventoryStore';

const receiveStockApi = api.receiveStock as unknown as Mock;
const adjustStockApi = api.adjustStock as unknown as Mock;

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    shopId: 'shop-1',
    name: 'Bread',
    sellPrice: 15,
    costPrice: 10,
    quantity: 20,
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
  useInventoryStore.setState({ products: [makeProduct()] });
});

describe('inventoryStore.receiveStock', () => {
  it('calls the receive endpoint (not adjustStock) and forwards the new cost price', async () => {
    receiveStockApi.mockResolvedValue({
      data: [{ product: makeProduct({ quantity: 30, costPrice: 12 }), stockLog: {} }],
    });

    await useInventoryStore.getState().receiveStock('prod-1', 10, 'Supplier delivery', 12);

    expect(adjustStockApi).not.toHaveBeenCalled();
    expect(receiveStockApi).toHaveBeenCalledWith('prod-1', {
      quantity: 10,
      note: 'Supplier delivery',
      costPrice: 12,
    });
  });

  it('updates local quantity AND costPrice from the API response', async () => {
    receiveStockApi.mockResolvedValue({
      data: [{ product: makeProduct({ quantity: 30, costPrice: 12 }), stockLog: {} }],
    });

    await useInventoryStore.getState().receiveStock('prod-1', 10, undefined, 12);

    const updated = useInventoryStore.getState().products.find((p) => p.id === 'prod-1')!;
    expect(updated.quantity).toBe(30);
    expect(updated.costPrice).toBe(12);
  });

  it('keeps the existing cost when no new cost is supplied', async () => {
    receiveStockApi.mockResolvedValue({
      data: [{ product: makeProduct({ quantity: 25, costPrice: 10 }), stockLog: {} }],
    });

    await useInventoryStore.getState().receiveStock('prod-1', 5);

    expect(receiveStockApi).toHaveBeenCalledWith('prod-1', {
      quantity: 5,
      note: undefined,
      costPrice: undefined,
    });
    const updated = useInventoryStore.getState().products.find((p) => p.id === 'prod-1')!;
    expect(updated.quantity).toBe(25);
    expect(updated.costPrice).toBe(10);
  });

  it('surfaces the error loudly (throws) and leaves state untouched on failure', async () => {
    receiveStockApi.mockResolvedValue({ error: 'Product not found' });

    await expect(
      useInventoryStore.getState().receiveStock('prod-1', 10, undefined, 12),
    ).rejects.toThrow('Product not found');

    const unchanged = useInventoryStore.getState().products.find((p) => p.id === 'prod-1')!;
    expect(unchanged.quantity).toBe(20);
    expect(unchanged.costPrice).toBe(10);
    expect(useInventoryStore.getState().error).toBe('Product not found');
  });
});
