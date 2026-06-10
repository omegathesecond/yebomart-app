import { describe, it, expect, beforeEach } from 'vitest';
import type { SyncQueueItem } from '@/types';
import {
  db,
  addToSyncQueue,
  getPendingSyncItems,
  removeSyncItem,
  updateSyncAttempt,
} from '@/lib/db';

// Exercises the real Dexie queue helpers against fake-indexeddb. These back the
// offline outbox drain, so the attempt-count filter and increment must be exact.

beforeEach(async () => {
  await db.syncQueue.clear();
});

async function seed(item: Partial<SyncQueueItem>): Promise<string> {
  const id = item.id ?? crypto.randomUUID();
  await db.syncQueue.add({
    id,
    table: 'sales',
    action: 'create',
    data: { localId: id },
    createdAt: new Date(),
    attempts: 0,
    ...item,
  });
  return id;
}

describe('addToSyncQueue', () => {
  it('enqueues a new item with attempts = 0 and the given payload', async () => {
    await addToSyncQueue('sales', 'create', { localId: 'abc', amountPaid: 25 });

    const all = await db.syncQueue.toArray();
    expect(all).toHaveLength(1);
    expect(all[0].table).toBe('sales');
    expect(all[0].action).toBe('create');
    expect(all[0].attempts).toBe(0);
    expect(all[0].createdAt).toBeInstanceOf(Date);
    expect((all[0].data as any).localId).toBe('abc');
    expect(typeof all[0].id).toBe('string');
  });
});

describe('getPendingSyncItems — attempt-count filter', () => {
  it('returns only items with attempts < 5, excluding parked ones', async () => {
    await seed({ id: 'fresh', attempts: 0 });
    await seed({ id: 'tried', attempts: 4 });
    await seed({ id: 'parked', attempts: 5 });
    await seed({ id: 'over', attempts: 6 });

    const pending = await getPendingSyncItems();
    const ids = pending.map((i) => i.id).sort();

    expect(ids).toEqual(['fresh', 'tried']); // 5 and 6 are parked out
  });

  it('returns an empty array when the queue is empty', async () => {
    expect(await getPendingSyncItems()).toEqual([]);
  });
});

describe('removeSyncItem', () => {
  it('deletes the item by id', async () => {
    const id = await seed({ attempts: 0 });
    expect(await db.syncQueue.count()).toBe(1);

    await removeSyncItem(id);

    expect(await db.syncQueue.count()).toBe(0);
  });
});

describe('updateSyncAttempt', () => {
  it('increments attempts and records lastAttempt + error', async () => {
    const id = await seed({ attempts: 2 });

    await updateSyncAttempt(id, 'boom');

    const item = await db.syncQueue.get(id);
    expect(item!.attempts).toBe(3);
    expect(item!.error).toBe('boom');
    expect(item!.lastAttempt).toBeInstanceOf(Date);
  });

  it('is a safe no-op for an unknown id (does not throw or create a row)', async () => {
    await expect(updateSyncAttempt('does-not-exist', 'err')).resolves.toBeUndefined();
    expect(await db.syncQueue.count()).toBe(0);
  });
});
