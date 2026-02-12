import { useState, useEffect } from 'react';
import {
  ArrowPathIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowUturnLeftIcon,
  BanknotesIcon,
  ArrowsRightLeftIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/api/client';
import { formatSZL } from '@/types';

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
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [processing, setProcessing] = useState(false);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const response = await api.getReturns(statusFilter ? { status: statusFilter } : undefined);
      setReturns(response.data || []);
    } catch (error) {
      console.error('Failed to fetch returns:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, [statusFilter]);

  const handleProcess = async (action: 'approve' | 'reject' | 'complete') => {
    if (!selectedReturn) return;
    setProcessing(true);
    try {
      await api.processReturn(selectedReturn.id, action);
      await fetchReturns();
      setSelectedReturn(null);
    } catch (error) {
      console.error('Failed to process return:', error);
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
        <Button
          variant="secondary"
          leftIcon={<ArrowPathIcon className="w-5 h-5" />}
          onClick={fetchReturns}
          disabled={loading}
        >
          Refresh
        </Button>
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
          <p className="text-slate-400">No returns found</p>
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
                        {formatSZL(ret.refundAmount)}
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
                    <p className="text-white">{formatSZL(item.unitPrice * item.quantity)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Exchange Items */}
            {selectedReturn.exchangeItems && selectedReturn.exchangeItems.length > 0 && (
              <div>
                <p className="text-sm text-slate-400 mb-2">Exchange Items</p>
                <div className="space-y-2">
                  {selectedReturn.exchangeItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-center bg-blue-900/30 border border-blue-800 rounded-lg p-3">
                      <div>
                        <p className="text-white font-medium">{item.productName}</p>
                        <p className="text-sm text-slate-400">Qty: {item.quantity}</p>
                      </div>
                      <p className="text-white">{formatSZL(item.unitPrice * item.quantity)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Refund Amount */}
            {selectedReturn.type === 'REFUND' && (
              <div className="bg-green-900/30 border border-green-800 rounded-xl p-4">
                <p className="text-sm text-green-400 mb-1">Refund Amount</p>
                <p className="text-2xl font-bold text-green-400">
                  {formatSZL(selectedReturn.refundAmount)}
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
    </div>
  );
}
