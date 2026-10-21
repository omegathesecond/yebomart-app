import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/yeboid', () => ({ getAccessToken: vi.fn(), clearTokens: vi.fn() }));
import { db } from '@/lib/db';
import { setSyncContext } from '@/lib/outboxContext';
import { useSyncStore, waitForSyncDrain } from './syncStore';
import * as yeboid from '@/lib/yeboid';

beforeEach(async () => {
  await waitForSyncDrain();
  await db.syncQueue.clear();
  localStorage.clear();
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  setSyncContext({ principalId: 'A', shopId: 'shop-A', mode: 'staff' }, 'verified-A');
  await db.syncQueue.add({ id: 'queued-A', table: 'sales', action: 'create',
    data: { localId: 'stable-A', items: [], amountPaid: 10, paymentMethod: 'CASH' },
    context: { principalId: 'A', shopId: 'shop-A', mode: 'staff' },
    createdAt: new Date(), attempts: 0 });
});

it.each(['yebomart_staff_token', 'yebomart.accessToken'])(
  'real drain hides and preserves A sales before a %s storage event arrives', async key => {
    await useSyncStore.getState().refreshPending();
    expect(useSyncStore.getState().pendingCount).toBe(1);
    localStorage.setItem(key, 'token-B');
    vi.mocked(yeboid.getAccessToken).mockResolvedValue('owner-B');
    vi.stubGlobal('fetch', vi.fn());
    await useSyncStore.getState().refreshPending();
    await useSyncStore.getState().replay();
    expect(useSyncStore.getState().pendingCount).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(await db.syncQueue.count()).toBe(1);

    // Only a verified original session may reopen the gate. It retains the
    // original idempotency key and the real HTTP client uses its pinned token.
    localStorage.clear();
    setSyncContext({ principalId: 'A', shopId: 'shop-A', mode: 'staff' }, 'verified-A');
    vi.mocked(fetch).mockImplementation(async (_url, options) => {
      expect(options?.headers).toMatchObject({ Authorization: 'Bearer verified-A', 'X-Shop-Id': 'shop-A' });
      expect(JSON.parse(options?.body as string).localId).toBe('stable-A');
      return new Response(JSON.stringify({ data: { id: 'ack-A' } }), { status: 200 });
    });
    await useSyncStore.getState().replay();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(yeboid.getAccessToken).not.toHaveBeenCalled();
    expect(await db.syncQueue.count()).toBe(0);
  },
);

it.each([200, 401])('credential changes during an HTTP %s replay cannot substitute tokens', async status => {
  vi.stubGlobal('fetch', vi.fn(async (_url, options: RequestInit) => {
    expect(options.headers).toMatchObject({ Authorization: 'Bearer verified-A', 'X-Shop-Id': 'shop-A' });
    localStorage.setItem('yebomart_staff_token', 'token-B');
    return new Response(JSON.stringify(status === 200 ? { data: { id: 'ack-A' } } : {}), { status });
  }));
  await useSyncStore.getState().replay();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(yeboid.getAccessToken).not.toHaveBeenCalled();
  expect(await db.syncQueue.count()).toBe(status === 200 ? 0 : 1);
  expect(useSyncStore.getState().pendingCount).toBe(0);
  expect(localStorage.getItem('yebomart_staff_token')).toBe('token-B');
});
