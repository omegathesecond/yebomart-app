import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownTrayIcon,
  AdjustmentsHorizontalIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { formatSZL, formatRelativeTime } from '@/types';

export function Stock() {
  const { shop } = useAuthStore();
  const { products, stockLogs, alerts, loadAll } = useInventoryStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');

  useEffect(() => {
    if (shop) {
      loadAll(shop.id);
    }
  }, [shop, loadAll]);

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesSearch = !searchQuery || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filter === 'low') return matchesSearch && p.quantity > 0 && p.quantity <= p.reorderAt;
    if (filter === 'out') return matchesSearch && p.quantity === 0;
    return matchesSearch;
  });

  // Sort by stock level (lowest first)
  const sortedProducts = [...filteredProducts].sort((a, b) => a.quantity - b.quantity);

  // Calculate totals
  const totalValue = products.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0);
  const lowStockCount = products.filter(p => p.quantity > 0 && p.quantity <= p.reorderAt).length;
  const outOfStockCount = products.filter(p => p.quantity === 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Stock Management</h1>
          <p className="text-slate-400 mt-1">
            Track and manage your inventory levels
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/stock/receive">
            <Button variant="primary" leftIcon={<ArrowDownTrayIcon className="w-5 h-5" />}>
              Receive Stock
            </Button>
          </Link>
          <Link to="/stock/adjust">
            <Button variant="secondary" leftIcon={<AdjustmentsHorizontalIcon className="w-5 h-5" />}>
              Adjust
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card gradient="blue">
          <p className="text-sm text-slate-400">Total Products</p>
          <p className="text-2xl font-bold text-white mt-1">{products.length}</p>
        </Card>
        <Card gradient="emerald">
          <p className="text-sm text-slate-400">Total Stock Value</p>
          <p className="text-2xl font-bold text-white mt-1">{formatSZL(totalValue)}</p>
        </Card>
        <Card gradient="amber" onClick={() => setFilter('low')} hover>
          <p className="text-sm text-slate-400">Low Stock</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{lowStockCount}</p>
        </Card>
        <Card gradient="red" onClick={() => setFilter('out')} hover>
          <p className="text-sm text-slate-400">Out of Stock</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{outOfStockCount}</p>
        </Card>
      </div>

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <Link to="/stock/alerts">
          <Card className="bg-red-500/10 border-red-500/30 hover:bg-red-500/20 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ExclamationTriangleIcon className="w-6 h-6 text-red-400" />
                <div>
                  <p className="font-semibold text-white">
                    {alerts.length} Stock Alert{alerts.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-slate-400">
                    Products need your attention
                  </p>
                </div>
              </div>
              <span className="text-amber-400">View all →</span>
            </div>
          </Card>
        </Link>
      )}

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'low' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilter('low')}
          >
            Low Stock
          </Button>
          <Button
            variant={filter === 'out' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilter('out')}
          >
            Out of Stock
          </Button>
        </div>
      </div>

      {/* Stock Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Product</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">Current Stock</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">Reorder At</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Value</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map((product) => {
                const isLowStock = product.quantity > 0 && product.quantity <= product.reorderAt;
                const isOutOfStock = product.quantity === 0;
                const stockValue = product.costPrice * product.quantity;

                return (
                  <tr 
                    key={product.id} 
                    className="border-b border-slate-700/50 table-row-hover"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-white">{product.name}</p>
                        {product.category && (
                          <p className="text-xs text-slate-500">{product.category}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`font-semibold ${
                        isOutOfStock ? 'text-red-400' :
                        isLowStock ? 'text-amber-400' : 'text-white'
                      }`}>
                        {product.quantity} {product.unit}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-400">
                      {product.reorderAt}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-300">
                      {formatSZL(stockValue)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge 
                        variant={isOutOfStock ? 'danger' : isLowStock ? 'warning' : 'success'}
                      >
                        {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low' : 'OK'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {sortedProducts.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-slate-400">No products found</p>
          </div>
        )}
      </Card>

      {/* Recent Activity */}
      {stockLogs.length > 0 && (
        <Card>
          <CardHeader title="Recent Stock Activity" subtitle="Last 10 movements" />
          <div className="space-y-2">
            {stockLogs.slice(0, 10).map((log) => {
              const product = products.find(p => p.id === log.productId);
              const isIncrease = log.quantity > 0;

              return (
                <div 
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      isIncrease ? 'bg-emerald-500/20' : 'bg-red-500/20'
                    }`}>
                      {isIncrease ? (
                        <ArrowUpIcon className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <ArrowDownIcon className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white">
                        {product?.name || 'Unknown Product'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {log.type.charAt(0).toUpperCase() + log.type.slice(1)}
                        {log.note && ` • ${log.note}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${
                      isIncrease ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {isIncrease ? '+' : ''}{log.quantity}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatRelativeTime(log.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
