import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BanknotesIcon,
  CalendarIcon,
  FunnelIcon,
  ChevronRightIcon,
  ReceiptPercentIcon
} from '@heroicons/react/24/outline';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { formatCurrency, formatDate, formatTime, formatRelativeTime, type Sale, PAYMENT_METHODS } from '@/types';

export function Sales() {
  const { shop } = useAuthStore();
  const { sales, loadAll } = useInventoryStore();
  
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  useEffect(() => {
    if (shop) {
      loadAll(shop.id);
    }
  }, [shop, loadAll]);

  // Filter sales by date
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const filteredSales = sales.filter(sale => {
    const saleDate = new Date(sale.createdAt);
    if (dateFilter === 'today') return saleDate >= todayStart;
    if (dateFilter === 'week') return saleDate >= weekStart;
    if (dateFilter === 'month') return saleDate >= monthStart;
    return true;
  });

  // Group sales by date
  const salesByDate = filteredSales.reduce((acc, sale) => {
    const dateKey = formatDate(sale.createdAt);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(sale);
    return acc;
  }, {} as Record<string, Sale[]>);

  // Calculate totals
  const totalSales = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalTransactions = filteredSales.length;
  const avgTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;

  // Payment method breakdown
  const paymentBreakdown = filteredSales.reduce((acc, sale) => {
    acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + sale.totalAmount;
    return acc;
  }, {} as Record<string, number>);

  const getPaymentIcon = (method: string) => {
    const pm = PAYMENT_METHODS.find(p => p.value === method);
    return pm?.icon || '💰';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales History</h1>
          <p className="text-slate-400 mt-1">
            View and manage your transactions
          </p>
        </div>
        <Link to="/pos">
          <button className="btn-primary">
            <ReceiptPercentIcon className="w-5 h-5" />
            New Sale
          </button>
        </Link>
      </div>

      {/* Date Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { key: 'today', label: 'Today' },
          { key: 'week', label: 'This Week' },
          { key: 'month', label: 'This Month' },
          { key: 'all', label: 'All Time' }
        ].map(filter => (
          <button
            key={filter.key}
            onClick={() => setDateFilter(filter.key as any)}
            className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
              dateFilter === filter.key
                ? 'bg-amber-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card gradient="emerald">
          <p className="text-sm text-slate-400">Total Sales</p>
          <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totalSales)}</p>
        </Card>
        <Card gradient="blue">
          <p className="text-sm text-slate-400">Transactions</p>
          <p className="text-2xl font-bold text-white mt-1">{totalTransactions}</p>
        </Card>
        <Card gradient="amber">
          <p className="text-sm text-slate-400">Avg. Transaction</p>
          <p className="text-2xl font-bold text-white mt-1">{formatCurrency(avgTransaction)}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-400">Payment Split</p>
          <div className="flex gap-2 mt-2">
            {Object.entries(paymentBreakdown).slice(0, 3).map(([method, amount]) => (
              <span key={method} className="text-lg">
                {getPaymentIcon(method)}
              </span>
            ))}
          </div>
        </Card>
      </div>

      {/* Payment Breakdown */}
      {Object.keys(paymentBreakdown).length > 0 && (
        <Card>
          <CardHeader title="Payment Methods" subtitle="Breakdown by payment type" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(paymentBreakdown).map(([method, amount]) => {
              const pm = PAYMENT_METHODS.find(p => p.value === method);
              const percentage = totalSales > 0 ? (amount / totalSales * 100).toFixed(0) : 0;
              
              return (
                <div key={method} className="p-3 rounded-xl bg-slate-700/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{pm?.icon}</span>
                    <span className="font-medium text-white">{pm?.label}</span>
                  </div>
                  <p className="text-lg font-bold text-amber-400">{formatCurrency(amount)}</p>
                  <p className="text-xs text-slate-500">{percentage}% of total</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Sales List */}
      <div className="space-y-6">
        {Object.entries(salesByDate).map(([date, dateSales]) => {
          const dayTotal = dateSales.reduce((sum, s) => sum + s.totalAmount, 0);
          
          return (
            <div key={date}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-slate-400" />
                  <span className="font-medium text-slate-300">{date}</span>
                </div>
                <span className="text-sm text-emerald-400">{formatCurrency(dayTotal)}</span>
              </div>
              
              <Card className="divide-y divide-slate-700/50">
                {dateSales.map((sale) => (
                  <button
                    key={sale.id}
                    onClick={() => setSelectedSale(sale)}
                    className="w-full p-4 flex items-center justify-between hover:bg-slate-700/30 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <BanknotesIcon className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">
                          {sale.items.length} item{sale.items.length > 1 ? 's' : ''}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs">{getPaymentIcon(sale.paymentMethod)}</span>
                          <span className="text-xs text-slate-400">
                            {formatTime(sale.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-semibold text-emerald-400">
                        {formatCurrency(sale.totalAmount)}
                      </p>
                      <ChevronRightIcon className="w-5 h-5 text-slate-500" />
                    </div>
                  </button>
                ))}
              </Card>
            </div>
          );
        })}

        {Object.keys(salesByDate).length === 0 && (
          <Card className="py-12 text-center">
            <BanknotesIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No sales for this period</p>
            <Link to="/pos" className="text-amber-400 text-sm hover:underline mt-2 inline-block">
              Make your first sale →
            </Link>
          </Card>
        )}
      </div>

      {/* Sale Detail Modal */}
      {selectedSale && (
        <div className="modal-backdrop flex items-center justify-center p-4">
          <div 
            className="absolute inset-0" 
            onClick={() => setSelectedSale(null)}
          />
          <div className="relative w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 animate-slide-up">
            <div className="p-4 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Receipt</h2>
                <button
                  onClick={() => setSelectedSale(null)}
                  className="p-1 hover:bg-slate-700 rounded-lg"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm text-slate-400">
                {formatDate(selectedSale.createdAt)} at {formatTime(selectedSale.createdAt)}
              </p>
            </div>

            <div className="p-4 space-y-4">
              {/* Items */}
              <div className="space-y-2">
                {selectedSale.items.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <div>
                      <p className="text-white">{item.productName}</p>
                      <p className="text-sm text-slate-400">
                        {item.quantity} × {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                    <p className="font-medium text-white">
                      {formatCurrency(item.totalPrice)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-700 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Payment</span>
                  <Badge variant="success">
                    {getPaymentIcon(selectedSale.paymentMethod)}{' '}
                    {PAYMENT_METHODS.find(p => p.value === selectedSale.paymentMethod)?.label}
                  </Badge>
                </div>
                <div className="flex justify-between items-center mt-3">
                  <span className="text-lg font-semibold text-white">Total</span>
                  <span className="text-2xl font-bold text-amber-400">
                    {formatCurrency(selectedSale.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
