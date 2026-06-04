import { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  CalendarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BanknotesIcon,
  ShoppingCartIcon,
  CubeIcon
} from '@heroicons/react/24/outline';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { formatCurrency } from '@/types';
import api from '@/api/client';

type Period = 'today' | 'week' | 'month';

export function Reports() {
  const { shop } = useAuthStore();
  const { products, sales, expenses, loadAll } = useInventoryStore();
  const [period, setPeriod] = useState<Period>('today');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (shop) {
      loadAll(shop.id);
      loadReport();
    }
  }, [shop, period]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const { data } = await api.getDailyReport();
      setReport(data);
    } catch (e) {
      console.error('Failed to load report:', e);
    }
    setLoading(false);
  };

  // Calculate metrics from local data
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

  // Calculate gross profit (revenue - cost of goods sold)
  let grossProfit = 0;
  for (const sale of filteredSales) {
    for (const item of sale.items) {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        grossProfit += (item.unitPrice - product.costPrice) * item.quantity;
      }
    }
  }

  // Expenses for the selected period → net profit = gross profit - expenses
  const periodExpenses = expenses
    .filter(e => new Date(e.date) >= getStartDate())
    .reduce((sum, e) => sum + e.amount, 0);
  const netProfit = grossProfit - periodExpenses;

  // Top products
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

  // Stock value
  const stockValue = products.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0);
  const lowStockCount = products.filter(p => p.quantity <= p.reorderAt).length;

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

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card gradient="emerald">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <BanknotesIcon className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Revenue</p>
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
              <p className="text-sm text-slate-400">Avg. Basket</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(avgBasket)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Top Products & Stock Summary */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <h3 className="text-lg font-semibold text-white mb-4">🏆 Top Selling Products</h3>
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

        {/* Stock Summary */}
        <Card>
          <h3 className="text-lg font-semibold text-white mb-4">📦 Stock Summary</h3>
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

      {/* Profit Margin */}
      <Card>
        <h3 className="text-lg font-semibold text-white mb-4">💰 Profit Analysis</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-slate-700/30 rounded-lg">
            <p className="text-sm text-slate-400">Revenue</p>
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
                {((netProfit / totalRevenue) * 100).toFixed(1)}% margin
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
