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
import { api, type Customer } from '@/api/client';
import { formatCurrency } from '@/types';

interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Sale {
  id: string;
  receiptNumber: string;
  totalAmount: number;
  paymentMethod: string;
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

interface Return {
  id: string;
  saleId?: string;
  customerId?: string;
  reason: string;
  type: 'REFUND' | 'EXCHANGE' | 'STORE_CREDIT';
  refundAmount: number;
  status: 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED';
  notes?: string;
  items: ReturnItem[];
  exchangeItems?: ReturnItem[];
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
  REFUND: { label: 'Refund', icon: BanknotesIcon, color: 'text-green-400' },
  EXCHANGE: { label: 'Exchange', icon: ArrowsRightLeftIcon, color: 'text-blue-400' },
  STORE_CREDIT: { label: 'Store Credit', icon: ArrowUturnLeftIcon, color: 'text-purple-400' },
};

export function Returns() {
  const { toast, showToast, dismissToast } = useToast();
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [processing, setProcessing] = useState(false);
  
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
    try {
      const response = await api.searchSaleByReceipt(receiptSearch.trim());
      if (response.error || !response.data) {
        setSaleError(response.error || 'Receipt not found');
        return;
      }
      setFoundSale(response.data);
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
        total += item.unitPrice * qty;
      }
    });
    return total;
  };

  const handleCreateReturn = async () => {
    if (!foundSale || selectedItems.size === 0 || !returnReason.trim()) return;
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
        customerId: selectedCustomer?.id,
        reason: returnReason,
        type: returnType,
        items,
        refundAmount: returnType === 'REFUND' ? calculateRefundAmount() : 0,
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
      const { error } = await api.processReturn(selectedReturn.id, action);
      if (error) {
        showToast(error, 'error');
        return;
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
          <h1 className="text-2xl font-bold text-white">Returns</h1>
          <p className="text-slate-400 mt-1">
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
          className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white"
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
          <ArrowPathIcon className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          <p className="text-slate-400 mt-2">Loading returns...</p>
        </div>
      ) : filteredReturns.length === 0 ? (
        <Card className="text-center py-12">
          <ArrowUturnLeftIcon className="w-12 h-12 mx-auto text-slate-500 mb-3" />
          <p className="text-slate-400 mb-4">No returns found</p>
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
                className="cursor-pointer hover:bg-slate-800/50 transition-colors"
                onClick={() => setSelectedReturn(ret)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <TypeIcon className={`w-5 h-5 ${typeConfig.color}`} />
                      <span className="font-medium text-white">{typeConfig.label}</span>
                      <Badge variant={statusConfig.color as any}>
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <p className="text-slate-400 text-sm mb-2">{ret.reason}</p>
                    <div className="text-sm text-slate-500">
                      {ret.items?.length || 0} item{(ret.items?.length || 0) !== 1 ? 's' : ''} •{' '}
                      {new Date(ret.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  {ret.type === 'REFUND' && (
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-400">
                        {formatCurrency(ret.refundAmount)}
                      </p>
                      <p className="text-xs text-slate-500">Refund</p>
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
          setReturnReason('');
          setSelectedCustomer(null);
        }}
        title="New Return"
      >
        <div className="space-y-6">
          {/* Receipt Search */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">
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
              <p className="text-red-400 text-sm mt-2">{saleError}</p>
            )}
          </div>

          {/* Found Sale */}
          {foundSale && (
            <>
              <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-mono text-amber-400 font-semibold">
                      {foundSale.receiptNumber}
                    </p>
                    <p className="text-sm text-slate-400">
                      {new Date(foundSale.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-white">
                      {formatCurrency(foundSale.totalAmount)}
                    </p>
                    <p className="text-xs text-slate-500 uppercase">
                      {foundSale.paymentMethod}
                    </p>
                  </div>
                </div>
                {foundSale.user && (
                  <p className="text-xs text-slate-500">
                    Cashier: {foundSale.user.name}
                  </p>
                )}
              </div>

              {/* Select Items to Return */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Select Items to Return
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {foundSale.items.map((item) => {
                    const isSelected = selectedItems.has(item.id);
                    const selectedQty = selectedItems.get(item.id) || 0;

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500/50'
                            : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                        }`}
                        onClick={() => toggleItemSelection(item.id, item.quantity)}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <p className="font-medium text-white">{item.productName}</p>
                            <p className="text-sm text-slate-400">
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
                                className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-center"
                              />
                              <span className="text-slate-500">/ {item.quantity}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Return Type */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Return Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['REFUND', 'EXCHANGE', 'STORE_CREDIT'] as const).map((type) => {
                    const config = TYPE_CONFIG[type];
                    const Icon = config.icon;
                    return (
                      <button
                        key={type}
                        onClick={() => setReturnType(type)}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-colors ${
                          returnType === type
                            ? 'bg-amber-500/20 border-amber-500'
                            : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${config.color}`} />
                        <span className="text-xs text-white">{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Reason for Return *
                </label>
                <textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g., Customer changed mind, Defective product, Wrong item..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  rows={2}
                />
              </div>

              {/* Customer (optional) */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Customer (optional)
                </label>
                {selectedCustomer ? (
                  <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2">
                    <UserCircleIcon className="w-5 h-5 text-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {selectedCustomer.name}
                      </p>
                      {selectedCustomer.phone && (
                        <p className="text-xs text-slate-400 truncate">
                          {selectedCustomer.phone}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedCustomer(null)}
                      className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400"
                      title="Remove customer"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCustomerPicker(true)}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:border-amber-500/50 hover:text-amber-400 transition-colors text-sm"
                  >
                    <UserPlusIcon className="w-5 h-5" />
                    Attach customer
                  </button>
                )}
              </div>

              {/* Refund Amount */}
              {returnType === 'REFUND' && selectedItems.size > 0 && (
                <div className="p-4 bg-green-900/30 border border-green-800 rounded-xl">
                  <p className="text-sm text-green-400 mb-1">Refund Amount</p>
                  <p className="text-2xl font-bold text-green-400">
                    {formatCurrency(calculateRefundAmount())}
                  </p>
                </div>
              )}

              {/* Create Button */}
              <Button
                variant="primary"
                className="w-full"
                onClick={handleCreateReturn}
                disabled={selectedItems.size === 0 || !returnReason.trim() || creatingReturn}
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
              <p className="text-sm text-slate-400 mb-1">Reason</p>
              <p className="text-white">{selectedReturn.reason}</p>
            </div>

            {/* Items */}
            <div>
              <p className="text-sm text-slate-400 mb-2">Returned Items</p>
              <div className="space-y-2">
                {selectedReturn.items?.map((item) => (
                  <div key={item.id} className="flex justify-between items-center bg-slate-800 rounded-lg p-3">
                    <div>
                      <p className="text-white font-medium">{item.productName}</p>
                      <p className="text-sm text-slate-400">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-white">{formatCurrency(item.unitPrice * item.quantity)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Refund Amount */}
            {selectedReturn.type === 'REFUND' && (
              <div className="bg-green-900/30 border border-green-800 rounded-xl p-4">
                <p className="text-sm text-green-400 mb-1">Refund Amount</p>
                <p className="text-2xl font-bold text-green-400">
                  {formatCurrency(selectedReturn.refundAmount)}
                </p>
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
            {selectedReturn.status === 'APPROVED' && (
              <Button
                variant="primary"
                className="w-full"
                onClick={() => handleProcess('complete')}
                disabled={processing}
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
