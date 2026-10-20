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

it.each([200, 401])('real drain never substitutes B credentials before storage events arrive (HTTP %s)', async status => {
  // Another tab has changed storage, but this tab has not received its event.
  localStorage.setItem('yebomart_staff_token', 'token-B');
  vi.mocked(yeboid.getAccessToken).mockResolvedValue('owner-B');
  vi.stubGlobal('fetch', vi.fn(async (_url, options: RequestInit) => {
    expect(options.headers).toMatchObject({ Authorization: 'Bearer verified-A', 'X-Shop-Id': 'shop-A' });
    expect(JSON.parse(options.body as string).localId).toBe('stable-A');
    return new Response(JSON.stringify({ data: { id: 'ack-A' } }), { status });
  }));
  await useSyncStore.getState().replay();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(yeboid.getAccessToken).not.toHaveBeenCalled();
  expect(await db.syncQueue.count()).toBe(status === 200 ? 0 : 1);
  expect(localStorage.getItem('yebomart_staff_token')).toBe('token-B');
});
