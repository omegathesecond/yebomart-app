import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BanknotesIcon,
  CalendarIcon,
  ChevronRightIcon,
  ReceiptPercentIcon,
  PrinterIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  NoSymbolIcon,
} from '@heroicons/react/24/outline';
import api from '@/api/client';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Toast, useToast } from '@/components/ui/Toast';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { formatCurrency, formatDate, formatTime, type Sale, PAYMENT_METHODS } from '@/types';

export function Sales() {
  const { shop, user } = useAuthStore();
  const { sales, loadAll } = useInventoryStore();
  const { toast, showToast, dismissToast } = useToast();

  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // Email-receipt modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Void-sale modal state
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  // Voiding is manager-gated to match the API (POST /api/sales/:id/void uses
  // managerAuth = OWNER/MANAGER). Cashiers never see the action.
  const canVoidSale = user?.role === 'owner' || user?.role === 'manager';
  const isVoided = (sale: Sale) => sale.status === 'VOIDED';

  useEffect(() => {
    if (shop) {
      loadAll(shop.id);
    }
  }, [shop, loadAll]);

  const shopName = shop?.name || 'YeboMart';
  const receiptNumberOf = (sale: Sale) =>
    sale.receiptNumber || sale.id.slice(-8).toUpperCase();

  const openEmailModal = () => {
    // Prefill the linked customer's email if the sale carries one.
    setCustomerEmail(selectedSale?.customer?.email || '');
    setShowEmailModal(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSendEmail = async () => {
    if (!selectedSale || !customerEmail) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      showToast('Please enter a valid email address', 'error');
      return;
    }

    setIsSendingEmail(true);
    try {
      await api.sendReceiptEmail({
        saleId: selectedSale.id,
        email: customerEmail,
        shopName,
        receiptNumber: receiptNumberOf(selectedSale),
        items: selectedSale.items,
        subtotal: selectedSale.subtotal,
        discount: selectedSale.discount,
        total: selectedSale.totalAmount,
        date: new Date(selectedSale.createdAt).toISOString(),
      });
      showToast('Receipt emailed successfully', 'success');
      setShowEmailModal(false);
      setCustomerEmail('');
    } catch (err: any) {
      // Fail loudly — never report a silent success.
      showToast(err?.message || 'Failed to send receipt. Please try again.', 'error');
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Build a plain-text receipt for WhatsApp sharing (client-only, no backend).
  const buildReceiptText = (sale: Sale) => {
    const lines = [
      shopName,
      `Receipt #${receiptNumberOf(sale)}`,
      `${formatDate(sale.createdAt)} ${formatTime(sale.createdAt)}`,
      '',
      ...sale.items.map(
        (item) => `${item.quantity} x ${item.productName} — ${formatCurrency(item.totalPrice)}`
      ),
      '',
      `Subtotal: ${formatCurrency(sale.subtotal)}`,
    ];
    if (sale.discount > 0) {
      lines.push(`Discount: -${formatCurrency(sale.discount)}`);
    }
    lines.push(`TOTAL: ${formatCurrency(sale.totalAmount)}`, '', 'Thank you for shopping with us!');
    return lines.join('\n');
  };

  const handleShareWhatsApp = () => {
    if (!selectedSale) return;
    const text = encodeURIComponent(buildReceiptText(selectedSale));
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const handleVoidSale = async () => {
    if (!selectedSale) return;

    // Mirror the API's Joi rule (reason 5–500 chars) so the cashier gets the
    // feedback before the round-trip instead of a 400.
    const reason = voidReason.trim();
    if (reason.length < 5) {
      showToast('Please enter a reason of at least 5 characters', 'error');
      return;
    }

    setIsVoiding(true);
    try {
      const { data, error } = await api.voidSale(selectedSale.id, reason);
      if (!data) {
        // Fail loudly — surface the real server message (no silent success).
        showToast(error || 'Failed to void sale. Please try again.', 'error');
        return;
      }
      showToast('Sale voided. Stock restored.', 'success');
      setShowVoidModal(false);
      setVoidReason('');
      setSelectedSale(null);
      // Reload so the list/badges/totals reflect the new VOIDED status and the
      // server-aggregated void reporting (Reports, StaffDetail) stays in sync.
      if (shop) await loadAll(shop.id);
    } catch (err: any) {
      showToast(err?.message || 'Failed to void sale. Please try again.', 'error');
    } finally {
      setIsVoiding(false);
    }
  };

  // Filter sales by date
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const filteredSales = sales.filter(sale => {
    const saleDate = new Date(sale.createdAt);
    if (dateFilter === 'today') return saleDate >= todayStart;
    if (dateFilter === 'week') return saleDate >= weekStart;
    if (dateFilter === 'month') return saleDate >= monthStart;
    return true;
  });

  // Group sales by date
  const salesByDate = filteredSales.reduce((acc, sale) => {
    const dateKey = formatDate(sale.createdAt);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(sale);
    return acc;
  }, {} as Record<string, Sale[]>);

  // Calculate totals — voided sales are not revenue, so exclude them from every
  // monetary figure (they still appear in the list below, badged as VOIDED).
  const countedSales = filteredSales.filter(s => !isVoided(s));
  const totalSales = countedSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalTransactions = countedSales.length;
  const avgTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;

  // Payment method breakdown
  const paymentBreakdown = countedSales.reduce((acc, sale) => {
    acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + sale.totalAmount;
    return acc;
  }, {} as Record<string, number>);

  const getPaymentIcon = (method: string) => {
    const pm = PAYMENT_METHODS.find(p => p.value === method);
    return pm?.icon || '💰';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales History</h1>
          <p className="text-slate-400 mt-1">
            View and manage your transactions
          </p>
        </div>
        <Link to="/pos">
          <button className="btn-primary">
            <ReceiptPercentIcon className="w-5 h-5" />
            New Sale
          </button>
        </Link>
      </div>

      {/* Date Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { key: 'today', label: 'Today' },
          { key: 'week', label: 'This Week' },
          { key: 'month', label: 'This Month' },
          { key: 'all', label: 'All Time' }
        ].map(filter => (
          <button
            key={filter.key}
            onClick={() => setDateFilter(filter.key as any)}
            className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
              dateFilter === filter.key
                ? 'bg-amber-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card gradient="emerald">
          <p className="text-sm text-slate-400">Total Sales</p>
          <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totalSales)}</p>
        </Card>
        <Card gradient="blue">
          <p className="text-sm text-slate-400">Transactions</p>
          <p className="text-2xl font-bold text-white mt-1">{totalTransactions}</p>
        </Card>
        <Card gradient="amber">
          <p className="text-sm text-slate-400">Avg. Transaction</p>
          <p className="text-2xl font-bold text-white mt-1">{formatCurrency(avgTransaction)}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-400">Payment Split</p>
          <div className="flex gap-2 mt-2">
            {Object.entries(paymentBreakdown).slice(0, 3).map(([method, amount]) => (
              <span key={method} className="text-lg">
                {getPaymentIcon(method)}
              </span>
            ))}
          </div>
        </Card>
      </div>

      {/* Payment Breakdown */}
      {Object.keys(paymentBreakdown).length > 0 && (
        <Card>
          <CardHeader title="Payment Methods" subtitle="Breakdown by payment type" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(paymentBreakdown).map(([method, amount]) => {
              const pm = PAYMENT_METHODS.find(p => p.value === method);
              const percentage = totalSales > 0 ? (amount / totalSales * 100).toFixed(0) : 0;
              
              return (
                <div key={method} className="p-3 rounded-xl bg-slate-700/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{pm?.icon}</span>
                    <span className="font-medium text-white">{pm?.label}</span>
                  </div>
                  <p className="text-lg font-bold text-amber-400">{formatCurrency(amount)}</p>
                  <p className="text-xs text-slate-500">{percentage}% of total</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Sales List */}
      <div className="space-y-6">
        {Object.entries(salesByDate).map(([date, dateSales]) => {
          const dayTotal = dateSales.reduce((sum, s) => sum + (isVoided(s) ? 0 : s.totalAmount), 0);
          
          return (
            <div key={date}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-slate-400" />
                  <span className="font-medium text-slate-300">{date}</span>
                </div>
                <span className="text-sm text-emerald-400">{formatCurrency(dayTotal)}</span>
              </div>
              
              <Card className="divide-y divide-slate-700/50">
                {dateSales.map((sale) => (
                  <button
                    key={sale.id}
                    onClick={() => setSelectedSale(sale)}
                    className="w-full p-4 flex items-center justify-between hover:bg-slate-700/30 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isVoided(sale) ? 'bg-red-500/20' : 'bg-emerald-500/20'
                      }`}>
                        {isVoided(sale) ? (
                          <NoSymbolIcon className="w-5 h-5 text-red-400" />
                        ) : (
                          <BanknotesIcon className="w-5 h-5 text-emerald-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white">
                            {sale.items.length} item{sale.items.length > 1 ? 's' : ''}
                          </p>
                          {isVoided(sale) && <Badge variant="danger">Voided</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs">{getPaymentIcon(sale.paymentMethod)}</span>
                          <span className="text-xs text-slate-400">
                            {formatTime(sale.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className={`text-lg font-semibold ${
                        isVoided(sale) ? 'text-slate-500 line-through' : 'text-emerald-400'
                      }`}>
                        {formatCurrency(sale.totalAmount)}
                      </p>
                      <ChevronRightIcon className="w-5 h-5 text-slate-500" />
                    </div>
                  </button>
                ))}
              </Card>
            </div>
          );
        })}

        {Object.keys(salesByDate).length === 0 && (
          <Card className="py-12 text-center">
            <BanknotesIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No sales for this period</p>
            <Link to="/pos" className="text-amber-400 text-sm hover:underline mt-2 inline-block">
              Make your first sale →
            </Link>
          </Card>
        )}
      </div>

      {/* Sale Detail Modal */}
      {selectedSale && (
        <div className="modal-backdrop flex items-center justify-center p-4">
          <div 
            className="absolute inset-0" 
            onClick={() => setSelectedSale(null)}
          />
          <div className="relative w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 animate-slide-up">
            <div className="p-4 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Receipt</h2>
                <button
                  onClick={() => setSelectedSale(null)}
                  className="p-1 hover:bg-slate-700 rounded-lg"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm text-slate-400">
                {formatDate(selectedSale.createdAt)} at {formatTime(selectedSale.createdAt)}
              </p>
            </div>

            <div className="p-4 space-y-4">
              {/* Printable receipt — white card matching the POS receipt so
                  the printed output is identical regardless of entry point. */}
              <div className="bg-white text-black p-4 rounded-lg font-mono text-sm print:shadow-none" id="receipt">
                <div className="text-center border-b border-dashed border-gray-300 pb-3 mb-3">
                  <h3 className="font-bold text-lg">{shopName}</h3>
                  <p className="text-xs text-gray-500">{shop?.address || ''}</p>
                  <p className="text-xs text-gray-500">Tel: {shop?.ownerPhone || ''}</p>
                </div>

                <div className="text-xs text-gray-500 mb-3">
                  <p>Date: {formatDate(selectedSale.createdAt)} {formatTime(selectedSale.createdAt)}</p>
                  <p className="font-bold text-black">Receipt #: {receiptNumberOf(selectedSale)}</p>
                </div>

                <div className="border-b border-dashed border-gray-300 pb-3 mb-3">
                  {selectedSale.items.map((item) => (
                    <div key={item.id} className="flex justify-between py-1">
                      <span className="flex-1">{item.productName}</span>
                      <span className="w-8 text-center">x{item.quantity}</span>
                      <span className="w-20 text-right">{formatCurrency(item.totalPrice)}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1 mb-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>{formatCurrency(selectedSale.subtotal)}</span>
                  </div>
                  {selectedSale.discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount</span>
                      <span>-{formatCurrency(selectedSale.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span>Payment</span>
                    <span>{PAYMENT_METHODS.find(p => p.value === selectedSale.paymentMethod)?.label || selectedSale.paymentMethod}</span>
                  </div>
                </div>

                <div className="flex justify-between font-bold text-lg border-t border-gray-300 pt-2">
                  <span>TOTAL</span>
                  <span>{formatCurrency(selectedSale.totalAmount)}</span>
                </div>

                <div className="text-center mt-4 pt-3 border-t border-dashed border-gray-300">
                  <p className="text-xs text-gray-500">Thank you for shopping with us!</p>
                  <p className="text-xs text-gray-400">Powered by YeboMart</p>
                </div>
              </div>

              {/* Payment badge (on-screen chrome — hidden when printing) */}
              <div className="flex justify-between items-center print:hidden">
                <span className="text-slate-400">Payment</span>
                <Badge variant="success">
                  {getPaymentIcon(selectedSale.paymentMethod)}{' '}
                  {PAYMENT_METHODS.find(p => p.value === selectedSale.paymentMethod)?.label}
                </Badge>
              </div>

              {/* Voided banner (on-screen chrome — hidden when printing) */}
              {isVoided(selectedSale) && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 print:hidden">
                  <NoSymbolIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-400">This sale was voided</p>
                    {selectedSale.voidReason && (
                      <p className="text-xs text-slate-400 mt-0.5">{selectedSale.voidReason}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Receipt actions */}
              <div className="grid grid-cols-3 gap-2 print:hidden">
                <Button variant="primary" className="w-full" onClick={handlePrint}>
                  <PrinterIcon className="w-5 h-5" />
                  Print
                </Button>
                <Button variant="secondary" className="w-full" onClick={openEmailModal}>
                  <EnvelopeIcon className="w-5 h-5" />
                  Email
                </Button>
                <Button variant="secondary" className="w-full" onClick={handleShareWhatsApp}>
                  <ChatBubbleLeftRightIcon className="w-5 h-5" />
                  WhatsApp
                </Button>
              </div>

              {/* Void action — manager-gated, hidden once voided or while a sale
                  is still queued offline (it has no server id to void yet). */}
              {canVoidSale && !isVoided(selectedSale) && !selectedSale.pendingSync && (
                <div className="print:hidden">
                  <Button
                    variant="danger"
                    className="w-full"
                    onClick={() => {
                      setVoidReason('');
                      setShowVoidModal(true);
                    }}
                  >
                    <NoSymbolIcon className="w-5 h-5" />
                    Void Sale
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Email Receipt Modal */}
      <Modal
        isOpen={showEmailModal}
        onClose={() => {
          setShowEmailModal(false);
          setCustomerEmail('');
        }}
        title="Email Receipt"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-slate-400 text-sm">
            Send a copy of this receipt to the customer's email address.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Customer Email
            </label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="customer@example.com"
              autoFocus
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowEmailModal(false);
                setCustomerEmail('');
              }}
            >
              <XMarkIcon className="w-5 h-5" />
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleSendEmail}
              disabled={!customerEmail || isSendingEmail}
              isLoading={isSendingEmail}
            >
              <EnvelopeIcon className="w-5 h-5" />
              Send Receipt
            </Button>
          </div>
        </div>
      </Modal>

      {/* Void Sale Modal */}
      <Modal
        isOpen={showVoidModal}
        onClose={() => {
          setShowVoidModal(false);
          setVoidReason('');
        }}
        title="Void Sale"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
            <NoSymbolIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-300">
              Voiding restores the sold stock and reverses any customer debt for
              this sale. This cannot be undone.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Reason for voiding
            </label>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="e.g. Customer changed their mind"
              rows={3}
              autoFocus
              maxLength={500}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">At least 5 characters.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowVoidModal(false);
                setVoidReason('');
              }}
            >
              <XMarkIcon className="w-5 h-5" />
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={handleVoidSale}
              disabled={voidReason.trim().length < 5 || isVoiding}
              isLoading={isVoiding}
            >
              <NoSymbolIcon className="w-5 h-5" />
              Void Sale
            </Button>
          </div>
        </div>
      </Modal>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
