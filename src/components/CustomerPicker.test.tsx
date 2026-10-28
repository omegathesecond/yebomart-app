import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CustomerPicker } from './CustomerPicker';
import { api } from '@/api/client';

vi.mock('@/api/client', () => ({ api: { getCustomers: vi.fn(), createCustomer: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getCustomers).mockResolvedValue({ data: { customers: [], totalOwed: 0 } });
});

describe('customer picker sessions', () => {
  it('starts a fresh search after closing an unfinished customer form', async () => {
    const props = { isOpen: true, onClose: vi.fn(), onSelect: vi.fn() };
    const { rerender } = render(<CustomerPicker {...props} />);
    await screen.findByText('No customers found');
    fireEvent.change(screen.getByPlaceholderText('Search by name or phone...'), { target: { value: 'Alice' } });
    fireEvent.click(screen.getByRole('button', { name: 'New Customer' }));
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();

    rerender(<CustomerPicker {...props} isOpen={false} />);
    rerender(<CustomerPicker {...props} />);
    expect(screen.getByPlaceholderText('Search by name or phone...')).toHaveValue('');
    expect(screen.queryByDisplayValue('Alice')).not.toBeInTheDocument();
    await screen.findByText('No customers found');
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it('shows a failed customer request through the error channel', async () => {
    vi.mocked(api.getCustomers).mockResolvedValue({ error: 'Customer service unavailable' });
    render(<CustomerPicker isOpen onClose={vi.fn()} onSelect={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Customer service unavailable');
  });
});
