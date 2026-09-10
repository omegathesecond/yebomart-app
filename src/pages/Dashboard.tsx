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
  const { getDashboardMetrics, loadInsights, insightsLoading, insightsError } =
    useInventoryStore();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    if (shop) {
      loadAll(shop.id);
      getDashboardMetrics(shop.id).then(setMetrics);
      loadInsights();
    }
  }, [shop, loadAll, getDashboardMetrics, loadInsights]);

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const lowStock = (metrics?.lowStockCount || 0) + (metrics?.criticalStockCount || 0);
  const basket =
    metrics?.todayTransactions && metrics.todayTransactions > 0
      ? (metrics.todaySales || 0) / metrics.todayTransactions
      : 0;

  const stats = [
    {
      label: 'Sales',
      value: formatCurrency(metrics?.todaySales || 0),
      note: `${metrics?.todayTransactions || 0} sale${metrics?.todayTransactions === 1 ? '' : 's'} so far`,
    },
    {
      label: 'Transactions',
      value: String(metrics?.todayTransactions || 0),
      note: basket > 0 ? `${formatCurrency(basket)} average basket` : undefined,
    },
    {
      label: 'Gross profit',
      value: formatCurrency(metrics?.todayProfit || 0),
      note: undefined,
    },
    {
      label: 'Needs attention',
      value: String(lowStock),
      note:
        lowStock > 0
          ? `${metrics?.criticalStockCount || 0} out of stock, ${metrics?.lowStockCount || 0} running low`
          : 'Nothing running low',
      attention: lowStock > 0,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            {getGreeting()}, {shop?.ownerName?.split(' ')[0] || 'Boss'}.
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-mute">
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

      {/*
        The day's numbers as one band split by rules, not four cards. An owner
        reads these in about two seconds at opening and the job is comparison —
        a shared baseline does that better than four boxes each drawing its own
        border and competing for attention.
      */}
      <div className="grid grid-cols-2 border border-line-strong bg-cream lg:grid-cols-4">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`px-5 py-4 ${i < stats.length - 1 ? 'border-b border-r border-line lg:border-b-0' : ''} ${
              stat.attention ? 'bg-wash' : ''
            }`}
          >
            <p className={`eyebrow ${stat.attention ? 'text-brick' : ''}`}>{stat.label}</p>
            <p className="m mt-2 text-[26px] font-semibold tracking-[-0.03em]">{stat.value}</p>
            {stat.note && (
              <p className={`mt-1 text-[11.5px] ${stat.attention ? 'text-brick' : 'text-mute'}`}>
                {stat.note}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link to="/products/new" className="card hover:border-ink/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-sharp bg-wash">
              <PlusIcon className="w-5 h-5 text-brick" />
            </div>
            <span className="font-medium text-ink">Add Product</span>
          </div>
        </Link>
        <Link to="/stock" state={{ openReceive: true }} className="card hover:border-ok/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-sharp bg-ok/20">
              <CubeIcon className="w-5 h-5 text-ok" />
            </div>
            <span className="font-medium text-ink">Receive Stock</span>
          </div>
        </Link>
        <Link to="/reports" className="card hover:border-line-strong/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-sharp bg-sand/20">
              <ArrowTrendingUpIcon className="w-5 h-5 text-body" />
            </div>
            <span className="font-medium text-ink">View Reports</span>
          </div>
        </Link>
        <Link to="/assistant" className="card transition-colors hover:border-ink/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-sharp bg-ink/20">
              <SparklesIcon className="w-5 h-5 text-brick" />
            </div>
            <span className="font-medium text-ink">Ask {shop?.assistantName}</span>
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
              <Link to="/sales" className="text-sm text-brick hover:text-brick">
                View all →
              </Link>
            }
          />
          <div className="space-y-3">
            {metrics?.recentSales && metrics.recentSales.length > 0 ? (
              metrics.recentSales.slice(0, 5).map((sale) => (
                <div 
                  key={sale.id}
                  className="flex items-center justify-between p-3 rounded-sharp bg-shade/30 hover:bg-shade/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-ok/20 flex items-center justify-center">
                      <BanknotesIcon className="w-5 h-5 text-ok" />
                    </div>
                    <div>
                      <p className="text-ink font-medium">
                        {sale.items.length} item{sale.items.length > 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-mute">
                        {sale.paymentMethod.toUpperCase()} • {formatRelativeTime(sale.createdAt)}
                      </p>
                    </div>
                  </div>
                  <p className="m text-lg font-semibold text-ok">
                    {formatCurrency(sale.totalAmount)}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <ShoppingCartIcon className="w-12 h-12 text-mist mx-auto mb-3" />
                <p className="text-mute">No sales yet today</p>
                <Link to="/pos" className="text-brick text-sm hover:underline mt-2 inline-block">
                  Make your first sale →
                </Link>
              </div>
            )}
          </div>
        </Card>

        {/* AI Insights + Low Stock */}
        <div className="space-y-6">
          <Card accent>
            <CardHeader
              title={`${shop?.assistantName || 'AI'} says...`}
              action={<SparklesIcon className="w-5 h-5 text-brick" />}
            />
            {insightsLoading ? (
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="p-3 rounded-sharp bg-sand/50 border border-line/50 animate-pulse"
                  >
                    <div className="h-3 w-1/2 rounded bg-shade" />
                    <div className="h-2.5 w-3/4 rounded bg-shade/70 mt-2" />
                  </div>
                ))}
              </div>
            ) : insightsError ? (
              <div className="p-3 rounded-sharp bg-sand/50 border border-bad/30">
                <p className="text-sm font-medium text-bad">
                  Couldn't load insights
                </p>
                <p className="text-xs text-mute mt-1">{insightsError}</p>
                <button
                  onClick={() => loadInsights()}
                  className="mt-2 text-xs text-brick hover:text-brick"
                >
                  Try again
                </button>
              </div>
            ) : insights.length > 0 ? (
              <div className="space-y-3">
                {insights.slice(0, 2).map((insight) => (
                  <div
                    key={insight.id}
                    className="p-3 rounded-sharp bg-sand/50 border border-line/50"
                  >
                    <p className="text-sm font-medium text-ink">{insight.title}</p>
                    <p className="text-xs text-mute mt-1 line-clamp-2">
                      {insight.description}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-sharp bg-sand/50 border border-line/50 text-center">
                <p className="text-sm text-body">No insights yet</p>
                <p className="text-xs text-mist mt-1">
                  Make a few sales and {shop?.assistantName || 'your assistant'} will
                  spot trends for you.
                </p>
              </div>
            )}
          </Card>

          {alerts.length > 0 && (
            <Card accent>
              <CardHeader
                title="Low Stock Alerts"
                subtitle={`${alerts.length} product${alerts.length > 1 ? 's' : ''} need attention`}
              />
              <div className="space-y-2">
                {alerts.slice(0, 3).map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between p-2 rounded-sharp bg-sand/50"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          alert.severity === 'out'
                            ? 'bg-bad'
                            : alert.severity === 'critical'
                            ? 'bg-brand'
                            : 'bg-warn'
                        }`}
                      />
                      <span className="text-sm text-ink truncate max-w-32">
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
                to="/stock"
                state={{ showAlerts: true }}
                className="flex items-center justify-center gap-1 mt-3 text-sm text-brick hover:text-brick"
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
                        index === 0 ? 'bg-brand text-ink' :
                        index === 1 ? 'bg-mist text-ink' :
                        'bg-brand text-ink'
                      }`}>
                        {index + 1}
                      </span>
                      <span className="text-sm text-ink">{product.name}</span>
                    </div>
                    <span className="text-sm text-mute">{product.quantity} sold</span>
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
