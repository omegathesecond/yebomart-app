import { useState, useEffect } from 'react';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  BuildingStorefrontIcon,
  ArrowPathIcon,
  CubeIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { api, type SupplierLedgerEntry } from '@/api/client';
import { useInventoryStore } from '@/stores/inventoryStore';
import { formatCurrency } from '@/types';

const LEDGER_TYPE_LABEL: Record<SupplierLedgerEntry['type'], string> = {
  BILL: 'Received (billed)',
  PAYMENT: 'Payment',
  ADJUSTMENT: 'Adjustment',
};

interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  taxId?: string;
  currency?: string;
  paymentTerms?: string;
  leadTimeDays?: number;
  notes?: string;
  isActive: boolean;
  // Accounts payable — what this shop currently owes the supplier. Mirrors
  // Supplier.balance on the API (bumped by PO receipts, paid down by
  // recordPayment on a PO). Positive = we owe them.
  balance: number;
  products?: Array<{
    productId: string;
    product?: { id: string; name: string; barcode?: string };
  }>;
  _count?: {
    products: number;
    orders: number;
  };
  createdAt: string;
}

export function Suppliers() {
  const { products } = useInventoryStore();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showProductsModal, setShowProductsModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [productSearch, setProductSearch] = useState('');
  const [supplierLedger, setSupplierLedger] = useState<SupplierLedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contactName: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    city: '',
    country: '',
    currency: '',
    paymentTerms: '',
    leadTimeDays: '',
    notes: '',
  });

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const response = await api.getSuppliers(searchQuery ? { search: searchQuery } : undefined);
      setSuppliers(response.data || []);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSuppliers();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleOpenModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        contactName: supplier.contactName || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        website: supplier.website || '',
        address: supplier.address || '',
        city: supplier.city || '',
        country: supplier.country || '',
        currency: supplier.currency || '',
        paymentTerms: supplier.paymentTerms || '',
        leadTimeDays: supplier.leadTimeDays?.toString() || '',
        notes: supplier.notes || '',
      });
      setSupplierLedger([]);
      setLedgerLoading(true);
      api.getSupplierLedger(supplier.id).then(({ data }) => {
        setSupplierLedger(data || []);
        setLedgerLoading(false);
      });
    } else {
      setEditingSupplier(null);
      setFormData({
        name: '',
        contactName: '',
        phone: '',
        email: '',
        website: '',
        address: '',
        city: '',
        country: '',
        currency: '',
        paymentTerms: '',
        leadTimeDays: '',
        notes: '',
      });
      setSupplierLedger([]);
    }
    setShowModal(true);
  };

  const handleOpenProductsModal = async (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    // Fetch full supplier details with products
    try {
      const response = await api.getSupplier(supplier.id);
      if (response.data?.products) {
        setSelectedProductIds(new Set(response.data.products.map((p: any) => p.productId)));
      } else {
        setSelectedProductIds(new Set());
      }
    } catch (error) {
      setSelectedProductIds(new Set());
    }
    setShowProductsModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      const data = {
        ...formData,
        leadTimeDays: formData.leadTimeDays ? parseInt(formData.leadTimeDays) : undefined,
      };
      if (editingSupplier) {
        await api.updateSupplier(editingSupplier.id, data);
      } else {
        await api.createSupplier(data);
      }
      await fetchSuppliers();
      setShowModal(false);
    } catch (error) {
      console.error('Failed to save supplier:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProducts = async () => {
    if (!selectedSupplier) return;
    setSaving(true);
    try {
      await api.setSupplierProducts(selectedSupplier.id, Array.from(selectedProductIds));
      await fetchSuppliers();
      setShowProductsModal(false);
    } catch (error) {
      console.error('Failed to save products:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleProduct = (productId: string) => {
    const newSet = new Set(selectedProductIds);
    if (newSet.has(productId)) {
      newSet.delete(productId);
    } else {
      newSet.add(productId);
    }
    setSelectedProductIds(newSet);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.deleteSupplier(deleteId);
      await fetchSuppliers();
      setDeleteId(null);
    } catch (error) {
      console.error('Failed to delete supplier:', error);
    }
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.phone?.includes(searchQuery)
  );

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.barcode?.includes(productSearch)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Suppliers</h1>
          <p className="text-slate-400 mt-1">
            {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          variant="primary"
          leftIcon={<PlusIcon className="w-5 h-5" />}
          onClick={() => handleOpenModal()}
        >
          Add Supplier
        </Button>
      </div>

      {/* Search */}
      <Input
        placeholder="Search suppliers..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
      />

      {/* Suppliers List */}
      {loading ? (
        <div className="text-center py-12">
          <ArrowPathIcon className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          <p className="text-slate-400 mt-2">Loading suppliers...</p>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <Card className="text-center py-12">
          <BuildingStorefrontIcon className="w-12 h-12 mx-auto text-slate-500 mb-3" />
          <p className="text-slate-400 mb-4">No suppliers found</p>
          <Button variant="primary" onClick={() => handleOpenModal()}>
            Add Your First Supplier
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSuppliers.map((supplier) => (
            <Card key={supplier.id} className="relative">
              {/* Actions */}
              <div className="absolute top-3 right-3 flex gap-1">
                <button
                  onClick={() => handleOpenProductsModal(supplier)}
                  className="p-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 text-amber-400"
                  title="Manage Products"
                >
                  <CubeIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleOpenModal(supplier)}
                  className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleteId(supplier.id)}
                  className="p-1.5 rounded-lg bg-slate-700 hover:bg-red-600 text-slate-300"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>

              <div className="pr-28">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                    <BuildingStorefrontIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{supplier.name}</h3>
                    {supplier.contactName && (
                      <p className="text-sm text-slate-400">{supplier.contactName}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {supplier.phone && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <PhoneIcon className="w-4 h-4" />
                      <a href={`tel:${supplier.phone}`} className="hover:text-amber-400">
                        {supplier.phone}
                      </a>
                    </div>
                  )}
                  {supplier.email && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <EnvelopeIcon className="w-4 h-4" />
                      <a href={`mailto:${supplier.email}`} className="hover:text-amber-400 truncate">
                        {supplier.email}
                      </a>
                    </div>
                  )}
                  {(supplier.address || supplier.country) && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <MapPinIcon className="w-4 h-4 shrink-0" />
                      <span className="truncate">
                        {supplier.city && `${supplier.city}, `}
                        {supplier.country || supplier.address}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {supplier.balance > 0 ? (
                    <Badge variant="danger">Owe {formatCurrency(supplier.balance)}</Badge>
                  ) : (
                    <Badge variant="success">Settled</Badge>
                  )}
                  {supplier.country && (
                    <Badge variant="neutral">{supplier.country}</Badge>
                  )}
                  {supplier.currency && (
                    <Badge variant="info">{supplier.currency}</Badge>
                  )}
                  {supplier.paymentTerms && (
                    <Badge variant="warning">{supplier.paymentTerms}</Badge>
                  )}
                  {supplier.leadTimeDays && (
                    <Badge variant="default">{supplier.leadTimeDays} days</Badge>
                  )}
                </div>

                {supplier._count && (
                  <div className="mt-3 pt-3 border-t border-slate-700 flex gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <CubeIcon className="w-3.5 h-3.5" />
                      {supplier._count.products} products
                    </span>
                    <span>{supplier._count.orders} orders</span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {/* Accounts payable — what this shop currently owes the supplier. */}
          {editingSupplier && (
            <div className="bg-slate-800 rounded-xl p-3 flex items-center justify-between">
              <span className="text-sm text-slate-400">Balance owed</span>
              <span
                className={`font-bold ${editingSupplier.balance > 0 ? 'text-red-400' : 'text-emerald-400'}`}
              >
                {editingSupplier.balance > 0 ? formatCurrency(editingSupplier.balance) : 'Settled'}
              </span>
            </div>
          )}

          {/* Accounts-payable ledger — BILL entries from PO receipts and
              PAYMENT entries from Record Payment on a PO's detail view. */}
          {editingSupplier && (ledgerLoading || supplierLedger.length > 0) && (
            <div>
              <p className="text-sm font-medium text-white mb-2">Account Ledger</p>
              {ledgerLoading ? (
                <div className="text-center py-3">
                  <ArrowPathIcon className="w-5 h-5 animate-spin mx-auto text-slate-400" />
                </div>
              ) : (
                <div className="space-y-2">
                  {supplierLedger.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex justify-between items-center bg-slate-800 rounded-lg p-3"
                    >
                      <div>
                        <p className="text-sm text-white">{LEDGER_TYPE_LABEL[entry.type]}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(entry.createdAt).toLocaleDateString()}
                          {entry.note ? ` · ${entry.note}` : ''}
                        </p>
                      </div>
                      <p
                        className={`font-semibold ${
                          entry.type === 'PAYMENT' ? 'text-emerald-400' : 'text-slate-300'
                        }`}
                      >
                        {formatCurrency(entry.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Company Details */}
          <div className="space-y-4">
            <p className="text-xs text-amber-400 mb-1 uppercase tracking-wider font-semibold">Company Details</p>
            <Input
              label="Supplier / Company Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Guangzhou Trading Co., Makro SA"
            />
            <Input
              label="Primary Contact"
              value={formData.contactName}
              onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
              placeholder="e.g., Wang Wei, Sarah Johnson"
            />
          </div>
          
          {/* Contact Information */}
          <div className="pt-3 border-t border-slate-700">
            <p className="text-xs text-amber-400 mb-3 uppercase tracking-wider font-semibold">Contact Information</p>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Phone Number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+86 20 1234 5678"
                hint="Include country code"
              />
              <Input
                label="Email Address"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="export@supplier.com"
              />
            </div>
            <div className="mt-4">
              <Input
                label="Website / Alibaba Store"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://supplier.alibaba.com"
              />
            </div>
          </div>
          
          {/* Location */}
          <div className="pt-3 border-t border-slate-700">
            <p className="text-xs text-amber-400 mb-3 uppercase tracking-wider font-semibold">Location</p>
            <Input
              label="Street Address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="e.g., 88 Tianhe Road, Building A"
            />
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Input
                label="City / Region"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g., Shenzhen, Cape Town"
              />
              <Input
                label="Country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                placeholder="e.g., China, South Africa"
              />
            </div>
          </div>
          
          {/* Trade Terms */}
          <div className="pt-3 border-t border-slate-700">
            <p className="text-xs text-amber-400 mb-3 uppercase tracking-wider font-semibold">Trade Terms</p>
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Trading Currency"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                placeholder="USD, CNY, ZAR"
                hint="Their currency"
              />
              <Input
                label="Payment Terms"
                value={formData.paymentTerms}
                onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                placeholder="T/T, L/C, 30% deposit"
                hint="How you pay"
              />
              <Input
                label="Lead Time"
                type="number"
                value={formData.leadTimeDays}
                onChange={(e) => setFormData({ ...formData, leadTimeDays: e.target.value })}
                placeholder="30"
                hint="Days to deliver"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Additional Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              rows={2}
              placeholder="MOQ requirements, shipping methods, quality notes, trade shows met at..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleSave}
              disabled={!formData.name.trim() || saving}
            >
              {saving ? 'Saving...' : editingSupplier ? 'Update' : 'Add Supplier'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Products Modal */}
      <Modal
        isOpen={showProductsModal}
        onClose={() => setShowProductsModal(false)}
        title={`Products from ${selectedSupplier?.name || 'Supplier'}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Select products that this supplier provides
          </p>
          
          {/* Product Search */}
          <Input
            placeholder="Search products..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
          />
          
          {/* Selected count */}
          <div className="text-sm text-amber-400">
            {selectedProductIds.size} product{selectedProductIds.size !== 1 ? 's' : ''} selected
          </div>

          {/* Product List */}
          <div className="max-h-64 overflow-y-auto space-y-2">
            {filteredProducts.map((product) => {
              const isSelected = selectedProductIds.has(product.id);
              return (
                <div
                  key={product.id}
                  onClick={() => toggleProduct(product.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-center justify-between ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/50'
                      : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div>
                    <p className="font-medium text-white">{product.name}</p>
                    {product.barcode && (
                      <p className="text-xs text-slate-500">{product.barcode}</p>
                    )}
                  </div>
                  {isSelected && (
                    <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                      <CheckIcon className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              );
            })}
            {filteredProducts.length === 0 && (
              <p className="text-center text-slate-500 py-4">No products found</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowProductsModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleSaveProducts}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Products'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier? This cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
