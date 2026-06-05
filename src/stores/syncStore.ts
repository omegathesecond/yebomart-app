import { create } from 'zustand';
import api, { NETWORK_ERROR } from '@/api/client';
import {
  db,
  getPendingSyncItems,
  removeSyncItem,
  updateSyncAttempt,
} from '@/lib/db';
import type { SyncQueueItem } from '@/types';

// Max attempts before an item is parked (mirrors getPendingSyncItems' filter).
const MAX_ATTEMPTS = 5;

/**
 * Single-flight guard. The drain can be triggered from several places at once
 * (app start, the `online` event, a manual retry tap). Without this, two
 * concurrent drains could each POST the same queued item before either removed
 * it — the server-side localId dedup would still prevent duplicate sales, but
 * we'd waste requests and race the attempt counter. One drain at a time.
 */
let draining = false;

/** Outcome of pushing one queued item to the API. */
type PushResult =
  | 'success' // committed server-side (or deduped) — remove from queue
  | 'retry'   // transport failure — still offline, keep item, DON'T burn an attempt
  | 'failed'; // server rejected (4xx) — burn an attempt, park after MAX_ATTEMPTS

interface SyncState {
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedAt: Date | null;

  /** Recount the outbox and publish the badge number. */
  refreshPending: () => Promise<void>;

  /**
   * Drain the outbox: POST each pending item, remove on success. Safe to call
   * anytime — no-ops if offline or already draining. Returns a summary.
   */
  replay: () => Promise<{ synced: number; failed: number }>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  pendingCount: 0,
  isSyncing: false,
  lastSyncedAt: null,

  refreshPending: async () => {
    const count = await db.syncQueue.count();
    set({ pendingCount: count });
  },

  replay: async () => {
    // Don't even try when the browser knows it's offline, or when a drain is
    // already in flight.
    if (draining || !navigator.onLine) return { synced: 0, failed: 0 };

    draining = true;
    set({ isSyncing: true });

    let synced = 0;
    let failed = 0;

    try {
      const items = await getPendingSyncItems(); // attempts < MAX_ATTEMPTS

      for (const item of items) {
        let result: PushResult;
        try {
          result = await pushItem(item);
        } catch (err: any) {
          // Unexpected client-side error while building/sending — treat as a
          // server-style failure so it eventually parks rather than looping.
          await updateSyncAttempt(item.id, err?.message || 'Replay error');
          failed++;
          continue;
        }

        if (result === 'success') {
          await removeSyncItem(item.id);
          synced++;
        } else if (result === 'retry') {
          // We went offline mid-drain. Stop here and leave the rest queued —
          // no attempt burned. The next `online` event resumes the drain.
          break;
        } else {
          await updateSyncAttempt(item.id, 'Server rejected queued item');
          failed++;
        }
      }
    } finally {
      draining = false;
      await get().refreshPending();
      set((s) => ({
        isSyncing: false,
        lastSyncedAt: synced > 0 ? new Date() : s.lastSyncedAt,
      }));
    }

    return { synced, failed };
  },
}));

/**
 * Dispatch a single queued item to the right API call.
 *
 * NETWORK_ERROR → 'retry' (we're offline again; never burn an attempt for a
 * transport failure, or a few reconnect blips could permanently lose a sale).
 * Any other error → 'failed' (a genuine server rejection that won't fix itself
 * on retry — e.g. a deleted product). Success → 'success'.
 */
async function pushItem(item: SyncQueueItem): Promise<PushResult> {
  if (item.table === 'sales' && item.action === 'create') {
    const { data, error } = await api.createSale(item.data as any);
    if (data) return 'success';
    if (error === NETWORK_ERROR) return 'retry';
    return 'failed';
  }

  // Unknown queue entry — fail it loudly toward parking rather than silently
  // dropping it. Today only 'sales/create' is ever enqueued; this guards
  // against a future enqueue site landing without a matching drain handler.
  console.error(`[sync] No drain handler for ${item.table}/${item.action}`);
  return 'failed';
}

/** Re-export so callers don't reach past the store. */
export { MAX_ATTEMPTS };
