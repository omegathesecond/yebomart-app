import { useEffect, useState } from 'react';
import {
  CheckCircleIcon,
  PrinterIcon,
  XMarkIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import api from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Toast, useToast } from '@/components/ui/Toast';
import { formatCurrency, type Shop } from '@/types';
import { useInventoryStore } from '@/stores/inventoryStore';

/**
 * The completed-sale data a receipt is rendered from. Mirrors the shape the
 * cart store's `checkout()` returns, flattened for display (the totals are
 * already computed and the items already carry `productName`/`totalPrice`).
 */
export interface ReceiptSale {
  total: number;
  subtotal: number;
  discount: number;
  items: any[];
  id: string;
  receiptNumber?: string;
  date: Date;
  paymentMethod?: string;
  cashReceived?: number;
  changeGiven?: number;
  pendingSync?: boolean;
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: ReceiptSale | null;
  shop: Shop | null;
  /** The attached customer's phone, if any — pre-fills the SMS recipient. */
  customerPhone?: string;
}

/**
 * Sale-complete receipt modal shared by the desktop POS and the mobile,
 * scan-centric POS. Renders the printable receipt (`id="receipt"`, isolated by
 * the global `@media print` rules in index.css), plus print, email, and SMS
 * share actions. The email/SMS sub-modals and their send logic live here so any
 * screen that completes a sale gets receipt sharing for free — no per-page
 * wiring. Email + SMS both need the network, so both are disabled while offline.
 */
export function ReceiptModal({ isOpen, onClose, sale, shop, customerPhone }: ReceiptModalProps) {
  // Self-contained feedback channel for the share actions so neither POS screen
  // has to thread a toast handler in.
  const { toast, showToast, dismissToast } = useToast();
  const isOnline = useInventoryStore((s) => s.isOnline);

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsPhone, setSmsPhone] = useState('');
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsSent, setSmsSent] = useState(false);

  // Reset the "sent" confirmations whenever a fresh sale is shown so the
  // Email/SMS buttons re-enable for the next customer.
  useEffect(() => {
    setEmailSent(false);
    setSmsSent(false);
  }, [sale?.id]);

  const handlePrint = () => {
    window.print();
  };

  const handleSendSms = async () => {
    if (!smsPhone || !sale) return;

    // Light client-side check; the server normalizes + validates authoritatively.
    const cleaned = smsPhone.replace(/[\s\-()]/g, '');
    if (!/^\+?[1-9]\d{6,14}$/.test(cleaned)) {
      showToast('Please enter a valid phone number', 'error');
      return;
    }

    setIsSendingSms(true);
    try {
      await api.sendReceiptSMS({ saleId: sale.id, phone: cleaned });
      setSmsSent(true);
      setShowSmsModal(false);
      setSmsPhone('');
      showToast('Receipt sent via SMS', 'success');
    } catch (err: any) {
      showToast('Failed to send SMS. Please try again.', 'error');
    }
    setIsSendingSms(false);
  };

  const handleSendEmail = async () => {
    if (!customerEmail || !sale) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      showToast('Please enter a valid email address', 'error');
      return;
    }

    setIsSendingEmail(true);
    try {
      await api.sendReceiptEmail({
        saleId: sale.id,
        email: customerEmail,
        shopName: shop?.name || 'YeboMart',
        receiptNumber: sale.receiptNumber || sale.id.slice(-8).toUpperCase(),
        items: sale.items,
        subtotal: sale.subtotal,
        discount: sale.discount,
        total: sale.total,
        date: sale.date.toISOString(),
      });
      setEmailSent(true);
      setShowEmailModal(false);
      setCustomerEmail('');
      showToast('Receipt emailed successfully', 'success');
    } catch (err: any) {
      showToast('Failed to send email. Please try again.', 'error');
    }
    setIsSendingEmail(false);
  };

  return (
    <>
      {/* Receipt Modal */}
      <Modal isOpen={isOpen} onClose={onClose} title="Sale Complete!" size="md">
        <div className="space-y-6">
          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircleIcon className="w-10 h-10 text-green-500" />
            </div>
          </div>

          {/* Receipt Preview */}
          {sale && (
            <div className="bg-white text-black p-4 rounded-lg font-mono text-sm print:shadow-none" id="receipt">
              <div className="text-center border-b border-dashed border-gray-300 pb-3 mb-3">
                <h3 className="font-bold text-lg">{shop?.name || 'YeboMart'}</h3>
                <p className="text-xs text-gray-500">{shop?.address || ''}</p>
                <p className="text-xs text-gray-500">Tel: {shop?.ownerPhone || ''}</p>
              </div>

              <div className="text-xs text-gray-500 mb-3">
                <p>Date: {sale.date.toLocaleDateString()} {sale.date.toLocaleTimeString()}</p>
                <p className="font-bold text-black">Receipt #: {sale.receiptNumber || sale.id.slice(-8).toUpperCase()}</p>
              </div>

              {sale.pendingSync && (
                <div className="mb-3 rounded bg-amber-100 border border-amber-300 px-2 py-1.5 text-xs text-amber-800">
                  Saved offline — this sale will sync automatically when you're back online.
                </div>
              )}

              <div className="border-b border-dashed border-gray-300 pb-3 mb-3">
                {sale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-1">
                    <span className="flex-1">{item.productName}</span>
                    <span className="w-8 text-center">x{item.quantity}</span>
                    <span className="w-20 text-right">{formatCurrency(item.totalPrice)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 mb-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(sale.subtotal || sale.total)}</span>
                </div>
                {sale.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(sale.discount)}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between font-bold text-lg border-t border-gray-300 pt-2">
                <span>TOTAL</span>
                <span>{formatCurrency(sale.total)}</span>
              </div>

              {/* Cash Payment Details */}
              {sale.paymentMethod === 'cash' && sale.cashReceived && (
                <div className="mt-3 pt-3 border-t border-dashed border-gray-300 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Cash Received</span>
                    <span>{formatCurrency(sale.cashReceived)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg text-green-600">
                    <span>CHANGE</span>
                    <span>{formatCurrency(sale.changeGiven || 0)}</span>
                  </div>
                </div>
              )}

              <div className="text-center mt-4 pt-3 border-t border-dashed border-gray-300">
                <p className="text-xs text-gray-500">Thank you for shopping with us!</p>
                <p className="text-xs text-gray-400">Powered by YeboMart</p>
              </div>
            </div>
          )}

          {/* Email / SMS Sent Confirmation */}
          {(emailSent || smsSent) && (
            <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 rounded-lg px-4 py-2">
              <CheckCircleIcon className="w-5 h-5" />
              {emailSent && smsSent
                ? 'Receipt sent by email and SMS!'
                : emailSent
                  ? 'Receipt emailed successfully!'
                  : 'Receipt sent via SMS!'}
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button variant="secondary" size="lg" className="w-full" onClick={onClose}>
              <XMarkIcon className="w-5 h-5" />
              Close
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={() => {
                setSmsPhone(customerPhone ?? '');
                setShowSmsModal(true);
              }}
              disabled={smsSent || !isOnline}
              title={isOnline ? undefined : 'You need to be online to text a receipt'}
            >
              <ChatBubbleLeftRightIcon className="w-5 h-5" />
              SMS
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={() => setShowEmailModal(true)}
              disabled={emailSent || !isOnline}
              title={isOnline ? undefined : 'You need to be online to email a receipt'}
            >
              <EnvelopeIcon className="w-5 h-5" />
              Email
            </Button>
            <Button variant="primary" size="lg" className="w-full" onClick={handlePrint}>
              <PrinterIcon className="w-5 h-5" />
              Print
            </Button>
          </div>
        </div>
      </Modal>

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
            Send a copy of the receipt to the customer's email address.
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

      {/* SMS Receipt Modal */}
      <Modal
        isOpen={showSmsModal}
        onClose={() => {
          setShowSmsModal(false);
          setSmsPhone('');
        }}
        title="Text Receipt"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-slate-400 text-sm">
            Send a short receipt to the customer by SMS.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Customer Phone
            </label>
            <input
              type="tel"
              value={smsPhone}
              onChange={(e) => setSmsPhone(e.target.value)}
              placeholder="+268 7842 2613"
              autoFocus
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowSmsModal(false);
                setSmsPhone('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleSendSms}
              disabled={!smsPhone || isSendingSms}
              isLoading={isSendingSms}
            >
              <ChatBubbleLeftRightIcon className="w-5 h-5" />
              Send Receipt
            </Button>
          </div>
        </div>
      </Modal>

      {/* Non-blocking feedback — rendered last so it paints above any open modal */}
      <Toast toast={toast} onDismiss={dismissToast} />
    </>
  );
}

export default ReceiptModal;
