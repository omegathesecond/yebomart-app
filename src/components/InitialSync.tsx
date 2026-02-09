import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';

interface InitialSyncProps {
  children: React.ReactNode;
}

export function InitialSync({ children }: InitialSyncProps) {
  const { shop, isAuthenticated } = useAuthStore();
  const { loadAll, lastSync, isLoading } = useInventoryStore();
  const [hasSynced, setHasSynced] = useState(false);
  const [syncStatus, setSyncStatus] = useState('Connecting...');

  useEffect(() => {
    const doSync = async () => {
      if (!isAuthenticated || !shop) return;
      
      // Check if we've already synced this session
      if (lastSync && hasSynced) return;

      setSyncStatus('Syncing products...');
      await loadAll(shop.id);
      setSyncStatus('Done!');
      setHasSynced(true);
    };

    doSync();
  }, [isAuthenticated, shop, loadAll, lastSync, hasSynced]);

  // Show sync screen if authenticated but haven't synced yet
  if (isAuthenticated && shop && !hasSynced && isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">YeboMart</h2>
        <p className="text-slate-400 text-sm mb-6">{syncStatus}</p>
        <div className="w-48 h-1 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full animate-pulse" style={{ width: '60%' }} />
        </div>
        <p className="text-slate-500 text-xs mt-4">Loading your shop data...</p>
      </div>
    );
  }

  return <>{children}</>;
}
