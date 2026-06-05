import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ExclamationTriangleIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { useBillingStore, isLowBalance } from '@/stores/billingStore';

/**
 * App-wide low-credit nudge. Lives in the Layout so it shows on every screen —
 * critical for mobile, where the desktop Sidebar's "Billing" link is hidden.
 * Fetches the balance once on mount; the shared billingStore keeps it in sync
 * after top-ups, so this reflects changes without a manual refetch.
 *
 * Hidden on the billing pages themselves (the page already shows balance + a
 * richer warning) to avoid a duplicate banner.
 */
export function LowBalanceBanner() {
  const location = useLocation();
  const { balance, loaded, fetchBalance } = useBillingStore();

  useEffect(() => {
    if (!loaded) fetchBalance();
  }, [loaded, fetchBalance]);

  if (location.pathname.startsWith('/billing')) return null;
  if (!isLowBalance(balance)) return null;

  return (
    <div className="bg-red-500/10 border-b border-red-500/30">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <ExclamationTriangleIcon className="w-5 h-5 text-red-400 shrink-0" />
        <p className="text-sm text-red-200 flex-1 min-w-0">
          <span className="font-medium">Low credits.</span>{' '}
          <span className="hidden sm:inline">
            {balance!.available.toLocaleString()} credits left — top up to keep AI &amp; messaging
            running.
          </span>
          <span className="sm:hidden">{balance!.available.toLocaleString()} left.</span>
        </p>
        <Link
          to="/billing"
          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
        >
          Top up
          <ArrowRightIcon className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
