import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BanknotesIcon,
  ShoppingCartIcon,
  CubeIcon,
  UsersIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { useToast } from '@/components/ui/useToast';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency } from '@/types';
import api from '@/api/client';
import type { ProductReport, StaffReport, SalesReport, ReportEvidence, ReportTotals } from '@/api/client';
import { downloadCsv, reportFilename } from '@/lib/exportReport';

type Period = 'today' | 'week' | 'month';
type Tab = 'summary' | 'products' | 'staff';

/** Authoritative server figures; the offline cache has no return evidence. */
interface ReportMetrics {
  accounting: SalesReport['summary'];
  totalRevenue: number;
  totalTax: number;
  totalCost: number;
  grossProfit: number;
  periodExpenses: number;
  netProfit: number;
  totalTransactions: number;
  avgBasket: number;
  topProducts: { name: string; qty: number; revenue: number }[];
  stockValue: number;
  lowStockCount: number;
  totalProducts: number;
}

export function Reports() {
  const { t } = useTranslation();
  const { shop } = useAuthStore();
  const { toast, showToast, dismissToast } = useToast();
  const summaryRequest = useRef(0);
  const detailRequest = useRef(0);
  const [period, setPeriod] = useState<Period>('today');
  const [tab, setTab] = useState<Tab>('summary');

  // ── Summary tab: server-backed metrics (the authoritative source) ─────────
  // Null until loaded; failures surface via an error card, never a silent
  // empty/local fallback.
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // ── Products / Staff tabs: server-backed reports ──────────────────────────
  const [productReport, setProductReport] = useState<ProductReport | null>(null);
  const [staffReport, setStaffReport] = useState<StaffReport | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [serverLoading, setServerLoading] = useState(false);

  // Period → absolute [start, end] range, recomputed per load.
  const rangeFor = (p: Period): { start: Date; end: Date } => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (p === 'today') return { start: todayStart, end: now };
    if (p === 'week') {
      return {
        start: new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000),
        end: now,
      };
    }
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  };

  useEffect(() => {
    if (!shop) return;
    loadSummary();
    loadServerReports();
    return () => {
      summaryRequest.current++;
      detailRequest.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop, period]);

  // Map the authoritative server sales report into the page's metrics shape.
  const fromServer = (report: SalesReport): ReportMetrics => {
    const s = report.summary;
    const stock = report.stock;
    return {
      accounting: s,
      // Net of VAT — non-VAT shops have totalTax 0, so netRevenue === totalSales.
      totalRevenue: s.netRevenue,
      totalTax: s.totalTax,
      totalCost: s.totalCost,
      grossProfit: s.grossProfit,
      periodExpenses: s.totalExpenses,
      netProfit: s.netProfit,
      totalTransactions: s.totalTransactions,
      avgBasket: s.averageBasket,
      topProducts: report.topProducts.map((p) => ({ name: p.name, qty: p.quantity, revenue: p.revenue })).slice(0, 5),
      stockValue: stock.stockValue,
      lowStockCount: stock.lowStockCount,
      totalProducts: stock.totalProducts,
    };
  };

  const loadSummary = async () => {
    const requestId = ++summaryRequest.current;
    setMetrics(null);
    setSummaryLoading(true);
    setSummaryError(null);
    const { start, end } = rangeFor(period);
    const { data, error: reqError } = await api.getSalesReport(start.toISOString(), end.toISOString());

    if (requestId !== summaryRequest.current) return;
    if (data) {
      setMetrics(fromServer(data));
    } else {
      // A real server/auth error — surface it; do NOT show misleading cached
      // numbers as if they were authoritative.
      setMetrics(null);
      setSummaryError(reqError || 'Failed to load report');
    }
    setSummaryLoading(false);
  };

  const loadServerReports = async () => {
    const requestId = ++detailRequest.current;
    setProductReport(null);
    setStaffReport(null);
    setServerLoading(true);
    setProductError(null);
    setStaffError(null);
    const { start, end } = rangeFor(period);
    const range = {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };

    const [prodRes, staffRes] = await Promise.all([api.getProductReport(range), api.getStaffReport(range)]);

    if (requestId !== detailRequest.current) return;
    if (prodRes.error || !prodRes.data) {
      const msg = prodRes.error || 'Failed to load product report';
      setProductError(msg);
      setProductReport(null);
      showToast(msg, 'error');
    } else {
      setProductReport(prodRes.data);
    }

    if (staffRes.error || !staffRes.data) {
      const msg = staffRes.error || 'Failed to load staff report';
      setStaffError(msg);
      setStaffReport(null);
      showToast(msg, 'error');
    } else {
      setStaffReport(staffRes.data);
    }

    setServerLoading(false);
  };

  const m = metrics;

  // ── Export ────────────────────────────────────────────────────────────────
  const periodLabel =
    period === 'today' ? t('reports.today') : period === 'week' ? t('reports.thisWeek') : t('reports.thisMonth');
  const tabLabel =
    tab === 'summary'
      ? t('reports.salesReport')
      : tab === 'products'
        ? t('reports.title') + '-products'
        : t('staff.title');

  const handleDownloadCsv = () => {
    const filename = reportFilename(shop?.name || 'YeboMart', tabLabel, period);
    const round = (n: number) => Number(n || 0).toFixed(2);

    if (tab === 'products') {
      if (!productReport) {
        showToast(productError || 'No product data to export', 'error');
        return;
      }
      downloadCsv(
        filename,
        ['Product', 'Category', 'Net Qty', ...accountingHeaders, 'Cost', 'Profit', 'Margin %', 'Avg Price'],
        [
          ...productReport.products.map((p) => [
            p.name,
            p.category,
            p.quantitySold,
            ...accountingValues(p).map(round),
            round(p.cost),
            round(p.profit),
            round(p.margin),
            round(p.averagePrice),
          ]),
          ...evidenceCsv(productReport.adjustments),
        ],
      );
      showToast('CSV downloaded');
      return;
    }

    if (tab === 'staff') {
      if (!staffReport) {
        showToast(staffError || 'No staff data to export', 'error');
        return;
      }
      downloadCsv(
        filename,
        ['Staff', 'Role', ...accountingHeaders, 'Transactions', 'Avg Transaction', 'Voids'],
        [
          ...staffReport.staff.map((s) => [
            s.name,
            s.role,
            ...accountingValues(s).map(round),
            s.transactionCount,
            round(s.averageTransaction),
            s.voidCount,
          ]),
          ...evidenceCsv(staffReport.adjustments),
        ],
      );
      showToast('CSV downloaded');
      return;
    }

    // Summary: a metric/value table for the selected period, sourced from the
    // authoritative server report (not the local cache).
    if (!m) {
      showToast(summaryError || 'No report data to export', 'error');
      return;
    }
    downloadCsv(
      filename,
      ['Metric', 'Value (SZL)'],
      [
        ['Period', periodLabel],
        ...summaryAdjustments(m.accounting).map(([label, value]) => [label, round(value)]),
        ...evidenceCsv(m.accounting),

        ...(m.totalTax > 0 ? [['Net VAT', round(m.totalTax)]] : []),
        ['Cost of Goods', round(m.totalCost)],
        ['Gross Profit', round(m.grossProfit)],
        ['Expenses', round(m.periodExpenses)],
        ['Net Profit', round(m.netProfit)],
        ['Transactions', m.totalTransactions],
        ['Average Basket', round(m.avgBasket)],
        ['Stock Value', round(m.stockValue)],
        ['Low Stock Items', m.lowStockCount],
      ],
    );
    showToast('CSV downloaded');
  };

  const handleDownloadPdf = () => {
    // Reuse the app's print-to-PDF path: the hidden #report-print card mirrors
    // the active tab; the browser's print dialog → "Save as PDF".
    if (tab === 'summary' && !m) {
      showToast(summaryError || 'No report data to export', 'error');
      return;
    }
    if (tab === 'products' && !productReport) {
      showToast(productError || 'No product data to export', 'error');
      return;
    }
    if (tab === 'staff' && !staffReport) {
      showToast(staffError || 'No staff data to export', 'error');
      return;
    }
    window.print();
  };

  return (
    <div className="space-y-6">
      <Toast toast={toast} onDismiss={dismissToast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('reports.title')}</h1>
          <p className="text-mute mt-1">Track your business performance</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={period === 'today' ? 'primary' : 'secondary'} size="sm" onClick={() => setPeriod('today')}>
            {t('reports.today')}
          </Button>
          <Button variant={period === 'week' ? 'primary' : 'secondary'} size="sm" onClick={() => setPeriod('week')}>
            {t('reports.thisWeek')}
          </Button>
          <Button variant={period === 'month' ? 'primary' : 'secondary'} size="sm" onClick={() => setPeriod('month')}>
            {t('reports.thisMonth')}
          </Button>
        </div>
      </div>

      {/* Tabs + export actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button variant={tab === 'summary' ? 'primary' : 'secondary'} size="sm" onClick={() => setTab('summary')}>
            {t('reports.salesReport')}
          </Button>
          <Button variant={tab === 'products' ? 'primary' : 'secondary'} size="sm" onClick={() => setTab('products')}>
            {t('reports.title')} · Products
          </Button>
          <Button variant={tab === 'staff' ? 'primary' : 'secondary'} size="sm" onClick={() => setTab('staff')}>
            {t('staff.title')}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleDownloadCsv}>
            <ArrowDownTrayIcon className="w-4 h-4 mr-1.5" />
            {t('reports.downloadCsv')}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleDownloadPdf}>
            <PrinterIcon className="w-4 h-4 mr-1.5" />
            {t('reports.downloadPdf')}
          </Button>
        </div>
      </div>

      {/* ── Summary tab (server-backed) ── */}
      {tab === 'summary' && (
        <>
          {/* Loading state */}
          {summaryLoading && !m && (
            <div className="flex flex-col items-center justify-center py-20 text-mute">
              <ArrowPathIcon className="w-10 h-10 animate-spin mb-3" />
              <p>Loading report…</p>
            </div>
          )}

          {/* Error state — a real server/auth failure. No misleading numbers. */}
          {!summaryLoading && summaryError && !m && (
            <Card>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ExclamationTriangleIcon className="w-12 h-12 text-bad mb-3" />
                <h3 className="text-lg font-semibold text-ink mb-1">Couldn't load report</h3>
                <p className="text-mute mb-4 max-w-sm">{summaryError}</p>
                <Button variant="primary" size="sm" onClick={loadSummary}>
                  <ArrowPathIcon className="w-4 h-4 mr-1" />
                  Try again
                </Button>
              </div>
            </Card>
          )}

          {m && (
            <>
              <AccountingSummary summary={m.accounting} />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-ok/20 rounded-sharp">
                      <BanknotesIcon className="w-6 h-6 text-ok" />
                    </div>
                    <div>
                      <p className="text-sm text-mute">Net revenue (excluding VAT)</p>
                      <p className="m text-2xl font-bold text-ink">{formatCurrency(m.totalRevenue)}</p>
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-sand/20 rounded-sharp">
                      <ArrowTrendingUpIcon className="w-6 h-6 text-body" />
                    </div>
                    <div>
                      <p className="text-sm text-mute">Net Profit</p>
                      <p className="m text-2xl font-bold text-ink">{formatCurrency(m.netProfit)}</p>
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-wash rounded-sharp">
                      <ShoppingCartIcon className="w-6 h-6 text-brick" />
                    </div>
                    <div>
                      <p className="text-sm text-mute">Transactions</p>
                      <p className="text-2xl font-bold text-ink">{m.totalTransactions}</p>
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-ink/20 rounded-sharp">
                      <ChartBarIcon className="w-6 h-6 text-brick" />
                    </div>
                    <div>
                      <p className="text-sm text-mute">{t('reports.averageSale')}</p>
                      <p className="m text-2xl font-bold text-ink">{formatCurrency(m.avgBasket)}</p>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <Card>
                  <h3 className="text-lg font-semibold text-ink mb-4">{t('reports.topSelling')}</h3>
                  {m.topProducts.length > 0 ? (
                    <div className="space-y-3">
                      {m.topProducts.map((product, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-shade/30 rounded-sharp">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-wash text-brick flex items-center justify-center text-sm font-bold">
                              {idx + 1}
                            </span>
                            <div>
                              <p className="font-medium text-ink">{product.name}</p>
                              <p className="text-sm text-mute">{product.qty} sold</p>
                            </div>
                          </div>
                          <p className="m font-semibold text-ok">{formatCurrency(product.revenue)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-mute">
                      <ChartBarIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No sales data yet</p>
                    </div>
                  )}
                </Card>

                <Card>
                  <h3 className="text-lg font-semibold text-ink mb-4">{t('reports.stockReport')}</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-shade/30 rounded-sharp">
                      <div className="flex items-center gap-3">
                        <CubeIcon className="w-6 h-6 text-body" />
                        <span className="text-body">Total Products</span>
                      </div>
                      <span className="text-xl font-bold text-ink">{m.totalProducts}</span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-shade/30 rounded-sharp">
                      <div className="flex items-center gap-3">
                        <BanknotesIcon className="w-6 h-6 text-ok" />
                        <span className="text-body">Stock Value</span>
                      </div>
                      <span className="m text-xl font-bold text-ok">{formatCurrency(m.stockValue)}</span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-shade/30 rounded-sharp">
                      <div className="flex items-center gap-3">
                        <ArrowTrendingDownIcon className="w-6 h-6 text-bad" />
                        <span className="text-body">Low Stock Items</span>
                      </div>
                      <span className="text-xl font-bold text-bad">{m.lowStockCount}</span>
                    </div>
                  </div>
                </Card>
              </div>

              <Card>
                <h3 className="text-lg font-semibold text-ink mb-4">{t('reports.profitReport')}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div className="text-center p-4 bg-shade/30 rounded-sharp">
                    <p className="text-sm text-mute">
                      Net revenue (excluding VAT)
                      {m.totalTax > 0 ? ' (net)' : ''}
                    </p>
                    <p className="m text-xl font-bold text-ink">{formatCurrency(m.totalRevenue)}</p>
                  </div>
                  {m.totalTax > 0 && (
                    <div className="text-center p-4 bg-shade/30 rounded-sharp">
                      <p className="text-sm text-mute">Net VAT</p>
                      <p className="m text-xl font-bold text-body">{formatCurrency(m.totalTax)}</p>
                    </div>
                  )}
                  <div className="text-center p-4 bg-shade/30 rounded-sharp">
                    <p className="text-sm text-mute">Cost of Goods</p>
                    <p className="m text-xl font-bold text-bad">{formatCurrency(m.totalCost)}</p>
                  </div>
                  <div className="text-center p-4 bg-shade/30 rounded-sharp">
                    <p className="text-sm text-mute">Gross Profit</p>
                    <p className="m text-xl font-bold text-ink">{formatCurrency(m.grossProfit)}</p>
                  </div>
                  <div className="text-center p-4 bg-shade/30 rounded-sharp">
                    <p className="text-sm text-mute">Expenses</p>
                    <p className="m text-xl font-bold text-brick">{formatCurrency(m.periodExpenses)}</p>
                  </div>
                  <div className="text-center p-4 bg-shade/30 rounded-sharp">
                    <p className="text-sm text-mute">Net Profit</p>
                    <p className={`text-xl font-bold ${m.netProfit >= 0 ? 'text-ok' : 'text-bad'}`}>
                      {formatCurrency(m.netProfit)}
                    </p>
                    {m.totalRevenue > 0 && (
                      <p className="text-xs text-mute">
                        {((m.netProfit / m.totalRevenue) * 100).toFixed(1)}% {t('reports.margin').toLowerCase()}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </>
          )}
        </>
      )}

      {/* ── Products tab (server-backed) ── */}
      {tab === 'products' && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <CubeIcon className="w-5 h-5 text-body" />
            <h3 className="text-lg font-semibold text-ink">Product Performance</h3>
            <span className="text-xs text-mist ml-auto">{periodLabel}</span>
          </div>
          <EvidenceNotice evidence={productReport?.adjustments} />
          {serverLoading ? (
            <p className="text-center py-8 text-mute">Loading…</p>
          ) : productError ? (
            <div className="text-center py-8 text-bad">
              <p className="font-medium">Couldn't load product report</p>
              <p className="text-sm text-mute mt-1">{productError}</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={loadServerReports}>
                Retry
              </Button>
            </div>
          ) : !productReport || productReport.products.length === 0 ? (
            <div className="text-center py-8 text-mute">
              <ChartBarIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No product sales in this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-line-strong">
                    <th className="eyebrow py-2 pr-4">Product</th>
                    <th className="eyebrow py-2 px-4">Category</th>
                    <th className="eyebrow py-2 px-4 text-right">Qty</th>
                    <AccountingHead />
                    <th className="eyebrow py-2 px-4 text-right">Profit</th>
                    <th className="eyebrow py-2 pl-4 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {productReport.products.map((p) => (
                    <tr key={JSON.stringify([p.id, p.name])} className="border-b border-line">
                      <td className="py-2 pr-4 text-ink">{p.name}</td>
                      <td className="py-2 px-4 text-mute">{p.category}</td>
                      <td className="py-2 px-4 text-right text-body">{p.quantitySold}</td>
                      <AccountingCells totals={p} />
                      <td className={`m py-2 px-4 text-right ${p.profit >= 0 ? 'text-ink' : 'text-bad'}`}>
                        {formatCurrency(p.profit)}
                      </td>
                      <td className="py-2 pl-4 text-right text-body">{p.margin.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Staff tab (server-backed) ── */}
      {tab === 'staff' && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <UsersIcon className="w-5 h-5 text-brick" />
            <h3 className="text-lg font-semibold text-ink">Staff Performance</h3>
            <span className="text-xs text-mist ml-auto">{periodLabel}</span>
          </div>
          <EvidenceNotice evidence={staffReport?.adjustments} />
          {serverLoading ? (
            <p className="text-center py-8 text-mute">Loading…</p>
          ) : staffError ? (
            <div className="text-center py-8 text-bad">
              <p className="font-medium">Couldn't load staff report</p>
              <p className="text-sm text-mute mt-1">{staffError}</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={loadServerReports}>
                Retry
              </Button>
            </div>
          ) : !staffReport || staffReport.staff.length === 0 ? (
            <div className="text-center py-8 text-mute">
              <UsersIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No staff activity in this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-line-strong">
                    <th className="eyebrow py-2 pr-4">Staff</th>
                    <th className="eyebrow py-2 px-4">Role</th>
                    <AccountingHead />
                    <th className="eyebrow py-2 px-4 text-right">Txns</th>
                    <th className="eyebrow py-2 px-4 text-right">Avg</th>
                    <th className="eyebrow py-2 pl-4 text-right">Voids</th>
                  </tr>
                </thead>
                <tbody>
                  {staffReport.staff.map((s) => (
                    <tr key={s.id} className="border-b border-line">
                      <td className="py-2 pr-4 text-ink">{s.name}</td>
                      <td className="py-2 px-4 text-mute capitalize">{s.role.toLowerCase()}</td>
                      <AccountingCells totals={s} />
                      <td className="py-2 px-4 text-right text-body">{s.transactionCount}</td>
                      <td className="m py-2 px-4 text-right text-body">{formatCurrency(s.averageTransaction)}</td>
                      <td className={`py-2 pl-4 text-right ${s.voidCount > 0 ? 'text-bad' : 'text-body'}`}>
                        {s.voidCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Hidden printable card — mirrors the active tab for "Download PDF". */}
      <PrintableReport
        shopName={shop?.name || 'YeboMart'}
        periodLabel={periodLabel}
        tab={tab}
        summary={
          m
            ? {
                accounting: m.accounting,
                revenue: m.totalRevenue,
                tax: m.totalTax,
                costOfGoods: m.totalCost,
                grossProfit: m.grossProfit,
                expenses: m.periodExpenses,
                netProfit: m.netProfit,
                transactions: m.totalTransactions,
                avgBasket: m.avgBasket,
                stockValue: m.stockValue,
                lowStockCount: m.lowStockCount,
              }
            : null
        }
        productReport={productReport}
        staffReport={staffReport}
      />
    </div>
  );
}

// ── Printable (white, paper-friendly) report ─────────────────────────────────
// Rendered hidden on screen (`hidden print:block`); the @media print rule in
// index.css isolates #report-print so only this lands on paper / in the PDF.
function PrintableReport({
  shopName,
  periodLabel,
  tab,
  summary,
  productReport,
  staffReport,
}: {
  shopName: string;
  periodLabel: string;
  tab: Tab;
  summary: {
    accounting: SalesReport['summary'];
    revenue: number;
    tax: number;
    costOfGoods: number;
    grossProfit: number;
    expenses: number;
    netProfit: number;
    transactions: number;
    avgBasket: number;
    stockValue: number;
    lowStockCount: number;
  } | null;
  productReport: ProductReport | null;
  staffReport: StaffReport | null;
}) {
  const title =
    tab === 'summary' ? 'Sales & Profit Summary' : tab === 'products' ? 'Product Performance' : 'Staff Performance';
  const th = 'text-left border-b border-line-strong py-1 px-2 font-semibold';
  const td = 'border-b border-line py-1 px-2';

  return (
    <div id="report-print" className="hidden print:block bg-cream text-black p-6 text-sm">
      <div className="mb-4">
        <h1 className="text-xl font-bold">{shopName}</h1>
        <p className="text-base font-semibold">{title}</p>
        <p className="text-xs text-mist">
          Period: {periodLabel} · Generated {new Date().toLocaleString()}
        </p>
      </div>

      <EvidenceNotice
        evidence={
          tab === 'summary'
            ? summary?.accounting
            : tab === 'products'
              ? productReport?.adjustments
              : staffReport?.adjustments
        }
      />
      {tab === 'summary' && summary && (
        <table className="w-full">
          <tbody>
            {[
              ...summaryAdjustments(summary.accounting).map(([label, value]) => [label, formatCurrency(value)]),

              ['Cost of Goods', formatCurrency(summary.costOfGoods)],
              ['Gross Profit', formatCurrency(summary.grossProfit)],
              ['Expenses', formatCurrency(summary.expenses)],
              ['Net Profit', formatCurrency(summary.netProfit)],
              ['Transactions', String(summary.transactions)],
              ['Average Basket', formatCurrency(summary.avgBasket)],
              ['Stock Value', formatCurrency(summary.stockValue)],
              ['Low Stock Items', String(summary.lowStockCount)],
            ].map(([k, v]) => (
              <tr key={k}>
                <td className={`${td} font-medium`}>{k}</td>
                <td className={`${td} text-right`}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'products' && productReport && (
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Product</th>
              <th className={th}>Category</th>
              <th className={`${th} text-right`}>Qty</th>
              <AccountingHead />
              <th className={`${th} text-right`}>Profit</th>
              <th className={`${th} text-right`}>Margin</th>
            </tr>
          </thead>
          <tbody>
            {productReport.products.map((p) => (
              <tr key={JSON.stringify([p.id, p.name])}>
                <td className={td}>{p.name}</td>
                <td className={td}>{p.category}</td>
                <td className={`${td} text-right`}>{p.quantitySold}</td>
                <AccountingCells totals={p} />
                <td className={`${td} text-right`}>{formatCurrency(p.profit)}</td>
                <td className={`${td} text-right`}>{p.margin.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'staff' && staffReport && (
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Staff</th>
              <th className={th}>Role</th>
              <AccountingHead />
              <th className={`${th} text-right`}>Txns</th>
              <th className={`${th} text-right`}>Avg</th>
              <th className={`${th} text-right`}>Voids</th>
            </tr>
          </thead>
          <tbody>
            {staffReport.staff.map((s) => (
              <tr key={s.id}>
                <td className={td}>{s.name}</td>
                <td className={td}>{s.role.toLowerCase()}</td>
                <AccountingCells totals={s} />
                <td className={`${td} text-right`}>{s.transactionCount}</td>
                <td className={`${td} text-right`}>{formatCurrency(s.averageTransaction)}</td>
                <td className={`${td} text-right`}>{s.voidCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const accountingHeaders = [
  'Gross sales (incl. VAT)',
  'Returns (incl. VAT)',
  'Exchange out (incl. VAT)',
  'Net sales (incl. VAT)',
  'Net VAT',
  'Net revenue (excl. VAT)',
];
const accountingValues = (s: ReportTotals) => [
  s.grossSales,
  s.returns,
  s.exchangeSales,
  s.totalSales,
  s.totalTax,
  s.netRevenue,
];
function AccountingHead() {
  return (
    <>
      {accountingHeaders.map((label) => (
        <th key={label} className="py-2 px-4 text-right">
          {label}
        </th>
      ))}
    </>
  );
}
function AccountingCells({ totals }: { totals: ReportTotals }) {
  return (
    <>
      {accountingValues(totals).map((value, i) => (
        <td key={accountingHeaders[i]} className="py-2 px-4 text-right">
          {formatCurrency(value)}
        </td>
      ))}
    </>
  );
}
function summaryAdjustments(s: SalesReport['summary']): [string, number][] {
  return [
    ...accountingHeaders.map((label, i): [string, number] => [label, accountingValues(s)[i]]),
    ['Sale VAT', s.salesTax],
    ['Returned VAT', s.returnedTax],
    ['Exchange VAT', s.exchangeTax],
    ['Sale COGS', s.grossCost],
    ['Restocked COGS reversed', s.reversedCost],
    ['Exchange COGS', s.exchangeCost],
    ['Receiptless adjustments (excluded; tax/cost unknown)', s.receiptlessReturns],
    ['Exchange value without tax/cost evidence (excluded)', s.unvaluedExchange],
  ];
}
function EvidenceNotice({ evidence }: { evidence?: ReportEvidence | null }) {
  return (
    <div className="text-sm my-3" role="note">
      <p>
        Returns use completion date, including earlier receipts. Returned sales are attributed to the original cashier;
        exchanges to the processing staff. Account credits and debt reversals are merchandise returns, not cash payouts.
      </p>
      {evidence && (evidence.receiptlessCount > 0 || evidence.unvaluedExchangeCount > 0) && (
        <p className="text-bad font-semibold">
          Profit is incomplete: receiptless adjustments {formatCurrency(evidence.receiptlessReturns)} (
          {evidence.receiptlessCount} returns) and exchanges without tax/cost evidence{' '}
          {formatCurrency(evidence.unvaluedExchange)} ({evidence.unvaluedExchangeCount} lines) are excluded from
          revenue, VAT and profit. Original evidence is required to value them.
        </p>
      )}
    </div>
  );
}
function AccountingSummary({ summary }: { summary: SalesReport['summary'] }) {
  return (
    <Card>
      <h3 className="font-semibold">Sales and return reconciliation</h3>
      <EvidenceNotice evidence={summary} />
      <dl className="grid grid-cols-2 gap-3">
        {summaryAdjustments(summary).map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-mute">{label}</dt>
            <dd>{formatCurrency(value)}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function evidenceCsv(e: ReportEvidence): (string | number)[][] {
  return [
    ['Receiptless adjustments excluded (unknown tax/cost)', e.receiptlessReturns],
    ['Unvalued exchanges excluded (unknown tax/cost)', e.unvaluedExchange],
    ['Profit complete', e.receiptlessCount === 0 && e.unvaluedExchangeCount === 0 ? 'Yes' : 'No'],
    [
      'Basis',
      'Completion date; original cashier for returns; exchange processor for outgoing merchandise. Credits are not cash payouts.',
    ],
  ];
}
