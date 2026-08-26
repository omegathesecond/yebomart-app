import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// Mock the network boundary so the accounts-payable rendering can be exercised
// without a real API. Mirrors the vi.mock('@/api/client', ...) pattern used in
// src/pages/AuditLog.test.tsx.
vi.mock('@/api/client', () => ({
  api: {
    getPurchaseOrders: vi.fn(),
    getSuppliers: vi.fn(),
    getPurchaseOrder: vi.fn(),
    getPurchaseOrderPayments: vi.fn(),
    recordSupplierPayment: vi.fn(),
    receivePurchaseOrder: vi.fn(),
    createPurchaseOrder: vi.fn(),
  },
}));

// Recording a payment is managerAuth on the API, so the page gates the button
// on owner/manager. Default the suite to an owner and override where it matters.
let mockAuthState: { user: { role: string } | null; authMode: 'owner' | 'staff' | null } = {
  user: { role: 'owner' },
  authMode: 'owner',
};
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => mockAuthState,
}));

vi.mock('@/stores/inventoryStore', () => ({
  useInventoryStore: () => ({ products: [], loadAll: vi.fn() }),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ state: null }),
  useNavigate: () => vi.fn(),
}));

import { api } from '@/api/client';
import { PurchaseOrders } from '@/pages/PurchaseOrders';

const getPurchaseOrders = api.getPurchaseOrders as unknown as Mock;
const getSuppliers = api.getSuppliers as unknown as Mock;
const getPurchaseOrder = api.getPurchaseOrder as unknown as Mock;
const getPurchaseOrderPayments = api.getPurchaseOrderPayments as unknown as Mock;
const recordSupplierPayment = api.recordSupplierPayment as unknown as Mock;

type PoOverrides = Partial<{
  id: string;
  orderNumber: string;
  status: 'DRAFT' | 'SENT' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED';
  amountReceived: number;
  amountPaid: number;
}>;

const makePo = (overrides: PoOverrides = {}) => ({
  id: 'po-1',
  orderNumber: 'PO-0001',
  supplierId: 'sup-1',
  status: 'DRAFT' as const,
  subtotal: 500,
  tax: 0,
  totalAmount: 500,
  amountReceived: 0,
  amountPaid: 0,
  orderDate: '2026-08-20T00:00:00.000Z',
  supplier: { id: 'sup-1', name: 'Acme Wholesale' },
  items: [],
  _count: { items: 2 },
  ...overrides,
});

/** The payable panel's two <p> lines in the detail modal (list card uses spans). */
const paidLine = () => screen.queryAllByText(/^Paid E/, { selector: 'p' });
const balanceLine = () => screen.queryAllByText(/ due$|^Settled$/, { selector: 'p' });

/** Render the page and open the detail modal for the seeded PO. */
async function openDetail(po: ReturnType<typeof makePo>) {
  getPurchaseOrders.mockResolvedValue({ data: [po] });
  getSuppliers.mockResolvedValue({ data: [{ id: 'sup-1', name: 'Acme Wholesale' }] });
  getPurchaseOrder.mockResolvedValue({ data: po });
  getPurchaseOrderPayments.mockResolvedValue({ data: [] });

  render(<PurchaseOrders />);
  await waitFor(() => expect(screen.getByText('PO-0001')).toBeInTheDocument());
  fireEvent.click(screen.getByText('PO-0001'));
  await waitFor(() => expect(getPurchaseOrder).toHaveBeenCalledWith('po-1'));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthState = { user: { role: 'owner' }, authMode: 'owner' };
});

describe('PurchaseOrders — accounts payable', () => {
  it('hides the payable panel for a PO that has not been received', async () => {
    // Nothing is billed until stock is received, so showing "Paid E0.00 of
    // E0.00 / Settled" here would claim a debt is settled that never existed.
    await openDetail(makePo({ status: 'DRAFT', amountReceived: 0, amountPaid: 0 }));

    // The supplier name renders on both the list card and the detail modal —
    // two occurrences means the modal is open.
    await waitFor(() => expect(screen.getAllByText('Acme Wholesale')).toHaveLength(2));
    expect(paidLine()).toHaveLength(0);
    expect(balanceLine()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Record Payment' })).toBeNull();
  });

  it('shows amount received, amount paid and balance due once the PO is received', async () => {
    await openDetail(makePo({ status: 'PARTIAL', amountReceived: 500, amountPaid: 200 }));

    await waitFor(() => expect(paidLine()).toHaveLength(1));
    expect(paidLine()[0]).toHaveTextContent('Paid E200.00 of E500.00');
    expect(balanceLine()[0]).toHaveTextContent('E300.00 due');
    expect(screen.getByRole('button', { name: 'Record Payment' })).toBeInTheDocument();
  });

  it('shows Settled and no Record Payment action once the balance is cleared', async () => {
    await openDetail(makePo({ status: 'RECEIVED', amountReceived: 500, amountPaid: 500 }));

    await waitFor(() => expect(paidLine()).toHaveLength(1));
    expect(balanceLine()[0]).toHaveTextContent('Settled');
    expect(screen.queryByRole('button', { name: 'Record Payment' })).toBeNull();
  });

  it('hides the Record Payment action from staff who cannot manage', async () => {
    mockAuthState = { user: { role: 'cashier' }, authMode: 'staff' };
    await openDetail(makePo({ status: 'PARTIAL', amountReceived: 500, amountPaid: 200 }));

    await waitFor(() => expect(paidLine()).toHaveLength(1));
    expect(screen.queryByRole('button', { name: 'Record Payment' })).toBeNull();
  });
});

describe('PurchaseOrders — recording a supplier payment', () => {
  /** Open the detail modal on a PO with E300.00 outstanding, then the payment modal. */
  async function openPaymentModal() {
    await openDetail(makePo({ status: 'PARTIAL', amountReceived: 500, amountPaid: 200 }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Record Payment' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }));
    await waitFor(() => expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument());
  }

  /** The modal's submit button — the detail modal's trigger shares its label. */
  const submitButton = () => {
    const buttons = screen.getAllByRole('button', { name: 'Record Payment' });
    return buttons[buttons.length - 1];
  };

  it('blocks an over-limit amount client-side before any request', async () => {
    await openPaymentModal();

    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '400' } });

    await waitFor(() =>
      expect(screen.getByText(/exceeds the 300 balance due/)).toBeInTheDocument(),
    );
    expect(submitButton()).toBeDisabled();
    expect(recordSupplierPayment).not.toHaveBeenCalled();
  });

  it("surfaces the server's rejection message rather than a generic failure", async () => {
    // A concurrent payment can make the client's balance stale, so the server
    // stays the source of truth — its message must reach the user verbatim.
    recordSupplierPayment.mockResolvedValue({
      error: 'Payment of 100 exceeds the balance due of 50',
    });
    await openPaymentModal();

    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '100' } });
    fireEvent.click(submitButton());

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Payment of 100 exceeds the balance due of 50',
      ),
    );
    expect(recordSupplierPayment).toHaveBeenCalledWith('po-1', { amount: 100, note: undefined });
  });

  it('refreshes the PO and the list after a successful payment', async () => {
    recordSupplierPayment.mockResolvedValue({
      data: makePo({ status: 'PARTIAL', amountReceived: 500, amountPaid: 300 }),
    });
    await openPaymentModal();

    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '100' } });
    fireEvent.change(screen.getByPlaceholderText(/Optional/), { target: { value: 'EFT 4471' } });
    fireEvent.click(submitButton());

    await waitFor(() =>
      expect(recordSupplierPayment).toHaveBeenCalledWith('po-1', {
        amount: 100,
        note: 'EFT 4471',
      }),
    );
    // No full page reload: the detail modal re-fetches and the list refreshes.
    await waitFor(() => expect(getPurchaseOrder).toHaveBeenCalledTimes(2));
    expect(getPurchaseOrders.mock.calls.length).toBeGreaterThan(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Payment of E100.00 recorded');
  });
});
