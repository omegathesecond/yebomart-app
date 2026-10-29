import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ getCustomers: vi.fn(), getCustomer: vi.fn(), addCustomerCredit: vi.fn() }));
vi.mock('@/api/client', () => ({ api: mocks }));
import { Customers } from './Customers';
const customer = { id: 'customer-1', name: 'Retail customer', balance: 500, creditLimit: 0, credits: [], sales: [] };
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear();
  mocks.getCustomers.mockResolvedValue({ data: { customers: [customer], totalOwed: 500 } });
  mocks.getCustomer.mockResolvedValue({ data: customer });
  mocks.addCustomerCredit.mockResolvedValue({ data: { credit: {}, newBalance: 400 } });
});
async function open() {
  fireEvent.click(await screen.findByText('Retail customer'));
  fireEvent.click(await screen.findByRole('button', { name: 'Record Payment' }));
}
describe('customer debt collection', () => {
  for (const method of ['CASH', 'EXTERNAL_NONCASH']) it(`requires explicit selection and sends ${method} with a stable retry key`, async () => {
    render(<Customers />); await open();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '100' } });
    const submit = screen.getAllByRole('button', { name: 'Record Payment' }).at(-1)!;
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Payment received as'), { target: { value: method } });
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.addCustomerCredit).toHaveBeenCalledWith('customer-1', expect.objectContaining({ type: 'PAYMENT', amount: 100, collectionMethod: method, collectionKey: expect.any(String) })));
    await waitFor(() => expect(sessionStorage.getItem('customer-collection:customer-1')).toBeNull());
  });
  it('surfaces till-close failures and retries the same entry after remount without double submit', async () => {
    let resolve!: (value: { error: string }) => void;
    mocks.addCustomerCredit.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const view = render(<Customers />); await open();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Payment received as'), { target: { value: 'CASH' } });
    const submit = screen.getAllByRole('button', { name: 'Record Payment' }).at(-1)!;
    fireEvent.click(submit); fireEvent.click(submit);
    expect(mocks.addCustomerCredit).toHaveBeenCalledTimes(1);
    const first = mocks.addCustomerCredit.mock.calls[0];
    resolve({ error: 'Open a till before collecting cash' });
    expect(await screen.findByText('Open a till before collecting cash')).toBeInTheDocument();
    expect(screen.getByLabelText('Payment received as')).toBeDisabled();
    view.unmount(); render(<Customers />); await open();
    expect(screen.getByLabelText('Amount')).toHaveValue(100);
    expect(screen.getByLabelText('Payment received as')).toHaveValue('CASH');
    fireEvent.click(screen.getAllByRole('button', { name: 'Record Payment' }).at(-1)!);
    await waitFor(() => expect(mocks.addCustomerCredit).toHaveBeenCalledTimes(2));
    expect(mocks.addCustomerCredit.mock.calls[1]).toEqual(first);
  });
  it('shows thrown dependency errors and leaves a retryable entry', async () => {
    mocks.addCustomerCredit.mockRejectedValueOnce(new Error('Connection interrupted'));
    render(<Customers />); await open();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Payment received as'), { target: { value: 'EXTERNAL_NONCASH' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Record Payment' }).at(-1)!);
    expect(await screen.findByText('Connection interrupted')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Record Payment' }).at(-1)!).toBeEnabled();
  });
  it('keeps adjustments outside the collection flow and labels historical payments unknown', async () => {
    mocks.getCustomer.mockResolvedValue({ data: { ...customer, credits: [{ id: 'old', type: 'PAYMENT', amount: 20, createdAt: '2026-10-28', collectionMethod: null }] } });
    render(<Customers />); await open();
    expect(screen.getByText('Payment · Unknown payment attribution')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Entry type'), { target: { value: 'ADJUSTMENT' } });
    expect(screen.queryByLabelText('Payment received as')).toBeNull();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record Adjustment' }));
    await waitFor(() => expect(mocks.addCustomerCredit).toHaveBeenCalledWith('customer-1', { type: 'ADJUSTMENT', amount: -20, note: undefined }));
  });
});

it('does not submit when browser storage cannot retain the retry key', async () => {
  render(<Customers />); await open();
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '100' } });
  fireEvent.change(screen.getByLabelText('Payment received as'), { target: { value: 'CASH' } });
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  try {
    fireEvent.click(screen.getAllByRole('button', { name: 'Record Payment' }).at(-1)!);
    expect(await screen.findByText(/Enable browser storage/)).toBeInTheDocument();
    expect(mocks.addCustomerCredit).not.toHaveBeenCalled();
  } finally { storage.mockRestore(); }
});
