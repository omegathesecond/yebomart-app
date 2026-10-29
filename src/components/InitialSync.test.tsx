import { beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('@/api/client', () => ({ default: { getProducts: vi.fn(), getSales: vi.fn(), getStaff: vi.fn(), listExpenses: vi.fn() } }));
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ shop: { id: 'shop' }, user: { id: 'owner' }, authMode: 'owner', isAuthenticated: true }) }));
import api from '@/api/client';
import { InitialSync } from './InitialSync';
import { useInventoryStore } from '@/stores/inventoryStore';
import { setSyncContext } from '@/lib/outboxContext';
beforeEach(() => {
  cleanup();
  vi.resetAllMocks();
  useInventoryStore.getState().clearAll();
  setSyncContext({ principalId: 'owner', shopId: 'shop', mode: 'owner' }, 'token');
  vi.mocked(api.getProducts).mockResolvedValue({ data: [] } as never);
  vi.mocked(api.getSales).mockResolvedValue({ data: [] } as never);
  vi.mocked(api.getStaff).mockResolvedValue({ data: [] } as never);
  vi.mocked(api.listExpenses).mockResolvedValue({ data: { expenses: [] } } as never);
});
it('blocks first sync on failure, exposes retry, and opens the shop after successful retry', async () => {
  vi.mocked(api.getProducts).mockResolvedValueOnce({ error: 'Products unavailable' });
  render(<InitialSync><div>Shop content</div></InitialSync>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Products unavailable');
  expect(screen.queryByText('Shop content')).not.toBeInTheDocument();
  expect(useInventoryStore.getState().lastSync).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry sync' }));
  expect(await screen.findByText('Shop content')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('keeps content visible with a stale warning and retry after refresh fails', async () => {
  render(<InitialSync><div>Shop content</div></InitialSync>);
  await screen.findByText('Shop content');
  const synced = useInventoryStore.getState().lastSync;
  vi.mocked(api.getSales).mockResolvedValueOnce({ error: 'Sales unavailable' });
  await useInventoryStore.getState().loadAll('shop');
  expect(await screen.findByRole('alert')).toHaveTextContent('Shop data may be out of date');
  expect(screen.getByText('Shop content')).toBeInTheDocument();
  expect(useInventoryStore.getState().lastSync).toBe(synced);
  fireEvent.click(screen.getByRole('button', { name: 'Retry sync' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});

it('retains a verified snapshot across same-session offline remount and recovers on retry', async () => {
  const view = render(<InitialSync><div>Shop content</div></InitialSync>);
  await screen.findByText('Shop content');
  const snapshot = useInventoryStore.getState();
  view.unmount();
  vi.mocked(api.getProducts).mockRejectedValueOnce(new Error('Offline'));
  render(<InitialSync><div>Shop content</div></InitialSync>);
  expect(screen.getByText('Shop content')).toBeInTheDocument();
  expect(await screen.findByRole('alert')).toHaveTextContent('Offline');
  expect(useInventoryStore.getState().lastSync).toBe(snapshot.lastSync);
  expect(useInventoryStore.getState().products).toBe(snapshot.products);
  fireEvent.click(screen.getByRole('button', { name: 'Retry sync' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});
it('blocks a new verified session from using the previous snapshot on offline remount', async () => {
  const view = render(<InitialSync><div>Shop content</div></InitialSync>);
  await screen.findByText('Shop content');
  view.unmount();
  setSyncContext({ principalId: 'owner', shopId: 'shop', mode: 'owner' }, 'new-token');
  vi.mocked(api.getProducts).mockRejectedValueOnce(new Error('Offline'));
  render(<InitialSync><div>Shop content</div></InitialSync>);
  expect(screen.queryByText('Shop content')).not.toBeInTheDocument();
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not sync shop data');
  expect(useInventoryStore.getState().lastSync).toBeNull();
});
