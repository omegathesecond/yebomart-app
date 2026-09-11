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
} from '@heroicons/react/24/outline';
import api from '@/api/client';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Toast, useToast } from '@/components/ui/Toast';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { formatCurrency, formatDate, formatTime, type Sale, type PaymentMethod, PAYMENT_METHODS } from '@/types';
import { PaymentMethodIcon } from '@/components/ui/PaymentMethodIcon';

export function Sales() {
  const { shop } = useAuthStore();
  const { sales, loadAll } = useInventoryStore();
  const { toast, showToast, dismissToast } = useToast();

  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // Email-receipt modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

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
    if (sale.tax && sale.tax > 0) {
      // Net (VAT-exclusive) so Net + VAT = TOTAL reconciles on the shared receipt.
      lines.push(`Net (excl. VAT): ${formatCurrency(sale.totalAmount - sale.tax)}`);
      lines.push(`VAT${shop?.taxRate ? ` (${shop.taxRate}%${shop.taxInclusive ? ' incl.' : ''})` : ''}: ${formatCurrency(sale.tax)}`);
    }
    lines.push(`TOTAL: ${formatCurrency(sale.totalAmount)}`);
    if (shop?.taxNumber) {
      lines.push(`VAT No: ${shop.taxNumber}`);
    }
    lines.push('', 'Thank you for shopping with us!');
    return lines.join('\n');
  };

  const handleShareWhatsApp = () => {
    if (!selectedSale) return;
    const text = encodeURIComponent(buildReceiptText(selectedSale));
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
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

  // Calculate totals
  const totalSales = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalTransactions = filteredSales.length;
  const avgTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;

  // Payment method breakdown
  const paymentBreakdown = filteredSales.reduce((acc, sale) => {
    acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + sale.totalAmount;
    return acc;
  }, {} as Record<string, number>);


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Sales History</h1>
          <p className="text-mute mt-1">
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
            className={`px-4 py-2 rounded-sharp whitespace-nowrap transition-all ${
              dateFilter === filter.key
                ? 'bg-brand text-ink'
                : 'bg-sand text-mute hover:bg-shade'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <p className="text-sm text-mute">Total Sales</p>
          <p className="m text-2xl font-bold text-ink mt-1">{formatCurrency(totalSales)}</p>
        </Card>
        <Card>
          <p className="text-sm text-mute">Transactions</p>
          <p className="text-2xl font-bold text-ink mt-1">{totalTransactions}</p>
        </Card>
        <Card>
          <p className="text-sm text-mute">Avg. Transaction</p>
          <p className="m text-2xl font-bold text-ink mt-1">{formatCurrency(avgTransaction)}</p>
        </Card>
        <Card>
          <p className="text-sm text-mute">Payment Split</p>
          <div className="flex gap-2 mt-2">
            {Object.entries(paymentBreakdown).slice(0, 3).map(([method, amount]) => (
              <span key={method} className="text-mute" title={method}>
                <PaymentMethodIcon method={method as PaymentMethod} className="h-[18px] w-[18px]" />
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
                <div key={method} className="p-3 rounded-sharp bg-shade/30">
                  <div className="flex items-center gap-2 mb-2">
                    <PaymentMethodIcon method={method as PaymentMethod} className="h-[18px] w-[18px] text-mute" />
                    <span className="font-medium text-ink">{pm?.label}</span>
                  </div>
                  <p className="m text-lg font-bold text-brick">{formatCurrency(amount)}</p>
                  <p className="text-xs text-mist">{percentage}% of total</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Sales List */}
      <div className="space-y-6">
        {Object.entries(salesByDate).map(([date, dateSales]) => {
          const dayTotal = dateSales.reduce((sum, s) => sum + s.totalAmount, 0);
          
          return (
            <div key={date}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-mute" />
                  <span className="font-medium text-body">{date}</span>
                </div>
                <span className="m text-[14px] font-semibold">{formatCurrency(dayTotal)}</span>
              </div>
              
              <div className="border border-line-strong bg-cream">
                <div className="hidden items-center gap-4 border-b border-line-strong px-4 pb-2.5 pt-3 sm:flex">
                  <span className="eyebrow w-[62px]">Time</span>
                  <span className="eyebrow flex-1">Sale</span>
                  <span className="eyebrow w-[104px]">Method</span>
                  <span className="eyebrow w-[92px] text-right">Total</span>
                  <span className="w-5" />
                </div>
                {dateSales.map((sale) => (
                  <button
                    key={sale.id}
                    onClick={() => setSelectedSale(sale)}
                    className="flex w-full items-center gap-4 border-b border-line px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-sand"
                  >
                    <span className="m hidden w-[62px] text-[12px] text-mute sm:block">
                      {formatTime(sale.createdAt)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium">
                        {sale.items.length} item{sale.items.length > 1 ? 's' : ''}
                        {sale.receiptNumber && (
                          <span className="m ml-2 text-[11.5px] font-normal text-mute">
                            {sale.receiptNumber}
                          </span>
                        )}
                      </p>
                      <span className="m mt-0.5 text-[10.5px] text-mute sm:hidden">
                        {formatTime(sale.createdAt)}
                      </span>
                    </div>
                    <span className="hidden w-[104px] items-center gap-2 sm:flex">
                      <PaymentMethodIcon method={sale.paymentMethod} className="h-[15px] w-[15px] text-mute" />
                      <span className="m text-[10.5px] uppercase tracking-[0.08em] text-body">
                        {PAYMENT_METHODS.find((m) => m.value === sale.paymentMethod)?.label ?? sale.paymentMethod}
                      </span>
                    </span>
                    <p className="m w-[92px] text-right text-[13.5px] font-semibold">
                      {formatCurrency(sale.totalAmount)}
                    </p>
                    <ChevronRightIcon className="h-4 w-4 shrink-0 text-mist" />
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {Object.keys(salesByDate).length === 0 && (
          <Card className="py-12 text-center">
            <BanknotesIcon className="w-12 h-12 text-mist mx-auto mb-3" />
            <p className="text-mute">No sales for this period</p>
            <Link to="/pos" className="text-brick text-sm hover:underline mt-2 inline-block">
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
          <div className="relative w-full max-w-md bg-sand rounded-sharp shadow-2xl border border-line animate-slide-up">
            <div className="p-4 border-b border-line">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-ink">Receipt</h2>
                <button
                  onClick={() => setSelectedSale(null)}
                  className="p-1 hover:bg-shade rounded-sharp"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-mute">
                {formatDate(selectedSale.createdAt)} at {formatTime(selectedSale.createdAt)}
              </p>
            </div>

            <div className="p-4 space-y-4">
              {/* Printable receipt — white card matching the POS receipt so
                  the printed output is identical regardless of entry point. */}
              <div className="bg-cream text-black p-4 rounded-sharp font-mono text-sm print:shadow-none" id="receipt">
                <div className="text-center border-b border-dashed border-line-strong pb-3 mb-3">
                  <h3 className="font-bold text-lg">{shopName}</h3>
                  <p className="text-xs text-mist">{shop?.address || ''}</p>
                  <p className="text-xs text-mist">Tel: {shop?.ownerPhone || ''}</p>
                </div>

                <div className="text-xs text-mist mb-3">
                  <p>Date: {formatDate(selectedSale.createdAt)} {formatTime(selectedSale.createdAt)}</p>
                  <p className="font-bold text-black">Receipt #: {receiptNumberOf(selectedSale)}</p>
                </div>

                <div className="border-b border-dashed border-line-strong pb-3 mb-3">
                  {selectedSale.items.map((item) => (
                    <div key={item.id} className="flex justify-between py-1">
                      <span className="flex-1">{item.productName}</span>
                      <span className="w-8 text-center">x{item.quantity}</span>
                      <span className="m w-20 text-right">{formatCurrency(item.totalPrice)}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1 mb-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span className="m">{formatCurrency(selectedSale.subtotal)}</span>
                  </div>
                  {selectedSale.discount > 0 && (
                    <div className="flex justify-between text-sm text-ok">
                      <span>Discount</span>
                      <span>-{formatCurrency(selectedSale.discount)}</span>
                    </div>
                  )}
                  {selectedSale.tax && selectedSale.tax > 0 ? (
                    <>
                      {/* Net (VAT-exclusive) amount so Net + VAT = TOTAL
                          reconciles — required for a compliant VAT receipt. */}
                      <div className="flex justify-between text-sm">
                        <span>Net (excl. VAT)</span>
                        <span className="m">{formatCurrency(selectedSale.totalAmount - selectedSale.tax)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>VAT{shop?.taxRate ? ` (${shop.taxRate}%${shop.taxInclusive ? ' incl.' : ''})` : ''}</span>
                        <span className="m">{formatCurrency(selectedSale.tax)}</span>
                      </div>
                    </>
                  ) : null}
                  <div className="flex justify-between text-sm">
                    <span>Payment</span>
                    <span>{PAYMENT_METHODS.find(p => p.value === selectedSale.paymentMethod)?.label || selectedSale.paymentMethod}</span>
                  </div>
                </div>

                <div className="flex justify-between font-bold text-lg border-t border-line-strong pt-2">
                  <span>TOTAL</span>
                  <span className="m">{formatCurrency(selectedSale.totalAmount)}</span>
                </div>

                {shop?.taxNumber && (
                  <p className="text-center text-xs text-mist mt-2">VAT No: {shop.taxNumber}</p>
                )}

                <div className="text-center mt-4 pt-3 border-t border-dashed border-line-strong">
                  <p className="text-xs text-mist">Thank you for shopping with us!</p>
                  <p className="text-xs text-mute">Powered by YeboMart</p>
                </div>
              </div>

              {/* Payment badge (on-screen chrome — hidden when printing) */}
              <div className="flex justify-between items-center print:hidden">
                <span className="text-mute">Payment</span>
                <Badge variant="success">
                  <PaymentMethodIcon method={selectedSale.paymentMethod} className="h-3.5 w-3.5" />
                  {PAYMENT_METHODS.find(p => p.value === selectedSale.paymentMethod)?.label}
                </Badge>
              </div>

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
          <p className="text-mute text-sm">
            Send a copy of this receipt to the customer's email address.
          </p>

          <div>
            <label className="block text-sm font-medium text-body mb-2">
              Customer Email
            </label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="customer@example.com"
              autoFocus
              className="w-full px-4 py-3 bg-shade border border-line-strong rounded-sharp text-ink placeholder-mist focus:outline-none focus:ring-2 focus:ring-ink"
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

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
