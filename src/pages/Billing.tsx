import { useState, useEffect, useCallback } from 'react';
import {
  BoltIcon,
  CheckBadgeIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Toast, useToast } from '@/components/ui/Toast';
import { api, type CreditPack } from '@/api/client';
import { useBillingStore, isLowBalance } from '@/stores/billingStore';

/**
 * localStorage key holding the in-flight top-up so the success page can confirm
 * it after the YeboPay redirect. YeboPay forwards `success_url` to the card
 * processor verbatim (no `?checkoutId=` appended), so we can't rely on a query
 * param — we stash the id here before leaving the app and read it back on
 * return. The success page reads query-param-OR-this and then clears it.
 */
export const PENDING_TOPUP_KEY = 'yebomart_pending_checkout';

/** Credits are anchored 1:1 to SZL; show prices in the Lilangeni (E) anchor. */
function szl(amount: number): string {
  return `E${amount.toLocaleString()}`;
}

const MIN_CUSTOM = 10;

export function Billing() {
  const { toast, showToast, dismissToast } = useToast();
  const { balance, loading: balanceLoading, error: balanceError, fetchBalance } = useBillingStore();

  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [packsLoading, setPacksLoading] = useState(true);
  const [packsError, setPacksError] = useState<string | null>(null);

  const [customAmount, setCustomAmount] = useState('');
  // The id of whichever option is mid-checkout, so only its button spins.
  const [buying, setBuying] = useState<string | null>(null);

  const loadPacks = useCallback(async () => {
    setPacksLoading(true);
    setPacksError(null);
    const { data, error } = await api.getCreditPacks();
    setPacksLoading(false);
    if (error || !data) {
      setPacksError(error || 'Failed to load credit packs');
      return;
    }
    setPacks(data.packs || []);
  }, []);

  useEffect(() => {
    loadPacks();
    fetchBalance();
  }, [loadPacks, fetchBalance]);

  // Kick off a top-up: create the YeboPay checkout, remember it, then redirect
  // the whole tab to the hosted checkout URL.
  const startCheckout = async (
    selectionId: string,
    body: { packId?: string; amount?: number },
    expectedCredits: number,
  ) => {
    if (buying) return;
    setBuying(selectionId);
    const idempotencyKey =
      (crypto as any)?.randomUUID?.() ?? `topup-${selectionId}-${Date.now()}`;
    const { data, error } = await api.createTopUpCheckout(body, idempotencyKey);
    if (error || !data) {
      setBuying(null);
      showToast(error || 'Could not start checkout', 'error');
      return;
    }
    if (!data.url) {
      setBuying(null);
      showToast('Checkout was created but no payment link was returned. Please try again.', 'error');
      return;
    }
    // Stash so /billing/success can confirm regardless of redirect query params.
    localStorage.setItem(
      PENDING_TOPUP_KEY,
      JSON.stringify({ checkoutId: data.checkoutId, credits: data.credits ?? expectedCredits }),
    );
    window.location.href = data.url;
  };

  const buyPack = (pack: CreditPack) =>
    startCheckout(pack.id, { packId: pack.id }, pack.credits);

  const buyCustom = () => {
    const amount = Math.round(parseFloat(customAmount));
    if (!amount || amount < MIN_CUSTOM) {
      showToast(`Enter an amount of at least ${szl(MIN_CUSTOM)}`, 'error');
      return;
    }
    startCheckout('custom', { amount }, amount);
  };

  const low = isLowBalance(balance);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Billing &amp; Credits</h1>
        <p className="text-slate-400 mt-1">
          Credits power your AI assistant and customer messaging. 1 credit = {szl(1)}.
        </p>
      </div>

      {/* Balance */}
      <Card gradient={low ? 'red' : 'amber'} className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">Current balance</p>
          {balanceLoading && !balance ? (
            <div className="flex items-center gap-2 mt-1 text-slate-300">
              <ArrowPathIcon className="w-5 h-5 animate-spin" />
              <span>Loading…</span>
            </div>
          ) : balanceError && !balance ? (
            <div className="mt-1">
              <p className="text-red-400 font-medium">Couldn’t load your balance</p>
              <button
                onClick={fetchBalance}
                className="text-sm text-amber-400 hover:underline mt-1"
              >
                Try again
              </button>
            </div>
          ) : (
            <p className={`text-3xl font-bold mt-1 ${low ? 'text-red-400' : 'text-white'}`}>
              {(balance?.available ?? 0).toLocaleString()}{' '}
              <span className="text-lg font-medium text-slate-400">credits</span>
            </p>
          )}
        </div>
        <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-amber-500/20 items-center justify-center shrink-0">
          <BoltIcon className="w-8 h-8 text-amber-400" />
        </div>
      </Card>

      {low && balance && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-200">
            Your balance is low ({balance.available.toLocaleString()} credits left). Top up below to
            keep using your AI assistant and customer messaging without interruption.
          </p>
        </div>
      )}

      {/* Packs */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Choose a pack</h2>

        {packsLoading ? (
          <div className="text-center py-12">
            <ArrowPathIcon className="w-8 h-8 animate-spin mx-auto text-slate-400" />
            <p className="text-slate-400 mt-2">Loading packs…</p>
          </div>
        ) : packsError ? (
          <Card className="text-center py-10">
            <ExclamationTriangleIcon className="w-10 h-10 mx-auto text-red-400 mb-3" />
            <p className="text-red-300 mb-4">{packsError}</p>
            <Button variant="secondary" onClick={loadPacks}>
              Retry
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {packs.map((pack) => {
              const isBest = pack.discountPercent === Math.max(...packs.map((p) => p.discountPercent));
              return (
                <Card
                  key={pack.id}
                  gradient={isBest && pack.discountPercent > 0 ? 'purple' : undefined}
                  className="flex flex-col"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-white">{pack.name}</h3>
                    {pack.discountPercent > 0 && (
                      <Badge variant={isBest ? 'success' : 'info'}>
                        Save {pack.discountPercent}%
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-3xl font-bold text-white">
                      {pack.credits.toLocaleString()}
                    </span>
                    <span className="text-slate-400">credits</span>
                  </div>
                  <p className="text-amber-400 font-semibold mb-3">{szl(pack.priceSzl)}</p>
                  <p className="text-sm text-slate-400 flex-1">{pack.description}</p>

                  <Button
                    variant={isBest && pack.discountPercent > 0 ? 'primary' : 'secondary'}
                    className="mt-4 w-full"
                    leftIcon={<SparklesIcon className="w-5 h-5" />}
                    isLoading={buying === pack.id}
                    disabled={!!buying}
                    onClick={() => buyPack(pack)}
                  >
                    Buy {pack.credits.toLocaleString()} credits
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Custom amount */}
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <CheckBadgeIcon className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-white">Custom top-up</h2>
        </div>
        <p className="text-sm text-slate-400 mb-3">
          Buy any amount (minimum {szl(MIN_CUSTOM)}). Custom top-ups are 1:1 — no bonus credits.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <Input
              label={`Amount in SZL (min ${MIN_CUSTOM})`}
              type="number"
              min={MIN_CUSTOM}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="e.g. 50"
              hint={
                customAmount && parseFloat(customAmount) >= MIN_CUSTOM
                  ? `You’ll get ${Math.round(parseFloat(customAmount)).toLocaleString()} credits`
                  : undefined
              }
            />
          </div>
          <Button
            variant="primary"
            isLoading={buying === 'custom'}
            disabled={!!buying || !customAmount || parseFloat(customAmount) < MIN_CUSTOM}
            onClick={buyCustom}
          >
            Top up {szl(Math.max(0, Math.round(parseFloat(customAmount) || 0)))}
          </Button>
        </div>
      </Card>

      <p className="text-xs text-slate-500">
        Payments are processed securely by YeboPay. You’ll be redirected to complete your purchase
        and brought back here once it’s done.
      </p>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
