import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/yeboid', () => ({ getAccessToken: vi.fn(), clearTokens: vi.fn() }));
import api from './client';
import * as yeboid from '@/lib/yeboid';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
});

const payload = { items: [], amountPaid: 10, paymentMethod: 'CASH', localId: 'stable-id' };

it('does not send a queued sale if logout changes session while obtaining a token', async () => {
  let resolve!: (token: string) => void;
  vi.mocked(yeboid.getAccessToken).mockImplementation(() => new Promise(r => { resolve = r; }));
  let current = true;
  const request = api.createSale(payload, { shopId: 'original-shop', isCurrent: () => current });
  current = false;
  resolve('new-account-token');
  expect((await request).error).toContain('Session changed');
  expect(fetch).not.toHaveBeenCalled();
});

it('binds replay to the original shop and keeps its idempotency key', async () => {
  vi.mocked(yeboid.getAccessToken).mockResolvedValue('original-token');
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ data: { id: 'server-sale' } }), { status: 200 }));
  await api.createSale(payload, { shopId: 'original-shop', isCurrent: () => true });
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/sales'), expect.objectContaining({
    headers: expect.objectContaining({ Authorization: 'Bearer original-token', 'X-Shop-Id': 'original-shop' }),
    body: JSON.stringify(payload),
  }));
});

it('does not refresh or expire a new session when an old replay returns 401 after logout', async () => {
  vi.mocked(yeboid.getAccessToken).mockResolvedValue('original-token');
  let current = true;
  const expired = vi.fn();
  api.setSessionExpiredCallback(expired);
  vi.mocked(fetch).mockImplementation(async () => {
    current = false;
    return new Response('{}', { status: 401 });
  });
  await api.createSale(payload, { shopId: 'original-shop', isCurrent: () => current });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(yeboid.getAccessToken).toHaveBeenCalledTimes(1);
  expect(yeboid.clearTokens).not.toHaveBeenCalled();
  expect(expired).not.toHaveBeenCalled();
});
