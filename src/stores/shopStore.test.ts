import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { Shop } from '@/types';

// Mock the network boundary. Mirrors the vi.mock('@/api/client', ...) pattern
// used in src/stores/cartStore.test.ts — literals only, since vi.mock
// factories can't reliably close over outer `const`/`let` bindings.
vi.mock('@/api/client', () => ({
  default: {
    getShops: vi.fn(),
    getMe: vi.fn(),
    createShop: vi.fn(),
    setActiveShopId: vi.fn(),
    getActiveShopId: vi.fn(() => null),
  },
}));

// shopStore.loadShops branches on authMode to decide GET /api/shops
// (owner) vs GET /api/auth/me (staff PIN, no YeboID identity to list with).
let mockAuthMode: 'owner' | 'staff' | null = 'owner';
vi.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => ({ authMode: mockAuthMode }) },
}));

import api from '@/api/client';
import { useShopStore } from '@/stores/shopStore';

const getShops = api.getShops as unknown as Mock;
const getMe = api.getMe as unknown as Mock;
const createShopApi = api.createShop as unknown as Mock;
const setActiveShopId = api.setActiveShopId as unknown as Mock;
const getActiveShopId = api.getActiveShopId as unknown as Mock;

function makeShop(overrides: Partial<Shop> = {}): Shop {
  return {
    id: 'shop-1',
    name: 'Corner Store',
    ownerName: 'Jane',
    ownerPhone: '+26876123456',
    phoneCountryCode: 'SZ',
    countryCode: 'SZ',
    businessType: 'general',
    assistantName: 'Yebo',
    currency: 'SZL',
    currencySymbol: 'E',
    timezone: 'Africa/Mbabane',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthMode = 'owner';
  getActiveShopId.mockReturnValue(null);
  useShopStore.setState({
    shops: [],
    currentShopId: null,
    currentShop: null,
    isLoading: false,
    error: null,
  });
});

describe('shopStore.loadShops — owner mode', () => {
  it('lists every shop from GET /api/shops and defaults to the oldest (first) one', async () => {
    const older = makeShop({ id: 'shop-old', name: 'Old Shop' });
    const newer = makeShop({ id: 'shop-new', name: 'New Shop' });
    getShops.mockResolvedValue({ data: [older, newer] }); // already oldest-first per the API contract

    await useShopStore.getState().loadShops();

    const state = useShopStore.getState();
    expect(getMe).not.toHaveBeenCalled();
    expect(state.shops.map((s) => s.id)).toEqual(['shop-old', 'shop-new']);
    expect(state.currentShopId).toBe('shop-old');
    expect(state.currentShop?.userRole).toBe('owner');
    expect(setActiveShopId).toHaveBeenCalledWith('shop-old');
  });

  it('prefers api.getActiveShopId() over the default when it names a shop still in the list', async () => {
    const older = makeShop({ id: 'shop-old' });
    const newer = makeShop({ id: 'shop-new' });
    getShops.mockResolvedValue({ data: [older, newer] });
    getActiveShopId.mockReturnValue('shop-new'); // e.g. just switched/created

    await useShopStore.getState().loadShops();

    expect(useShopStore.getState().currentShopId).toBe('shop-new');
  });

  it('surfaces an error and does not silently show a stale shop list on failure', async () => {
    getShops.mockResolvedValue({ error: 'Request failed' });

    await useShopStore.getState().loadShops();

    const state = useShopStore.getState();
    expect(state.error).toBe('Request failed');
    expect(state.shops).toEqual([]);
    expect(state.isLoading).toBe(false);
  });
});

describe('shopStore.loadShops — staff PIN mode', () => {
  it('resolves the single shop via /api/auth/me instead of the owner-only /api/shops list', async () => {
    mockAuthMode = 'staff';
    getMe.mockResolvedValue({ data: { shop: makeShop({ id: 'shop-1' }), user: { role: 'CASHIER' } } });

    await useShopStore.getState().loadShops();

    const state = useShopStore.getState();
    expect(getShops).not.toHaveBeenCalled();
    expect(state.shops).toHaveLength(1);
    expect(state.shops[0].userRole).toBe('staff');
    expect(state.currentShopId).toBe('shop-1');
  });
});

describe('shopStore.setCurrentShop', () => {
  it('switches the active shop and persists it through api.setActiveShopId', () => {
    const shopA = makeShop({ id: 'shop-a' });
    const shopB = makeShop({ id: 'shop-b' });
    useShopStore.setState({
      shops: [
        { ...shopA, userRole: 'owner' },
        { ...shopB, userRole: 'owner' },
      ],
      currentShopId: 'shop-a',
      currentShop: { ...shopA, userRole: 'owner' },
    });

    useShopStore.getState().setCurrentShop('shop-b');

    expect(useShopStore.getState().currentShopId).toBe('shop-b');
    expect(setActiveShopId).toHaveBeenCalledWith('shop-b');
  });

  it('no-ops for a shop id that is not in the loaded list (never silently switches to an unknown shop)', () => {
    const shopA = makeShop({ id: 'shop-a' });
    useShopStore.setState({
      shops: [{ ...shopA, userRole: 'owner' }],
      currentShopId: 'shop-a',
      currentShop: { ...shopA, userRole: 'owner' },
    });

    useShopStore.getState().setCurrentShop('shop-does-not-exist');

    expect(useShopStore.getState().currentShopId).toBe('shop-a');
    expect(setActiveShopId).not.toHaveBeenCalled();
  });
});

describe('shopStore.createShop', () => {
  it('creates a second shop under the same owner and returns it on success', async () => {
    const created = makeShop({ id: 'shop-new', name: 'Second Branch' });
    createShopApi.mockResolvedValue({ data: created });

    const result = await useShopStore.getState().createShop({ name: 'Second Branch', businessType: 'general' });

    expect(createShopApi).toHaveBeenCalledWith({
      shopName: 'Second Branch',
      businessType: 'general',
      assistantName: undefined,
    });
    expect(result).toEqual({ success: true, shop: created });
    expect(useShopStore.getState().isLoading).toBe(false);
  });

  it('surfaces the API error and never fabricates a phantom shop on failure', async () => {
    createShopApi.mockResolvedValue({ error: 'Shop name is required' });

    const result = await useShopStore.getState().createShop({ name: '', businessType: 'general' });

    expect(result).toEqual({ success: false, error: 'Shop name is required' });
    expect(useShopStore.getState().error).toBe('Shop name is required');
    expect(useShopStore.getState().shops).toEqual([]);
  });
});

describe('shopStore.clearShops', () => {
  it('resets every field — used on logout so a new owner never sees the previous one’s shops', () => {
    useShopStore.setState({
      shops: [{ ...makeShop(), userRole: 'owner' }],
      currentShopId: 'shop-1',
      currentShop: { ...makeShop(), userRole: 'owner' },
      error: 'stale error',
    });

    useShopStore.getState().clearShops();

    const state = useShopStore.getState();
    expect(state.shops).toEqual([]);
    expect(state.currentShopId).toBeNull();
    expect(state.currentShop).toBeNull();
    expect(state.error).toBeNull();
  });
});
