import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CheckCircleIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { api } from '@/api/client';
import { useBillingStore } from '@/stores/billingStore';
import { PENDING_TOPUP_KEY } from './Billing';

interface PendingTopUp {
  checkoutId: string;
  credits?: number;
}

/**
 * Resolve the checkout to confirm. YeboPay forwards `success_url` to the
 * processor as-is, so we may NOT get a query param back — fall back to the
 * checkout we stashed in localStorage before redirecting out (see Billing.tsx).
 */
function resolvePending(searchParams: URLSearchParams): PendingTopUp | null {
  const fromQuery =
    searchParams.get('checkoutId') ||
    searchParams.get('checkout_id') ||
    searchParams.get('session_id');
  if (fromQuery) return { checkoutId: fromQuery };

  const raw = localStorage.getItem(PENDING_TOPUP_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingTopUp;
    return parsed?.checkoutId ? parsed : null;
  } catch {
    return null;
  }
}

type Phase = 'loading' | 'completed' | 'pending' | 'error' | 'missing';

export function BillingSuccess() {
  const [searchParams] = useSearchParams();
  const setBalance = useBillingStore((s) => s.setBalance);

  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [creditsAdded, setCreditsAdded] = useState<number | null>(null);
  const [newBalance, setNewBalance] = useState<number | null>(null);

  const confirm = useCallback(async () => {
    const pending = resolvePending(searchParams);
    if (!pending) {
      setPhase('missing');
      return;
    }

    setPhase('loading');
    const { data, error } = await api.confirmTopUp(pending.checkoutId);
    if (error || !data) {
      setErrorMsg(error || 'Could not confirm your top-up.');
      setPhase('error');
      return;
    }

    // Push the fresh balance into the shared store so the banner + AI screens
    // reflect it immediately.
    setBalance(data.balance);
    setNewBalance(data.balance.available);
    setCreditsAdded(pending.credits ?? null);

    if (data.completed) {
      localStorage.removeItem(PENDING_TOPUP_KEY); // done — don't re-confirm.
      setPhase('completed');
    } else {
      // Payment captured but the wallet credit (webhook-driven) hasn't landed
      // yet. Keep the pending record so a retry can re-check.
      setPhase('pending');
    }
  }, [searchParams, setBalance]);

  useEffect(() => {
    confirm();
  }, [confirm]);

  return (
    <div className="max-w-lg mx-auto py-8">
      <Card className="text-center py-10 px-6">
        {phase === 'loading' && (
          <>
            <ArrowPathIcon className="w-12 h-12 mx-auto text-amber-400 animate-spin mb-4" />
            <h1 className="text-xl font-bold text-white">Confirming your top-up…</h1>
            <p className="text-slate-400 mt-2">Hang tight, this only takes a moment.</p>
          </>
        )}

        {phase === 'completed' && (
          <>
            <CheckCircleIcon className="w-16 h-16 mx-auto text-emerald-400 mb-4" />
            <h1 className="text-2xl font-bold text-white">Payment successful</h1>
            <p className="text-slate-300 mt-2">
              {creditsAdded != null && (
                <span className="text-emerald-400 font-semibold">
                  +{creditsAdded.toLocaleString()} credits
                </span>
              )}
              {creditsAdded != null && newBalance != null && ' · '}
              {newBalance != null && (
                <>
                  New balance:{' '}
                  <span className="font-semibold text-white">
                    {newBalance.toLocaleString()} credits
                  </span>
                </>
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
              <Link to="/">
                <Button variant="secondary" className="w-full sm:w-auto">
                  Back to Dashboard
                </Button>
              </Link>
              <Link to="/billing">
                <Button variant="primary" className="w-full sm:w-auto">
                  View Billing
                </Button>
              </Link>
            </div>
          </>
        )}

        {phase === 'pending' && (
          <>
            <ClockIcon className="w-16 h-16 mx-auto text-amber-400 mb-4" />
            <h1 className="text-2xl font-bold text-white">Payment received</h1>
            <p className="text-slate-300 mt-2">
              We’re still crediting your wallet. This usually clears within a minute.
              {newBalance != null && (
                <>
                  {' '}Current balance:{' '}
                  <span className="font-semibold text-white">
                    {newBalance.toLocaleString()} credits
                  </span>
                  .
                </>
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
              <Button variant="primary" onClick={confirm} leftIcon={<ArrowPathIcon className="w-5 h-5" />}>
                Check again
              </Button>
              <Link to="/billing">
                <Button variant="secondary" className="w-full sm:w-auto">
                  Go to Billing
                </Button>
              </Link>
            </div>
          </>
        )}

        {phase === 'error' && (
          <>
            <ExclamationTriangleIcon className="w-16 h-16 mx-auto text-red-400 mb-4" />
            <h1 className="text-2xl font-bold text-white">Couldn’t confirm top-up</h1>
            <p className="text-red-300 mt-2">{errorMsg}</p>
            <p className="text-slate-400 text-sm mt-2">
              If you completed payment, your credits may still arrive shortly. Try again or check
              your balance on the billing page.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
              <Button variant="primary" onClick={confirm} leftIcon={<ArrowPathIcon className="w-5 h-5" />}>
                Retry
              </Button>
              <Link to="/billing">
                <Button variant="secondary" className="w-full sm:w-auto">
                  Go to Billing
                </Button>
              </Link>
            </div>
          </>
        )}

        {phase === 'missing' && (
          <>
            <ExclamationTriangleIcon className="w-16 h-16 mx-auto text-amber-400 mb-4" />
            <h1 className="text-2xl font-bold text-white">No top-up to confirm</h1>
            <p className="text-slate-400 mt-2">
              We couldn’t find a pending top-up. Head to the billing page to view your balance or
              buy credits.
            </p>
            <Link to="/billing" className="inline-block mt-6">
              <Button variant="primary">Go to Billing</Button>
            </Link>
          </>
        )}
      </Card>
    </div>
  );
}
