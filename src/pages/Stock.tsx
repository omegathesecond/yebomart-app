import { useState, useEffect } from 'react';
import {
  ArrowDownTrayIcon,
  AdjustmentsHorizontalIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ClockIcon,
  CheckCircleIcon,
  PencilSquareIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { formatSZL, formatRelativeTime, type Product, type StockLog } from '@/types';
import api from '@/api/client';

// Adjustment types supported by API
type AdjustmentType = 'ADJUSTMENT' | 'DAMAGED' | 'EXPIRED' | 'TRANSFER' | 'RETURN';

const ADJUSTMENT_TYPES: { value: AdjustmentType; label: string; icon: string }[] = [
  { value: 'ADJUSTMENT', label: 'Stock Correction', icon: '📝' },
  { value: 'DAMAGED', label: 'Damaged', icon: '💔' },
  { value: 'EXPIRED', label: 'Expired', icon: '📅' },
  { value: 'RETURN', label: 'Customer Return', icon: '↩️' },
  { value: 'TRANSFER', label: 'Transfer', icon: '🔄' },
];

export function Stock() {
  const { shop } = useAuthStore();
  const { products, stockLogs, alerts, loadAll, adjustStock } = useInventoryStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
  
  // Product history modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productHistory, setProductHistory] = useState<StockLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Receive stock modal
  const [showReceive, setShowReceive] = useState(false);
  const [receiveProduct, setReceiveProduct] = useState<string>('');
  const [receiveQty, setReceiveQty] = useState('');
  const [receiveNote, setReceiveNote] = useState('');
  const [isReceiving, setIsReceiving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [receiveErrors, setReceiveErrors] = useState<Record<string, string>>({});
  
  // Adjust stock modal
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<string>('');
  const [adjustType, setAdjustType] = useState<AdjustmentType>('ADJUSTMENT');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustDirection, setAdjustDirection] = useState<'add' | 'remove'>('remove');
  const [adjustNote, setAdjustNote] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustErrors, setAdjustErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (shop) {
      loadAll(shop.id);
    }
  }, [shop, loadAll]);

  // Load product history when selected
  const handleProductClick = async (product: Product) => {
    setSelectedProduct(product);
    setLoadingHistory(true);
    
    try {
      const { data } = await api.getStockLogs(product.id);
      setProductHistory(data || []);
    } catch (e) {
      setProductHistory(stockLogs.filter(log => log.productId === product.id));
    }
    
    setLoadingHistory(false);
  };

  const closeHistory = () => {
    setSelectedProduct(null);
    setProductHistory([]);
  };

  // Receive stock validation
  const validateReceive = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!receiveProduct) {
      errors.product = 'Please select a product';
    }
    if (!receiveQty) {
      errors.quantity = 'Quantity is required';
    } else if (parseInt(receiveQty) <= 0) {
      errors.quantity = 'Quantity must be greater than 0';
    }
    
    setReceiveErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Receive stock handler
  const handleReceiveStock = async () => {
    if (!validateReceive()) return;
    
    setIsReceiving(true);
    try {
      await adjustStock(receiveProduct, parseInt(receiveQty), 'restock', receiveNote || 'Stock received');
      setShowReceive(false);
      setReceiveProduct('');
      setReceiveQty('');
      setReceiveNote('');
      setReceiveErrors({});
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      
      // Reload data
      if (shop) loadAll(shop.id);
    } catch (e) {
      console.error('Failed to receive stock:', e);
    }
    setIsReceiving(false);
  };

  // Adjust stock validation
  const validateAdjust = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!adjustProduct) {
      errors.product = 'Please select a product';
    }
    if (!adjustQty) {
      errors.quantity = 'Quantity is required';
    } else if (parseInt(adjustQty) <= 0) {
      errors.quantity = 'Quantity must be greater than 0';
    } else if (adjustDirection === 'remove') {
      const product = products.find(p => p.id === adjustProduct);
      if (product && parseInt(adjustQty) > product.quantity) {
        errors.quantity = `Cannot remove more than current stock (${product.quantity})`;
      }
    }
    if (!adjustNote.trim()) {
      errors.note = 'Please provide a reason for this adjustment';
    }
    
    setAdjustErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Adjust stock handler
  const handleAdjustStock = async () => {
    if (!validateAdjust()) return;
    
    setIsAdjusting(true);
    try {
      const qty = parseInt(adjustQty);
      const finalQty = adjustDirection === 'remove' ? -qty : qty;
      
      // Call API directly for adjustment types
      await api.adjustStock(adjustProduct, {
        type: adjustType,
        quantity: finalQty,
        note: adjustNote
      });
      
      setShowAdjust(false);
      setAdjustProduct('');
      setAdjustType('ADJUSTMENT');
      setAdjustQty('');
      setAdjustDirection('remove');
      setAdjustNote('');
      setAdjustErrors({});
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      
      // Reload data
      if (shop) loadAll(shop.id);
    } catch (e) {
      console.error('Failed to adjust stock:', e);
      setAdjustErrors({ submit: 'Failed to adjust stock. Please try again.' });
    }
    setIsAdjusting(false);
  };

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

  // Get low stock alerts from products
  const lowStockAlerts = products.filter(p => p.quantity <= p.reorderAt);

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
          <Button 
            variant="secondary" 
            leftIcon={<PencilSquareIcon className="w-5 h-5" />}
            onClick={() => setShowAdjust(true)}
          >
            Adjust Stock
          </Button>
          <Button 
            variant="primary" 
            leftIcon={<ArrowDownTrayIcon className="w-5 h-5" />}
            onClick={() => setShowReceive(true)}
          >
            Receive Stock
          </Button>
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

      {/* Stock Alerts Banner */}
      {lowStockAlerts.length > 0 && (
        <Card className="bg-red-500/10 border-red-500/30">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <p className="font-semibold text-white mb-2">
                ⚠️ {lowStockAlerts.length} Stock Alert{lowStockAlerts.length > 1 ? 's' : ''}
              </p>
              <div className="space-y-2">
                {lowStockAlerts.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg">
                    <div>
                      <p className="text-white font-medium">{p.name}</p>
                      <p className="text-xs text-slate-400">{p.category}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${p.quantity === 0 ? 'text-red-400' : 'text-amber-400'}`}>
                        {p.quantity === 0 ? 'OUT OF STOCK' : `Only ${p.quantity} left`}
                      </p>
                      <Button 
                        size="sm" 
                        variant="primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReceiveProduct(p.id);
                          setShowReceive(true);
                        }}
                      >
                        Restock
                      </Button>
                    </div>
                  </div>
                ))}
                {lowStockAlerts.length > 5 && (
                  <p className="text-sm text-slate-400 text-center">
                    +{lowStockAlerts.length - 5} more items need attention
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>
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
                    className="border-b border-slate-700/50 cursor-pointer hover:bg-slate-700/50 transition-colors"
                    onClick={() => handleProductClick(product)}
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

      {/* Receive Stock Modal */}
      <Modal
        isOpen={showReceive}
        onClose={() => { setShowReceive(false); setReceiveErrors({}); }}
        title="Receive Stock"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Select Product
            </label>
            <select
              value={receiveProduct}
              onChange={(e) => { setReceiveProduct(e.target.value); if (receiveErrors.product) setReceiveErrors({...receiveErrors, product: ''}); }}
              className={`w-full px-4 py-3 bg-slate-700 border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                receiveErrors.product ? 'border-red-500' : 'border-slate-600'
              }`}
            >
              <option value="">Choose a product...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (Current: {p.quantity})
                </option>
              ))}
            </select>
            {receiveErrors.product && (
              <p className="text-red-400 text-sm mt-1">{receiveErrors.product}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Quantity Received
            </label>
            <input
              type="number"
              min="1"
              value={receiveQty}
              onChange={(e) => { setReceiveQty(e.target.value); if (receiveErrors.quantity) setReceiveErrors({...receiveErrors, quantity: ''}); }}
              placeholder="Enter quantity"
              className={`w-full px-4 py-3 bg-slate-700 border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                receiveErrors.quantity ? 'border-red-500' : 'border-slate-600'
              }`}
            />
            {receiveErrors.quantity && (
              <p className="text-red-400 text-sm mt-1">{receiveErrors.quantity}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Note (optional)
            </label>
            <input
              type="text"
              value={receiveNote}
              onChange={(e) => setReceiveNote(e.target.value)}
              placeholder="e.g., Supplier delivery"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => { setShowReceive(false); setReceiveErrors({}); }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleReceiveStock}
              isLoading={isReceiving}
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              Receive Stock
            </Button>
          </div>
        </div>
      </Modal>

      {/* Adjust Stock Modal */}
      <Modal
        isOpen={showAdjust}
        onClose={() => { setShowAdjust(false); setAdjustErrors({}); }}
        title="Adjust Stock"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Select Product
            </label>
            <select
              value={adjustProduct}
              onChange={(e) => { setAdjustProduct(e.target.value); if (adjustErrors.product) setAdjustErrors({...adjustErrors, product: ''}); }}
              className={`w-full px-4 py-3 bg-slate-700 border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                adjustErrors.product ? 'border-red-500' : 'border-slate-600'
              }`}
            >
              <option value="">Choose a product...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (Current: {p.quantity})
                </option>
              ))}
            </select>
            {adjustErrors.product && (
              <p className="text-red-400 text-sm mt-1">{adjustErrors.product}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Adjustment Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ADJUSTMENT_TYPES.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setAdjustType(type.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    adjustType === type.value
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {type.icon} {type.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Direction
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAdjustDirection('remove')}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${
                  adjustDirection === 'remove'
                    ? 'bg-red-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <ArrowDownIcon className="w-4 h-4 inline mr-2" />
                Remove Stock
              </button>
              <button
                type="button"
                onClick={() => setAdjustDirection('add')}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${
                  adjustDirection === 'add'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <ArrowUpIcon className="w-4 h-4 inline mr-2" />
                Add Stock
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Quantity
            </label>
            <input
              type="number"
              min="1"
              value={adjustQty}
              onChange={(e) => { setAdjustQty(e.target.value); if (adjustErrors.quantity) setAdjustErrors({...adjustErrors, quantity: ''}); }}
              placeholder="Enter quantity"
              className={`w-full px-4 py-3 bg-slate-700 border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                adjustErrors.quantity ? 'border-red-500' : 'border-slate-600'
              }`}
            />
            {adjustErrors.quantity && (
              <p className="text-red-400 text-sm mt-1">{adjustErrors.quantity}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Reason / Note <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={adjustNote}
              onChange={(e) => { setAdjustNote(e.target.value); if (adjustErrors.note) setAdjustErrors({...adjustErrors, note: ''}); }}
              placeholder="e.g., Damaged during delivery, Stock count correction"
              className={`w-full px-4 py-3 bg-slate-700 border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                adjustErrors.note ? 'border-red-500' : 'border-slate-600'
              }`}
            />
            {adjustErrors.note && (
              <p className="text-red-400 text-sm mt-1">{adjustErrors.note}</p>
            )}
          </div>

          {adjustErrors.submit && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm">{adjustErrors.submit}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => { setShowAdjust(false); setAdjustErrors({}); }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleAdjustStock}
              isLoading={isAdjusting}
            >
              <PencilSquareIcon className="w-5 h-5" />
              {adjustDirection === 'remove' ? 'Remove' : 'Add'} Stock
            </Button>
          </div>
        </div>
      </Modal>

      {/* Product History Modal */}
      <Modal
        isOpen={!!selectedProduct}
        onClose={closeHistory}
        title={selectedProduct?.name || 'Product History'}
        size="lg"
      >
        {selectedProduct && (
          <div className="space-y-6">
            {/* Product Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-700/30 p-3 rounded-lg">
                <p className="text-xs text-slate-400">Current Stock</p>
                <p className="text-xl font-bold text-white">{selectedProduct.quantity}</p>
              </div>
              <div className="bg-slate-700/30 p-3 rounded-lg">
                <p className="text-xs text-slate-400">Reorder At</p>
                <p className="text-xl font-bold text-amber-400">{selectedProduct.reorderAt}</p>
              </div>
              <div className="bg-slate-700/30 p-3 rounded-lg">
                <p className="text-xs text-slate-400">Cost Price</p>
                <p className="text-xl font-bold text-white">{formatSZL(selectedProduct.costPrice)}</p>
              </div>
              <div className="bg-slate-700/30 p-3 rounded-lg">
                <p className="text-xs text-slate-400">Sell Price</p>
                <p className="text-xl font-bold text-emerald-400">{formatSZL(selectedProduct.sellPrice)}</p>
              </div>
            </div>

            {/* Stock History */}
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                <ClockIcon className="w-4 h-4" />
                Stock History
              </h3>
              
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                </div>
              ) : productHistory.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {productHistory.map((log, idx) => {
                    const isIncrease = log.quantity > 0;
                    return (
                      <div 
                        key={log.id || idx}
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
                            <p className="font-medium text-white capitalize">
                              {log.type}
                            </p>
                            {log.note && (
                              <p className="text-xs text-slate-400">{log.note}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${
                            isIncrease ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {isIncrease ? '+' : ''}{log.quantity}
                          </p>
                          <p className="text-xs text-slate-500">
                            {log.previousQty} → {log.newQty}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatRelativeTime(log.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <ClockIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No history yet</p>
                  <p className="text-sm text-slate-500">Stock movements will appear here</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-slate-700">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={closeHistory}
              >
                Close
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setAdjustProduct(selectedProduct.id);
                  closeHistory();
                  setShowAdjust(true);
                }}
              >
                <PencilSquareIcon className="w-5 h-5" />
                Adjust
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => {
                  setReceiveProduct(selectedProduct.id);
                  closeHistory();
                  setShowReceive(true);
                }}
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
                Receive
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed bottom-4 right-4 bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50">
          <CheckCircleIcon className="w-6 h-6" />
          <span className="font-medium">Stock received successfully!</span>
        </div>
      )}
    </div>
  );
}
