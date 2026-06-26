import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BanknotesIcon,
  ShoppingCartIcon,
  ArrowTrendingUpIcon,
  ExclamationTriangleIcon,
  CubeIcon,
  SparklesIcon,
  PlusIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { formatCurrency, formatRelativeTime, type DashboardMetrics } from '@/types';
import { getShopType } from '@/data/shopTypes';

export function Dashboard() {
  const { shop } = useAuthStore();
  const { loadAll, alerts, insights, sales, products } = useInventoryStore();
  const { getDashboardMetrics } = useInventoryStore();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    if (shop) {
      loadAll(shop.id);
      getDashboardMetrics(shop.id).then(setMetrics);
    }
  }, [shop, loadAll, getDashboardMetrics]);

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const stats = [
    {
      label: "Today's Sales",
      value: formatCurrency(metrics?.todaySales || 0),
      icon: BanknotesIcon,
      color: 'emerald',
      change: metrics?.todaySales && metrics.todaySales > 0 ? '+' : ''
    },
    {
      label: 'Transactions',
      value: metrics?.todayTransactions || 0,
      icon: ShoppingCartIcon,
      color: 'blue'
    },
    {
      label: 'Profit',
      value: formatCurrency(metrics?.todayProfit || 0),
      icon: ArrowTrendingUpIcon,
      color: 'amber'
    },
    {
      label: 'Low Stock',
      value: (metrics?.lowStockCount || 0) + (metrics?.criticalStockCount || 0),
      icon: ExclamationTriangleIcon,
      color: alerts.length > 0 ? 'red' : 'emerald'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {getGreeting()}, {shop?.ownerName?.split(' ')[0] || 'Boss'}! 👋
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-400">
              Here's what's happening at {shop?.name || 'your shop'} today.
            </p>
            {shop?.businessType && (
              <Badge variant="info" size="sm">
                {getShopType(shop.businessType)?.name || shop.businessType}
              </Badge>
            )}
          </div>
        </div>
        <Link to="/pos">
          <Button 
            variant="primary" 
            size="lg"
            leftIcon={<ShoppingCartIcon className="w-5 h-5" />}
          >
            Open POS
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card 
            key={stat.label} 
            gradient={stat.color as any}
            className="relative overflow-hidden"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400">{stat.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
              </div>
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${
                stat.color === 'emerald' ? 'from-emerald-500 to-teal-600' :
                stat.color === 'blue' ? 'from-blue-500 to-cyan-600' :
                stat.color === 'amber' ? 'from-amber-500 to-orange-600' :
                'from-red-500 to-rose-600'
              }`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link to="/products/new" className="card hover:border-amber-500/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <PlusIcon className="w-5 h-5 text-amber-400" />
            </div>
            <span className="font-medium text-white">Add Product</span>
          </div>
        </Link>
        <Link to="/stock" state={{ openReceive: true }} className="card hover:border-emerald-500/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <CubeIcon className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="font-medium text-white">Receive Stock</span>
          </div>
        </Link>
        <Link to="/reports" className="card hover:border-blue-500/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <ArrowTrendingUpIcon className="w-5 h-5 text-blue-400" />
            </div>
            <span className="font-medium text-white">View Reports</span>
          </div>
        </Link>
        <Link to="/assistant" className="card transition-colors hover:border-purple-500/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <SparklesIcon className="w-5 h-5 text-purple-400" />
            </div>
            <span className="font-medium text-white">Ask {shop?.assistantName}</span>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Sales */}
        <Card className="lg:col-span-2">
          <CardHeader 
            title="Recent Sales" 
            subtitle="Today's transactions"
            action={
              <Link to="/sales" className="text-sm text-amber-400 hover:text-amber-300">
                View all →
              </Link>
            }
          />
          <div className="space-y-3">
            {metrics?.recentSales && metrics.recentSales.length > 0 ? (
              metrics.recentSales.slice(0, 5).map((sale) => (
                <div 
                  key={sale.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <BanknotesIcon className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {sale.items.length} item{sale.items.length > 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-slate-400">
                        {sale.paymentMethod.toUpperCase()} • {formatRelativeTime(sale.createdAt)}
                      </p>
                    </div>
                  </div>
                  <p className="text-lg font-semibold text-emerald-400">
                    {formatCurrency(sale.totalAmount)}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <ShoppingCartIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No sales yet today</p>
                <Link to="/pos" className="text-amber-400 text-sm hover:underline mt-2 inline-block">
                  Make your first sale →
                </Link>
              </div>
            )}
          </div>
        </Card>

        {/* AI Insights + Low Stock */}
        <div className="space-y-6">
          {insights.length > 0 && (
            <Card gradient="purple">
              <CardHeader
                title={`${shop?.assistantName || 'AI'} says...`}
                action={<SparklesIcon className="w-5 h-5 text-purple-400" />}
              />
              <div className="space-y-3">
                {insights.slice(0, 2).map((insight) => (
                  <div
                    key={insight.id}
                    className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50"
                  >
                    <p className="text-sm font-medium text-white">{insight.title}</p>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {insight.description}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {alerts.length > 0 && (
            <Card gradient="red">
              <CardHeader
                title="Low Stock Alerts"
                subtitle={`${alerts.length} product${alerts.length > 1 ? 's' : ''} need attention`}
              />
              <div className="space-y-2">
                {alerts.slice(0, 3).map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          alert.severity === 'out'
                            ? 'bg-red-500'
                            : alert.severity === 'critical'
                            ? 'bg-amber-500'
                            : 'bg-yellow-500'
                        }`}
                      />
                      <span className="text-sm text-white truncate max-w-32">
                        {alert.productName}
                      </span>
                    </div>
                    <Badge
                      variant={alert.severity === 'out' ? 'danger' : 'warning'}
                      size="sm"
                    >
                      {alert.currentQty} left
                    </Badge>
                  </div>
                ))}
              </div>
              <Link
                to="/stock?filter=alerts"
                className="flex items-center justify-center gap-1 mt-3 text-sm text-amber-400 hover:text-amber-300"
              >
                View all alerts <ArrowRightIcon className="w-4 h-4" />
              </Link>
            </Card>
          )}

          {/* Top Products */}
          {metrics?.topProducts && metrics.topProducts.length > 0 && (
            <Card>
              <CardHeader 
                title="Top Sellers Today"
                subtitle="Best performing products"
              />
              <div className="space-y-2">
                {metrics.topProducts.slice(0, 3).map((product, index) => (
                  <div 
                    key={product.name}
                    className="flex items-center justify-between p-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-amber-500 text-white' :
                        index === 1 ? 'bg-slate-400 text-white' :
                        'bg-amber-700 text-white'
                      }`}>
                        {index + 1}
                      </span>
                      <span className="text-sm text-white">{product.name}</span>
                    </div>
                    <span className="text-sm text-slate-400">{product.quantity} sold</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
