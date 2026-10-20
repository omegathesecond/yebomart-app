import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/client', () => ({
  default: {
    createSale: vi.fn(), staffLogin: vi.fn(), getMe: vi.fn(), exchangeYeboid: vi.fn(),
    clearAllTokens: vi.fn(() => localStorage.removeItem('yebomart_staff_token')),
    setSessionExpiredCallback: vi.fn(),
  },
  NETWORK_ERROR: 'Network error. Please try again.',
}));
vi.mock('@/lib/yeboid', () => ({ getAccessToken: vi.fn(async () => null) }));

import api, { NETWORK_ERROR } from '@/api/client';
import { db, YeboMartDB } from '@/lib/db';
import { getSyncContext, setSyncContext } from '@/lib/outboxContext';
import { useAuthStore } from './authStore';
import { useCartStore } from './cartStore';
import { useSyncStore, waitForSyncDrain } from './syncStore';
import type { Product } from '@/types';

function online(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}
async function login(id = 'cashier', shopId = 'shop') {
  vi.mocked(api.staffLogin).mockResolvedValue({ data: {
    user: { id, shopId } as any, shop: { id: shopId } as any, token: 'token',
  } });
  expect(await useAuthStore.getState().staffLogin('phone', 'pin')).toBe(true);
  await waitForSyncDrain();
  await useSyncStore.getState().refreshPending();
}
async function sale() {
  useCartStore.getState().addItem({ id: 'bread', shopId: 'shop', name: 'Bread', sellPrice: 10 } as Product);
  const receipt = await useCartStore.getState().checkout('cashier', 'shop');
  expect(receipt?.pendingSync).toBe(true);
  await useSyncStore.getState().refreshPending();
  return receipt!;
}

beforeEach(async () => {
  await useAuthStore.getState().logout();
  await db.syncQueue.clear();
  useCartStore.getState().clear();
  vi.clearAllMocks();
  online(false);
});

describe('durable, session-scoped POS outbox', () => {
  it('offline checkout → logout → same account sign-in sends exactly one sale with its original localId', async () => {
    await login();
    const receipt = await sale();
    expect((await db.syncQueue.toArray())[0].context).toEqual({ principalId: 'cashier', shopId: 'shop', mode: 'staff' });
    await useAuthStore.getState().logout();
    expect(await db.syncQueue.count()).toBe(1);
    expect(useSyncStore.getState().pendingCount).toBe(0);
    vi.mocked(api.createSale).mockResolvedValue({ data: { id: 'server-sale' } });
    online(true);
    await login();
    await useSyncStore.getState().replay();
    expect(api.createSale).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.createSale).mock.calls[0][0].localId).toBe(receipt.localId);
    expect(await db.syncQueue.count()).toBe(0);
  });

  it('forced session expiry uses logout and preserves the sale', async () => {
    await login();
    await sale();
    // Callback was registered when the actual auth store initialized.
    registeredExpiry();
    await useAuthStore.getState().logout();
    expect(getSyncContext()).toBeNull();
    expect(await db.syncQueue.count()).toBe(1);
  });

  it('another account or shop cannot see the pending badge or replay the sale', async () => {
    await login();
    await sale();
    await useAuthStore.getState().logout();
    online(true);
    await login('other');
    expect(useSyncStore.getState().pendingCount).toBe(0);
    expect(api.createSale).not.toHaveBeenCalled();
    await useAuthStore.getState().logout();
    await login('cashier', 'other-shop');
    expect(useSyncStore.getState().pendingCount).toBe(0);
    expect(api.createSale).not.toHaveBeenCalled();
    expect(await db.syncQueue.count()).toBe(1);
  });

  it.each([true, false])('logout during replay retains unacknowledged data (acknowledged=%s)', async (acknowledged) => {
    await login();
    await sale();
    await sale();
    let finish!: (value: any) => void;
    let sent!: () => void;
    const started = new Promise<void>(resolve => { sent = resolve; });
    vi.mocked(api.createSale).mockImplementationOnce(() => { sent(); return new Promise(resolve => { finish = resolve; }); });
    online(true);
    const drain = useSyncStore.getState().replay();
    await started;
    const logout = useAuthStore.getState().logout();
    expect(getSyncContext()).toBeNull();
    finish(acknowledged ? { data: { id: 'server' } } : { error: NETWORK_ERROR });
    await Promise.all([drain, logout]);
    expect(api.createSale).toHaveBeenCalledTimes(1);
    expect(await db.syncQueue.count()).toBe(acknowledged ? 1 : 2);
    // Model server localId dedup when the committed response was lost.
    const serverIds = new Set([vi.mocked(api.createSale).mock.calls[0][0].localId]);
    vi.mocked(api.createSale).mockImplementation(async payload => {
      serverIds.add(payload.localId);
      return { data: { id: payload.localId } };
    });
    await login();
    expect(await db.syncQueue.count()).toBe(0);
    expect(serverIds.size).toBe(2);
  });

  it('survives closing/reopening IndexedDB and revalidates auth before showing or sending data', async () => {
    await login();
    const receipt = await sale();
    db.close();
    setSyncContext(null); // reload loses all memory-only authorization
    const reopened = new YeboMartDB();
    await reopened.open();
    expect((await reopened.syncQueue.toArray())[0].data).toMatchObject({ localId: receipt.localId });
    reopened.close();
    await db.open();
    online(true);
    await useSyncStore.getState().refreshPending();
    await useSyncStore.getState().replay();
    expect(useSyncStore.getState().pendingCount).toBe(0);
    expect(api.createSale).not.toHaveBeenCalled();
    localStorage.setItem('yebomart_staff_token', 'verified-on-reload');
    vi.mocked(api.getMe).mockResolvedValue({ data: { user: { id: 'cashier' }, shop: { id: 'shop' }, subscription: null } });
    vi.mocked(api.createSale).mockResolvedValue({ error: NETWORK_ERROR });
    await useAuthStore.getState().loadUser();
    await waitForSyncDrain();
    expect(useSyncStore.getState().pendingCount).toBe(1);
    expect(api.createSale).toHaveBeenCalledTimes(1);
  });

  it('logout with zero pending sales clears every ordinary cache', async () => {
    await login();
    const caches = db.tables.filter(table => table.name !== 'syncQueue');
    for (const table of caches) await table.put({ id: 'cached' });
    await useAuthStore.getState().logout();
    for (const table of caches) expect(await table.count()).toBe(0);
  });

  it('binds an owner queue to the API-accepted YeboID subject, never another owner of the same shop', async () => {
    const token = (sub: string) => `header.${btoa(JSON.stringify({ sub }))}.signature`;
    vi.mocked(api.exchangeYeboid).mockResolvedValue({ data: { shop: { id: 'shop' }, isNewShop: false } });
    await useAuthStore.getState().exchangeYeboidToken(token('owner-one'));
    await sale();
    expect((await db.syncQueue.toArray())[0].context?.principalId).toBe('owner-one');
    await useAuthStore.getState().logout();
    online(true);
    await useAuthStore.getState().exchangeYeboidToken(token('owner-two'));
    await waitForSyncDrain();
    expect(api.createSale).not.toHaveBeenCalled();
    expect(useSyncStore.getState().pendingCount).toBe(0);
    await useAuthStore.getState().logout();
    vi.mocked(api.createSale).mockResolvedValue({ data: { id: 'server-sale' } });
    await useAuthStore.getState().exchangeYeboidToken(token('owner-one'));
    await waitForSyncDrain();
    expect(api.createSale).toHaveBeenCalledTimes(1);
    expect(await db.syncQueue.count()).toBe(0);
  });

  it('manual retry can resend a parked sale without changing its localId', async () => {
    await login();
    const receipt = await sale();
    const item = (await db.syncQueue.toArray())[0];
    await db.syncQueue.update(item.id, { attempts: 5 });
    online(true);
    vi.mocked(api.createSale).mockResolvedValue({ data: { id: 'server-sale' } });
    await useSyncStore.getState().replay();
    expect(api.createSale).not.toHaveBeenCalled();
    expect(useSyncStore.getState().pendingCount).toBe(1);
    await useSyncStore.getState().replay(true);
    expect(vi.mocked(api.createSale).mock.calls[0][0].localId).toBe(receipt.localId);
    expect(await db.syncQueue.count()).toBe(0);
  });

  it('a late getMe response cannot reopen the replay gate after logout', async () => {
    await login();
    await sale();
    localStorage.setItem('yebomart_staff_token', 'old-session');
    let respond!: (value: any) => void;
    let started!: () => void;
    const requested = new Promise<void>(resolve => { started = resolve; });
    vi.mocked(api.getMe).mockImplementationOnce(() => {
      started();
      return new Promise(resolve => { respond = resolve; });
    });
    const load = useAuthStore.getState().loadUser();
    await requested;
    await useAuthStore.getState().logout();
    respond({ data: { user: { id: 'cashier' }, shop: { id: 'shop' }, subscription: null } });
    await load;
    online(true);
    await useSyncStore.getState().replay();
    expect(getSyncContext()).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(api.createSale).not.toHaveBeenCalled();
    expect(await db.syncQueue.count()).toBe(1);
  });

  it('refuses checkout without a verified session or with products from another shop', async () => {
    useCartStore.getState().addItem({ id: 'bread', shopId: 'shop', name: 'Bread', sellPrice: 10 } as Product);
    expect(await useCartStore.getState().checkout('cashier', 'shop')).toBeNull();
    await login('cashier', 'other-shop');
    expect(await useCartStore.getState().checkout('cashier', 'other-shop')).toBeNull();
    expect(await db.syncQueue.count()).toBe(0);
    expect(api.createSale).not.toHaveBeenCalled();
    expect(useCartStore.getState().error).toBeTruthy();
  });

  it('retains historical unscoped entries without attributing them to whoever signs in next', async () => {
    await db.syncQueue.add({ id: 'legacy', table: 'sales', action: 'create', data: { localId: 'legacy' }, createdAt: new Date(), attempts: 0 });
    online(true);
    await login();
    expect(useSyncStore.getState().pendingCount).toBe(0);
    expect(api.createSale).not.toHaveBeenCalled();
    expect(await db.syncQueue.count()).toBe(1);
  });
});

// Capture the real callback before beforeEach clears spy histories.
const registeredExpiry = vi.mocked(api.setSessionExpiredCallback).mock.calls[0][0];

it('hides pending sales when another tab changes credentials without deleting its queue or new tokens', async () => {
  await login();
  await sale();
  localStorage.setItem('yebomart_staff_token', 'account-B-token');
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'yebomart_staff_token', newValue: 'account-B-token',
  }));
  expect(getSyncContext()).toBeNull();
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  expect(useSyncStore.getState().pendingCount).toBe(0);
  online(true);
  await useSyncStore.getState().replay();
  expect(api.createSale).not.toHaveBeenCalled();
  expect(await db.syncQueue.count()).toBe(1);
  expect(localStorage.getItem('yebomart_staff_token')).toBe('account-B-token');
});
