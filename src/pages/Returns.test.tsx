import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Returns } from './Returns';
import type { ReturnSale as Sale, Return } from '@/api/models';
import { api } from '@/api/client';
const creditSale: Sale = {
  id: 'sale', customerId: 'debtor', paymentMethod: 'CREDIT', totalAmount: 100,
  receiptNumber: 'R1', createdAt: '2026-10-26', items: [],
};

vi.mock('@/api/client', () => ({ api: {
  getReturns: vi.fn(), processReturn: vi.fn(), searchSaleByReceipt: vi.fn(), getReturnEntitlement: vi.fn(), createReturn: vi.fn(),
} }));
vi.mock('@/components/CustomerPicker', () => ({ CustomerPicker: ({ onSelect }: { onSelect: (customer: { id: string; name: string }) => void }) => <button onClick={() => onSelect({ id: 'recipient', name: 'Recipient' })}>Pick recipient</button> }));
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


describe('paid-sale store-credit completion', () => {
  const approvedReturn: Return = {
    id: 'return', saleId: 'sale', customerId: 'recipient',
    customer: { id: 'recipient', name: 'Retail customer' },
    type: 'STORE_CREDIT', status: 'APPROVED', reason: 'Damaged item',
    refundAmount: 50, items: [], createdAt: '2026-10-26',
  };
  it('keeps the detail open and reports failure when completion has no persisted ledger entry', async () => {
    vi.mocked(api.getReturns).mockResolvedValue({ data: [approvedReturn] });
    vi.mocked(api.processReturn).mockResolvedValue({ data: { ...approvedReturn, status: 'COMPLETED' } satisfies Return });
    render(<Returns />);
    fireEvent.click(await screen.findByText('Damaged item'));
    expect(screen.getByText('Retail customer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Complete Return & Restock' }));
    expect(await screen.findByText(/Store credit posting was not confirmed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Complete Return & Restock' })).toBeInTheDocument();
    expect(screen.queryByText(/Store credit of/)).not.toBeInTheDocument();
  });
  it('confirms paid-sale account credit only after the ledger entry is returned', async () => {
    vi.mocked(api.getReturns).mockResolvedValue({ data: [approvedReturn] });
    vi.mocked(api.processReturn).mockResolvedValue({ data: {
      ...approvedReturn, status: 'COMPLETED', creditReversal: { id: 'entry', returnId: 'return', customerId: 'recipient', amount: 50 },
    } satisfies Return });
    render(<Returns />);
    fireEvent.click(await screen.findByText('Damaged item'));
    fireEvent.click(screen.getByRole('button', { name: 'Complete Return & Restock' }));
    expect(await screen.findByText(/Store credit of .* posted to the customer account/)).toBeInTheDocument();
    expect(screen.queryByText(/Repayments retained/)).not.toBeInTheDocument();
  });
});

describe('paid-sale store credit', () => {
  it('requires a recipient before creating the return', async () => {
    vi.mocked(api.searchSaleByReceipt).mockResolvedValue({ data: {
      ...creditSale, id: 'paid-sale', customerId: undefined, paymentMethod: 'CASH', totalAmount: 100,
      receiptNumber: 'R2', createdAt: '2026-10-26',
    } satisfies Sale });
    vi.mocked(api.createReturn).mockResolvedValue({ error: 'Posting unavailable' });
    render(<Returns />);
    fireEvent.click(screen.getByRole('button', { name: 'New Return' }));
    const search = screen.getByPlaceholderText('e.g., RCP-260212-0001 or just 0001');
    fireEvent.change(search, { target: { value: 'R2' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    fireEvent.click(await screen.findByText('Tea'));
    fireEvent.click(screen.getByRole('button', { name: 'Store Credit' }));
    fireEvent.change(screen.getByPlaceholderText(/Customer changed mind/), { target: { value: 'Returned goods' } });
    expect(screen.getByRole('button', { name: 'Create Return' })).toBeDisabled();
    fireEvent.click(screen.getByText('Pick recipient'));
    fireEvent.click(screen.getByRole('button', { name: 'Create Return' }));
    await waitFor(() => expect(api.createReturn).toHaveBeenCalledWith(expect.objectContaining({ saleId: 'paid-sale', customerId: 'recipient', type: 'STORE_CREDIT' })));
    expect(await screen.findByText('Posting unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Return created')).not.toBeInTheDocument();
  });
});
