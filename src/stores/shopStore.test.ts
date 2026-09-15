import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

// Mock the network boundary so the switching logic (which shop becomes
// active, when X-Shop-Id gets updated) is tested in isolation.
vi.mock('@/api/client', () => ({
  default: {
    getShops: vi.fn(),
    createShop: vi.fn(),
    getMe: vi.fn(),
    setActiveShopId: vi.fn(),
    clearActiveShopId: vi.fn(),
  },
}));

import api from '@/api/client';
import { useShopStore } from '@/stores/shopStore';

const getShops = api.getShops as unknown as Mock;
const createShop = api.createShop as unknown as Mock;
const getMe = api.getMe as unknown as Mock;
const setActiveShopId = api.setActiveShopId as unknown as Mock;
const clearActiveShopId = api.clearActiveShopId as unknown as Mock;

function makeApiShop(overrides: Record<string, any> = {}) {
  return {
    id: 'shop_1',
    name: 'Main Branch',
    businessType: 'general',
    assistantName: 'Yebo',
    currency: 'SZL',
    currencySymbol: 'E',
    countryCode: 'SZ',
    phoneCountryCode: '+268',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useShopStore.setState({
    shops: [],
    currentShopId: null,
    currentShop: null,
    isLoading: false,
    error: null,
  });
});

describe('shopStore.loadShops', () => {
  it('populates the list from GET /api/shops and activates the oldest (first) shop', async () => {
    const shopA = makeApiShop({ id: 'shop_a', name: 'Main Branch' });
    const shopB = makeApiShop({ id: 'shop_b', name: 'Second Branch' });
    getShops.mockResolvedValue({ data: [shopA, shopB] });

    await useShopStore.getState().loadShops();

    const state = useShopStore.getState();
    expect(state.shops.map(s => s.id)).toEqual(['shop_a', 'shop_b']);
    expect(state.currentShopId).toBe('shop_a');
    expect(state.currentShop?.userRole).toBe('owner');
    expect(setActiveShopId).toHaveBeenCalledWith('shop_a');
  });

  it('keeps a previously-selected shop active on reload rather than resetting to the first', async () => {
    const shopA = makeApiShop({ id: 'shop_a', name: 'Main Branch' });
    const shopB = makeApiShop({ id: 'shop_b', name: 'Second Branch' });
    getShops.mockResolvedValue({ data: [shopA, shopB] });
    useShopStore.setState({ currentShopId: 'shop_b' });

    await useShopStore.getState().loadShops();

    expect(useShopStore.getState().currentShopId).toBe('shop_b');
    expect(setActiveShopId).toHaveBeenCalledWith('shop_b');
  });

  it('falls back to GET /api/auth/me (single shop) when GET /api/shops errors — staff PIN sessions', async () => {
    getShops.mockResolvedValue({ error: 'Unauthorized' });
    getMe.mockResolvedValue({
      data: { user: { id: 'staff_1', name: 'Cashier' }, shop: makeApiShop({ id: 'shop_staff' }) },
    });

    await useShopStore.getState().loadShops();

    const state = useShopStore.getState();
    expect(state.shops).toHaveLength(1);
    expect(state.currentShop?.id).toBe('shop_staff');
    expect(state.currentShop?.userRole).toBe('staff');
    expect(setActiveShopId).toHaveBeenCalledWith('shop_staff');
  });

  it('surfaces an error and leaves shops empty when both getShops and getMe fail (signed out)', async () => {
    getShops.mockResolvedValue({ error: 'Unauthorized' });
    getMe.mockResolvedValue({ error: 'Unauthorized' });

    await useShopStore.getState().loadShops();

    const state = useShopStore.getState();
    expect(state.shops).toEqual([]);
    expect(state.currentShop).toBeNull();
    expect(state.error).toBeTruthy();
  });
});

describe('shopStore.setCurrentShop', () => {
  it('switches the active shop and updates the X-Shop-Id the client will send', () => {
    useShopStore.setState({
      shops: [
        { id: 'shop_a', name: 'A', userRole: 'owner' } as any,
        { id: 'shop_b', name: 'B', userRole: 'owner' } as any,
      ],
      currentShopId: 'shop_a',
      currentShop: { id: 'shop_a', name: 'A', userRole: 'owner' } as any,
    });

    useShopStore.getState().setCurrentShop('shop_b');

    const state = useShopStore.getState();
    expect(state.currentShopId).toBe('shop_b');
    expect(state.currentShop?.id).toBe('shop_b');
    expect(setActiveShopId).toHaveBeenCalledWith('shop_b');
  });

  it('is a no-op for a shop id not in the local list', () => {
    useShopStore.setState({
      shops: [{ id: 'shop_a', name: 'A', userRole: 'owner' } as any],
      currentShopId: 'shop_a',
      currentShop: { id: 'shop_a', name: 'A', userRole: 'owner' } as any,
    });

    useShopStore.getState().setCurrentShop('shop_ghost');

    expect(useShopStore.getState().currentShopId).toBe('shop_a');
    expect(setActiveShopId).not.toHaveBeenCalled();
  });
});

describe('shopStore.createShop — the Onboarding "Add Shop" flow', () => {
  it('creates a second shop, adds it to the list, and switches to it', async () => {
    const first = makeApiShop({ id: 'shop_a', name: 'Main Branch' });
    useShopStore.setState({
      shops: [{ ...first, userRole: 'owner' }] as any,
      currentShopId: 'shop_a',
      currentShop: { ...first, userRole: 'owner' } as any,
    });
    const second = makeApiShop({ id: 'shop_b', name: 'Second Branch' });
    createShop.mockResolvedValue({ data: second });

    const result = await useShopStore.getState().createShop({ name: 'Second Branch' });

    expect(result.success).toBe(true);
    expect(result.shop?.id).toBe('shop_b');
    const state = useShopStore.getState();
    expect(state.shops.map(s => s.id)).toEqual(['shop_a', 'shop_b']);
    // Switches to the newly created shop immediately.
    expect(state.currentShopId).toBe('shop_b');
    expect(setActiveShopId).toHaveBeenCalledWith('shop_b');
  });

  it('fails loudly (no fake shop) when the API call errors', async () => {
    createShop.mockResolvedValue({ error: 'No existing shop found for this YeboID account.' });

    const result = await useShopStore.getState().createShop({ name: 'Orphan' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No existing shop found/);
    expect(useShopStore.getState().shops).toEqual([]);
    expect(setActiveShopId).not.toHaveBeenCalled();
  });
});

describe('shopStore.clearShops', () => {
  it('resets state and clears the persisted active-shop id', () => {
    useShopStore.setState({
      shops: [{ id: 'shop_a', name: 'A', userRole: 'owner' } as any],
      currentShopId: 'shop_a',
      currentShop: { id: 'shop_a', name: 'A', userRole: 'owner' } as any,
      error: 'stale error',
    });

    useShopStore.getState().clearShops();

    const state = useShopStore.getState();
    expect(state.shops).toEqual([]);
    expect(state.currentShopId).toBeNull();
    expect(state.currentShop).toBeNull();
    expect(state.error).toBeNull();
    expect(clearActiveShopId).toHaveBeenCalledTimes(1);
  });
});
