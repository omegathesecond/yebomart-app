import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/api/client', () => ({ default: { getProducts: vi.fn(), getSales: vi.fn(), getStaff: vi.fn(), listExpenses: vi.fn() } }));
import api from '@/api/client';
import { useInventoryStore as store } from './inventoryStore';
import { setSyncContext } from '@/lib/outboxContext';
const product = { id: 'known', isActive: true, quantity: 10, reorderAt: 1 };
const load = () => store.getState().loadAll('shop');
beforeEach(() => {
  vi.resetAllMocks();
  store.getState().clearAll();
  setSyncContext({ principalId: 'owner', mode: 'owner', shopId: 'shop' }, 'token');
  vi.mocked(api.getProducts).mockResolvedValue({ data: [product] } as never);
  vi.mocked(api.getSales).mockResolvedValue({ data: [] } as never);
  vi.mocked(api.getStaff).mockResolvedValue({ data: [] } as never);
  vi.mocked(api.listExpenses).mockResolvedValue({ data: { expenses: [] } } as never);
});
describe('atomic shop sync', () => {
  it('rejects page two without publishing a partial catalogue, then retries successfully', async () => {
    vi.mocked(api.getProducts).mockResolvedValueOnce({ data: Array(100).fill(product) } as never)
      .mockResolvedValueOnce({ error: 'Page two unavailable' });
    expect(await load()).toBe(false);
    expect(store.getState()).toMatchObject({ products: [], lastSync: null, syncError: 'Page two unavailable' });
    expect(await load()).toBe(true);
    expect(store.getState().products).toEqual([product]);
    expect(store.getState().lastSync).toBeInstanceOf(Date);
    expect(store.getState().syncError).toBeNull();
  });
  for (const method of ['getSales', 'getStaff', 'listExpenses'] as const) {
    it(`preserves the complete successful snapshot when ${method} fails`, async () => {
      expect(await load()).toBe(true);
      const snapshot = store.getState();
      vi.mocked(api.getProducts).mockResolvedValue({ data: [{ ...product, id: 'new' }] } as never);
      vi.mocked(api[method]).mockResolvedValue({ error: `${method} unavailable` } as never);
      expect(await load()).toBe(false);
      expect(store.getState()).toMatchObject({ products: snapshot.products, sales: snapshot.sales, staff: snapshot.staff, expenses: snapshot.expenses, lastSync: snapshot.lastSync, syncError: `${method} unavailable` });
    });
    it(`does not complete a first sync when ${method} fails`, async () => {
      vi.mocked(api[method]).mockResolvedValue({ error: 'Unavailable' } as never);
      expect(await load()).toBe(false);
      expect(store.getState().lastSync).toBeNull();
      expect(store.getState().products).toEqual([]);
    });
  }
  it('does not let an older request overwrite a newer successful load', async () => {
    let resolve!: (value: never) => void;
    vi.mocked(api.getProducts).mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const old = load();
    expect(await load()).toBe(true);
    const snapshot = store.getState();
    resolve({ data: [{ ...product, id: 'old' }] } as never);
    expect(await old).toBe(false);
    expect(store.getState().products).toBe(snapshot.products);
    expect(store.getState().lastSync).toBe(snapshot.lastSync);
  });
  it('surfaces thrown dependency failures without publishing data', async () => {
    vi.mocked(api.getSales).mockRejectedValueOnce(new Error('Connection lost'));
    expect(await load()).toBe(false);
    expect(store.getState()).toMatchObject({ products: [], syncError: 'Connection lost', lastSync: null });
  });
  for (const change of ['logout', 'session', 'shop', 'clear'] as const) {
    it(`discards an outstanding load after ${change}`, async () => {
      let resolve!: (value: never) => void;
      vi.mocked(api.getProducts).mockReturnValueOnce(new Promise(r => { resolve = r; }));
      const pending = load();
      if (change === 'clear') store.getState().clearAll();
      else setSyncContext(change === 'logout' ? null : { principalId: 'another', mode: 'owner', shopId: change === 'shop' ? 'other-shop' : 'shop' });
      resolve({ data: [product] } as never);
      expect(await pending).toBe(false);
      expect(store.getState().products).toEqual([]);
      expect(store.getState().lastSync).toBeNull();
      expect(api.getSales).not.toHaveBeenCalled();
    });
  }
});
