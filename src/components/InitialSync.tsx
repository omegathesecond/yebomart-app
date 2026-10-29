import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { Button } from '@/components/ui/Button';
import { credentialSnapshot } from '@/lib/outboxContext';

interface InitialSyncProps {
  children: React.ReactNode;
}

export function InitialSync({ children }: InitialSyncProps) {
  const { shop, user, authMode, isAuthenticated } = useAuthStore();
  const sessionKey = JSON.stringify([shop?.id, user?.id, authMode, isAuthenticated, credentialSnapshot()]);
  return <ShopSync key={sessionKey}>{children}</ShopSync>;
}

function ShopSync({ children }: InitialSyncProps) {
  const { shop, isAuthenticated } = useAuthStore();
  const { loadAll, lastSync, isLoading, syncError, hasCurrentSnapshot } = useInventoryStore();
  // Route remounts retain the store snapshot; only its verified session may reuse it.
  const hasSynced = !!lastSync && hasCurrentSnapshot();
  const [attempt, setAttempt] = useState(0);
  const shopId = shop?.id;

  useEffect(() => {
    if (isAuthenticated && shopId) {
      void loadAll(shopId);
    }
  }, [isAuthenticated, shopId, loadAll, attempt]);

  const retry = () => {
    if (hasSynced && shopId) void loadAll(shopId);
    else setAttempt(value => value + 1);
  };

  if (!isAuthenticated || !shopId) return <>{children}</>;

  if (!hasSynced) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-6">
        <h2 className="text-xl font-bold text-ink mb-2">YeboMart</h2>
        {syncError ? (
          <div role="alert" className="text-center space-y-4">
            <p>Could not sync shop data. {syncError}</p>
            <Button onClick={retry} isLoading={isLoading}>Retry sync</Button>
          </div>
        ) : <p role="status">Loading your shop data...</p>}
      </div>
    );
  }

  return <>
    {syncError && <div role="alert" className="bg-cream text-ink p-4 border-b space-y-2">
      <p>Shop data may be out of date. Showing the last successful sync{lastSync ? ` (${lastSync.toLocaleString()})` : ''}. {syncError}</p>
      <Button size="sm" onClick={retry} isLoading={isLoading}>Retry sync</Button>
    </div>}
    {children}
  </>;
}
