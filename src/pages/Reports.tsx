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
} from '@heroicons/react/24/outline';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toast, useToast } from '@/components/ui/Toast';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { formatCurrency } from '@/types';
import api from '@/api/client';
import type { ProductReport, StaffReport } from '@/api/client';
import { downloadCsv, reportFilename } from '@/lib/exportReport';

type Period = 'today' | 'week' | 'month';
type Tab = 'summary' | 'products' | 'staff';

export function Reports() {
  const { t } = useTranslation();
  const { shop } = useAuthStore();
  const { products, sales, expenses, loadAll } = useInventoryStore();
  const { toast, showToast, dismissToast } = useToast();
  const [period, setPeriod] = useState<Period>('today');
  const [tab, setTab] = useState<Tab>('summary');
  const [, setReport] = useState<any>(null);

  // Server-backed reports (the authoritative ones — local IndexedDB only has
  // whatever synced). Null until loaded; failures surface via toast, never a
  // silent empty fallback.
  const [productReport, setProductReport] = useState<ProductReport | null>(null);
  const [staffReport, setStaffReport] = useState<StaffReport | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [serverLoading, setServerLoading] = useState(false);

  // Period → absolute date range, recomputed per load.
  const rangeFor = (p: Period) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start =
      p === 'today'
        ? todayStart
        : p === 'week'
          ? new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)
          : new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: start.toISOString(), endDate: now.toISOString() };
  };

  useEffect(() => {
    if (!shop) return;
    loadAll(shop.id);
    loadDailyReport();
    loadServerReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop, period]);

  const loadDailyReport = async () => {
    const { data, error } = await api.getDailyReport();
    if (error) {
      // Non-fatal here (Summary tab is computed from local data too), but say so.
      showToast(error, 'error');
      return;
    }
    setReport(data);
  };

  const loadServerReports = async () => {
    setServerLoading(true);
    setProductError(null);
    setStaffError(null);
    const range = rangeFor(period);

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

  // ── Client-side summary metrics (Summary tab) ─────────────────────────────
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const getStartDate = () => {
    if (period === 'today') return todayStart;
    if (period === 'week') return weekStart;
    return monthStart;
  };

  const filteredSales = sales.filter(s => new Date(s.createdAt) >= getStartDate());
  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalTransactions = filteredSales.length;
  const avgBasket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  let grossProfit = 0;
  for (const sale of filteredSales) {
    for (const item of sale.items) {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        grossProfit += (item.unitPrice - product.costPrice) * item.quantity;
      }
    }
  }

  const periodExpenses = expenses
    .filter(e => new Date(e.date) >= getStartDate())
    .reduce((sum, e) => sum + e.amount, 0);
  const netProfit = grossProfit - periodExpenses;

  const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
  for (const sale of filteredSales) {
    for (const item of sale.items) {
      if (!productSales[item.productId]) {
        productSales[item.productId] = { name: item.productName, qty: 0, revenue: 0 };
      }
      productSales[item.productId].qty += item.quantity;
      productSales[item.productId].revenue += item.totalPrice;
    }
  }
  const topProducts = Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  const stockValue = products.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0);
  const lowStockCount = products.filter(p => p.quantity <= p.reorderAt).length;

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

    // Summary: a metric/value table for the selected period.
    downloadCsv(
      filename,
      ['Metric', 'Value (SZL)'],
      [
        ['Period', periodLabel],
        ['Revenue', round(totalRevenue)],
        ['Cost of Goods', round(totalRevenue - grossProfit)],
        ['Gross Profit', round(grossProfit)],
        ['Expenses', round(periodExpenses)],
        ['Net Profit', round(netProfit)],
        ['Transactions', totalTransactions],
        ['Average Basket', round(avgBasket)],
        ['Stock Value', round(stockValue)],
        ['Low Stock Items', lowStockCount],
      ],
    );
    showToast('CSV downloaded');
  };

  const handleDownloadPdf = () => {
    // Reuse the app's print-to-PDF path: the hidden #report-print card mirrors
    // the active tab; the browser's print dialog → "Save as PDF".
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

      {/* ── Summary tab ── */}
      {tab === 'summary' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card gradient="emerald">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <BanknotesIcon className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">{t('reports.revenue')}</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(totalRevenue)}</p>
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
                  <p className="text-2xl font-bold text-white">{formatCurrency(netProfit)}</p>
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
                  <p className="text-2xl font-bold text-white">{totalTransactions}</p>
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
                  <p className="text-2xl font-bold text-white">{formatCurrency(avgBasket)}</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="text-lg font-semibold text-white mb-4">🏆 {t('reports.topSelling')}</h3>
              {topProducts.length > 0 ? (
                <div className="space-y-3">
                  {topProducts.map((product, idx) => (
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
                  <span className="text-xl font-bold text-white">{products.length}</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <BanknotesIcon className="w-6 h-6 text-emerald-400" />
                    <span className="text-slate-300">Stock Value</span>
                  </div>
                  <span className="text-xl font-bold text-emerald-400">{formatCurrency(stockValue)}</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <ArrowTrendingDownIcon className="w-6 h-6 text-red-400" />
                    <span className="text-slate-300">Low Stock Items</span>
                  </div>
                  <span className="text-xl font-bold text-red-400">{lowStockCount}</span>
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <h3 className="text-lg font-semibold text-white mb-4">💰 {t('reports.profitReport')}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-slate-700/30 rounded-lg">
                <p className="text-sm text-slate-400">{t('reports.revenue')}</p>
                <p className="text-xl font-bold text-white">{formatCurrency(totalRevenue)}</p>
              </div>
              <div className="text-center p-4 bg-slate-700/30 rounded-lg">
                <p className="text-sm text-slate-400">Cost of Goods</p>
                <p className="text-xl font-bold text-red-400">{formatCurrency(totalRevenue - grossProfit)}</p>
              </div>
              <div className="text-center p-4 bg-slate-700/30 rounded-lg">
                <p className="text-sm text-slate-400">Gross Profit</p>
                <p className="text-xl font-bold text-white">{formatCurrency(grossProfit)}</p>
              </div>
              <div className="text-center p-4 bg-slate-700/30 rounded-lg">
                <p className="text-sm text-slate-400">Expenses</p>
                <p className="text-xl font-bold text-orange-400">{formatCurrency(periodExpenses)}</p>
              </div>
              <div className="text-center p-4 bg-slate-700/30 rounded-lg">
                <p className="text-sm text-slate-400">Net Profit</p>
                <p className={`text-xl font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(netProfit)}
                </p>
                {totalRevenue > 0 && (
                  <p className="text-xs text-slate-400">
                    {((netProfit / totalRevenue) * 100).toFixed(1)}% {t('reports.margin').toLowerCase()}
                  </p>
                )}
              </div>
            </div>
          </Card>
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
        summary={{
          revenue: totalRevenue,
          costOfGoods: totalRevenue - grossProfit,
          grossProfit,
          expenses: periodExpenses,
          netProfit,
          transactions: totalTransactions,
          avgBasket,
          stockValue,
          lowStockCount,
        }}
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
    revenue: number; costOfGoods: number; grossProfit: number; expenses: number;
    netProfit: number; transactions: number; avgBasket: number; stockValue: number; lowStockCount: number;
  };
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

      {tab === 'summary' && (
        <table className="w-full">
          <tbody>
            {[
              ['Revenue', formatCurrency(summary.revenue)],
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
