import { useState, useEffect, useCallback } from 'react';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  UserGroupIcon,
  UserCircleIcon,
  ArrowPathIcon,
  BanknotesIcon,
  ReceiptPercentIcon,
  ShoppingBagIcon,
  PaperAirplaneIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Toast, useToast } from '@/components/ui/Toast';
import { api, type Customer, type CustomerDetail } from '@/api/client';
import { formatCurrency } from '@/types';

const CREDIT_TYPE_LABEL: Record<string, string> = {
  PURCHASE: 'Purchase',
  PAYMENT: 'Payment',
  ADJUSTMENT: 'Adjustment',
  REFUND: 'Refund',
};

export function Customers() {
  const { toast, showToast, dismissToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [totalOwed, setTotalOwed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Add/edit form
  const [showFormModal, setShowFormModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    creditLimit: '',
  });

  // Detail drawer
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Record payment / manual ledger adjustment
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState<'PAYMENT' | 'ADJUSTMENT' | 'REFUND'>('PAYMENT');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Send statement / reminder via YeboLink (WhatsApp → SMS)
  const [sending, setSending] = useState<'statement' | 'reminder' | null>(null);

  const fetchCustomers = useCallback(
    async (term: string) => {
      setLoading(true);
      const { data, error } = await api.getCustomers(term ? { search: term } : undefined);
      setLoading(false);
      if (error) {
        showToast(error, 'error');
        return;
      }
      setCustomers(data?.customers || []);
      setTotalOwed(data?.totalOwed || 0);
    },
    [showToast],
  );

  useEffect(() => {
    fetchCustomers('');
  }, [fetchCustomers]);

  useEffect(() => {
    const timer = setTimeout(() => fetchCustomers(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchCustomers]);

  const openCreate = () => {
    setEditing(null);
    setFormData({ name: '', phone: '', email: '', address: '', creditLimit: '' });
    setShowFormModal(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setFormData({
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      creditLimit: c.creditLimit ? String(c.creditLimit) : '',
    });
    setShowFormModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);
    const payload = {
      name: formData.name.trim(),
      phone: formData.phone.trim() || undefined,
      email: formData.email.trim() || undefined,
      address: formData.address.trim() || undefined,
      creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : undefined,
    };
    const { error } = editing
      ? await api.updateCustomer(editing.id, payload)
      : await api.createCustomer(payload);
    setSaving(false);
    if (error) {
      showToast(error, 'error');
      return;
    }
    showToast(editing ? 'Customer updated' : 'Customer created');
    setShowFormModal(false);
    fetchCustomers(searchQuery);
  };

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setPaymentAmount('');
    const { data, error } = await api.getCustomer(id);
    setDetailLoading(false);
    if (error || !data) {
      showToast(error || 'Failed to load customer', 'error');
      return;
    }
    setDetail(data);
  };

  const openPaymentModal = () => {
    setPaymentType('PAYMENT');
    setPaymentAmount('');
    setPaymentNote('');
    setShowPaymentModal(true);
  };

  // Mirror the server's addCreditSchema: an ADJUSTMENT carries its own sign (a
  // negative amount reduces the balance) but must be non-zero; PAYMENT/REFUND
  // are positive magnitudes that pay the balance down.
  const isPaymentAmountValid = () => {
    const amount = parseFloat(paymentAmount);
    if (Number.isNaN(amount)) return false;
    return paymentType === 'ADJUSTMENT' ? amount !== 0 : amount > 0;
  };

  const handleRecordPayment = async () => {
    if (!detail || !isPaymentAmountValid()) return;
    const amount = parseFloat(paymentAmount);
    setRecordingPayment(true);
    const { data, error } = await api.addCustomerCredit(detail.id, {
      type: paymentType,
      amount,
      note: paymentNote.trim() || undefined,
    });
    setRecordingPayment(false);
    if (error || !data) {
      // No silent fallback — surface the API failure loudly, including the
      // 422 a positive over-limit ADJUSTMENT returns (owner override required).
      showToast(error || 'Failed to record entry', 'error');
      return;
    }
    showToast(`${CREDIT_TYPE_LABEL[paymentType]} of ${formatCurrency(Math.abs(amount))} recorded`);
    setShowPaymentModal(false);
    // Refresh the detail (new balance + ledger) and the list balance badges.
    openDetail(detail.id);
    fetchCustomers(searchQuery);
  };

  const handleSendStatement = async (reminder: boolean) => {
    if (!detail || !detail.phone) return;
    setSending(reminder ? 'reminder' : 'statement');
    const { data, error } = await api.sendCustomerStatement(detail.id, { reminder });
    setSending(null);
    if (error || !data) {
      showToast(error || `Failed to send ${reminder ? 'reminder' : 'statement'}`, 'error');
      return;
    }
    const channel = data.channel === 'whatsapp' ? 'WhatsApp' : 'SMS';
    showToast(`${reminder ? 'Reminder' : 'Statement'} sent via ${channel}`);
  };

  // Total spent = sum of returned (recent) sales. The API caps sales at the
  // most recent 20, so this reflects recent purchases rather than all-time.
  const recentSpent = detail?.sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Customers</h1>
          <p className="text-slate-400 mt-1">
            {customers.length} customer{customers.length !== 1 ? 's' : ''}
            {totalOwed > 0 && (
              <span className="ml-2 text-red-400">
                · {formatCurrency(totalOwed)} owed
              </span>
            )}
          </p>
        </div>
        <Button
          variant="primary"
          leftIcon={<PlusIcon className="w-5 h-5" />}
          onClick={openCreate}
        >
          Add Customer
        </Button>
      </div>

      {/* Search */}
      <Input
        placeholder="Search by name or phone..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
      />

      {/* List */}
      {loading ? (
        <div className="text-center py-12">
          <ArrowPathIcon className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          <p className="text-slate-400 mt-2">Loading customers...</p>
        </div>
      ) : customers.length === 0 ? (
        <Card className="text-center py-12">
          <UserGroupIcon className="w-12 h-12 mx-auto text-slate-500 mb-3" />
          <p className="text-slate-400 mb-4">No customers found</p>
          <Button variant="primary" onClick={openCreate}>
            Add Your First Customer
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((c) => (
            <Card
              key={c.id}
              className="relative cursor-pointer hover:bg-slate-800/50 transition-colors"
              onClick={() => openDetail(c.id)}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit(c);
                }}
                className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300"
                title="Edit"
              >
                <PencilIcon className="w-4 h-4" />
              </button>

              <div className="pr-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                    <span className="text-white font-semibold">
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white truncate">{c.name}</h3>
                    {c._count && (
                      <p className="text-xs text-slate-500">
                        {c._count.sales} sale{c._count.sales !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {c.phone && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <PhoneIcon className="w-4 h-4" />
                      <span>{c.phone}</span>
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <EnvelopeIcon className="w-4 h-4" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {c.balance > 0 ? (
                    <Badge variant="danger">Owes {formatCurrency(c.balance)}</Badge>
                  ) : c.balance < 0 ? (
                    <Badge variant="success">Credit {formatCurrency(-c.balance)}</Badge>
                  ) : (
                    <Badge variant="neutral">Settled</Badge>
                  )}
                  {c.creditLimit > 0 && (
                    <Badge variant="info">Limit {formatCurrency(c.creditLimit)}</Badge>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={editing ? 'Edit Customer' : 'Add Customer'}
      >
        <div className="space-y-4">
          <Input
            label="Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Customer name"
            leftIcon={<UserCircleIcon className="w-5 h-5" />}
          />
          <Input
            label="Phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+268 7842 2613"
            leftIcon={<PhoneIcon className="w-5 h-5" />}
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="customer@example.com"
            leftIcon={<EnvelopeIcon className="w-5 h-5" />}
          />
          <Input
            label="Address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Physical address"
            leftIcon={<MapPinIcon className="w-5 h-5" />}
          />
          <Input
            label="Credit Limit"
            type="number"
            value={formData.creditLimit}
            onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
            placeholder="0.00"
            hint="Max amount this customer can owe"
          />
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowFormModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleSave}
              disabled={!formData.name.trim() || saving}
              isLoading={saving}
            >
              {editing ? 'Update' : 'Add Customer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={!!detail || detailLoading}
        onClose={() => setDetail(null)}
        title={detail?.name || 'Customer'}
        size="lg"
      >
        {detailLoading ? (
          <div className="text-center py-10">
            <ArrowPathIcon className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          </div>
        ) : detail ? (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
            {/* Contact */}
            <div className="space-y-2 text-sm">
              {detail.phone && (
                <div className="flex items-center gap-2 text-slate-300">
                  <PhoneIcon className="w-4 h-4 text-slate-500" />
                  <a href={`tel:${detail.phone}`} className="hover:text-amber-400">
                    {detail.phone}
                  </a>
                </div>
              )}
              {detail.email && (
                <div className="flex items-center gap-2 text-slate-300">
                  <EnvelopeIcon className="w-4 h-4 text-slate-500" />
                  <a href={`mailto:${detail.email}`} className="hover:text-amber-400">
                    {detail.email}
                  </a>
                </div>
              )}
              {detail.address && (
                <div className="flex items-center gap-2 text-slate-300">
                  <MapPinIcon className="w-4 h-4 text-slate-500" />
                  <span>{detail.address}</span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-800 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400">Balance</p>
                <p
                  className={`text-lg font-bold ${
                    detail.balance > 0
                      ? 'text-red-400'
                      : detail.balance < 0
                        ? 'text-emerald-400'
                        : 'text-white'
                  }`}
                >
                  {formatCurrency(detail.balance)}
                </p>
              </div>
              <div className="bg-slate-800 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400">Recent Spent</p>
                <p className="text-lg font-bold text-white">{formatCurrency(recentSpent)}</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400">Credit Limit</p>
                <p className="text-lg font-bold text-white">
                  {formatCurrency(detail.creditLimit)}
                </p>
              </div>
            </div>

            {/* Record a payment or post a manual ledger adjustment. Available to
                any signed-in staff: the API's POST /:id/credit is NOT
                manager-gated (only PATCH / send-statement are), so gating this
                would re-break the gap it fills — cashiers selling "on the book"
                must be able to clear debt. Over-limit positive adjustments still
                fail loudly with a 422. */}
            <Button
              variant="success"
              className="w-full"
              leftIcon={<BanknotesIcon className="w-5 h-5" />}
              onClick={openPaymentModal}
            >
              Record Payment
            </Button>

            {/* Purchase history */}
            <div>
              <p className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                <ShoppingBagIcon className="w-5 h-5 text-amber-400" />
                Purchase History
              </p>
              {detail.sales.length === 0 ? (
                <p className="text-sm text-slate-500 py-3">No purchases yet.</p>
              ) : (
                <div className="space-y-2">
                  {detail.sales.map((s) => (
                    <div
                      key={s.id}
                      className="flex justify-between items-center bg-slate-800 rounded-lg p-3"
                    >
                      <div>
                        <p className="text-sm font-mono text-amber-400">
                          {s.receiptNumber || s.id.slice(-8).toUpperCase()}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(s.createdAt).toLocaleString()} ·{' '}
                          {s.paymentMethod}
                        </p>
                      </div>
                      <p className="font-semibold text-white">
                        {formatCurrency(s.totalAmount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Credit ledger */}
            {detail.credits.length > 0 && (
              <div>
                <p className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                  <ReceiptPercentIcon className="w-5 h-5 text-violet-400" />
                  Account Ledger
                </p>
                <div className="space-y-2">
                  {detail.credits.map((cr) => (
                    <div
                      key={cr.id}
                      className="flex justify-between items-center bg-slate-800 rounded-lg p-3"
                    >
                      <div>
                        <p className="text-sm text-white">
                          {CREDIT_TYPE_LABEL[cr.type] || cr.type}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(cr.createdAt).toLocaleDateString()}
                          {cr.note ? ` · ${cr.note}` : ''}
                        </p>
                      </div>
                      <p
                        className={`font-semibold ${
                          cr.type === 'PAYMENT' || cr.type === 'REFUND'
                            ? 'text-emerald-400'
                            : 'text-slate-300'
                        }`}
                      >
                        {formatCurrency(cr.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Send statement / reminder via WhatsApp (SMS fallback). Manager-gated
                server-side; disabled here when the customer has no phone. */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                variant="secondary"
                className="flex-1 min-w-[7rem]"
                leftIcon={<PencilIcon className="w-5 h-5" />}
                onClick={() => {
                  const c = detail;
                  setDetail(null);
                  openEdit(c);
                }}
              >
                Edit
              </Button>
              <div
                className="flex-1 min-w-[8rem]"
                title={detail.phone ? undefined : 'Add a phone number to send a statement'}
              >
                <Button
                  variant="primary"
                  className="w-full"
                  leftIcon={<PaperAirplaneIcon className="w-5 h-5" />}
                  onClick={() => handleSendStatement(false)}
                  disabled={!detail.phone || sending !== null}
                  isLoading={sending === 'statement'}
                >
                  Send statement
                </Button>
              </div>
              {detail.balance > 0 && (
                <div
                  className="flex-1 min-w-[8rem]"
                  title={detail.phone ? undefined : 'Add a phone number to send a reminder'}
                >
                  <Button
                    variant="outline"
                    className="w-full"
                    leftIcon={<BellAlertIcon className="w-5 h-5" />}
                    onClick={() => handleSendStatement(true)}
                    disabled={!detail.phone || sending !== null}
                    isLoading={sending === 'reminder'}
                  >
                    Send reminder
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Record payment / ledger adjustment */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Record Payment"
        size="sm"
      >
        {detail && (
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-xl p-3 flex items-center justify-between">
              <span className="text-sm text-slate-400">{detail.name}'s balance</span>
              <span
                className={`font-bold ${
                  detail.balance > 0
                    ? 'text-red-400'
                    : detail.balance < 0
                      ? 'text-emerald-400'
                      : 'text-white'
                }`}
              >
                {formatCurrency(detail.balance)}
              </span>
            </div>

            <Select
              label="Type"
              value={paymentType}
              onChange={(e) =>
                setPaymentType(e.target.value as 'PAYMENT' | 'ADJUSTMENT' | 'REFUND')
              }
              options={[
                { value: 'PAYMENT', label: 'Payment — customer pays down their balance' },
                { value: 'REFUND', label: 'Refund — money returned to the customer' },
                { value: 'ADJUSTMENT', label: 'Adjustment — manual correction (±)' },
              ]}
            />

            <Input
              label="Amount *"
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="0.00"
              leftIcon={<BanknotesIcon className="w-5 h-5" />}
              hint={
                paymentType === 'ADJUSTMENT'
                  ? 'Use a negative amount to reduce the balance, positive to increase it.'
                  : undefined
              }
            />

            {isPaymentAmountValid() && (
              <p className="text-xs text-slate-400">
                New balance:{' '}
                <span className="font-semibold text-slate-200">
                  {formatCurrency(
                    detail.balance +
                      (paymentType === 'ADJUSTMENT'
                        ? parseFloat(paymentAmount)
                        : -parseFloat(paymentAmount)),
                  )}
                </span>
              </p>
            )}

            <Textarea
              label="Note"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="Optional — e.g. cash, mobile money reference, reason for adjustment"
              maxLength={500}
              className="min-h-[72px]"
            />

            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowPaymentModal(false)}
                disabled={recordingPayment}
              >
                Cancel
              </Button>
              <Button
                variant="success"
                className="flex-1"
                onClick={handleRecordPayment}
                disabled={!isPaymentAmountValid() || recordingPayment}
                isLoading={recordingPayment}
              >
                {paymentType === 'PAYMENT'
                  ? 'Record Payment'
                  : paymentType === 'REFUND'
                    ? 'Record Refund'
                    : 'Record Adjustment'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
