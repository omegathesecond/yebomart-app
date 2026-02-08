import { useEffect } from 'react';
import { WifiIcon } from '@heroicons/react/24/outline';
import { useInventoryStore } from '@/stores/inventoryStore';

export function OfflineIndicator() {
  const { isOnline, setOnlineStatus } = useInventoryStore();

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

  if (isOnline) return null;

  return (
    <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2">
      <div className="flex items-center justify-center gap-2 text-amber-400">
        <WifiIcon className="w-4 h-4" />
        <span className="text-sm font-medium">
          You're offline — changes will sync when you're back online
        </span>
      </div>
    </div>
  );
}
