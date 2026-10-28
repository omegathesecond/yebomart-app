import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sales } from './Sales';
import api from '@/api/client';
import type { Sale } from '@/types';

vi.mock('@/api/client', () => ({ default: { getSales: vi.fn(), searchSaleByReceipt: vi.fn(), getSale: vi.fn(), sendReceiptEmail: vi.fn() } }));
const shop = { id: 'shop', name: 'Test shop' };
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ shop }) }));
const sales: Sale[] = Array.from({ length: 65 }, (_, index) => ({
  id: `sale-${index}`, shopId: 'shop', userId: 'user', receiptNumber: `RCP-${index.toString().padStart(4, '0')}`,
  subtotal: 10, discount: 0, totalAmount: 10, paymentMethod: 'CASH', items: [],
  createdAt: new Date(2026, 9, 28 - Math.floor(index / 15), 12),
}));
function mount() { return render(<MemoryRouter><Sales /></MemoryRouter>); }
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 28, 14));
  vi.mocked(api.getSales).mockImplementation(async params => {
    const matching = sales.filter(sale => (!params?.startDate || sale.createdAt >= new Date(params.startDate)) && (!params?.endDate || sale.createdAt <= new Date(params.endDate)));
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    return { data: matching.slice((page - 1) * limit, page * limit), metadata: { total: matching.length, page, limit, hasPrev: page > 1, hasNext: page * limit < matching.length } };
  });
});

afterEach(() => vi.useRealTimers());

describe('server sales history', () => {
  it('navigates beyond 50 sales and resets to page one when dates change', async () => {
    mount();
    await screen.findByText('RCP-0000');
    fireEvent.click(screen.getByRole('button', { name: 'All Time' }));
    await screen.findByText(/65 matching sales/);
    for (let page = 2; page <= 4; page++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      await screen.findByText(`RCP-${((page - 1) * 20).toString().padStart(4, '0')}`);
    }
    expect(screen.getByText('RCP-0064')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByText(/cover this page only/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    await waitFor(() => expect(api.getSales).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, startDate: expect.any(String), endDate: expect.any(String) })));
    expect(screen.queryByText('RCP-0064')).not.toBeInTheDocument();
  });


  it('ignores an older date request that finishes after the current request', async () => {
    let finish!: (result: { error: string }) => void;
    vi.mocked(api.getSales).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'All Time' }));
    await screen.findByText(/65 matching sales/);
    finish({ error: 'Obsolete request failed' });
    await waitFor(() => expect(screen.queryByText('Obsolete request failed')).not.toBeInTheDocument());
    expect(screen.getByText(/65 matching sales/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('RCP-0020');
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    await screen.findByText('RCP-0000');
  });

  it('sends local calendar bounds for this week and this month', async () => {
    mount();
    await screen.findByText('RCP-0000');
    fireEvent.click(screen.getByRole('button', { name: 'This Week' }));
    await waitFor(() => expect(api.getSales).toHaveBeenLastCalledWith({ page: 1, limit: 20,
      startDate: new Date(2026, 9, 26).toISOString(), endDate: new Date(2026, 9, 28, 23, 59, 59, 999).toISOString(),
    }));
    fireEvent.click(screen.getByRole('button', { name: 'This Month' }));
    await waitFor(() => expect(api.getSales).toHaveBeenLastCalledWith({ page: 1, limit: 20,
      startDate: new Date(2026, 9, 1).toISOString(), endDate: new Date(2026, 9, 28, 23, 59, 59, 999).toISOString(),
    }));
  });

  it('reopens a historic receipt after a fresh mount and preserves receipt actions', async () => {
    vi.mocked(api.searchSaleByReceipt).mockResolvedValue({ data: { id: sales[64].id, receiptNumber: 'RCP-0064', totalAmount: 10, paymentMethod: 'CASH', items: [], createdAt: sales[64].createdAt.toISOString() } });
    vi.mocked(api.getSale).mockResolvedValue({ data: sales[64] });
    mount();
    fireEvent.change(screen.getByRole('textbox', { name: 'Receipt number' }), { target: { value: 'RCP-0064' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find receipt' }));
    expect(await screen.findByText('Receipt #: RCP-0064')).toBeInTheDocument();
    expect(api.getSale).toHaveBeenCalledWith('sale-64');
    for (const name of ['Print', 'Email', 'WhatsApp']) expect(screen.getByRole('button', { name })).toBeEnabled();
  });

  it('shows loading and request failure with retry, never a false empty state', async () => {
    let finish!: (result: { error: string }) => void;
    vi.mocked(api.getSales).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    mount();
    expect(screen.getByRole('status')).toHaveTextContent('Loading sales');
    finish({ error: 'Sales service unavailable' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Sales service unavailable');
    expect(screen.queryByText('No sales for this period')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('RCP-0000');
  });

  it('shows a true empty result and receipt lookup errors with retry', async () => {
    vi.mocked(api.getSales).mockResolvedValue({ data: [], metadata: { total: 0, page: 1, limit: 20, hasNext: false, hasPrev: false } });
    vi.mocked(api.searchSaleByReceipt).mockResolvedValue({ error: 'Receipt not found' });
    mount();
    await screen.findByText('No sales for this period');
    fireEvent.change(screen.getByRole('textbox', { name: 'Receipt number' }), { target: { value: 'missing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find receipt' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Receipt not found');
    fireEvent.click(screen.getByRole('button', { name: 'Retry receipt lookup' }));
    await waitFor(() => expect(api.searchSaleByReceipt).toHaveBeenCalledTimes(2));
  });
});
