import { useEffect } from 'react';
import { WifiIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useInventoryStore } from '@/stores/inventoryStore';
import { useSyncStore } from '@/stores/syncStore';

export function OfflineIndicator() {
  const { isOnline, setOnlineStatus } = useInventoryStore();
  const { pendingCount, isSyncing, replay } = useSyncStore();

  useEffect(() => {
    const handleOnline = () => setOnlineStatus(true);
    const handleOffline = () => setOnlineStatus(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnlineStatus]);

  const changes = `${pendingCount} ${pendingCount === 1 ? 'change' : 'changes'}`;

  // Offline: be honest about what's happening. Pending sales ARE saved locally
  // and will sync — the syncQueue drain now backs that promise.
  if (!isOnline) {
    return (
      <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2">
        <div className="flex items-center justify-center gap-2 text-amber-400">
          <WifiIcon className="w-4 h-4" />
          <span className="text-sm font-medium">
            {pendingCount > 0
              ? `You're offline — ${changes} saved here, will sync when you're back online`
              : "You're offline — sales are saved here and sync when you're back online"}
          </span>
        </div>
      </div>
    );
  }

  // Online and actively draining the outbox.
  if (isSyncing && pendingCount > 0) {
    return (
      <div className="bg-sky-500/20 border-b border-sky-500/30 px-4 py-2">
        <div className="flex items-center justify-center gap-2 text-sky-400">
          <ArrowPathIcon className="w-4 h-4 animate-spin" />
          <span className="text-sm font-medium">Syncing {changes}…</span>
        </div>
      </div>
    );
  }

  // Online but items are still queued (e.g. waiting on a retry). Offer a manual
  // nudge so the cashier can confirm their sales reached the server.
  if (pendingCount > 0) {
    return (
      <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2">
        <button
          onClick={() => replay()}
          className="flex w-full items-center justify-center gap-2 text-amber-400"
        >
          <ArrowPathIcon className="w-4 h-4" />
          <span className="text-sm font-medium">
            {changes} waiting to sync — tap to retry
          </span>
        </button>
      </div>
    );
  }

  return null;
}
