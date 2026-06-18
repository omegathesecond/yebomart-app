import { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BanknotesIcon,
  ShoppingCartIcon,
  CubeIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  WifiIcon
} from '@heroicons/react/24/outline';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { formatCurrency } from '@/types';
import api, { NETWORK_ERROR } from '@/api/client';

type Period = 'today' | 'week' | 'month';

/**
 * Normalised metrics the page renders. Built from the authoritative server
 * report; the local-cache fallback (offline only) is mapped into the same
 * shape so the JSX has a single source to read from.
 */
interface ReportMetrics {
  totalRevenue: number;
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
  const { shop } = useAuthStore();
  const { products, sales, expenses, loadAll } = useInventoryStore();
  const [period, setPeriod] = useState<Period>('today');
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // True when the figures shown come from the local cache because the device
  // is offline — surfaced to the user via a banner, never silently.
  const [usingCache, setUsingCache] = useState(false);

  useEffect(() => {
    if (shop) {
      loadAll(shop.id);
      loadReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop, period]);

  // Inclusive [start, end] range for the selected period.
  const getRange = (): { start: Date; end: Date } => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === 'today') return { start: todayStart, end: now };
    if (period === 'week') {
      return { start: new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000), end: now };
    }
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  };

  // Recompute metrics from the locally-cached store. Used ONLY as an explicit
  // offline fallback — incomplete on a fresh device, so the page flags it.
  const computeFromCache = (): ReportMetrics => {
    const { start } = getRange();
    const filteredSales = sales.filter(s => new Date(s.createdAt) >= start);
    const totalRevenue = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalTransactions = filteredSales.length;

    let grossProfit = 0;
    let totalCost = 0;
    const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
    for (const sale of filteredSales) {
      for (const item of sale.items) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          grossProfit += (item.unitPrice - product.costPrice) * item.quantity;
          totalCost += product.costPrice * item.quantity;
        }
        if (!productSales[item.productId]) {
          productSales[item.productId] = { name: item.productName, qty: 0, revenue: 0 };
        }
        productSales[item.productId].qty += item.quantity;
        productSales[item.productId].revenue += item.totalPrice;
      }
    }

    const periodExpenses = expenses
      .filter(e => new Date(e.date) >= start)
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      totalRevenue,
      totalCost,
      grossProfit,
      periodExpenses,
      netProfit: grossProfit - periodExpenses,
      totalTransactions,
      avgBasket: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
      topProducts: Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
      stockValue: products.reduce((sum, p) => sum + p.costPrice * p.quantity, 0),
      lowStockCount: products.filter(p => p.quantity <= p.reorderAt).length,
      totalProducts: products.length,
    };
  };

  // Map the authoritative server report into the page's metrics shape.
  const fromServer = (report: any): ReportMetrics => {
    const s = report.summary ?? {};
    const stock = report.stock ?? {};
    return {
      totalRevenue: s.totalSales ?? 0,
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

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    const { start, end } = getRange();
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
      setError(reqError || 'Failed to load report');
    }
    setLoading(false);
  };

  const m = metrics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-slate-400 mt-1">Track your business performance</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={period === 'today' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setPeriod('today')}
          >
            Today
          </Button>
          <Button
            variant={period === 'week' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setPeriod('week')}
          >
            This Week
          </Button>
          <Button
            variant={period === 'month' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setPeriod('month')}
          >
            This Month
          </Button>
        </div>
      </div>

      {/* Offline / cached banner — only shown when figures come from the
          local cache because the device is offline. Never silent. */}
      {usingCache && m && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
          <WifiIcon className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">
            You're offline — showing cached figures from this device. These may be
            incomplete and exclude sales made on other devices or before your last sync.
          </p>
          <Button variant="secondary" size="sm" onClick={loadReport} className="ml-auto">
            Retry
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading && !m && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <ArrowPathIcon className="w-10 h-10 animate-spin mb-3" />
          <p>Loading report…</p>
        </div>
      )}

      {/* Error state — a real server/auth failure. No misleading numbers. */}
      {!loading && error && !m && (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ExclamationTriangleIcon className="w-12 h-12 text-red-400 mb-3" />
            <h3 className="text-lg font-semibold text-white mb-1">Couldn't load report</h3>
            <p className="text-slate-400 mb-4 max-w-sm">{error}</p>
            <Button variant="primary" size="sm" onClick={loadReport}>
              <ArrowPathIcon className="w-4 h-4 mr-1" />
              Try again
            </Button>
          </div>
        </Card>
      )}

      {m && (
      <>
      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card gradient="emerald">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <BanknotesIcon className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Revenue</p>
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
              <p className="text-sm text-slate-400">Avg. Basket</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(m.avgBasket)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Top Products & Stock Summary */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <h3 className="text-lg font-semibold text-white mb-4">🏆 Top Selling Products</h3>
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

        {/* Stock Summary */}
        <Card>
          <h3 className="text-lg font-semibold text-white mb-4">📦 Stock Summary</h3>
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

      {/* Profit Margin */}
      <Card>
        <h3 className="text-lg font-semibold text-white mb-4">💰 Profit Analysis</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-slate-700/30 rounded-lg">
            <p className="text-sm text-slate-400">Revenue</p>
            <p className="text-xl font-bold text-white">{formatCurrency(m.totalRevenue)}</p>
          </div>
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
                {((m.netProfit / m.totalRevenue) * 100).toFixed(1)}% margin
              </p>
            )}
          </div>
        </div>
      </Card>
      </>
      )}
    </div>
  );
}
