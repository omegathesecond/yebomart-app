import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { SyncQueueItem } from '@/types';

const NETWORK_ERROR = 'Network error. Please try again.';

// Only the network boundary is mocked; the outbox itself is the REAL Dexie queue
// (backed by fake-indexeddb) so the drain is tested end-to-end with persistence.
vi.mock('@/api/client', () => ({
  // Literal inlined — vi.mock factories are hoisted above the const above and
  // cannot close over outer variables.
  default: { createSale: vi.fn() },
  NETWORK_ERROR: 'Network error. Please try again.',
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
}));

import api from '@/api/client';
import { db } from '@/lib/db';
import { useSyncStore, MAX_ATTEMPTS } from '@/stores/syncStore';

const createSale = api.createSale as unknown as Mock;

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}

/** Insert a sales/create outbox entry with a controllable attempt count. */
async function enqueueSale(overrides: Partial<SyncQueueItem> = {}): Promise<string> {
  const id = crypto.randomUUID();
  const item: SyncQueueItem = {
    id,
    table: 'sales',
    action: 'create',
    data: { localId: id, amountPaid: 10, items: [] },
    createdAt: new Date(),
    attempts: 0,
    ...overrides,
  };
  await db.syncQueue.add(item);
  return id;
}

beforeEach(async () => {
  vi.clearAllMocks();
  setOnline(true);
  await db.syncQueue.clear();
  useSyncStore.setState({ pendingCount: 0, isSyncing: false, lastSyncedAt: null });
});

describe('syncStore.replay — guards', () => {
  it('no-ops when offline and leaves the queue untouched', async () => {
    setOnline(false);
    await enqueueSale();

    const result = await useSyncStore.getState().replay();

    expect(result).toEqual({ synced: 0, failed: 0 });
    expect(createSale).not.toHaveBeenCalled();
    expect(await db.syncQueue.count()).toBe(1);
  });

  it('concurrent drains do not double-POST (single-flight guard)', async () => {
    createSale.mockResolvedValue({ data: { id: 'srv' } });
    await enqueueSale();
    await enqueueSale();

    // Fire two drains in the same tick. The second sees `draining` already set
    // and short-circuits, so each queued item is POSTed exactly once.
    const [r1, r2] = await Promise.all([
      useSyncStore.getState().replay(),
      useSyncStore.getState().replay(),
    ]);

    expect(createSale).toHaveBeenCalledTimes(2); // 2 items, once each — not 4
    expect([r1.synced, r2.synced].sort()).toEqual([0, 2]);
    expect(await db.syncQueue.count()).toBe(0);
  });
});

describe('syncStore.replay — per-item outcomes', () => {
  it('success removes the item from the outbox', async () => {
    createSale.mockResolvedValue({ data: { id: 'srv-1' } });
    await enqueueSale();

    const result = await useSyncStore.getState().replay();

    expect(result).toEqual({ synced: 1, failed: 0 });
    expect(await db.syncQueue.count()).toBe(0);
    expect(useSyncStore.getState().pendingCount).toBe(0);
  });

  it('transport failure → "retry": item kept, NO attempt burned', async () => {
    createSale.mockResolvedValue({ error: NETWORK_ERROR });
    const id = await enqueueSale();

    const result = await useSyncStore.getState().replay();

    // retry breaks the drain without counting as synced or failed.
    expect(result).toEqual({ synced: 0, failed: 0 });
    const item = await db.syncQueue.get(id);
    expect(item).toBeDefined();
    expect(item!.attempts).toBe(0); // critical: a reconnect blip must not park a real sale
  });

  it('4xx rejection → "failed": burns one attempt and records the error', async () => {
    createSale.mockResolvedValue({ error: 'Server rejected queued item' });
    const id = await enqueueSale();

    const result = await useSyncStore.getState().replay();

    expect(result).toEqual({ synced: 0, failed: 1 });
    const item = await db.syncQueue.get(id);
    expect(item!.attempts).toBe(1);
    expect(item!.error).toBeTruthy();
    expect(await db.syncQueue.count()).toBe(1); // still queued, not dropped
  });

  it('parks an item after MAX_ATTEMPTS — it is no longer drained', async () => {
    createSale.mockResolvedValue({ error: 'Server rejected queued item' });
    // One attempt away from the cap.
    const id = await enqueueSale({ attempts: MAX_ATTEMPTS - 1 });

    // This drain burns the final attempt → attempts === MAX_ATTEMPTS.
    const first = await useSyncStore.getState().replay();
    expect(first.failed).toBe(1);
    expect((await db.syncQueue.get(id))!.attempts).toBe(MAX_ATTEMPTS);

    // A subsequent drain skips the parked item entirely (attempts >= MAX_ATTEMPTS).
    createSale.mockClear();
    const second = await useSyncStore.getState().replay();

    expect(createSale).not.toHaveBeenCalled();
    expect(second).toEqual({ synced: 0, failed: 0 });
    expect(await db.syncQueue.count()).toBe(1); // parked, retained for inspection
  });

  it('drains multiple items and reports the tally', async () => {
    createSale.mockResolvedValue({ data: { id: 'srv' } });
    await enqueueSale();
    await enqueueSale();
    await enqueueSale();

    const result = await useSyncStore.getState().replay();

    expect(result).toEqual({ synced: 3, failed: 0 });
    expect(await db.syncQueue.count()).toBe(0);
  });
});
