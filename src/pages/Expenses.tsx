import { useState, useEffect, useMemo, useRef } from 'react';
import {
  PlusIcon,
  TrashIcon,
  PencilSquareIcon,
  BanknotesIcon,
  ArrowPathIcon,
  ReceiptPercentIcon,
  CalendarIcon,
  PaperClipIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Toast, useToast } from '@/components/ui/Toast';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import {
  formatCurrency,
  formatDate,
  EXPENSE_CATEGORIES,
  type Expense,
  type ExpenseCategory,
} from '@/types';
import { api, type ExpenseSummary } from '@/api/client';

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.value, c.label]),
);

// Local date (YYYY-MM-DD) for the date <input>.
function toDateInput(d: Date): string {
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().split('T')[0];
}

function todayInput(): string {
  return toDateInput(new Date());
}

const emptyForm = () => ({
  category: 'supplies' as ExpenseCategory,
  amount: '',
  description: '',
  date: todayInput(),
  // Persisted R2 url of the receipt photo ('' = no receipt attached).
  receiptUrl: '',
});

export function Expenses() {
  const { toast, showToast, dismissToast } = useToast();
  const { user, authMode } = useAuthStore();
  const { expenses, loadExpenses, addExpense, updateExpense, deleteExpense } =
    useInventoryStore();

  // Create + update + delete are managerAuth on the API: OWNER or MANAGER.
  const canManage =
    authMode === 'owner' || user?.role === 'owner' || user?.role === 'manager';

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(emptyForm());

  // Receipt photo upload state. `receiptPreviewUrl` is a local blob shown only
  // while the file is in flight; on success the real R2 url replaces it, on
  // failure it is discarded so nothing fake is ever displayed or saved.
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    await loadExpenses();
    const { data } = await api.getExpenseSummary();
    if (data) setSummary(data);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedExpenses = useMemo(
    () =>
      [...expenses].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [expenses],
  );

  const resetReceiptState = () => {
    setReceiptPreviewUrl(null);
    setIsUploadingReceipt(false);
    setReceiptError('');
  };

  const openCreate = () => {
    setFormData(emptyForm());
    setEditingId(null);
    resetReceiptState();
    setShowFormModal(true);
  };

  const openEdit = (expense: Expense) => {
    setFormData({
      category: expense.category,
      amount: String(expense.amount),
      description: expense.description || '',
      date: toDateInput(new Date(expense.date)),
      receiptUrl: expense.receiptUrl || '',
    });
    setEditingId(expense.id);
    resetReceiptState();
    setShowFormModal(true);
  };

  const closeForm = () => {
    setShowFormModal(false);
    resetReceiptState();
  };

  const handleReceiptSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file after a failure
    if (!file) return;

    setReceiptError('');
    const objectUrl = URL.createObjectURL(file);
    setReceiptPreviewUrl(objectUrl);
    setIsUploadingReceipt(true);

    try {
      const response = await api.uploadImage(file);
      if (response.data?.url) {
        setFormData((prev) => ({ ...prev, receiptUrl: response.data!.url }));
      } else {
        // Upload failed — surface it loudly and keep whatever receipt was
        // already attached. Never fabricate a url or silently drop the photo.
        const message = response.error || 'Failed to upload receipt. Please try again.';
        setReceiptError(message);
        showToast(message, 'error');
      }
    } finally {
      setIsUploadingReceipt(false);
      setReceiptPreviewUrl(null);
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleRemoveReceipt = () => {
    setFormData((prev) => ({ ...prev, receiptUrl: '' }));
    setReceiptError('');
  };

  const displayReceiptUrl = receiptPreviewUrl || formData.receiptUrl;

  const handleSave = async () => {
    const amount = parseFloat(formData.amount);
    if (!amount || amount <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateExpense(editingId, {
          category: formData.category,
          amount,
          description: formData.description.trim(),
          date: new Date(formData.date),
          // Always sent on update: '' is how a removed receipt actually
          // clears the stored url (the API maps '' to NULL).
          receiptUrl: formData.receiptUrl,
        });
        showToast('Expense updated');
      } else {
        await addExpense({
          shopId: '', // server derives shopId from the token; ignored by the client
          category: formData.category,
          amount,
          description: formData.description.trim() || undefined,
          date: new Date(formData.date),
          // Omitted when unset — the API's create schema rejects an
          // empty-string uri.
          receiptUrl: formData.receiptUrl || undefined,
        });
        showToast('Expense recorded');
      }
      closeForm();
      // Refresh the summary totals (store already refreshed the list)
      const { data } = await api.getExpenseSummary();
      if (data) setSummary(data);
    } catch (e: any) {
      showToast(
        e?.message || (editingId ? 'Failed to update expense' : 'Failed to record expense'),
        'error',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this expense? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await deleteExpense(id);
      showToast('Expense deleted');
      const { data } = await api.getExpenseSummary();
      if (data) setSummary(data);
    } catch (e: any) {
      showToast(e?.message || 'Failed to delete expense', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Expenses</h1>
          <p className="text-slate-400 mt-1">
            Track what your shop spends so profit reflects reality
          </p>
        </div>
        {canManage && (
          <Button
            variant="primary"
            leftIcon={<PlusIcon className="w-5 h-5" />}
            onClick={openCreate}
          >
            Record Expense
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card gradient="amber">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <BanknotesIcon className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">This Month</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(summary?.thisMonth || 0)}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-500/20 rounded-lg">
              <CalendarIcon className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Last Month</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(summary?.lastMonth || 0)}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <ReceiptPercentIcon className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Entries (Month)</p>
              <p className="text-2xl font-bold text-white">{summary?.count || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12">
          <ArrowPathIcon className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          <p className="text-slate-400 mt-2">Loading expenses...</p>
        </div>
      ) : sortedExpenses.length === 0 ? (
        <Card className="text-center py-12">
          <ReceiptPercentIcon className="w-12 h-12 mx-auto text-slate-500 mb-3" />
          <p className="text-slate-400 mb-4">No expenses recorded yet</p>
          {canManage && (
            <Button variant="primary" onClick={openCreate}>
              Record Your First Expense
            </Button>
          )}
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-slate-700/50">
            {sortedExpenses.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-3 p-4 hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {e.receiptUrl && (
                    <a
                      href={e.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View receipt"
                      className="shrink-0 w-11 h-11 rounded-lg overflow-hidden border border-slate-600 hover:border-orange-500 transition-colors"
                    >
                      <img
                        src={e.receiptUrl}
                        alt={`Receipt for ${CATEGORY_LABEL[e.category] || e.category} expense`}
                        className="w-full h-full object-cover"
                      />
                    </a>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="warning" size="sm">
                        {CATEGORY_LABEL[e.category] || e.category}
                      </Badge>
                      <span className="text-xs text-slate-500">{formatDate(e.date)}</span>
                    </div>
                    {e.description && (
                      <p className="text-sm text-slate-300 mt-1 truncate">
                        {e.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-lg font-semibold text-orange-400">
                    {formatCurrency(e.amount)}
                  </span>
                  {canManage && (
                    <button
                      onClick={() => openEdit(e)}
                      className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
                      title={e.receiptUrl ? 'Edit expense' : 'Edit expense / attach receipt'}
                      aria-label={`Edit ${CATEGORY_LABEL[e.category] || e.category} expense`}
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                  )}
                  {canManage && (
                    <button
                      onClick={() => handleDelete(e.id)}
                      disabled={deletingId === e.id}
                      className="p-1.5 rounded-lg bg-slate-700 hover:bg-red-600/80 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                      title="Delete expense"
                    >
                      {deletingId === e.id ? (
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      ) : (
                        <TrashIcon className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showFormModal}
        onClose={closeForm}
        title={editingId ? 'Edit Expense' : 'Record Expense'}
      >
        <div className="space-y-4">
          <Select
            label="Category"
            value={formData.category}
            onChange={(e) =>
              setFormData({ ...formData, category: e.target.value as ExpenseCategory })
            }
            options={EXPENSE_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          />
          <Input
            label="Amount *"
            type="number"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            placeholder="0.00"
            leftIcon={<BanknotesIcon className="w-5 h-5" />}
          />
          <Input
            label="Date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            leftIcon={<CalendarIcon className="w-5 h-5" />}
          />
          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="What was this for? (optional)"
          />

          {/* Receipt photo */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-300">Receipt Photo</p>

            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-xl bg-slate-700/50 border border-slate-600 overflow-hidden flex items-center justify-center shrink-0">
                {displayReceiptUrl ? (
                  <img
                    src={displayReceiptUrl}
                    alt="Receipt preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <PaperClipIcon className="w-8 h-8 text-slate-500" />
                )}
                {isUploadingReceipt && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex flex-col items-start gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isUploadingReceipt}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploadingReceipt
                    ? 'Uploading…'
                    : displayReceiptUrl
                      ? 'Replace Receipt'
                      : 'Attach Receipt'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleReceiptSelect}
                  aria-label="Receipt photo"
                />
                {formData.receiptUrl && !isUploadingReceipt && (
                  <button
                    type="button"
                    onClick={handleRemoveReceipt}
                    className="text-sm text-red-400 hover:text-red-300"
                  >
                    Remove receipt
                  </button>
                )}
              </div>
            </div>

            {receiptError && (
              <div
                role="alert"
                className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30"
              >
                <ExclamationTriangleIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{receiptError}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={closeForm}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleSave}
              disabled={
                !formData.amount ||
                parseFloat(formData.amount) <= 0 ||
                saving ||
                isUploadingReceipt
              }
              isLoading={saving}
            >
              {editingId ? 'Save Changes' : 'Record'}
            </Button>
          </div>
        </div>
      </Modal>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
