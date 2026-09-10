import { useState, useEffect, useCallback } from 'react';
import {
  BanknotesIcon,
  CalculatorIcon,
  PrinterIcon,
  LockOpenIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import api, { type CashSession, type CashSessionZReport } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Toast, useToast } from '@/components/ui/Toast';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatDateTime } from '@/types';

/**
 * Cash drawer / shift management.
 *
 * Three states:
 *  1. No open till  → capture a starting float and open one.
 *  2. Till open     → live tally of cash taken + the cash-up form (count the
 *                     drawer). On close we compute expected vs counted and the
 *                     variance.
 *  3. Just closed   → variance shown prominently + a printable Z-report.
 *
 * Every API failure is surfaced via the toast — no silent fallback.
 */
export function CashUp() {
  const { shop } = useAuthStore();
  const { toast, showToast, dismissToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<CashSession | null>(null);

  // Open-till form
  const [openingFloat, setOpeningFloat] = useState('');
  const [opening, setOpening] = useState(false);

  // Cash-up form
  const [countedCash, setCountedCash] = useState('');
  const [notes, setNotes] = useState('');
  const [closing, setClosing] = useState(false);

  // Result after cash-up
  const [zreport, setZreport] = useState<CashSessionZReport | null>(null);

  const loadCurrent = useCallback(async () => {
    setLoading(true);
    const res = await api.getCurrentCashSession();
    setLoading(false);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    setSession(res.data ?? null);
  }, [showToast]);

  useEffect(() => {
    loadCurrent();
  }, [loadCurrent]);

  const handleOpen = async () => {
    const value = parseFloat(openingFloat);
    if (isNaN(value) || value < 0) {
      showToast('Enter a valid starting float (0 or more)', 'error');
      return;
    }
    setOpening(true);
    const res = await api.openCashSession(value);
    setOpening(false);
    if (res.error || !res.data) {
      showToast(res.error || 'Failed to open till', 'error');
      return;
    }
    setSession(res.data);
    setOpeningFloat('');
    showToast('Till opened');
  };

  const handleCashUp = async () => {
    if (!session) return;
    const value = parseFloat(countedCash);
    if (isNaN(value) || value < 0) {
      showToast('Enter the counted cash amount (0 or more)', 'error');
      return;
    }
    setClosing(true);
    const res = await api.closeCashSession(session.id, value, notes.trim() || undefined);
    if (res.error || !res.data) {
      setClosing(false);
      showToast(res.error || 'Failed to cash up', 'error');
      return;
    }
    const closed = res.data;
    // Pull the full Z-report for the printable summary.
    const zres = await api.getCashSessionZReport(session.id);
    setClosing(false);
    if (zres.error || !zres.data) {
      // The session DID close — surface the report failure but still show the
      // close result so the cashier sees the variance.
      showToast(zres.error || 'Cashed up, but failed to load the Z-report', 'error');
    } else {
      setZreport(zres.data);
    }
    setSession(closed);
    setCountedCash('');
    setNotes('');
    showToast('Till cashed up');
  };

  const startNewTill = () => {
    setSession(null);
    setZreport(null);
  };

  const currencyName = shop?.currency || '';

  // ── Render helpers ──────────────────────────────────────────────────────

  const varianceTone = (variance: number) =>
    variance === 0 ? 'text-ok' : variance < 0 ? 'text-bad' : 'text-brick';

  const varianceLabel = (variance: number) => {
    if (variance === 0) return 'Balanced';
    const abs = formatCurrency(Math.abs(variance));
    return variance < 0 ? `${abs} short` : `${abs} over`;
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-shade border-t-brand animate-spin" />
      </div>
    );
  }

  const isOpen = session?.status === 'OPEN';
  const isClosed = session?.status === 'CLOSED';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <span className="eyebrow">Closing the drawer</span>
        <h1 className="mt-2.5 text-[27px] font-semibold leading-[1.15] tracking-[-0.03em]">
          Count what is in the drawer.
          <br />
          <span className="font-normal text-mute">YeboMart knows what should be there.</span>
        </h1>
      </div>

      {/* ── State 1: no open till ─────────────────────────────────────────── */}
      {!session && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 text-body">
            <LockOpenIcon className="w-5 h-5 text-brick" />
            <h2 className="text-lg font-semibold text-ink">Open till</h2>
          </div>
          <p className="text-sm text-mute">
            Count the cash you're starting the drawer with (the float) and open the till. Cash sales
            you ring up will be tallied against it.
          </p>
          <Input
            label={`Starting float${currencyName ? ` (${currencyName})` : ''}`}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={openingFloat}
            onChange={(e) => setOpeningFloat(e.target.value)}
          />
          <Button variant="primary" isLoading={opening} icon={<BanknotesIcon className="w-5 h-5" />} onClick={handleOpen}>
            Open till
          </Button>
        </div>
      )}

      {/* ── State 2: till open ────────────────────────────────────────────── */}
      {isOpen && session && (
        <>
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-ok animate-pulse" />
                <h2 className="text-lg font-semibold text-ink">Till open</h2>
              </div>
              <button
                onClick={loadCurrent}
                className="text-mute hover:text-ink text-sm flex items-center gap-1"
                title="Refresh tally"
              >
                <ArrowPathIcon className="w-4 h-4" /> Refresh
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Opening float" value={formatCurrency(session.openingFloat)} />
              <Stat label="Cash sales" value={formatCurrency(session.cashSalesTotal ?? 0)} sub={`${session.cashSalesCount ?? 0} sale(s)`} />
              <Stat label="Expected in drawer" value={formatCurrency(session.expectedCash ?? session.openingFloat)} highlight />
              <Stat
                label="Opened"
                value={session.user?.name || 'Owner'}
                sub={formatDateTime(session.openedAt)}
              />
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <CalculatorIcon className="w-5 h-5 text-brick" />
              <h2 className="text-lg font-semibold text-ink">Cash up</h2>
            </div>
            <p className="text-sm text-mute">
              Count the physical cash in the drawer and enter it. We'll compare it to the expected
              total and record any shortage or overage.
            </p>
            <Input
              label={`Counted cash${currencyName ? ` (${currencyName})` : ''}`}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
            />
            <Input
              label="Notes (optional)"
              type="text"
              placeholder="e.g. drawer short — refund not logged"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            {/* Live preview of the variance as they type. */}
            {countedCash !== '' && !isNaN(parseFloat(countedCash)) && (
              <div className="flex items-baseline justify-between border border-line bg-sand px-4 py-3.5">
                <span className="m text-[11.5px] text-mute">
                  Expected {formatCurrency(session.expectedCash ?? session.openingFloat)}
                </span>
                <span className={`m text-[15px] font-semibold ${varianceTone(parseFloat(countedCash) - (session.expectedCash ?? session.openingFloat))}`}>
                  {varianceLabel(parseFloat(countedCash) - (session.expectedCash ?? session.openingFloat))}
                </span>
              </div>
            )}

            <Button variant="success" isLoading={closing} icon={<CalculatorIcon className="w-5 h-5" />} onClick={handleCashUp}>
              Cash up &amp; close till
            </Button>
          </div>
        </>
      )}

      {/* ── State 3: just closed — variance + Z-report ────────────────────── */}
      {isClosed && session && (
        <>
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-ink mb-4">Cash-up result</h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Stat label="Expected" value={formatCurrency(session.expectedCash ?? 0)} />
              <Stat label="Counted" value={formatCurrency(session.countedCash ?? 0)} />
              <Stat label="Variance" value={formatCurrency(session.variance ?? 0)} />
            </div>
            <div className={`flex items-center justify-between border bg-cream px-5 py-4 ${
              (session.variance ?? 0) === 0
                ? 'border-ok'
                : (session.variance ?? 0) < 0
                  ? 'border-bad'
                  : 'border-warn'
            }`}>
              <div>
                <p className={`eyebrow ${
                  (session.variance ?? 0) === 0 ? 'text-ok' : (session.variance ?? 0) < 0 ? 'text-bad' : 'text-warn'
                }`}>
                  Variance
                </p>
                <p className={`m mt-1.5 text-[32px] font-semibold leading-none tracking-[-0.03em] ${varianceTone(session.variance ?? 0)}`}>
                  {varianceLabel(session.variance ?? 0)}
                </p>
              </div>
              {(session.variance ?? 0) !== 0 && (
                <ExclamationTriangleIcon className={`h-8 w-8 ${varianceTone(session.variance ?? 0)}`} />
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <Button variant="secondary" icon={<PrinterIcon className="w-5 h-5" />} onClick={() => window.print()} disabled={!zreport}>
                Print Z-report
              </Button>
              <Button variant="primary" icon={<LockOpenIcon className="w-5 h-5" />} onClick={startNewTill}>
                Open a new till
              </Button>
            </div>
          </div>

          {zreport && <ZReportCard z={zreport} shopName={shop?.name} />}
        </>
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`border p-3.5 ${highlight ? 'border-line-strong bg-sand' : 'border-line bg-cream'}`}>
      <p className="eyebrow">{label}</p>
      <p className={`m mt-1.5 truncate text-[19px] font-semibold tracking-[-0.02em]`}>{value}</p>
      {sub && <p className="m mt-1 truncate text-[10.5px] text-mute">{sub}</p>}
    </div>
  );
}

/**
 * Printable Z-report. Visible on screen (dark) and rendered as a white card for
 * print via the #zreport-print rule in index.css.
 */
function ZReportCard({ z, shopName }: { z: CashSessionZReport; shopName?: string }) {
  return (
    <div className="card p-6">
      <h3 className="text-base font-semibold text-ink mb-3">Z-Report</h3>

      {/* On-screen dark version */}
      <div className="space-y-2 text-sm">
        <Row label="Transactions" value={String(z.transactionCount)} />
        <Row label="Gross sales" value={formatCurrency(z.gross)} />
        <Row label="Discounts" value={formatCurrency(z.totalDiscount)} />
        <Row label="Net sales" value={formatCurrency(z.net)} />
        <div className="border-t border-line my-2" />
        {z.byPaymentMethod.map((m) => (
          <Row key={m.method} label={`${m.method} (${m.count})`} value={formatCurrency(m.total)} />
        ))}
        <div className="border-t border-line my-2" />
        <Row label="Opening float" value={formatCurrency(z.session.openingFloat)} />
        <Row label="Expected cash" value={formatCurrency(z.session.expectedCash ?? 0)} />
        <Row label="Counted cash" value={formatCurrency(z.session.countedCash ?? 0)} />
        <Row label="Variance" value={formatCurrency(z.session.variance ?? 0)} strong />
      </div>

      {/* Print-only white card (hidden on screen) */}
      <div id="zreport-print" className="hidden print:block bg-cream text-black p-6" style={{ fontFamily: 'monospace' }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 'bold', fontSize: 18 }}>{shopName || z.shop?.name || 'YeboMart'}</div>
          <div style={{ fontSize: 14 }}>Z-REPORT — END OF SHIFT</div>
          <div style={{ fontSize: 12 }}>
            {formatDateTime(z.session.openedAt)} → {z.session.closedAt ? formatDateTime(z.session.closedAt) : '—'}
          </div>
          {z.session.cashier?.name && <div style={{ fontSize: 12 }}>Cashier: {z.session.cashier.name}</div>}
        </div>
        <hr />
        <PrintRow label="Transactions" value={String(z.transactionCount)} />
        <PrintRow label="Gross sales" value={formatCurrency(z.gross)} />
        <PrintRow label="Discounts" value={formatCurrency(z.totalDiscount)} />
        <PrintRow label="Net sales" value={formatCurrency(z.net)} />
        <hr />
        <div style={{ fontWeight: 'bold', margin: '6px 0' }}>By payment method</div>
        {z.byPaymentMethod.map((m) => (
          <PrintRow key={m.method} label={`${m.method} (${m.count})`} value={formatCurrency(m.total)} />
        ))}
        <hr />
        <PrintRow label="Opening float" value={formatCurrency(z.session.openingFloat)} />
        <PrintRow label="Expected cash" value={formatCurrency(z.session.expectedCash ?? 0)} />
        <PrintRow label="Counted cash" value={formatCurrency(z.session.countedCash ?? 0)} />
        <PrintRow label="VARIANCE" value={formatCurrency(z.session.variance ?? 0)} bold />
        {z.session.notes && <div style={{ fontSize: 12, marginTop: 8 }}>Notes: {z.session.notes}</div>}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-mute">{label}</span>
      <span className={strong ? 'font-bold text-ink' : 'text-ink'}>{value}</span>
    </div>
  );
}

function PrintRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: bold ? 'bold' : 'normal', fontSize: 13 }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
