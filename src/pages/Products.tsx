import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  QrCodeIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Toast, useToast } from '@/components/ui/Toast';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { formatCurrency } from '@/types';
import { api } from '@/api/client';
import { downloadCsv, downloadCsvText } from '@/lib/exportReport';
import {
  parseProductCsv,
  PRODUCT_CSV_HEADERS,
  MAX_IMPORT_ROWS,
  type ParsedProduct,
  type ParseRowError,
} from '@/lib/csvImport';

export function Products() {
  const { shop } = useAuthStore();
  const { products, loadAll, deleteProduct } = useInventoryStore();
  const { toast, showToast, dismissToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // CSV import/export
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importRows, setImportRows] = useState<ParsedProduct[]>([]);
  const [importErrors, setImportErrors] = useState<ParseRowError[]>([]);
  const [updateExisting, setUpdateExisting] = useState(false);

  useEffect(() => {
    if (shop) {
      loadAll(shop.id);
    }
  }, [shop, loadAll]);

  // ── CSV export ──────────────────────────────────────────────────────────
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const csv = await api.exportProducts();
      if (!csv || !csv.trim()) {
        showToast('No products to export yet.', 'error');
        return;
      }
      const date = new Date().toISOString().slice(0, 10);
      downloadCsvText(`products-${date}.csv`, csv);
      showToast('Products exported.');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to export products.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    // Header + one example row so owners can see the expected shape.
    downloadCsv('yebomart-products-template', PRODUCT_CSV_HEADERS, [
      ['6001234567890', 'Example Cola 500ml', 'Beverages', '6.50', '10.00', '24', '6', 'each'],
    ]);
  };

  // ── CSV import ──────────────────────────────────────────────────────────
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file again re-fires onChange.
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const { rows, errors } = parseProductCsv(text);
      setImportFileName(file.name);
      setImportRows(rows);
      setImportErrors(errors);
      setUpdateExisting(false);
      setImportOpen(true);
    } catch (err) {
      // Malformed file (e.g. missing required columns) — surface loudly.
      showToast(err instanceof Error ? err.message : 'Could not read the CSV file.', 'error');
    }
  };

  const handleConfirmImport = async () => {
    if (importRows.length === 0 || importRows.length > MAX_IMPORT_ROWS) return;
    setIsImporting(true);
    try {
      const res = await api.bulkImportProducts(importRows, updateExisting);
      if (res.error || !res.data) {
        showToast(res.error || 'Import failed.', 'error');
        return;
      }
      const { created, updated, skipped, errors } = res.data;
      const serverErrors = errors ?? [];
      if (serverErrors.length > 0) {
        const detail = serverErrors
          .slice(0, 3)
          .map((er: { row: number; error: string }) => {
            const name = importRows[er.row - 1]?.name;
            return name ? `${name}: ${er.error}` : er.error;
          })
          .join('; ');
        showToast(
          `Imported ${created} created / ${updated} updated, but ${serverErrors.length} row(s) failed: ${detail}${serverErrors.length > 3 ? '…' : ''}`,
          'error',
        );
      } else {
        showToast(
          `Import complete: ${created} created, ${updated} updated, ${skipped} skipped.`,
        );
      }
      if (shop) await loadAll(shop.id);
      setImportOpen(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Import failed.', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const tooManyRows = importRows.length > MAX_IMPORT_ROWS;

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
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileSelected}
          />
          <Button
            variant="ghost"
            onClick={handleDownloadTemplate}
            title="Download a CSV template with the correct columns"
          >
            Template
          </Button>
          <Button
            variant="secondary"
            leftIcon={<ArrowUpTrayIcon className="w-5 h-5" />}
            onClick={() => fileInputRef.current?.click()}
          >
            Import
          </Button>
          <Button
            variant="secondary"
            leftIcon={<ArrowDownTrayIcon className="w-5 h-5" />}
            onClick={handleExport}
            isLoading={isExporting}
          >
            Export
          </Button>
          <Link to="/products/new">
            <Button variant="primary" leftIcon={<PlusIcon className="w-5 h-5" />}>
              Add Product
            </Button>
          </Link>
        </div>
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
                <div className="flex items-start gap-3 mb-3">
                  {/* Product thumbnail */}
                  {product.imageUrl && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-700 flex-shrink-0">
                      <img 
                        src={product.imageUrl} 
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2 flex-1 min-w-0">
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
                </div>
                
                <div className="flex-1">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-sm text-slate-400">Sell Price</span>
                    <span className="text-xl font-bold text-amber-400">
                      {formatCurrency(product.sellPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline text-sm">
                    <span className="text-slate-400">Cost</span>
                    <span className="text-slate-300">{formatCurrency(product.costPrice)}</span>
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

      {/* CSV Import preview */}
      <Modal
        isOpen={importOpen}
        onClose={() => !isImporting && setImportOpen(false)}
        title="Import products from CSV"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">{importFileName}</p>

          <div className="flex flex-wrap gap-2">
            <Badge variant="success">{importRows.length} ready to import</Badge>
            {importErrors.length > 0 && (
              <Badge variant="danger">{importErrors.length} with errors (skipped)</Badge>
            )}
          </div>

          {tooManyRows && (
            <p className="text-sm text-red-400">
              This file has {importRows.length} valid rows — the maximum per import is {MAX_IMPORT_ROWS}.
              Split it into smaller files and import each.
            </p>
          )}

          {importRows.length === 0 && !tooManyRows && (
            <p className="text-sm text-red-400">
              No valid rows to import. Fix the errors below (or check the file format with “Download
              template”) and try again.
            </p>
          )}

          {importErrors.length > 0 && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <p className="text-sm font-medium text-red-300 mb-2">
                {importErrors.length} row(s) will be skipped:
              </p>
              <ul className="space-y-1 max-h-48 overflow-y-auto text-xs text-red-200/90">
                {importErrors.slice(0, 100).map((err, i) => (
                  <li key={i}>
                    Line {err.line}: {err.message}
                  </li>
                ))}
                {importErrors.length > 100 && (
                  <li className="text-red-200/60">…and {importErrors.length - 100} more.</li>
                )}
              </ul>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={updateExisting}
              onChange={(e) => setUpdateExisting(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
            />
            Update existing products (match by barcode) instead of skipping them
          </label>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setImportOpen(false)}
              className="btn btn-secondary flex-1"
              disabled={isImporting}
            >
              Cancel
            </button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleConfirmImport}
              isLoading={isImporting}
              disabled={importRows.length === 0 || tooManyRows}
            >
              Import {importRows.length} product{importRows.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </Modal>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
