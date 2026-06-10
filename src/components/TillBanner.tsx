import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BanknotesIcon, CalculatorIcon, LockOpenIcon } from '@heroicons/react/24/outline';
import api, { type CashSession } from '@/api/client';
import { formatCurrency } from '@/types';

/**
 * Persistent till indicator for the POS. Shows whether a cash drawer is open
 * (with the live cash tally) and links to the Cash Up page to open a till or
 * cash up. Self-contained: fetches its own state, fails quietly to a neutral
 * "open a till" prompt (a banner is not a vital path — the Cash Up page surfaces
 * real errors loudly via toast).
 */
export function TillBanner() {
  const [session, setSession] = useState<CashSession | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    api.getCurrentCashSession().then((res) => {
      if (!active) return;
      if (!res.error) setSession(res.data ?? null);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!loaded) return null;

  const isOpen = session?.status === 'OPEN';

  return (
    <Link
      to="/cash-up"
      className={`flex items-center justify-between gap-3 mb-3 px-4 py-2.5 rounded-xl border transition-colors ${
        isOpen
          ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15'
          : 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {isOpen ? (
          <>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <BanknotesIcon className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-sm text-emerald-200 truncate">
              Till open · cash {formatCurrency(session?.cashSalesTotal ?? 0)} · expected{' '}
              {formatCurrency(session?.expectedCash ?? session?.openingFloat ?? 0)}
            </span>
          </>
        ) : (
          <>
            <LockOpenIcon className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="text-sm text-amber-200 truncate">No till open — open one to track cash</span>
          </>
        )}
      </div>
      <span className="flex items-center gap-1 text-xs font-semibold shrink-0 text-white/80">
        <CalculatorIcon className="w-4 h-4" />
        {isOpen ? 'Cash up' : 'Open till'}
      </span>
    </Link>
  );
}
