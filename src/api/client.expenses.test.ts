import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/yeboid', () => ({ getAccessToken: vi.fn(), clearTokens: vi.fn() }));
import { useInventoryStore } from '@/stores/inventoryStore';
import * as yeboid from '@/lib/yeboid';

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  vi.mocked(yeboid.getAccessToken).mockResolvedValue('manager-token');
  vi.stubGlobal('fetch', vi.fn());
});
for (const fundingSource of ['TILL_CASH', 'OUTSIDE_TILL'] as const) it(`sends ${fundingSource} membership/key through the real store and client and maps the returned expense`, async () => {
  const date = new Date('2026-10-29T12:00:00Z');
  const expense = { id: 'expense', shopId: 'shop', category: 'TRANSPORT', amount: 50, date: date.toISOString(), createdAt: date.toISOString(),
    fundingSource, cashSessionId: fundingSource === 'TILL_CASH' ? 'till' : null, submissionKey: 'f96a3d76-e2aa-4dce-9eaa-0d5b6d055635' };
  vi.mocked(fetch).mockImplementation(async (_url, options) => new Response(JSON.stringify({ data: options?.method === 'POST' ? expense : { expenses: [expense], totals: {}, pagination: { page: 1 } } }), { status: 200 }));
  await useInventoryStore.getState().addExpense({ ...expense, category: 'transport', date });
  const sent = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
  expect(sent).toMatchObject({ category: 'TRANSPORT', amount: 50, fundingSource, date: date.toISOString(), submissionKey: expense.submissionKey });
  if (fundingSource === 'TILL_CASH') expect(sent.cashSessionId).toBe('till');
  else expect(sent.cashSessionId).toBeUndefined();
  expect(useInventoryStore.getState().expenses[0]).toMatchObject({ fundingSource, cashSessionId: expense.cashSessionId, submissionKey: expense.submissionKey });
});

for (const code of ['EXPENSE_PAYOUT_NOT_RECORDED', undefined]) it(`preserves only the API error code (${code}) through client and store`, async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ success: false, message: 'Payout failed', code }), { status: code ? 409 : 500 }));
  await expect(useInventoryStore.getState().addExpense({ shopId: 'shop', category: 'transport', amount: 50,
    date: new Date(), fundingSource: 'TILL_CASH', cashSessionId: 'till', submissionKey: crypto.randomUUID(),
  })).rejects.toMatchObject({ message: 'Payout failed', code });
  expect(fetch).toHaveBeenCalledOnce();
});
