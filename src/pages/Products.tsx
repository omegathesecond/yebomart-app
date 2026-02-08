import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  QrCodeIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { formatSZL, PRODUCT_CATEGORIES } from '@/types';

export function Products() {
  const { shop } = useAuthStore();
  const { products, loadAll, deleteProduct } = useInventoryStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (shop) {
      loadAll(shop.id);
    }
  }, [shop, loadAll]);

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesSearch = !searchQuery || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode?.includes(searchQuery);
    const matchesCategory = !categoryFilter || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories from products
  const usedCategories = [...new Set(products.map(p => p.category).filter(Boolean))];

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    await deleteProduct(deleteId);
    setIsDeleting(false);
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Products</h1>
          <p className="text-slate-400 mt-1">
            {products.length} product{products.length !== 1 ? 's' : ''} in catalog
          </p>
        </div>
        <Link to="/products/new">
          <Button variant="primary" leftIcon={<PlusIcon className="w-5 h-5" />}>
            Add Product
          </Button>
        </Link>
      </div>

      {/* Filters */}
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
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="select min-w-40"
          >
            <option value="">All Categories</option>
            {usedCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Grid */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((product) => {
            const isLowStock = product.quantity <= product.reorderAt;
            const isOutOfStock = product.quantity === 0;
            
            return (
              <Card key={product.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{product.name}</h3>
                    {product.category && (
                      <Badge variant="default" size="sm" className="mt-1">
                        {product.category}
                      </Badge>
                    )}
                  </div>
                  {product.barcode && (
                    <QrCodeIcon className="w-5 h-5 text-slate-500 flex-shrink-0" />
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-sm text-slate-400">Sell Price</span>
                    <span className="text-xl font-bold text-amber-400">
                      {formatSZL(product.sellPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline text-sm">
                    <span className="text-slate-400">Cost</span>
                    <span className="text-slate-300">{formatSZL(product.costPrice)}</span>
                  </div>
                  <div className="flex justify-between items-baseline text-sm mt-1">
                    <span className="text-slate-400">Margin</span>
                    <span className="text-emerald-400">
                      {((product.sellPrice - product.costPrice) / product.sellPrice * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-slate-400">In Stock</span>
                    <Badge 
                      variant={isOutOfStock ? 'danger' : isLowStock ? 'warning' : 'success'}
                    >
                      {product.quantity} {product.unit}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/products/${product.id}`} className="flex-1">
                      <Button variant="secondary" size="sm" className="w-full">
                        <PencilIcon className="w-4 h-4" />
                        Edit
                      </Button>
                    </Link>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setDeleteId(product.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="py-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700/50 flex items-center justify-center">
            {searchQuery || categoryFilter ? (
              <MagnifyingGlassIcon className="w-8 h-8 text-slate-500" />
            ) : (
              <PlusIcon className="w-8 h-8 text-slate-500" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            {searchQuery || categoryFilter ? 'No products found' : 'No products yet'}
          </h3>
          <p className="text-slate-400 mb-4">
            {searchQuery || categoryFilter 
              ? 'Try adjusting your search or filters'
              : 'Add your first product to get started'
            }
          </p>
          {!searchQuery && !categoryFilter && (
            <Link to="/products/new">
              <Button variant="primary">
                <PlusIcon className="w-5 h-5" />
                Add Product
              </Button>
            </Link>
          )}
        </Card>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Product"
        message="Are you sure you want to delete this product? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
