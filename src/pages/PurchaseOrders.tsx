import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  PlusIcon,
  ClipboardDocumentListIcon,
  ArrowPathIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  TruckIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Toast, useToast } from '@/components/ui/Toast';
import { api } from '@/api/client';
import { useInventoryStore } from '@/stores/inventoryStore';
import { formatCurrency, formatDate } from '@/types';

interface POItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  receivedQty: number;
}

interface PurchaseOrder {
  id: string;
  orderNumber?: string;
  supplierId: string;
  status: 'DRAFT' | 'SENT' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED';
  subtotal: number;
  tax: number;
  totalAmount: number;
  orderDate: string;
  expectedDate?: string;
  receivedDate?: string;
  notes?: string;
  supplier?: { id: string; name: string; phone?: string; currency?: string };
  items?: POItem[];
  _count?: { items: number };
}

interface Supplier {
  id: string;
  name: string;
}

// Draft line item while building a PO in the create modal.
interface DraftLine {
  productId: string;
  productName: string;
  qtyOrdered: number;
  unitCost: number;
}

const STATUS_VARIANT: Record<PurchaseOrder['status'], 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'default',
  SENT: 'info',
  PARTIAL: 'warning',
  RECEIVED: 'success',
  CANCELLED: 'danger',
};

const STATUS_FILTERS = ['ALL', 'DRAFT', 'SENT', 'PARTIAL', 'RECEIVED', 'CANCELLED'] as const;

export function PurchaseOrders() {
  const { products, loadAll } = useInventoryStore();
  const { toast, showToast, dismissToast } = useToast();

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('ALL');

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [placeOrder, setPlaceOrder] = useState(true); // SENT vs DRAFT
  const [tax, setTax] = useState('');
  const [notes, setNotes] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [productSearch, setProductSearch] = useState('');

  // Receive modal state
  const [receivePo, setReceivePo] = useState<PurchaseOrder | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [receiveQty, setReceiveQty] = useState<Record<string, number>>({});
  const [updateCost, setUpdateCost] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await api.getPurchaseOrders(
      statusFilter === 'ALL' ? undefined : { status: statusFilter },
    );
    if (error) {
      showToast(error, 'error');
      setOrders([]);
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  }, [statusFilter, showToast]);

  const fetchSuppliers = useCallback(async () => {
    const { data, error } = await api.getSuppliers();
    if (error) {
      showToast(error, 'error');
      return;
    }
    setSuppliers((data || []).map((s: any) => ({ id: s.id, name: s.name })));
  }, [showToast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    fetchSuppliers();
    if (products.length === 0) loadAll('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Create flow ──────────────────────────────────────────────────────

  const openCreate = () => {
    setSupplierId('');
    setPlaceOrder(true);
    setTax('');
    setNotes('');
    setExpectedDate('');
    setLines([]);
    setProductSearch('');
    setShowCreate(true);
  };

  const addLine = (product: { id: string; name: string; costPrice: number }) => {
    setLines((prev) => {
      if (prev.some((l) => l.productId === product.id)) return prev;
      return [
        ...prev,
        { productId: product.id, productName: product.name, qtyOrdered: 1, unitCost: product.costPrice || 0 },
      ];
    });
  };

  const updateLine = (productId: string, field: 'qtyOrdered' | 'unitCost', value: number) => {
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, [field]: value } : l)));
  };

  const removeLine = (productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  };

  const draftSubtotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.qtyOrdered * l.unitCost, 0),
    [lines],
  );
  const draftTotal = draftSubtotal + (parseFloat(tax) || 0);

  const handleCreate = async () => {
    if (!supplierId) {
      showToast('Pick a supplier first', 'error');
      return;
    }
    if (lines.length === 0) {
      showToast('Add at least one product line', 'error');
      return;
    }
    if (lines.some((l) => l.qtyOrdered < 1 || l.unitCost < 0)) {
      showToast('Quantities must be at least 1 and costs cannot be negative', 'error');
      return;
    }

    setSaving(true);
    const { error } = await api.createPurchaseOrder({
      supplierId,
      status: placeOrder ? 'SENT' : 'DRAFT',
      tax: parseFloat(tax) || 0,
      expectedDate: expectedDate || undefined,
      notes: notes || undefined,
      items: lines.map((l) => ({ productId: l.productId, qtyOrdered: l.qtyOrdered, unitCost: l.unitCost })),
    });
    setSaving(false);

    if (error) {
      showToast(error, 'error');
      return;
    }
    showToast('Purchase order created');
    setShowCreate(false);
    fetchOrders();
  };

  // ── Receive flow ─────────────────────────────────────────────────────

  const openReceive = async (po: PurchaseOrder) => {
    // Always pull fresh detail so we have the latest receivedQty per line.
    const { data, error } = await api.getPurchaseOrder(po.id);
    if (error || !data) {
      showToast(error || 'Failed to load purchase order', 'error');
      return;
    }
    const full = data as PurchaseOrder;
    const initial: Record<string, number> = {};
    (full.items || []).forEach((item) => {
      initial[item.id] = Math.max(0, item.quantity - item.receivedQty);
    });
    setReceiveQty(initial);
    setUpdateCost(false);
    setReceivePo(full);
  };

  const handleReceive = async () => {
    if (!receivePo) return;
    const items = (receivePo.items || [])
      .map((item) => ({ poItemId: item.id, quantity: receiveQty[item.id] || 0 }))
      .filter((r) => r.quantity > 0);

    if (items.length === 0) {
      showToast('Enter a quantity to receive on at least one line', 'error');
      return;
    }

    setReceiving(true);
    const { error } = await api.receivePurchaseOrder(receivePo.id, { items, updateCost });
    setReceiving(false);

    if (error) {
      showToast(error, 'error');
      return;
    }
    showToast('Stock received and updated');
    setReceivePo(null);
    // Refresh both the PO list and product stock levels.
    fetchOrders();
    loadAll('');
  };

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
          p.barcode?.includes(productSearch),
      ),
    [products, productSearch],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Purchase Orders</h1>
          <p className="text-slate-400 mt-1">
            {orders.length} order{orders.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="primary" leftIcon={<PlusIcon className="w-5 h-5" />} onClick={openCreate}>
          New Purchase Order
        </Button>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-amber-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12">
          <ArrowPathIcon className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          <p className="text-slate-400 mt-2">Loading purchase orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <Card className="text-center py-12">
          <ClipboardDocumentListIcon className="w-12 h-12 mx-auto text-slate-500 mb-3" />
          <p className="text-slate-400 mb-4">No purchase orders yet</p>
          <Button variant="primary" onClick={openCreate}>
            Raise Your First Purchase Order
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((po) => {
            const canReceive = po.status !== 'RECEIVED' && po.status !== 'CANCELLED';
            return (
              <Card key={po.id}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-white">{po.orderNumber || po.id.slice(0, 8)}</h3>
                    <p className="text-sm text-slate-400">{po.supplier?.name || 'Unknown supplier'}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[po.status]}>
                    {po.status.charAt(0) + po.status.slice(1).toLowerCase()}
                  </Badge>
                </div>

                <div className="space-y-1 text-sm text-slate-400">
                  <div className="flex justify-between">
                    <span>Items</span>
                    <span className="text-slate-300">{po._count?.items ?? po.items?.length ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total</span>
                    <span className="text-white font-semibold">{formatCurrency(po.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ordered</span>
                    <span className="text-slate-300">{formatDate(po.orderDate)}</span>
                  </div>
                </div>

                {canReceive && (
                  <Button
                    variant="secondary"
                    className="w-full mt-4"
                    leftIcon={<TruckIcon className="w-4 h-4" />}
                    onClick={() => openReceive(po)}
                  >
                    Receive Stock
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Purchase Order" size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {/* Supplier */}
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Supplier *</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            >
              <option value="">Select a supplier…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {suppliers.length === 0 && (
              <p className="text-xs text-amber-400 mt-1">Add a supplier first on the Suppliers page.</p>
            )}
          </div>

          {/* Product picker */}
          <div className="pt-3 border-t border-slate-700">
            <p className="text-xs text-amber-400 mb-2 uppercase tracking-wider font-semibold">Add Products</p>
            <Input
              placeholder="Search products to add..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
            />
            {productSearch && (
              <div className="max-h-40 overflow-y-auto mt-2 space-y-1">
                {filteredProducts.slice(0, 30).map((p) => {
                  const added = lines.some((l) => l.productId === p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => addLine(p)}
                      disabled={added}
                      className={`w-full text-left p-2.5 rounded-lg border flex items-center justify-between transition-colors ${
                        added
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                          : 'bg-slate-800 border-slate-700 hover:border-slate-600 text-white'
                      }`}
                    >
                      <span className="text-sm">{p.name}</span>
                      {added ? (
                        <CheckIcon className="w-4 h-4" />
                      ) : (
                        <PlusIcon className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <p className="text-center text-slate-500 py-3 text-sm">No products found</p>
                )}
              </div>
            )}
          </div>

          {/* Line items */}
          {lines.length > 0 && (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs text-slate-500 px-1">
                <span className="col-span-5">Product</span>
                <span className="col-span-3">Qty</span>
                <span className="col-span-3">Unit Cost</span>
                <span className="col-span-1"></span>
              </div>
              {lines.map((l) => (
                <div key={l.productId} className="grid grid-cols-12 gap-2 items-center">
                  <span className="col-span-5 text-sm text-white truncate">{l.productName}</span>
                  <input
                    type="number"
                    min={1}
                    value={l.qtyOrdered}
                    onChange={(e) => updateLine(l.productId, 'qtyOrdered', parseInt(e.target.value) || 0)}
                    className="col-span-3 bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm focus:border-amber-500"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={l.unitCost}
                    onChange={(e) => updateLine(l.productId, 'unitCost', parseFloat(e.target.value) || 0)}
                    className="col-span-3 bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm focus:border-amber-500"
                  />
                  <button
                    onClick={() => removeLine(l.productId)}
                    className="col-span-1 flex justify-center text-slate-400 hover:text-red-400"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Tax + expected date */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-700">
            <Input
              label="Tax"
              type="number"
              value={tax}
              onChange={(e) => setTax(e.target.value)}
              placeholder="0.00"
            />
            <Input
              label="Expected Date"
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              placeholder="Delivery instructions, reference numbers..."
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={placeOrder}
              onChange={(e) => setPlaceOrder(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500"
            />
            Mark as ordered (sent to supplier) — uncheck to keep as draft
          </label>

          {/* Totals */}
          <div className="flex justify-between items-center pt-3 border-t border-slate-700">
            <span className="text-slate-400">Total</span>
            <span className="text-xl font-bold text-white">{formatCurrency(draftTotal)}</span>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleCreate}
              disabled={saving || !supplierId || lines.length === 0}
            >
              {saving ? 'Creating...' : 'Create Order'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Receive Modal */}
      <Modal
        isOpen={!!receivePo}
        onClose={() => setReceivePo(null)}
        title={`Receive ${receivePo?.orderNumber || 'Purchase Order'}`}
        size="lg"
      >
        {receivePo && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <p className="text-sm text-slate-400">
              Enter the quantity received per line. Stock increases and an audit entry is logged for each.
            </p>

            <div className="grid grid-cols-12 gap-2 text-xs text-slate-500 px-1">
              <span className="col-span-5">Product</span>
              <span className="col-span-2 text-right">Ordered</span>
              <span className="col-span-2 text-right">Received</span>
              <span className="col-span-3 text-right">Receive Now</span>
            </div>

            {(receivePo.items || []).map((item) => {
              const outstanding = Math.max(0, item.quantity - item.receivedQty);
              return (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                  <span className="col-span-5 text-sm text-white truncate">{item.productName}</span>
                  <span className="col-span-2 text-right text-sm text-slate-300">{item.quantity}</span>
                  <span className="col-span-2 text-right text-sm text-slate-300">{item.receivedQty}</span>
                  <input
                    type="number"
                    min={0}
                    max={outstanding}
                    value={receiveQty[item.id] ?? 0}
                    disabled={outstanding === 0}
                    onChange={(e) => {
                      const v = Math.min(outstanding, Math.max(0, parseInt(e.target.value) || 0));
                      setReceiveQty((prev) => ({ ...prev, [item.id]: v }));
                    }}
                    className="col-span-3 bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm text-right focus:border-amber-500 disabled:opacity-50"
                  />
                </div>
              );
            })}

            <label className="flex items-center gap-2 text-sm text-slate-300 pt-2 border-t border-slate-700">
              <input
                type="checkbox"
                checked={updateCost}
                onChange={(e) => setUpdateCost(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500"
              />
              Update product cost prices to this PO's unit costs
            </label>

            <div className="flex gap-3 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setReceivePo(null)}>
                Cancel
              </Button>
              <Button variant="primary" className="flex-1" onClick={handleReceive} disabled={receiving}>
                {receiving ? 'Receiving...' : 'Receive Stock'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
