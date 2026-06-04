import { useState, useEffect, useCallback } from 'react';
import {
  MagnifyingGlassIcon,
  UserPlusIcon,
  UserCircleIcon,
  ArrowPathIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Toast, useToast } from '@/components/ui/Toast';
import { api, type Customer } from '@/api/client';

interface CustomerPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (customer: Customer) => void;
}

/**
 * Shared modal for attaching a customer to a sale or return.
 *
 * Search the existing customer list or create a new one inline. On any API
 * failure it surfaces a toast — it never silently selects nothing or fabricates
 * a customer.
 */
export function CustomerPicker({ isOpen, onClose, onSelect }: CustomerPickerProps) {
  const { toast, showToast, dismissToast } = useToast();
  const [mode, setMode] = useState<'search' | 'create'>('search');
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });

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
    },
    [showToast],
  );

  // Load + reset whenever the picker opens
  useEffect(() => {
    if (isOpen) {
      setMode('search');
      setSearch('');
      setForm({ name: '', phone: '', email: '' });
      fetchCustomers('');
    }
  }, [isOpen, fetchCustomers]);

  // Debounced search
  useEffect(() => {
    if (!isOpen || mode !== 'search') return;
    const timer = setTimeout(() => fetchCustomers(search), 300);
    return () => clearTimeout(timer);
  }, [search, isOpen, mode, fetchCustomers]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    const { data, error } = await api.createCustomer({
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
    });
    setCreating(false);
    if (error || !data) {
      showToast(error || 'Failed to create customer', 'error');
      return;
    }
    showToast('Customer created');
    onSelect(data);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'New Customer' : 'Select Customer'}
    >
      <div className="space-y-4">
        {mode === 'search' ? (
          <>
            <Input
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
              autoFocus
            />

            <div className="max-h-72 overflow-y-auto space-y-2">
              {loading ? (
                <div className="text-center py-8">
                  <ArrowPathIcon className="w-7 h-7 animate-spin mx-auto text-slate-400" />
                </div>
              ) : customers.length === 0 ? (
                <p className="text-center text-slate-500 py-8 text-sm">
                  No customers found
                </p>
              ) : (
                customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onSelect(c)}
                    className="w-full text-left p-3 rounded-xl bg-slate-800 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-800/70 transition-colors flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
                      <span className="text-white text-sm font-semibold">
                        {c.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{c.name}</p>
                      {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
                    </div>
                    {c.balance > 0 && (
                      <span className="text-xs text-red-400 font-medium shrink-0">
                        owes {c.balance.toFixed(2)}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>

            <Button
              variant="secondary"
              className="w-full"
              leftIcon={<UserPlusIcon className="w-5 h-5" />}
              onClick={() => {
                setForm({ name: search.trim(), phone: '', email: '' });
                setMode('create');
              }}
            >
              New Customer
            </Button>
          </>
        ) : (
          <>
            <Input
              label="Name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Customer name"
              leftIcon={<UserCircleIcon className="w-5 h-5" />}
              autoFocus
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+268 7842 2613"
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="customer@example.com"
            />
            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                className="flex-1"
                leftIcon={<ArrowLeftIcon className="w-5 h-5" />}
                onClick={() => setMode('search')}
              >
                Back
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleCreate}
                disabled={!form.name.trim() || creating}
                isLoading={creating}
              >
                Create &amp; Select
              </Button>
            </div>
          </>
        )}
      </div>

      <Toast toast={toast} onDismiss={dismissToast} />
    </Modal>
  );
}
