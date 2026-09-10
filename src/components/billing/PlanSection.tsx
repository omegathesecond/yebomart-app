import { useCallback, useEffect, useState } from 'react';
import {
  ArrowPathIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  api,
  type Plan,
  type PlanCode,
  type SubscriptionResponse,
  type SubscriptionStatus,
} from '@/api/client';

/**
 * The shop's plan: what it is on now, what the month's allowances have left,
 * and how to move between plans.
 *
 * Plans are billed by invoice rather than a stored card, because most owners
 * here pay by mobile money. So "subscribe" does not switch anything on — it
 * raises an invoice and hands over its pay link. The plan starts when that is
 * paid, which is why a PENDING cycle still shows Till's entitlements.
 */

function szl(amount: number): string {
  return `E${amount.toLocaleString()}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Allowance keys are API enums; these are what a shop owner would call them. */
const ACTION_LABELS: Record<string, string> = {
  AI_QUESTION: 'Assistant questions',
  AI_INSIGHT: 'Background insights',
  WHATSAPP: 'Customer WhatsApp messages',
  DAILY_REPORT: 'Daily reports',
  LOW_STOCK_ALERT: 'Low-stock alerts',
};

const STATUS_COPY: Record<SubscriptionStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  ACTIVE: { label: 'Active', variant: 'success' },
  PENDING: { label: 'Awaiting payment', variant: 'warning' },
  PAST_DUE: { label: 'Unpaid', variant: 'danger' },
  CANCELED: { label: 'Cancelled', variant: 'neutral' },
};

export function PlanSection({ onNotify }: { onNotify: (msg: string, kind: 'success' | 'error') => void }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [state, setState] = useState<SubscriptionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [plansRes, subRes] = await Promise.all([api.getPlans(), api.getSubscription()]);
    setLoading(false);

    if (plansRes.error || !plansRes.data) {
      setError(plansRes.error || 'Failed to load plans');
      return;
    }
    setPlans(plansRes.data.plans || []);

    // A shop with no subscription is a normal state, not an error — but a
    // failed request is, and must not masquerade as "you're on the free plan".
    if (subRes.error || !subRes.data) {
      setError(subRes.error || 'Failed to load your plan');
      return;
    }
    setState(subRes.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sub = state?.subscription ?? null;
  const entitledPlan: PlanCode = state?.usage.plan_code ?? 'TILL';

  const startPlan = async (code: PlanCode) => {
    if (code === 'TILL' || busy) return;
    setBusy(code);
    const { data, error: err } = await api.subscribe(code);
    setBusy(null);

    if (err || !data) {
      onNotify(err || 'Could not start the plan', 'error');
      return;
    }
    if (!data.pay_url) {
      onNotify('The invoice was created but no payment link came back. Check your email.', 'error');
      return;
    }
    // The invoice is also emailed, so leaving the app is safe: the owner can
    // pay from either place and the plan activates on YeboPay's webhook.
    window.location.href = data.pay_url;
  };

  const cancelPlan = async () => {
    if (busy) return;
    setBusy('cancel');
    const { data, error: err } = await api.cancelSubscription();
    setBusy(null);

    if (err || !data) {
      onNotify(err || 'Could not cancel the plan', 'error');
      return;
    }
    onNotify(`Your plan runs until ${formatDate(data.ends_at)}.`, 'success');
    load();
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <ArrowPathIcon className="w-8 h-8 animate-spin mx-auto text-slate-400" />
        <p className="text-slate-400 mt-2">Loading your plan…</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="text-center py-10">
        <ExclamationTriangleIcon className="w-10 h-10 mx-auto text-red-400 mb-3" />
        <p className="text-red-300 mb-4">{error}</p>
        <Button variant="secondary" onClick={load}>
          Retry
        </Button>
      </Card>
    );
  }

  const metered = (state?.usage.allowances ?? []).filter((a) => a.allowance !== null);

  return (
    <div className="space-y-6">
      {/* Unpaid cycle — the single most useful thing to surface. */}
      {sub && sub.pay_url && (sub.status === 'PENDING' || sub.status === 'PAST_DUE') && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <ExclamationTriangleIcon className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-100 flex-1">
            {sub.status === 'PENDING'
              ? `Your ${sub.plan_code === 'BUSY' ? 'Busy' : 'Shop'} plan starts once invoice ${sub.invoice_number ?? ''} is paid.`
              : `Invoice ${sub.invoice_number ?? ''} went unpaid, so you're back on the free Till plan for now.`}
          </p>
          <Button variant="primary" onClick={() => (window.location.href = sub.pay_url!)}>
            Pay now
          </Button>
        </div>
      )}

      {/* Current entitlement + this month's usage. */}
      <Card gradient={entitledPlan === 'TILL' ? undefined : 'emerald'}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-sm text-slate-400">Your plan</p>
            <p className="text-2xl font-bold text-white mt-1">
              {plans.find((p) => p.code === entitledPlan)?.name ?? 'Till'}
            </p>
          </div>
          {sub && <Badge variant={STATUS_COPY[sub.status].variant}>{STATUS_COPY[sub.status].label}</Badge>}
        </div>

        {sub?.status === 'ACTIVE' && (
          <p className="text-sm text-slate-400 mb-4">
            {sub.cancel_at_period_end
              ? `Ends ${formatDate(sub.current_period_end)}. You keep everything until then.`
              : `Renews ${formatDate(sub.current_period_end)}.`}
          </p>
        )}

        {metered.length > 0 ? (
          <div className="space-y-3">
            {metered.map((a) => {
              const allowance = a.allowance ?? 0;
              const pct = allowance > 0 ? Math.min(100, (a.used / allowance) * 100) : 0;
              const spent = (a.remaining ?? 0) <= 0;
              return (
                <div key={a.action}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{ACTION_LABELS[a.action] ?? a.action}</span>
                    <span className={spent ? 'text-amber-400' : 'text-slate-400'}>
                      {a.used} / {allowance}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${spent ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-slate-500 pt-1">
              Anything beyond your allowance uses credits, so nothing stops working.
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            Everything you use is on credits. A plan below covers the day-to-day and works out cheaper.
          </p>
        )}
      </Card>

      {/* The plans themselves. */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Plans</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.code === entitledPlan;
            const isFree = plan.code === 'TILL';
            return (
              <Card
                key={plan.code}
                gradient={plan.code === 'SHOP' ? 'amber' : undefined}
                className="flex flex-col"
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-white">{plan.name}</h3>
                  {isCurrent && <Badge variant="success">Current</Badge>}
                </div>
                <p className="text-sm text-slate-400 mb-3">{plan.tagline}</p>

                <p className="mb-4">
                  <span className="text-3xl font-bold text-white">
                    {isFree ? 'Free' : szl(plan.price_szl)}
                  </span>
                  {!isFree && <span className="text-slate-400 text-sm"> /month</span>}
                </p>

                <ul className="space-y-2 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                      <CheckIcon className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-4">
                  {isCurrent ? (
                    sub?.status === 'ACTIVE' && !sub.cancel_at_period_end ? (
                      <Button
                        variant="ghost"
                        className="w-full"
                        isLoading={busy === 'cancel'}
                        disabled={!!busy}
                        onClick={cancelPlan}
                      >
                        Cancel plan
                      </Button>
                    ) : (
                      <Button variant="secondary" className="w-full" disabled>
                        {isFree ? 'Your plan' : 'Current plan'}
                      </Button>
                    )
                  ) : isFree ? (
                    <Button variant="secondary" className="w-full" disabled>
                      Always available
                    </Button>
                  ) : (
                    <Button
                      variant={plan.code === 'SHOP' ? 'primary' : 'secondary'}
                      className="w-full"
                      leftIcon={<ChatBubbleLeftRightIcon className="w-5 h-5" />}
                      isLoading={busy === plan.code}
                      disabled={!!busy}
                      onClick={() => startPlan(plan.code)}
                    >
                      Get {plan.name}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Plans are billed by invoice, so you can pay however you like. We email it too, and your
          plan starts the moment it is paid.
        </p>
      </div>
    </div>
  );
}
