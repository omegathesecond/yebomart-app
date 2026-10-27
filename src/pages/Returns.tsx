import { useState, useEffect } from 'react';
import {
  ArrowPathIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowUturnLeftIcon,
  BanknotesIcon,
  ArrowsRightLeftIcon,
  PlusIcon,
  ReceiptPercentIcon,
  DocumentMagnifyingGlassIcon,
  UserPlusIcon,
  UserCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Toast, useToast } from '@/components/ui/Toast';
import { CustomerPicker } from '@/components/CustomerPicker';
import { api, type Customer, type ReplacementProduct } from '@/api/client';
import { useAuthStore } from '@/stores/authStore';
import { computeTax } from '@/lib/tax';
import { formatCurrency } from '@/types';

interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  remainingCents: number;
}

export interface Sale {
  id: string;
  receiptNumber: string;
  totalAmount: number;
  paymentMethod: string;
  customerId?: string;
  items: SaleItem[];
  createdAt: string;
  user?: { name: string };
}

interface ReturnItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  restockable: boolean;
  restocked: boolean;
}

export interface Return {
  id: string;
  saleId?: string;
  customerId?: string;
  customer?: { id: string; name: string };
  creditReversal?: { id: string; amount: number; customerId: string; returnId: string };
  reason: string;
  type: 'REFUND' | 'EXCHANGE' | 'STORE_CREDIT';
  refundAmount: number;
  settlementMethod?: string;
  settlementReference?: string;
  cashSessionId?: string;
  status: 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED';
  notes?: string;
  items: ReturnItem[];
  exchangeItems?: Array<Pick<ReturnItem, 'id' | 'productId' | 'productName' | 'quantity' | 'unitPrice'>>;
  createdAt: string;
  processedAt?: string;
}

const STATUS_CONFIG = {
  PENDING: { label: 'Pending', color: 'warning', icon: ClockIcon },
  APPROVED: { label: 'Approved', color: 'info', icon: CheckCircleIcon },
  COMPLETED: { label: 'Completed', color: 'success', icon: CheckCircleIcon },
  REJECTED: { label: 'Rejected', color: 'error', icon: XCircleIcon },
};

const TYPE_CONFIG = {
  REFUND: { label: 'Refund', icon: BanknotesIcon, color: 'text-ok' },
  EXCHANGE: { label: 'Exchange', icon: ArrowsRightLeftIcon, color: 'text-body' },
  STORE_CREDIT: { label: 'Store Credit', icon: ArrowUturnLeftIcon, color: 'text-brick' },
};

export function Returns() {
  const { toast, showToast, dismissToast } = useToast();
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [processing, setProcessing] = useState(false);
  const [settlementMethod, setSettlementMethod] = useState<'CASH' | 'CARD' | 'MOMO' | 'EMALI'>('CASH');
  const [settlementReference, setSettlementReference] = useState('');
  const [payoutConfirmed, setPayoutConfirmed] = useState(false);
  useEffect(() => {
    setPayoutConfirmed(false);
    setSettlementReference('');
    setSettlementMethod('CASH');
  }, [selectedReturn?.id]);
  
  // New return flow
  const [showNewReturn, setShowNewReturn] = useState(false);
  const [receiptSearch, setReceiptSearch] = useState('');
  const [searchingSale, setSearchingSale] = useState(false);
  const [foundSale, setFoundSale] = useState<Sale | null>(null);
  const [saleError, setSaleError] = useState('');
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
  const [returnType, setReturnType] = useState<'REFUND' | 'EXCHANGE' | 'STORE_CREDIT'>('REFUND');
  const [returnReason, setReturnReason] = useState('');
  const [creatingReturn, setCreatingReturn] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const shop = useAuthStore(state => state.shop);
  const [replacementSearch, setReplacementSearch] = useState('');
  const [replacementProducts, setReplacementProducts] = useState<ReplacementProduct[]>([]);
  const [replacementLoading, setReplacementLoading] = useState(false);
  const [replacementError, setReplacementError] = useState('');
  const [replacements, setReplacements] = useState<Array<{ product: ReplacementProduct; quantity: number }>>([]);

  useEffect(() => {
    if (!showNewReturn || returnType !== 'EXCHANGE') return;
    let cancelled = false;
    setReplacementLoading(true);
    setReplacementError('');
    const timer = setTimeout(async () => {
      try {
        const response = await api.getProducts({ search: replacementSearch.trim() || undefined, isActive: true, limit: 100 });
        if (response.error || !response.data) throw new Error(response.error || 'Unable to load replacement products');
        if (!cancelled) setReplacementProducts(response.data);
      } catch (error) {
        if (!cancelled) {
          setReplacementProducts([]);
          setReplacementError(error instanceof Error ? error.message : 'Unable to load replacement products');
        }
      } finally {
        if (!cancelled) setReplacementLoading(false);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [showNewReturn, returnType, replacementSearch, shop?.id]);

  const replacementTotal = shop ? computeTax(
    replacements.reduce((sum, line) => sum + line.product.sellPrice * line.quantity, 0), 0,
    { taxRate: shop.taxRate ?? 0, taxInclusive: shop.taxInclusive ?? false },
  ).total : null;

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const response = await api.getReturns(statusFilter ? { status: statusFilter } : undefined);
      if (response.error) {
        showToast(response.error, 'error');
        return;
      }
      setReturns(response.data || []);
    } catch (error: any) {
      showToast(error?.message || 'Failed to load returns', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, [statusFilter]);

  const handleSearchReceipt = async () => {
    if (!receiptSearch.trim()) return;
    setSearchingSale(true);
    setSaleError('');
    setFoundSale(null);
    setReplacements([]);
    try {
      const response = await api.searchSaleByReceipt(receiptSearch.trim());
      if (response.error || !response.data) {
        setSaleError(response.error || 'Receipt not found');
        return;
      }
      const remaining = await api.getReturnEntitlement(response.data.id);
      if (remaining.error || !remaining.data) {
        setSaleError(remaining.error || 'Unable to load refundable items');
        return;
      }
      setFoundSale({ ...response.data, items: remaining.data.filter(p => p.remainingQuantity > 0).map(p => ({
        id: p.productId, productId: p.productId, productName: p.productName,
        quantity: p.remainingQuantity, remainingCents: p.remainingCents,
        unitPrice: p.remainingCents / 100 / p.remainingQuantity, totalPrice: p.remainingCents / 100,
      })) });
      setReturnType(response.data.paymentMethod === 'CREDIT' ? 'STORE_CREDIT' : 'REFUND');
      setSelectedCustomer(null);
      setSelectedItems(new Map());
    } catch (error: any) {
      setSaleError(error.message || 'Receipt not found');
    } finally {
      setSearchingSale(false);
    }
  };

  const toggleItemSelection = (itemId: string, maxQty: number) => {
    const newMap = new Map(selectedItems);
    if (newMap.has(itemId)) {
      newMap.delete(itemId);
    } else {
      newMap.set(itemId, maxQty);
    }
    setSelectedItems(newMap);
  };

  const updateItemQty = (itemId: string, qty: number, maxQty: number) => {
    const newMap = new Map(selectedItems);
    if (qty <= 0) {
      newMap.delete(itemId);
    } else {
      newMap.set(itemId, Math.min(qty, maxQty));
    }
    setSelectedItems(newMap);
  };

  const calculateRefundAmount = () => {
    if (!foundSale) return 0;
    let total = 0;
    selectedItems.forEach((qty, itemId) => {
      const item = foundSale.items.find(i => i.id === itemId);
      if (item) {
        total += Math.round(item.remainingCents * qty / item.quantity) / 100;
      }
    });
    return total;
  };

  const returnedValue = calculateRefundAmount();
  const exchangeDifference = replacementTotal === null ? null : (Math.round(replacementTotal * 100) - Math.round(returnedValue * 100)) / 100;
  const exchangeError = !replacements.length ? 'Choose at least one replacement item.'
    : replacementTotal === null ? 'Shop tax settings are unavailable. Reload before creating an exchange.'
    : exchangeDifference !== 0
      ? 'Values must match. Change the replacement items or quantities. No balance payment or payout is supported.'
      : '';

  const handleCreateReturn = async () => {
    if (!foundSale || selectedItems.size === 0 || !returnReason.trim()) return;
    if (returnType === 'STORE_CREDIT' && foundSale.paymentMethod !== 'CREDIT' && !selectedCustomer) {
      showToast('Choose a customer to receive store credit', 'error');
      return;
    }
    if (foundSale.paymentMethod === 'CREDIT' && (returnType !== 'STORE_CREDIT' || (selectedCustomer && selectedCustomer.id !== foundSale.customerId))) {
      showToast('Pay-later returns must adjust the original customer account. Cash refunds and exchanges are not supported.', 'error');
      return;
    }
    if (returnType === 'EXCHANGE' && exchangeError) {
      showToast(exchangeError, 'error');
      return;
    }
    setCreatingReturn(true);
    try {
      const items = Array.from(selectedItems.entries()).map(([itemId, qty]) => {
        const item = foundSale.items.find(i => i.id === itemId)!;
        return {
          productId: item.productId,
          productName: item.productName,
          quantity: qty,
          unitPrice: item.unitPrice,
          restockable: true,
        };
      });

      const { error } = await api.createReturn({
        saleId: foundSale.id,
        customerId: foundSale.paymentMethod === 'CREDIT' ? foundSale.customerId : selectedCustomer?.id,
        reason: returnReason,
        ...(returnType === 'EXCHANGE'
          ? { type: returnType, exchangeItems: replacements.map(line => ({ productId: line.product.id, quantity: line.quantity })) }
          : { type: returnType }),
        items,
        refundAmount: returnType === 'REFUND' ? returnedValue : 0,
      });

      if (error) {
        showToast(error, 'error');
        return;
      }

      // Reset and refresh
      showToast('Return created');
      setShowNewReturn(false);
      setFoundSale(null);
      setReceiptSearch('');
      setSelectedItems(new Map());
      setReplacements([]);
      setReturnReason('');
      setSelectedCustomer(null);
      await fetchReturns();
    } catch (error: any) {
      showToast(error?.message || 'Failed to create return', 'error');
    } finally {
      setCreatingReturn(false);
    }
  };

  const handleProcess = async (action: 'approve' | 'reject' | 'complete') => {
    if (!selectedReturn) return;
    setProcessing(true);
    try {
      const { data, error } = await api.processReturn(selectedReturn.id, action, action === 'complete' && selectedReturn.type === 'REFUND' ? { method: settlementMethod, confirmed: payoutConfirmed, reference: settlementReference || undefined } : undefined);
      if (error) {
        showToast(error, 'error');
        return;
      }
      if (action === 'complete' && selectedReturn.type === 'STORE_CREDIT' &&
          !(data as Return | undefined)?.creditReversal?.id) {
        showToast('Store credit posting was not confirmed. Refresh the return before continuing.', 'error');
        return;
      }
      if (action === 'complete' && data?.creditReversal) {
        showToast(data.creditReversal.amount < 0
          ? `Customer account adjusted by ${formatCurrency(-data.creditReversal.amount)}. Repayments retained; no cash refunded.`
          : `Store credit of ${formatCurrency(data.creditReversal.amount)} posted to the customer account.`);
      }
      await fetchReturns();
      setSelectedReturn(null);
    } catch (error: any) {
      showToast(error?.message || 'Failed to process return', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const filteredReturns = returns.filter(r =>
    r.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.items?.some(i => i.productName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Returns</h1>
          <p className="text-mute mt-1">
            Manage refunds and exchanges
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            leftIcon={<ArrowPathIcon className="w-5 h-5" />}
            onClick={fetchReturns}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            leftIcon={<PlusIcon className="w-5 h-5" />}
            onClick={() => setShowNewReturn(true)}
          >
            New Return
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search returns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-sand border border-line rounded-sharp px-4 py-2.5 text-ink"
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="COMPLETED">Completed</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {/* Returns List */}
      {loading ? (
        <div className="text-center py-12">
          <ArrowPathIcon className="w-8 h-8 animate-spin mx-auto text-mute" />
          <p className="text-mute mt-2">Loading returns...</p>
        </div>
      ) : filteredReturns.length === 0 ? (
        <Card className="text-center py-12">
          <ArrowUturnLeftIcon className="w-12 h-12 mx-auto text-mist mb-3" />
          <p className="text-mute mb-4">No returns found</p>
          <Button variant="primary" onClick={() => setShowNewReturn(true)}>
            Create First Return
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredReturns.map((ret) => {
            const statusConfig = STATUS_CONFIG[ret.status];
            const typeConfig = TYPE_CONFIG[ret.type];
            const TypeIcon = typeConfig.icon;

            return (
              <Card
                key={ret.id}
                className="cursor-pointer hover:bg-sand/50 transition-colors"
                onClick={() => setSelectedReturn(ret)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <TypeIcon className={`w-5 h-5 ${typeConfig.color}`} />
                      <span className="font-medium text-ink">{typeConfig.label}</span>
                      <Badge variant={statusConfig.color as any}>
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <p className="text-mute text-sm mb-2">{ret.reason}</p>
                    <div className="text-sm text-mist">
                      {ret.items?.length || 0} item{(ret.items?.length || 0) !== 1 ? 's' : ''} •{' '}
                      {new Date(ret.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  {ret.type === 'REFUND' && (
                    <div className="text-right">
                      <p className="m text-lg font-bold text-ok">
                        {formatCurrency(ret.refundAmount)}
                      </p>
                      <p className="text-xs text-mist">Refund</p>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Return Modal */}
      <Modal
        isOpen={showNewReturn}
        onClose={() => {
          setShowNewReturn(false);
          setFoundSale(null);
          setReceiptSearch('');
          setSaleError('');
          setSelectedItems(new Map());
          setReplacements([]);
          setReplacementSearch('');
          setReturnReason('');
          setSelectedCustomer(null);
        }}
        title="New Return"
      >
        <div className="space-y-6">
          {/* Receipt Search */}
          <div>
            <label className="block text-sm text-mute mb-2">
              Search by Receipt Number
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., RCP-260212-0001 or just 0001"
                value={receiptSearch}
                onChange={(e) => setReceiptSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchReceipt()}
                leftIcon={<ReceiptPercentIcon className="w-5 h-5" />}
              />
              <Button
                variant="secondary"
                onClick={handleSearchReceipt}
                disabled={searchingSale || !receiptSearch.trim()}
              >
                {searchingSale ? (
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                ) : (
                  <DocumentMagnifyingGlassIcon className="w-5 h-5" />
                )}
              </Button>
            </div>
            {saleError && (
              <p className="text-bad text-sm mt-2">{saleError}</p>
            )}
          </div>

          {/* Found Sale */}
          {foundSale && (
            <>
              <div className="p-4 bg-sand rounded-sharp border border-line">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-mono text-brick font-semibold">
                      {foundSale.receiptNumber}
                    </p>
                    <p className="text-sm text-mute">
                      {new Date(foundSale.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="m text-lg font-bold text-ink">
                      {formatCurrency(foundSale.totalAmount)}
                    </p>
                    <p className="text-xs text-mist uppercase">
                      {foundSale.paymentMethod}
                    </p>
                  </div>
                </div>
                {foundSale.user && (
                  <p className="text-xs text-mist">
                    Cashier: {foundSale.user.name}
                  </p>
                )}
              </div>

              {/* Select Items to Return */}
              <div>
                <label className="block text-sm text-mute mb-2">
                  Select Items to Return
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {foundSale.items.map((item) => {
                    const isSelected = selectedItems.has(item.id);
                    const selectedQty = selectedItems.get(item.id) || 0;

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-sharp border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-wash border-ink/50'
                            : 'bg-sand border-line hover:border-line-strong'
                        }`}
                        onClick={() => toggleItemSelection(item.id, item.quantity)}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <p className="font-medium text-ink">{item.productName}</p>
                            <p className="text-sm text-mute">
                              {formatCurrency(item.unitPrice)} × {item.quantity}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="number"
                                min="1"
                                max={item.quantity}
                                value={selectedQty}
                                onChange={(e) => updateItemQty(item.id, parseInt(e.target.value) || 0, item.quantity)}
                                className="w-16 bg-shade border border-line-strong rounded-sharp px-2 py-1 text-ink text-center"
                              />
                              <span className="text-mist">/ {item.quantity}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {foundSale.paymentMethod === 'CREDIT' && (
                <p role="status" className="text-sm text-mute">On completion, the returned value reduces the original customer’s debt. Repayments stay on the account; any surplus becomes account credit. No cash is refunded.</p>
              )}
              {/* Return Type */}
              <div>
                <label className="block text-sm text-mute mb-2">
                  Return Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['REFUND', 'EXCHANGE', 'STORE_CREDIT'] as const).map((type) => {
                    const config = TYPE_CONFIG[type];
                    const Icon = config.icon;
                    return (
                      <button
                        disabled={foundSale.paymentMethod === 'CREDIT' && type !== 'STORE_CREDIT'}
                        key={type}
                        onClick={() => setReturnType(type)}
                        className={`p-3 rounded-sharp border flex flex-col items-center gap-1 transition-colors ${
                          returnType === type
                            ? 'bg-wash border-ink'
                            : 'bg-sand border-line hover:border-line-strong'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${config.color}`} />
                        <span className="text-xs text-ink">{foundSale.paymentMethod === 'CREDIT' && type === 'STORE_CREDIT' ? 'Adjust account' : config.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {returnType === 'EXCHANGE' && (
                <section className="space-y-3" aria-label="Replacement merchandise">
                  <h3 className="font-medium text-ink">Replacement items</h3>
                  <p className="text-sm text-mute">Equal-value exchanges only. Replacements use current retail prices and shop tax, without new discounts. Returned value includes the original tax and discounts.</p>
                  <label className="block text-sm text-mute">Search replacement products
                    <Input value={replacementSearch} onChange={e => setReplacementSearch(e.target.value)} placeholder="Product name or barcode" />
                  </label>
                  {replacementLoading && <p role="status">Loading replacement products...</p>}
                  {replacementError && <p role="alert" className="text-bad">{replacementError}</p>}
                  {!replacementLoading && !replacementError && <div className="max-h-40 overflow-y-auto space-y-2">
                    {replacementProducts.map(product => <button key={product.id} type="button" className="block w-full text-left p-3 bg-sand" onClick={() => setReplacements(lines => lines.some(line => line.product.id === product.id)
                      ? lines.map(line => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line)
                      : [...lines, { product, quantity: 1 }])}>
                      Add {product.name} · {formatCurrency(product.sellPrice)}
                    </button>)}
                    {!replacementProducts.length && <p>No active products found.</p>}
                    {replacementProducts.length === 100 && <p className="text-sm text-mute">Showing 100 matches. Search by name or barcode to narrow the results.</p>}
                  </div>}
                  {replacements.map(line => <div key={line.product.id} className="flex flex-wrap items-center gap-3">
                    <span className="flex-1">{line.product.name}</span>
                    <label className="text-sm">Quantity for {line.product.name}
                      <input type="number" min="1" step="1" className="w-16 border border-line p-1" value={line.quantity} onChange={e => {
                        const quantity = Number(e.target.value);
                        if (Number.isSafeInteger(quantity) && quantity > 0) setReplacements(lines => lines.map(item => item.product.id === line.product.id ? { ...item, quantity } : item));
                      }} />
                    </label>
                    <button type="button" className="p-2 text-sm" onClick={() => setReplacements(lines => lines.filter(item => item.product.id !== line.product.id))}>Remove {line.product.name}</button>
                  </div>)}
                  <div className="bg-sand border border-line p-4 space-y-1" aria-live="polite">
                    <p>Returned value: {formatCurrency(returnedValue)}</p>
                    <p>Replacement value (including tax): {replacementTotal === null ? 'Unavailable' : formatCurrency(replacementTotal)}</p>
                    {exchangeDifference !== null && <p>Difference: {formatCurrency(exchangeDifference)}</p>}
                    {exchangeError ? <p role="alert" className="text-bad">{exchangeError}</p> : <p>Values match. No payment or payout is required.</p>}
                  </div>
                </section>
              )}

              {/* Reason */}
              <div>
                <label className="block text-sm text-mute mb-2">
                  Reason for Return *
                </label>
                <textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g., Customer changed mind, Defective product, Wrong item..."
                  className="w-full bg-sand border border-line rounded-sharp px-4 py-3 text-ink placeholder-mist focus:border-ink focus:ring-1 focus:ring-ink"
                  rows={2}
                />
              </div>

              {/* Credit returns always use the original debtor. */}
              {foundSale.paymentMethod !== 'CREDIT' && <div>
                <label className="block text-sm text-mute mb-2">
                  {returnType === 'STORE_CREDIT' ? 'Customer receiving store credit (required)' : 'Customer (optional)'}
                </label>
                {selectedCustomer ? (
                  <div className="flex items-center gap-2 bg-sand border border-line rounded-sharp px-3 py-2">
                    <UserCircleIcon className="w-5 h-5 text-brick shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">
                        {selectedCustomer.name}
                      </p>
                      {selectedCustomer.phone && (
                        <p className="text-xs text-mute truncate">
                          {selectedCustomer.phone}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedCustomer(null)}
                      className="p-1 rounded-sharp hover:bg-shade text-mute hover:text-bad"
                      title="Remove customer"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCustomerPicker(true)}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-sharp border border-dashed border-line-strong text-mute hover:border-ink/50 hover:text-brick transition-colors text-sm"
                  >
                    <UserPlusIcon className="w-5 h-5" />
                    Attach customer
                  </button>
                )}
              </div>}

              {/* Refund Amount */}
              {returnType !== 'EXCHANGE' && selectedItems.size > 0 && (
                <div className="p-4 bg-ok/30 border border-ok rounded-sharp">
                  <p className="text-sm text-ok mb-1">{returnType === 'STORE_CREDIT' ? 'Store credit amount' : 'Refund Amount'}</p>
                  <p className="m text-2xl font-bold text-ok">
                    {formatCurrency(returnedValue)}
                  </p>
                </div>
              )}

              {/* Create Button */}
              <Button
                variant="primary"
                className="w-full"
                onClick={handleCreateReturn}
                disabled={(returnType === 'EXCHANGE' && !!exchangeError) || selectedItems.size === 0 || !returnReason.trim() || creatingReturn || (returnType === 'STORE_CREDIT' && foundSale.paymentMethod !== 'CREDIT' && !selectedCustomer)}
              >
                {creatingReturn ? 'Creating...' : 'Create Return'}
              </Button>
            </>
          )}
        </div>
      </Modal>

      {/* Return Detail Modal */}
      <Modal
        isOpen={!!selectedReturn}
        onClose={() => setSelectedReturn(null)}
        title="Return Details"
      >
        {selectedReturn && (
          <div className="space-y-6">
            {/* Status & Type */}
            <div className="flex items-center gap-4">
              <Badge variant={STATUS_CONFIG[selectedReturn.status].color as any}>
                {STATUS_CONFIG[selectedReturn.status].label}
              </Badge>
              <span className={`flex items-center gap-1 ${TYPE_CONFIG[selectedReturn.type].color}`}>
                {(() => {
                  const Icon = TYPE_CONFIG[selectedReturn.type].icon;
                  return <Icon className="w-5 h-5" />;
                })()}
                {TYPE_CONFIG[selectedReturn.type].label}
              </span>
            </div>

            {/* Reason */}
            <div>
              <p className="text-sm text-mute mb-1">Reason</p>
              <p className="text-ink">{selectedReturn.reason}</p>
            </div>

            {selectedReturn.type === 'STORE_CREDIT' && (
              <div className="bg-sand border border-line rounded-sharp p-4">
                <p className="text-sm text-mute">{selectedReturn.creditReversal ? 'Credited to' : 'Store credit recipient'}</p>
                <p className="text-ink">{selectedReturn.customer?.name || selectedReturn.customerId}</p>
                <p className="text-lg font-bold text-ink">{formatCurrency(selectedReturn.creditReversal ? Math.abs(selectedReturn.creditReversal.amount) : selectedReturn.refundAmount)}</p>
                {selectedReturn.creditReversal && <p className="text-xs text-mute">Ledger entry: {selectedReturn.creditReversal.id}</p>}
              </div>
            )}

            {/* Items */}
            <div>
              <p className="text-sm text-mute mb-2">Returned Items</p>
              <div className="space-y-2">
                {selectedReturn.items?.map((item) => (
                  <div key={item.id} className="flex justify-between items-center bg-sand rounded-sharp p-3">
                    <div>
                      <p className="text-ink font-medium">{item.productName}</p>
                      <p className="text-sm text-mute">Qty: {item.quantity}</p>
                    </div>
                    <p className="m text-ink">{formatCurrency(item.unitPrice * item.quantity)}</p>
                  </div>
                ))}
              </div>
            </div>

            {selectedReturn.type === 'EXCHANGE' && <section aria-label="Replacement items">
              <h3 className="text-sm text-mute mb-2">Replacement items</h3>
              {selectedReturn.exchangeItems?.map(item => <div key={item.id} className="flex justify-between bg-sand p-3">
                <span>{item.productName} · Qty: {item.quantity}</span><span>{formatCurrency(item.unitPrice * item.quantity)}</span>
              </div>)}
              {!selectedReturn.exchangeItems?.length && <p role="alert" className="text-bad">This exchange has no replacement items and cannot be completed. Reject it and create a new exchange.</p>}
              <p>Returned value: {formatCurrency(selectedReturn.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0))}</p>
              <p>Replacement value (including tax): {formatCurrency(selectedReturn.exchangeItems?.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) ?? 0)}</p>
            </section>}

            {/* Refund Amount */}
            {selectedReturn.type === 'REFUND' && (
              <div className="bg-ok/30 border border-ok rounded-sharp p-4">
                <p className="text-sm text-ok mb-1">Refund Amount</p>
                <p className="m text-2xl font-bold text-ok">
                  {formatCurrency(selectedReturn.refundAmount)}
                </p>
              </div>
            )}

            {selectedReturn.settlementMethod && (
              <p className="text-sm text-mute">Paid via {selectedReturn.settlementMethod}{selectedReturn.cashSessionId ? ` · Till ${selectedReturn.cashSessionId}` : ''}{selectedReturn.settlementReference ? ` · ${selectedReturn.settlementReference}` : ''}</p>
            )}
            {selectedReturn.status === 'APPROVED' && selectedReturn.type === 'REFUND' && (
              <div className="space-y-3">
                <label className="block text-sm">Actual refund payment method
                  <select className="input w-full mt-1" value={settlementMethod} onChange={e => { setSettlementMethod(e.target.value as typeof settlementMethod); setPayoutConfirmed(false); }}>
                    <option value="CASH">Cash from current till</option>
                    <option value="CARD">Card</option><option value="MOMO">MTN Mobile Money</option><option value="EMALI">eMali</option>
                  </select>
                </label>
                <p className="text-sm text-mute">{settlementMethod === 'CASH' ? 'Requires an open till. The payout is recorded against the current session, including returns from earlier days.' : 'Complete the refund externally first. Record only a successful payment; this action does not send a provider refund.'} CREDIT-sale payouts require debt settlement and are unsupported.</p>
                {settlementMethod !== 'CASH' && <label className="block text-sm">Successful refund reference
                  <input className="input w-full mt-1" value={settlementReference} maxLength={200} onChange={e => setSettlementReference(e.target.value)} />
                </label>}
                <label className="flex gap-2 text-sm"><input type="checkbox" checked={payoutConfirmed} onChange={e => setPayoutConfirmed(e.target.checked)} />I confirm {formatCurrency(selectedReturn.refundAmount)} was paid to the customer by this method.</label>
              </div>
            )}

            {/* Actions */}
            {selectedReturn.status === 'PENDING' && (
              <div className="flex gap-3">
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={() => handleProcess('reject')}
                  disabled={processing}
                >
                  Reject
                </Button>
                <Button
                  variant="success"
                  className="flex-1"
                  onClick={() => handleProcess('approve')}
                  disabled={processing}
                >
                  Approve
                </Button>
              </div>
            )}
            {selectedReturn.status === 'APPROVED' && selectedReturn.type === 'EXCHANGE' && (
              <Button variant="danger" onClick={() => handleProcess('reject')} disabled={processing}>Reject exchange</Button>
            )}
            {selectedReturn.status === 'APPROVED' && (
              <Button
                variant="primary"
                className="w-full"
                onClick={() => handleProcess('complete')}
                disabled={processing || (selectedReturn.type === 'EXCHANGE' && !selectedReturn.exchangeItems?.length) || (selectedReturn.type === 'REFUND' && (!payoutConfirmed || (settlementMethod !== 'CASH' && !settlementReference.trim())))}
              >
                {processing ? 'Processing...' : 'Complete Return & Restock'}
              </Button>
            )}
          </div>
        )}
      </Modal>

      {/* Customer Picker */}
      <CustomerPicker
        isOpen={showCustomerPicker}
        onClose={() => setShowCustomerPicker(false)}
        onSelect={(c) => {
          setSelectedCustomer(c);
          setShowCustomerPicker(false);
        }}
      />

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
