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
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { formatCurrency, PRODUCT_CATEGORIES } from '@/types';

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
          <h1 className="text-2xl font-bold text-ink">Products</h1>
          <p className="text-mute mt-1">
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

      {/*
        A dense table, not a card grid. A shop carries a hundred-odd lines and
        the job here is scanning and comparing — price against cost, what is
        running low — which a column does and a card cannot. Cards survive on
        phones, where there is no room for seven columns.
      */}
      {filteredProducts.length > 0 ? (
        <div className="border border-line-strong bg-cream">
          {/* Column header — desktop only */}
          <div className="hidden items-center gap-4 border-b border-line-strong px-4 pb-2.5 pt-3 md:flex">
            <span className="eyebrow flex-1">Product</span>
            <span className="eyebrow w-[124px]">Barcode</span>
            <span className="eyebrow w-[92px]">Category</span>
            <span className="eyebrow w-[76px] text-right">Cost</span>
            <span className="eyebrow w-[76px] text-right">Price</span>
            <span className="eyebrow w-[64px] text-right">Margin</span>
            <span className="eyebrow w-[132px] text-right">In stock</span>
            <span className="eyebrow w-[64px] text-right">Edit</span>
          </div>

          {filteredProducts.map((product) => {
            const isLowStock = product.quantity <= product.reorderAt;
            const isOutOfStock = product.quantity === 0;
            const margin =
              product.sellPrice > 0
                ? ((product.sellPrice - product.costPrice) / product.sellPrice) * 100
                : 0;
            // The meter reads against the reorder point, because "38 left" only
            // means something next to the level this shop restocks at.
            const fill = isOutOfStock
              ? 0
              : Math.max(6, Math.min(100, (product.quantity / Math.max(product.reorderAt * 2, 1)) * 100));

            return (
              <div
                key={product.id}
                className={`flex flex-col gap-2 border-b border-line px-4 py-3 last:border-b-0 md:flex-row md:items-center md:gap-4 md:py-3 ${
                  isOutOfStock ? 'bg-wash' : ''
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {product.imageUrl && (
                    <div className="h-9 w-9 shrink-0 overflow-hidden border border-line bg-sand">
                      <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium">{product.name}</p>
                    <p className="m mt-0.5 text-[10.5px] text-mute md:hidden">
                      {formatCurrency(product.sellPrice)} · {product.quantity} {product.unit}
                    </p>
                  </div>
                </div>

                <span className="m hidden w-[124px] truncate text-[11.5px] text-mute md:block">
                  {product.barcode || '—'}
                </span>
                <span className="m hidden w-[92px] truncate text-[10.5px] uppercase tracking-[0.08em] text-body md:block">
                  {product.category || '—'}
                </span>
                <span className="m hidden w-[76px] text-right text-[13px] text-body md:block">
                  {formatCurrency(product.costPrice)}
                </span>
                <span className="m hidden w-[76px] text-right text-[13px] font-semibold md:block">
                  {formatCurrency(product.sellPrice)}
                </span>
                <span className={`m hidden w-[64px] text-right text-[13px] md:block ${margin > 0 ? 'text-ok' : 'text-bad'}`}>
                  {margin.toFixed(1)}%
                </span>

                <span className="hidden w-[132px] items-center justify-end gap-2.5 md:flex">
                  <span className="h-1 w-[56px] bg-shade">
                    <span
                      className={`block h-1 ${isOutOfStock ? '' : isLowStock ? 'bg-warn' : 'bg-ink'}`}
                      style={{ width: `${fill}%` }}
                    />
                  </span>
                  <span
                    className={`m w-[62px] text-right text-[11.5px] ${
                      isOutOfStock ? 'font-medium text-bad' : isLowStock ? 'font-medium text-warn' : 'text-mute'
                    }`}
                  >
                    {isOutOfStock ? 'Out of stock' : isLowStock ? `${product.quantity} low` : `${product.quantity} in stock`}
                  </span>
                </span>

                <div className="flex w-[64px] shrink-0 items-center justify-end gap-1">
                  <Link
                    to={`/products/${product.id}`}
                    aria-label={`Edit ${product.name}`}
                    className="grid h-8 w-8 place-items-center text-mute transition-colors hover:text-ink"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => setDeleteId(product.id)}
                    aria-label={`Delete ${product.name}`}
                    className="grid h-8 w-8 place-items-center text-mist transition-colors hover:text-bad"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="py-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-shade/50 flex items-center justify-center">
            {searchQuery || categoryFilter ? (
              <MagnifyingGlassIcon className="w-8 h-8 text-mist" />
            ) : (
              <PlusIcon className="w-8 h-8 text-mist" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-ink mb-2">
            {searchQuery || categoryFilter ? 'No products found' : 'No products yet'}
          </h3>
          <p className="text-mute mb-4">
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
