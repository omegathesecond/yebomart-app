import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock the network boundary so the page's loading/populated/empty branching
// is tested without a real API. Mirrors the vi.mock('@/api/client', ...)
// pattern used in src/stores/cartStore.test.ts.
vi.mock('@/api/client', () => ({
  api: { getAuditLogs: vi.fn(), getStaff: vi.fn() },
  AUDIT_ACTIONS: [
    'LOGIN',
    'LOGOUT',
    'PRODUCT_CREATE',
    'PRODUCT_UPDATE',
    'PRODUCT_DELETE',
    'SALE_CREATE',
    'SALE_VOID',
    'STOCK_ADJUST',
    'STOCK_RECEIVE',
    'USER_CREATE',
    'USER_UPDATE',
    'USER_DELETE',
    'EXPENSE_CREATE',
    'EXPENSE_DELETE',
    'SETTINGS_UPDATE',
    'LICENSE_APPLY',
  ],
}));

let mockAuthState: { user: { role: string } | null; authMode: 'owner' | 'staff' | null } = {
  user: { role: 'owner' },
  authMode: 'owner',
};
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => mockAuthState,
}));

import { api } from '@/api/client';
import { AuditLog } from '@/pages/AuditLog';

const getAuditLogs = api.getAuditLogs as unknown as Mock;
const getStaff = api.getStaff as unknown as Mock;

const SAMPLE_LOGS = [
  {
    id: 'log-1',
    shopId: 'shop-1',
    userId: 'user-1',
    action: 'SALE_VOID',
    entityType: 'sale',
    entityId: 'sale-1',
    details: { reason: 'wrong item' },
    ipAddress: null,
    createdAt: '2026-08-20T10:00:00.000Z',
    user: { name: 'Jane Cashier', role: 'cashier' },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthState = { user: { role: 'owner' }, authMode: 'owner' };
  getStaff.mockResolvedValue({ data: [{ id: 'user-1', name: 'Jane Cashier' }] });
});

describe('AuditLog', () => {
  it('shows a loading state before the request resolves', () => {
    getAuditLogs.mockReturnValue(new Promise(() => {})); // never resolves

    render(<AuditLog />);

    expect(screen.getByText(/loading audit log/i)).toBeInTheDocument();
  });

  it('renders a populated list of audit entries', async () => {
    getAuditLogs.mockResolvedValue({
      data: {
        logs: SAMPLE_LOGS,
        pagination: { page: 1, limit: 25, total: 1, pages: 1 },
      },
    });

    render(<AuditLog />);

    await waitFor(() => {
      expect(screen.getAllByText('Jane Cashier').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Sale Voided').length).toBeGreaterThan(0);
    expect(screen.queryByText(/no audit entries found/i)).not.toBeInTheDocument();
  });

  it('renders an empty state when there are no audit entries', async () => {
    getAuditLogs.mockResolvedValue({
      data: {
        logs: [],
        pagination: { page: 1, limit: 25, total: 0, pages: 0 },
      },
    });

    render(<AuditLog />);

    await waitFor(() => {
      expect(screen.getByText(/no audit entries found/i)).toBeInTheDocument();
    });
  });

  it('does not call the API and shows an owner-only message for non-owners', () => {
    mockAuthState = { user: { role: 'cashier' }, authMode: 'staff' };

    render(<AuditLog />);

    expect(screen.getByText(/owners only/i)).toBeInTheDocument();
    expect(getAuditLogs).not.toHaveBeenCalled();
  });
});
