import { useState, useEffect } from 'react';
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
  WifiIcon,
} from '@heroicons/react/24/outline';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toast, useToast } from '@/components/ui/Toast';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { formatCurrency } from '@/types';
import api, { NETWORK_ERROR } from '@/api/client';
import type { ProductReport, StaffReport } from '@/api/client';
import { downloadCsv, reportFilename } from '@/lib/exportReport';

type Period = 'today' | 'week' | 'month';
type Tab = 'summary' | 'products' | 'staff';

/**
 * Normalised metrics the Summary tab renders. Built from the authoritative
 * server report; the local-cache fallback (offline only) is mapped into the
 * same shape so the JSX has a single source to read from.
 */
interface ReportMetrics {
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
  const { products, sales, expenses, loadAll } = useInventoryStore();
  const { toast, showToast, dismissToast } = useToast();
  const [period, setPeriod] = useState<Period>('today');
  const [tab, setTab] = useState<Tab>('summary');

  // ── Summary tab: server-backed metrics (the authoritative source) ─────────
  // Null until loaded; failures surface via an error card, never a silent
  // empty/local fallback. The local cache is only used offline, behind a banner.
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  // True when the figures shown come from the local cache because the device
  // is offline — surfaced to the user via a banner, never silently.
  const [usingCache, setUsingCache] = useState(false);

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
      return { start: new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000), end: now };
    }
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  };

  useEffect(() => {
    if (!shop) return;
    loadAll(shop.id);
    loadSummary();
    loadServerReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop, period]);

  // Map the authoritative server sales report into the page's metrics shape.
  const fromServer = (report: any): ReportMetrics => {
    const s = report.summary ?? {};
    const stock = report.stock ?? {};
    return {
      // Net of VAT — non-VAT shops have totalTax 0, so netRevenue === totalSales.
      totalRevenue: s.netRevenue ?? s.totalSales ?? 0,
      totalTax: s.totalTax ?? 0,
      totalCost: s.totalCost ?? 0,
      grossProfit: s.grossProfit ?? 0,
      periodExpenses: s.totalExpenses ?? 0,
      netProfit: s.netProfit ?? 0,
      totalTransactions: s.totalTransactions ?? 0,
      avgBasket: s.averageBasket ?? 0,
      topProducts: (report.topProducts ?? [])
        .map((p: any) => ({ name: p.name, qty: p.quantity, revenue: p.revenue }))
        .slice(0, 5),
      stockValue: stock.stockValue ?? 0,
      lowStockCount: stock.lowStockCount ?? 0,
      totalProducts: stock.totalProducts ?? 0,
    };
  };

  // Recompute Summary metrics from the locally-cached store. Used ONLY as an
  // explicit offline fallback — incomplete on a fresh device, so the page flags it.
  const computeFromCache = (): ReportMetrics => {
    const { start } = rangeFor(period);
    const filteredSales = sales.filter(s => new Date(s.createdAt) >= start);
    // Gross takings (what customers paid). VAT collected is owed to the revenue
    // authority, not income — so revenue/profit are reckoned NET of VAT. Non-VAT
    // shops have tax 0, so netRevenue === grossTakings (unchanged). Mirrors the
    // server report.service netting.
    const grossTakings = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalTax = filteredSales.reduce((sum, s) => sum + (s.tax || 0), 0);
    const totalRevenue = grossTakings - totalTax;
    const totalTransactions = filteredSales.length;

    let totalCost = 0;
    const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
    for (const sale of filteredSales) {
      for (const item of sale.items) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          totalCost += product.costPrice * item.quantity;
        }
        if (!productSales[item.productId]) {
          productSales[item.productId] = { name: item.productName, qty: 0, revenue: 0 };
        }
        productSales[item.productId].qty += item.quantity;
        productSales[item.productId].revenue += item.totalPrice;
      }
    }
    // Gross profit = net revenue - COGS (matches the server report.service).
    const grossProfit = totalRevenue - totalCost;

    const periodExpenses = expenses
      .filter(e => new Date(e.date) >= start)
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      totalRevenue,
      totalTax,
      totalCost,
      grossProfit,
      periodExpenses,
      netProfit: grossProfit - periodExpenses,
      totalTransactions,
      avgBasket: totalTransactions > 0 ? grossTakings / totalTransactions : 0,
      topProducts: Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
      stockValue: products.reduce((sum, p) => sum + p.costPrice * p.quantity, 0),
      lowStockCount: products.filter(p => p.quantity <= p.reorderAt).length,
      totalProducts: products.length,
    };
  };

  const loadSummary = async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    const { start, end } = rangeFor(period);
    const { data, error: reqError } = await api.getSalesReport(
      start.toISOString(),
      end.toISOString(),
    );

    if (data) {
      setMetrics(fromServer(data));
      setUsingCache(false);
    } else if (reqError === NETWORK_ERROR) {
      // Offline: fall back to the local cache, but flag it loudly so the user
      // knows the figures may be incomplete (never silent — CLAUDE.md rule).
      setMetrics(computeFromCache());
      setUsingCache(true);
    } else {
      // A real server/auth error — surface it; do NOT show misleading cached
      // numbers as if they were authoritative.
      setMetrics(null);
      setUsingCache(false);
      setSummaryError(reqError || 'Failed to load report');
    }
    setSummaryLoading(false);
  };

  const loadServerReports = async () => {
    setServerLoading(true);
    setProductError(null);
    setStaffError(null);
    const { start, end } = rangeFor(period);
    const range = { startDate: start.toISOString(), endDate: end.toISOString() };

    const [prodRes, staffRes] = await Promise.all([
      api.getProductReport(range),
      api.getStaffReport(range),
    ]);

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
  const periodLabel = period === 'today' ? t('reports.today') : period === 'week' ? t('reports.thisWeek') : t('reports.thisMonth');
  const tabLabel = tab === 'summary' ? t('reports.salesReport') : tab === 'products' ? t('reports.title') + '-products' : t('staff.title');

  const handleDownloadCsv = () => {
    const filename = reportFilename(shop?.name || 'YeboMart', tabLabel, period);
    const round = (n: number) => Number(n || 0).toFixed(2);

    if (tab === 'products') {
      if (!productReport || productReport.products.length === 0) {
        showToast(productError || 'No product data to export', 'error');
        return;
      }
      downloadCsv(
        filename,
        ['Product', 'Category', 'Qty Sold', 'Revenue', 'Cost', 'Profit', 'Margin %', 'Avg Price'],
        productReport.products.map(p => [
          p.name, p.category, p.quantitySold, round(p.revenue), round(p.cost), round(p.profit), round(p.margin), round(p.averagePrice),
        ]),
      );
      showToast('CSV downloaded');
      return;
    }

    if (tab === 'staff') {
      if (!staffReport || staffReport.staff.length === 0) {
        showToast(staffError || 'No staff data to export', 'error');
        return;
      }
      downloadCsv(
        filename,
        ['Staff', 'Role', 'Total Sales', 'Transactions', 'Avg Transaction', 'Voids'],
        staffReport.staff.map(s => [
          s.name, s.role, round(s.totalSales), s.transactionCount, round(s.averageTransaction), s.voidCount,
        ]),
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
        ['Revenue' + (m.totalTax > 0 ? ' (net of VAT)' : ''), round(m.totalRevenue)],
        ...(m.totalTax > 0 ? [['VAT Collected', round(m.totalTax)]] : []),
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
    if (tab === 'products' && (!productReport || productReport.products.length === 0)) {
      showToast(productError || 'No product data to export', 'error');
      return;
    }
    if (tab === 'staff' && (!staffReport || staffReport.staff.length === 0)) {
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
          <h1 className="text-2xl font-bold text-white">{t('reports.title')}</h1>
          <p className="text-slate-400 mt-1">Track your business performance</p>
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
          {/* Offline / cached banner — only when figures come from the local
              cache because the device is offline. Never silent. */}
          {usingCache && m && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
              <WifiIcon className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">
                You're offline — showing cached figures from this device. These may be
                incomplete and exclude sales made on other devices or before your last sync.
              </p>
              <Button variant="secondary" size="sm" onClick={loadSummary} className="ml-auto">
                Retry
              </Button>
            </div>
          )}

          {/* Loading state */}
          {summaryLoading && !m && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <ArrowPathIcon className="w-10 h-10 animate-spin mb-3" />
              <p>Loading report…</p>
            </div>
          )}

          {/* Error state — a real server/auth failure. No misleading numbers. */}
          {!summaryLoading && summaryError && !m && (
            <Card>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ExclamationTriangleIcon className="w-12 h-12 text-red-400 mb-3" />
                <h3 className="text-lg font-semibold text-white mb-1">Couldn't load report</h3>
                <p className="text-slate-400 mb-4 max-w-sm">{summaryError}</p>
                <Button variant="primary" size="sm" onClick={loadSummary}>
                  <ArrowPathIcon className="w-4 h-4 mr-1" />
                  Try again
                </Button>
              </div>
            </Card>
          )}

          {m && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card gradient="emerald">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                      <BanknotesIcon className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">{t('reports.revenue')}</p>
                      <p className="text-2xl font-bold text-white">{formatCurrency(m.totalRevenue)}</p>
                    </div>
                  </div>
                </Card>

                <Card gradient="blue">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <ArrowTrendingUpIcon className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Net Profit</p>
                      <p className="text-2xl font-bold text-white">{formatCurrency(m.netProfit)}</p>
                    </div>
                  </div>
                </Card>

                <Card gradient="amber">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-lg">
                      <ShoppingCartIcon className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Transactions</p>
                      <p className="text-2xl font-bold text-white">{m.totalTransactions}</p>
                    </div>
                  </div>
                </Card>

                <Card gradient="purple">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <ChartBarIcon className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">{t('reports.averageSale')}</p>
                      <p className="text-2xl font-bold text-white">{formatCurrency(m.avgBasket)}</p>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <Card>
                  <h3 className="text-lg font-semibold text-white mb-4">🏆 {t('reports.topSelling')}</h3>
                  {m.topProducts.length > 0 ? (
                    <div className="space-y-3">
                      {m.topProducts.map((product, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm font-bold">
                              {idx + 1}
                            </span>
                            <div>
                              <p className="font-medium text-white">{product.name}</p>
                              <p className="text-sm text-slate-400">{product.qty} sold</p>
                            </div>
                          </div>
                          <p className="font-semibold text-emerald-400">{formatCurrency(product.revenue)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <ChartBarIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No sales data yet</p>
                    </div>
                  )}
                </Card>

                <Card>
                  <h3 className="text-lg font-semibold text-white mb-4">📦 {t('reports.stockReport')}</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <CubeIcon className="w-6 h-6 text-blue-400" />
                        <span className="text-slate-300">Total Products</span>
                      </div>
                      <span className="text-xl font-bold text-white">{m.totalProducts}</span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <BanknotesIcon className="w-6 h-6 text-emerald-400" />
                        <span className="text-slate-300">Stock Value</span>
                      </div>
                      <span className="text-xl font-bold text-emerald-400">{formatCurrency(m.stockValue)}</span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <ArrowTrendingDownIcon className="w-6 h-6 text-red-400" />
                        <span className="text-slate-300">Low Stock Items</span>
                      </div>
                      <span className="text-xl font-bold text-red-400">{m.lowStockCount}</span>
                    </div>
                  </div>
                </Card>
              </div>

              <Card>
                <h3 className="text-lg font-semibold text-white mb-4">💰 {t('reports.profitReport')}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div className="text-center p-4 bg-slate-700/30 rounded-lg">
                    <p className="text-sm text-slate-400">{t('reports.revenue')}{m.totalTax > 0 ? ' (net)' : ''}</p>
                    <p className="text-xl font-bold text-white">{formatCurrency(m.totalRevenue)}</p>
                  </div>
                  {m.totalTax > 0 && (
                    <div className="text-center p-4 bg-slate-700/30 rounded-lg">
                      <p className="text-sm text-slate-400">VAT Collected</p>
                      <p className="text-xl font-bold text-sky-400">{formatCurrency(m.totalTax)}</p>
                    </div>
                  )}
                  <div className="text-center p-4 bg-slate-700/30 rounded-lg">
                    <p className="text-sm text-slate-400">Cost of Goods</p>
                    <p className="text-xl font-bold text-red-400">{formatCurrency(m.totalCost)}</p>
                  </div>
                  <div className="text-center p-4 bg-slate-700/30 rounded-lg">
                    <p className="text-sm text-slate-400">Gross Profit</p>
                    <p className="text-xl font-bold text-white">{formatCurrency(m.grossProfit)}</p>
                  </div>
                  <div className="text-center p-4 bg-slate-700/30 rounded-lg">
                    <p className="text-sm text-slate-400">Expenses</p>
                    <p className="text-xl font-bold text-orange-400">{formatCurrency(m.periodExpenses)}</p>
                  </div>
                  <div className="text-center p-4 bg-slate-700/30 rounded-lg">
                    <p className="text-sm text-slate-400">Net Profit</p>
                    <p className={`text-xl font-bold ${m.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(m.netProfit)}
                    </p>
                    {m.totalRevenue > 0 && (
                      <p className="text-xs text-slate-400">
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
            <CubeIcon className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Product Performance</h3>
            <span className="text-xs text-slate-500 ml-auto">{periodLabel}</span>
          </div>
          {serverLoading ? (
            <p className="text-center py-8 text-slate-400">Loading…</p>
          ) : productError ? (
            <div className="text-center py-8 text-red-400">
              <p className="font-medium">Couldn't load product report</p>
              <p className="text-sm text-slate-400 mt-1">{productError}</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={loadServerReports}>Retry</Button>
            </div>
          ) : !productReport || productReport.products.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <ChartBarIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No product sales in this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="py-2 pr-4 font-medium">Product</th>
                    <th className="py-2 px-4 font-medium">Category</th>
                    <th className="py-2 px-4 font-medium text-right">Qty</th>
                    <th className="py-2 px-4 font-medium text-right">Revenue</th>
                    <th className="py-2 px-4 font-medium text-right">Profit</th>
                    <th className="py-2 pl-4 font-medium text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {productReport.products.map(p => (
                    <tr key={p.id} className="border-b border-slate-800">
                      <td className="py-2 pr-4 text-white">{p.name}</td>
                      <td className="py-2 px-4 text-slate-400">{p.category}</td>
                      <td className="py-2 px-4 text-right text-slate-300">{p.quantitySold}</td>
                      <td className="py-2 px-4 text-right text-emerald-400">{formatCurrency(p.revenue)}</td>
                      <td className={`py-2 px-4 text-right ${p.profit >= 0 ? 'text-white' : 'text-red-400'}`}>{formatCurrency(p.profit)}</td>
                      <td className="py-2 pl-4 text-right text-slate-300">{p.margin.toFixed(1)}%</td>
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
            <UsersIcon className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Staff Performance</h3>
            <span className="text-xs text-slate-500 ml-auto">{periodLabel}</span>
          </div>
          {serverLoading ? (
            <p className="text-center py-8 text-slate-400">Loading…</p>
          ) : staffError ? (
            <div className="text-center py-8 text-red-400">
              <p className="font-medium">Couldn't load staff report</p>
              <p className="text-sm text-slate-400 mt-1">{staffError}</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={loadServerReports}>Retry</Button>
            </div>
          ) : !staffReport || staffReport.staff.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <UsersIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No staff activity in this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="py-2 pr-4 font-medium">Staff</th>
                    <th className="py-2 px-4 font-medium">Role</th>
                    <th className="py-2 px-4 font-medium text-right">Sales</th>
                    <th className="py-2 px-4 font-medium text-right">Txns</th>
                    <th className="py-2 px-4 font-medium text-right">Avg</th>
                    <th className="py-2 pl-4 font-medium text-right">Voids</th>
                  </tr>
                </thead>
                <tbody>
                  {staffReport.staff.map(s => (
                    <tr key={s.id} className="border-b border-slate-800">
                      <td className="py-2 pr-4 text-white">{s.name}</td>
                      <td className="py-2 px-4 text-slate-400 capitalize">{s.role.toLowerCase()}</td>
                      <td className="py-2 px-4 text-right text-emerald-400">{formatCurrency(s.totalSales)}</td>
                      <td className="py-2 px-4 text-right text-slate-300">{s.transactionCount}</td>
                      <td className="py-2 px-4 text-right text-slate-300">{formatCurrency(s.averageTransaction)}</td>
                      <td className={`py-2 pl-4 text-right ${s.voidCount > 0 ? 'text-red-400' : 'text-slate-300'}`}>{s.voidCount}</td>
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
    revenue: number; tax: number; costOfGoods: number; grossProfit: number; expenses: number;
    netProfit: number; transactions: number; avgBasket: number; stockValue: number; lowStockCount: number;
  } | null;
  productReport: ProductReport | null;
  staffReport: StaffReport | null;
}) {
  const title = tab === 'summary' ? 'Sales & Profit Summary' : tab === 'products' ? 'Product Performance' : 'Staff Performance';
  const th = 'text-left border-b border-gray-400 py-1 px-2 font-semibold';
  const td = 'border-b border-gray-200 py-1 px-2';

  return (
    <div id="report-print" className="hidden print:block bg-white text-black p-6 text-sm">
      <div className="mb-4">
        <h1 className="text-xl font-bold">{shopName}</h1>
        <p className="text-base font-semibold">{title}</p>
        <p className="text-xs text-gray-600">Period: {periodLabel} · Generated {new Date().toLocaleString()}</p>
      </div>

      {tab === 'summary' && summary && (
        <table className="w-full">
          <tbody>
            {[
              [summary.tax > 0 ? 'Revenue (net of VAT)' : 'Revenue', formatCurrency(summary.revenue)],
              ...(summary.tax > 0 ? [['VAT Collected', formatCurrency(summary.tax)]] : []),
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
              <th className={`${th} text-right`}>Revenue</th>
              <th className={`${th} text-right`}>Profit</th>
              <th className={`${th} text-right`}>Margin</th>
            </tr>
          </thead>
          <tbody>
            {productReport.products.map(p => (
              <tr key={p.id}>
                <td className={td}>{p.name}</td>
                <td className={td}>{p.category}</td>
                <td className={`${td} text-right`}>{p.quantitySold}</td>
                <td className={`${td} text-right`}>{formatCurrency(p.revenue)}</td>
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
              <th className={`${th} text-right`}>Sales</th>
              <th className={`${th} text-right`}>Txns</th>
              <th className={`${th} text-right`}>Avg</th>
              <th className={`${th} text-right`}>Voids</th>
            </tr>
          </thead>
          <tbody>
            {staffReport.staff.map(s => (
              <tr key={s.id}>
                <td className={td}>{s.name}</td>
                <td className={td}>{s.role.toLowerCase()}</td>
                <td className={`${td} text-right`}>{formatCurrency(s.totalSales)}</td>
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
