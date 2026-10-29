import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api, { type CashSession, type CashSessionZReport } from '@/api/client';
import { CashUp } from './CashUp';
vi.mock('@/api/client', () => ({ default: { getCurrentCashSession: vi.fn(), getCashSessionHistory: vi.fn(), getCashSessionZReport: vi.fn() } }));
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ shop: { name: 'Test shop', currency: 'SZL' } }) }));
const session: CashSession = { id: 'old-shift', shopId: 'shop', userId: 'cashier', user: { id: 'cashier', name: 'Jane' }, status: 'CLOSED', openedAt: '2026-08-01T08:00:00Z', closedAt: '2026-08-01T17:00:00Z', openingFloat: 100, expectedCash: 120, countedCash: 115, variance: -5, notes: 'Saved note' };
const report: CashSessionZReport = { cashCollectionsTotal: null, cashCollectionsCount: null, session: { ...session, cashier: session.user }, cashRefundsTotal: 0, cashRefundsCount: 0, transactionCount: 1, gross: 20, totalDiscount: 0, net: 20, tax: 0, totalAmount: 20, byPaymentMethod: [] };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getCurrentCashSession).mockResolvedValue({ data: null });
  vi.mocked(api.getCashSessionHistory).mockResolvedValue({ data: { sessions: [session], pagination: { page: 1, totalPages: 1, hasNext: false, hasPrev: false } } });
  vi.mocked(api.getCashSessionZReport).mockResolvedValue({ data: report });
});
describe('saved cash-ups', () => {
  it('retrieves and prints a historical shift after fresh mounts', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    for (let i = 0; i < 2; i++) {
      const view = render(<CashUp />);
      fireEvent.click(await screen.findByText('View Z-report'));
      fireEvent.click(await screen.findByText('Print historical Z-report'));
      expect(api.getCashSessionZReport).toHaveBeenLastCalledWith('old-shift');
      expect(document.querySelector('#zreport-print')?.textContent).toContain('Saved note');
      expect(document.querySelector('#zreport-print')?.textContent).toContain('Jane');
      view.unmount();
    }
    expect(print).toHaveBeenCalledTimes(2);
  });
  it('surfaces history errors without claiming an empty history', async () => {
    vi.mocked(api.getCashSessionHistory).mockResolvedValue({ error: 'History unavailable' });
    render(<CashUp />);
    expect(await screen.findByRole('alert')).toHaveTextContent('History unavailable');
    expect(screen.queryByText('No till sessions match these filters.')).toBeNull();
  });
  it('resets pagination and sends date/status filters', async () => {
    render(<CashUp />);
    await screen.findByText('View Z-report');
    fireEvent.change(screen.getByLabelText('Opened from'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'OPEN' } });
    await waitFor(() => expect(api.getCashSessionHistory).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, status: 'OPEN', from: expect.stringContaining('2026-08-01') })));
  });
  it('shows empty results only after loading succeeds', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof api.getCashSessionHistory>>) => void;
    vi.mocked(api.getCashSessionHistory).mockReturnValue(new Promise(done => { resolve = done; }));
    render(<CashUp />);
    expect(await screen.findByText('Loading till history…')).toBeInTheDocument();
    expect(screen.queryByText('No till sessions match these filters.')).toBeNull();
    resolve({ data: { sessions: [], pagination: { page: 1, totalPages: 0, hasNext: false, hasPrev: false } } });
    expect(await screen.findByText('No till sessions match these filters.')).toBeInTheDocument();
  });

  it('clears the old printable report when another report request fails', async () => {
    render(<CashUp />);
    fireEvent.click(await screen.findByText('View Z-report'));
    await screen.findByText('Print historical Z-report');
    vi.mocked(api.getCashSessionZReport).mockResolvedValue({ error: 'Report unavailable' });
    fireEvent.click(screen.getByText('View Z-report'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Report unavailable');
    expect(screen.queryByText('Print historical Z-report')).toBeNull();
    expect(document.querySelector('#zreport-print')).toBeNull();
  });

});

for (const cashCollectionsTotal of [0, 100, null]) it(`shows saved collections ${cashCollectionsTotal} separately in on-screen and printed Z report`, async () => {
  vi.mocked(api.getCashSessionZReport).mockResolvedValue({ data: { ...report, cashCollectionsTotal, cashCollectionsCount: cashCollectionsTotal == null ? null : Number(cashCollectionsTotal > 0), session: { ...report.session, expectedCash: cashCollectionsTotal == null ? 250 : 250 + cashCollectionsTotal } } });
  render(<CashUp />);
  fireEvent.click(await screen.findByText('View Z-report'));
  await screen.findByText('Print historical Z-report');
  const labels = screen.getAllByText('Cash debt collections');
  expect(labels).toHaveLength(2);
  for (const label of labels) expect(label.parentElement).toHaveTextContent(cashCollectionsTotal == null ? 'Unknown attribution' : cashCollectionsTotal.toFixed(2));
  expect(document.querySelector('#zreport-print')?.textContent).toContain(cashCollectionsTotal == null ? '250.00' : (250 + cashCollectionsTotal).toFixed(2));
});
