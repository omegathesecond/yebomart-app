import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/yeboid', () => ({ getAccessToken: vi.fn().mockResolvedValue('token'), clearTokens: vi.fn() }));
import api from './client';

beforeEach(() => { localStorage.clear(); vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => vi.unstubAllGlobals());
it('serializes explicit sales pages/date bounds and retains server metadata', async () => {
  const metadata = { total: 65, page: 3, limit: 20, hasNext: true, hasPrev: true };
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ success: true, data: [], metadata }), { status: 200 }));
  const startDate = '2026-10-01T00:00:00.000Z';
  const endDate = '2026-10-28T23:59:59.999Z';
  const response = await api.getSales({ page: 3, limit: 20, startDate, endDate });
  const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
  expect(Object.fromEntries(url.searchParams)).toEqual({ page: '3', limit: '20', startDate, endDate });
  expect(response.metadata).toEqual(metadata);
  expect(response.data).toEqual([]);
});
it('surfaces sales errors without success data or metadata', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ success: false, message: 'Database unavailable' }), { status: 503 }));
  const response = await api.getSales({ page: 1, limit: 20 });
  expect(response.error).toBe('Database unavailable');
  expect(response.data).toBeUndefined();
  expect(response.metadata).toBeUndefined();
});
