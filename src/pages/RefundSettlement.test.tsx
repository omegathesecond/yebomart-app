import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ getReturns: vi.fn(), processReturn: vi.fn(), getCurrentCashSession: vi.fn(), closeCashSession: vi.fn(), getCashSessionZReport: vi.fn() }));
vi.mock('@/api/client', () => ({ api: mocks, default: mocks }));
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ shop: { name: 'Test shop', currency: 'SZL', currencySymbol: 'E' } }) }));
vi.mock('@/components/CustomerPicker', () => ({ CustomerPicker: () => null }));
import { Returns } from './Returns';
import { CashUp } from './CashUp';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getReturns.mockResolvedValue({ data: [{ id: 'return-1', reason: 'Wrong size', type: 'REFUND', status: 'APPROVED', refundAmount: 20, items: [], createdAt: '2026-10-26' }] });
  mocks.processReturn.mockResolvedValue({ data: {} });
});
describe('refund settlement UI', () => {
  it('requires explicit payout confirmation and sends the actual cash method', async () => {
    render(<Returns />);
    fireEvent.click(await screen.findByText('Wrong size'));
    const complete = screen.getByRole('button', { name: 'Complete Return & Restock' });
    expect(complete).toBeDisabled();
    expect(screen.getByText(/Requires an open till/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(complete).toBeEnabled();
    fireEvent.click(complete);
    await waitFor(() => expect(mocks.processReturn).toHaveBeenCalledWith('return-1', 'complete', { method: 'CASH', confirmed: true, reference: undefined }));
  });
  it('requires an external success reference, resets confirmation on method change and surfaces failures', async () => {
    mocks.processReturn.mockResolvedValue({ error: 'Till closed before confirmation' });
    render(<Returns />);
    fireEvent.click(await screen.findByText('Wrong size'));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText('Actual refund payment method'), { target: { value: 'CARD' } });
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    const complete = screen.getByRole('button', { name: 'Complete Return & Restock' });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(complete).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Successful refund reference'), { target: { value: 'refund-success' } });
    fireEvent.click(complete);
    await waitFor(() => expect(mocks.processReturn).toHaveBeenCalledWith('return-1', 'complete', { method: 'CARD', confirmed: true, reference: 'refund-success' }));
    expect(await screen.findByText('Till closed before confirmation')).toBeInTheDocument();
  });
  it('shows cash outflows in live cash-up and in both on-screen and printed Z reports', async () => {
    const session = { id: 'till', status: 'OPEN', openingFloat: 100, cashSalesTotal: 50, cashSalesCount: 1, cashRefundsTotal: 20, cashRefundsCount: 1, expectedCash: 130, openedAt: '2026-10-26T08:00:00Z' };
    const closed = { ...session, status: 'CLOSED', countedCash: 130, variance: 0, closedAt: '2026-10-26T17:00:00Z' };
    mocks.getCurrentCashSession.mockResolvedValue({ data: session });
    mocks.closeCashSession.mockResolvedValue({ data: closed });
    mocks.getCashSessionZReport.mockResolvedValue({ data: { session: closed, cashRefundsTotal: 20, cashRefundsCount: 1, transactionCount: 1, gross: 50, totalDiscount: 0, net: 50, tax: 0, totalAmount: 50, byPaymentMethod: [{ method: 'CASH', total: 50, count: 1 }] } });
    const { container } = render(<CashUp />);
    expect(await screen.findByText('Cash refunds paid')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '130' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cash up & close till' }));
    await waitFor(() => expect(mocks.closeCashSession).toHaveBeenCalledWith('till', 130, undefined));
    await screen.findByText('Z-Report');
    expect(screen.getAllByText('Cash refunds paid (1)')).toHaveLength(2);
    const printed = container.querySelector('#zreport-print') as HTMLElement;
    expect(within(printed).getByText('Cash refunds paid (1)').parentElement).toHaveTextContent('20.00');
    expect(within(printed).getByText('Expected cash').parentElement).toHaveTextContent('130.00');
  });
});
