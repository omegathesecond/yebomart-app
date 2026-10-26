import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Returns } from './Returns';
import { api } from '@/api/client';
import type { Sale } from '@/types';

const creditSale = {
  id: 'sale', customerId: 'debtor', paymentMethod: 'CREDIT', totalAmount: 100,
  receiptNumber: 'R1', createdAt: '2026-10-26',
} satisfies Pick<Sale, 'id' | 'paymentMethod' | 'totalAmount' | 'receiptNumber'> & {
  customerId: string;
  createdAt: string;
};

vi.mock('@/api/client', () => ({ api: {
  getReturns: vi.fn(), searchSaleByReceipt: vi.fn(), getReturnEntitlement: vi.fn(), createReturn: vi.fn(),
} }));
vi.mock('@/components/CustomerPicker', () => ({ CustomerPicker: () => null }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getReturns).mockResolvedValue({ data: [] });
  vi.mocked(api.searchSaleByReceipt).mockResolvedValue({ data: creditSale });
  vi.mocked(api.getReturnEntitlement).mockResolvedValue({ data: [{ productId: 'product', productName: 'Tea', remainingQuantity: 5, remainingCents: 10000 }] });
});
describe('pay-later return choices', () => {
  it('explains account credit, disables cash/exchange and preserves the debtor on submission', async () => {
    vi.mocked(api.createReturn).mockResolvedValue({ error: 'Account needs reconciliation' });
    render(<Returns />);
    fireEvent.click(screen.getByRole('button', { name: 'New Return' }));
    const search = screen.getByPlaceholderText('e.g., RCP-260212-0001 or just 0001');
    fireEvent.change(search, { target: { value: 'R1' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(await screen.findByText(/Repayments stay on the account/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refund' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Exchange' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Adjust account' })).toBeEnabled();
    expect(screen.queryByText('Attach customer')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Tea'));
    fireEvent.change(screen.getByPlaceholderText(/Customer changed mind/), { target: { value: 'Returned goods' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Return' }));
    await waitFor(() => expect(api.createReturn).toHaveBeenCalledWith(expect.objectContaining({ saleId: 'sale', customerId: 'debtor', type: 'STORE_CREDIT', refundAmount: 0 })));
    expect(await screen.findByText('Account needs reconciliation')).toBeInTheDocument();
    expect(screen.queryByText('Return created')).not.toBeInTheDocument();
  });
});
