import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';

// Mock the network boundary so the upload flow runs without a real API.
// Mirrors the vi.mock('@/api/client', ...) pattern in ProductForm.test.tsx.
vi.mock('@/api/client', () => ({
  api: {
    getExpenseSummary: vi.fn(),
    uploadImage: vi.fn(),
  },
}));

const mockAuthState = { user: { role: 'owner' }, authMode: 'owner' };
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => mockAuthState,
}));

const loadExpenses = vi.fn();
const addExpense = vi.fn();
const updateExpense = vi.fn();
const deleteExpense = vi.fn();
let mockExpenses: Record<string, unknown>[] = [];
vi.mock('@/stores/inventoryStore', () => ({
  useInventoryStore: () => ({
    expenses: mockExpenses,
    loadExpenses,
    addExpense,
    updateExpense,
    deleteExpense,
  }),
}));

import { api } from '@/api/client';
import { Expenses } from '@/pages/Expenses';

const getExpenseSummary = api.getExpenseSummary as unknown as Mock;
const uploadImage = api.uploadImage as unknown as Mock;

const RECEIPT = 'https://cdn.yebomart.com/expenses/receipt-1.jpg';

beforeEach(() => {
  vi.clearAllMocks();
  mockExpenses = [];
  loadExpenses.mockResolvedValue(undefined);
  addExpense.mockResolvedValue('new-expense-id');
  updateExpense.mockResolvedValue(undefined);
  getExpenseSummary.mockResolvedValue({ data: { thisMonth: 0, lastMonth: 0, count: 0, byCategory: {} } });
  // jsdom implements neither of these.
  URL.createObjectURL = vi.fn(() => 'blob:receipt-preview');
  URL.revokeObjectURL = vi.fn();
});

const makeFile = () => new File(['fake-bytes'], 'receipt.jpg', { type: 'image/jpeg' });

function selectReceipt() {
  fireEvent.change(screen.getByLabelText(/receipt photo/i), {
    target: { files: [makeFile()] },
  });
}

/** Render, wait for the initial load, then open the create modal. */
async function renderAndOpenCreate() {
  const view = render(<Expenses />);
  await waitFor(() => expect(getExpenseSummary).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: /record expense/i }));
  return view;
}

function setAmount(value: string) {
  fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value } });
}

describe('Expenses — attaching a receipt on create', () => {
  it('uploads the picked file and shows the stored receipt', async () => {
    uploadImage.mockResolvedValue({ data: { url: RECEIPT, key: 'expenses/receipt-1.jpg' } });

    await renderAndOpenCreate();
    selectReceipt();

    await waitFor(() => expect(uploadImage).toHaveBeenCalledTimes(1));
    expect(uploadImage.mock.calls[0][0]).toBeInstanceOf(File);

    await waitFor(() => {
      expect(screen.getByAltText(/receipt preview/i)).toHaveAttribute('src', RECEIPT);
    });
    expect(screen.getByRole('button', { name: /replace receipt/i })).toBeInTheDocument();
  });

  it('sends the uploaded url as receiptUrl on the create payload', async () => {
    uploadImage.mockResolvedValue({ data: { url: RECEIPT, key: 'expenses/receipt-1.jpg' } });

    await renderAndOpenCreate();
    selectReceipt();
    await waitFor(() => expect(screen.getByAltText(/receipt preview/i)).toBeInTheDocument());

    setAmount('250');
    fireEvent.click(screen.getByRole('button', { name: /^record$/i }));

    await waitFor(() => expect(addExpense).toHaveBeenCalledTimes(1));
    expect(addExpense.mock.calls[0][0]).toMatchObject({ amount: 250, receiptUrl: RECEIPT });
  });

  it('omits receiptUrl entirely when no receipt was attached', async () => {
    await renderAndOpenCreate();

    setAmount('80');
    fireEvent.click(screen.getByRole('button', { name: /^record$/i }));

    await waitFor(() => expect(addExpense).toHaveBeenCalledTimes(1));
    // The API's create schema rejects an empty-string uri, so it must be
    // absent rather than ''.
    expect(addExpense.mock.calls[0][0].receiptUrl).toBeUndefined();
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it('lets the user remove an attached receipt before saving', async () => {
    uploadImage.mockResolvedValue({ data: { url: RECEIPT, key: 'expenses/receipt-1.jpg' } });

    await renderAndOpenCreate();
    selectReceipt();
    await waitFor(() => expect(screen.getByAltText(/receipt preview/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /remove receipt/i }));
    expect(screen.queryByAltText(/receipt preview/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /attach receipt/i })).toBeInTheDocument();

    setAmount('80');
    fireEvent.click(screen.getByRole('button', { name: /^record$/i }));

    await waitFor(() => expect(addExpense).toHaveBeenCalledTimes(1));
    expect(addExpense.mock.calls[0][0].receiptUrl).toBeUndefined();
  });
});

describe('Expenses — a failed receipt upload fails loudly', () => {
  it('surfaces the API error and never fabricates a fallback url', async () => {
    uploadImage.mockResolvedValue({ error: 'Image storage (R2) is not configured' });

    await renderAndOpenCreate();
    selectReceipt();

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(
        alerts.some((a) => a.textContent?.includes('Image storage (R2) is not configured')),
      ).toBe(true);
    });

    // No preview, no "Replace" — the control is back to its empty state.
    expect(screen.queryByAltText(/receipt preview/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /attach receipt/i })).toBeInTheDocument();

    // ...and saving does NOT smuggle a fake url through.
    setAmount('40');
    fireEvent.click(screen.getByRole('button', { name: /^record$/i }));
    await waitFor(() => expect(addExpense).toHaveBeenCalledTimes(1));
    expect(addExpense.mock.calls[0][0].receiptUrl).toBeUndefined();
  });

  it('falls back to a generic message when the API returns no error text', async () => {
    uploadImage.mockResolvedValue({ data: undefined });

    await renderAndOpenCreate();
    selectReceipt();

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.some((a) => a.textContent?.includes('Failed to upload receipt'))).toBe(true);
    });
  });
});

describe('Expenses — receipts on an existing expense (update)', () => {
  const existing = {
    id: 'exp-1',
    shopId: 'shop-1',
    category: 'supplies',
    amount: 120,
    description: 'Till rolls',
    date: new Date('2026-08-20T00:00:00.000Z'),
    createdAt: new Date('2026-08-20T00:00:00.000Z'),
  };

  async function renderAndEditFirst() {
    render(<Expenses />);
    await waitFor(() => expect(getExpenseSummary).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole('button', { name: /edit supplies expense/i }));
  }

  it('attaches a receipt to an expense that had none', async () => {
    mockExpenses = [{ ...existing }];
    uploadImage.mockResolvedValue({ data: { url: RECEIPT, key: 'expenses/receipt-1.jpg' } });

    await renderAndEditFirst();
    // The form is prefilled from the row being edited.
    expect(screen.getByPlaceholderText('0.00')).toHaveValue(120);

    selectReceipt();
    await waitFor(() => expect(screen.getByAltText(/receipt preview/i)).toHaveAttribute('src', RECEIPT));

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(updateExpense).toHaveBeenCalledTimes(1));
    expect(updateExpense.mock.calls[0][0]).toBe('exp-1');
    expect(updateExpense.mock.calls[0][1]).toMatchObject({ amount: 120, receiptUrl: RECEIPT });
    expect(addExpense).not.toHaveBeenCalled();
  });

  it("sends receiptUrl: '' when an existing receipt is removed, so it actually clears", async () => {
    mockExpenses = [{ ...existing, receiptUrl: RECEIPT }];

    await renderAndEditFirst();
    // The already-attached receipt shows in the form.
    expect(screen.getByAltText(/receipt preview/i)).toHaveAttribute('src', RECEIPT);

    fireEvent.click(screen.getByRole('button', { name: /remove receipt/i }));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(updateExpense).toHaveBeenCalledTimes(1));
    expect(updateExpense.mock.calls[0][1]).toMatchObject({ receiptUrl: '' });
  });

  it('keeps an untouched receipt attached when other fields are edited', async () => {
    mockExpenses = [{ ...existing, receiptUrl: RECEIPT }];

    await renderAndEditFirst();
    setAmount('999');
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(updateExpense).toHaveBeenCalledTimes(1));
    expect(updateExpense.mock.calls[0][1]).toMatchObject({ amount: 999, receiptUrl: RECEIPT });
  });
});

describe('Expenses — receipt visible in the list', () => {
  const base = {
    id: 'exp-1',
    shopId: 'shop-1',
    category: 'transport',
    amount: 60,
    description: 'Fuel',
    date: new Date('2026-08-20T00:00:00.000Z'),
    createdAt: new Date('2026-08-20T00:00:00.000Z'),
  };

  it('renders a thumbnail linking to the full receipt', async () => {
    mockExpenses = [{ ...base, receiptUrl: RECEIPT }];

    render(<Expenses />);
    await waitFor(() => expect(getExpenseSummary).toHaveBeenCalled());

    const link = await screen.findByTitle('View receipt');
    expect(link).toHaveAttribute('href', RECEIPT);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(within(link).getByRole('img')).toHaveAttribute('src', RECEIPT);
  });

  it('renders no thumbnail for an expense without a receipt', async () => {
    mockExpenses = [{ ...base }];

    render(<Expenses />);
    await waitFor(() => expect(getExpenseSummary).toHaveBeenCalled());
    await screen.findByText('Fuel');

    expect(screen.queryByTitle('View receipt')).not.toBeInTheDocument();
  });
});
