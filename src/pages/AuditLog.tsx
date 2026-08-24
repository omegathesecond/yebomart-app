import { useState, useEffect, useCallback } from 'react';
import {
  ClockIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import { api, AUDIT_ACTIONS, type AuditLogEntry, type AuditLogPagination } from '@/api/client';
import { formatDateTime } from '@/types';

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  PRODUCT_CREATE: 'Product Created',
  PRODUCT_UPDATE: 'Product Updated',
  PRODUCT_DELETE: 'Product Deleted',
  SALE_CREATE: 'Sale Recorded',
  SALE_VOID: 'Sale Voided',
  STOCK_ADJUST: 'Stock Adjusted',
  STOCK_RECEIVE: 'Stock Received',
  USER_CREATE: 'Staff Added',
  USER_UPDATE: 'Staff Updated',
  USER_DELETE: 'Staff Removed',
  EXPENSE_CREATE: 'Expense Added',
  EXPENSE_DELETE: 'Expense Deleted',
  SETTINGS_UPDATE: 'Settings Updated',
  LICENSE_APPLY: 'License Applied',
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] || action;
}

function actionVariant(action: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  if (action.includes('DELETE') || action.includes('VOID')) return 'danger';
  if (action.includes('ADJUST') || action.includes('UPDATE')) return 'warning';
  if (action.includes('CREATE') || action.includes('RECEIVE')) return 'success';
  return 'info';
}

const LIMIT = 25;

interface Filters {
  userId: string;
  action: string;
  startDate: string;
  endDate: string;
}

const EMPTY_FILTERS: Filters = { userId: '', action: '', startDate: '', endDate: '' };

export function AuditLog() {
  const { user, authMode } = useAuthStore();
  // ownerAuth on the API — mirrors api/src/routes/audit.routes.ts.
  const isOwner = authMode === 'owner' || user?.role === 'owner';

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [pagination, setPagination] = useState<AuditLogPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const updateFilters = (updates: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
    setPage(1);
  };

  useEffect(() => {
    if (!isOwner) return;
    api.getStaff().then((res) => {
      if (res.data) setStaff(res.data);
    });
  }, [isOwner]);

  const load = useCallback(async () => {
    if (!isOwner) return;
    setLoading(true);
    setError(null);
    const res = await api.getAuditLogs({
      page,
      limit: LIMIT,
      userId: filters.userId || undefined,
      action: filters.action || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
    });
    if (res.data) {
      setLogs(res.data.logs);
      setPagination(res.data.pagination);
      setForbidden(false);
    } else {
      setLogs([]);
      setPagination(null);
      if (res.status === 403) {
        setForbidden(true);
      } else {
        setError(res.error || 'Failed to load audit log');
      }
    }
    setLoading(false);
  }, [isOwner, page, filters]);

  useEffect(() => {
    load();
  }, [load]);

  // Client-side guard mirrors the API's ownerAuth gate — a non-owner (or a
  // staff-mode session) never even sees the fetch attempt. This is UI-only;
  // the real enforcement is the API's 403, handled below via `forbidden`.
  if (!isOwner) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <ShieldExclamationIcon className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mt-3">Owners only</h1>
          <p className="text-slate-400 mt-2">
            The audit log is only visible to the shop owner.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <p className="text-slate-400 mt-1">
          Every login, sale, stock change and edit made in your shop
        </p>
      </div>

      {/* Filters */}
      <Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Staff Member"
            value={filters.userId}
            onChange={(e) => updateFilters({ userId: e.target.value })}
            options={[
              { value: '', label: 'All staff' },
              ...staff.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <Select
            label="Action"
            value={filters.action}
            onChange={(e) => updateFilters({ action: e.target.value })}
            options={[
              { value: '', label: 'All actions' },
              ...AUDIT_ACTIONS.map((a) => ({ value: a, label: actionLabel(a) })),
            ]}
          />
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">From</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => updateFilters({ startDate: e.target.value })}
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">To</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => updateFilters({ endDate: e.target.value })}
              className="input w-full"
            />
          </div>
        </div>
        {(filters.userId || filters.action || filters.startDate || filters.endDate) && (
          <div className="mt-3">
            <Button variant="ghost" size="sm" onClick={() => updateFilters(EMPTY_FILTERS)}>
              Clear filters
            </Button>
          </div>
        )}
      </Card>

      {/* Forbidden — API disagreed with the client-side owner check (stale
          role, shared/expired session, etc). Never a silent blank page. */}
      {forbidden && (
        <Card className="text-center py-12">
          <ShieldExclamationIcon className="w-12 h-12 mx-auto text-red-400 mb-3" />
          <p className="text-slate-300 font-medium">
            You don't have permission to view the audit log
          </p>
          <p className="text-slate-500 text-sm mt-1">This page is restricted to the shop owner.</p>
        </Card>
      )}

      {!forbidden && error && (
        <Card className="text-center py-12">
          <p className="text-red-400">{error}</p>
          <Button variant="secondary" className="mt-4" onClick={load}>
            Retry
          </Button>
        </Card>
      )}

      {!forbidden && !error && loading && (
        <div className="text-center py-12">
          <ArrowPathIcon className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          <p className="text-slate-400 mt-2">Loading audit log...</p>
        </div>
      )}

      {!forbidden && !error && !loading && logs.length === 0 && (
        <Card className="text-center py-12">
          <ClockIcon className="w-12 h-12 mx-auto text-slate-500 mb-3" />
          <p className="text-slate-400">No audit entries found</p>
        </Card>
      )}

      {!forbidden && !error && !loading && logs.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Time</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                    Staff Member
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Action</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-700/50">
                    <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-white">{log.user?.name || 'Unknown'}</p>
                      {log.user?.role && (
                        <p className="text-xs text-slate-500 capitalize">{log.user.role}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={actionVariant(log.action)}>{actionLabel(log.action)}</Badge>
                      <p className="text-xs text-slate-500 mt-1 capitalize">{log.entityType}</p>
                    </td>
                    <td
                      className="py-3 px-4 text-slate-400 max-w-xs truncate"
                      title={log.details && Object.keys(log.details).length ? JSON.stringify(log.details) : undefined}
                    >
                      {log.details && Object.keys(log.details).length > 0
                        ? JSON.stringify(log.details)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-700">
              <p className="text-sm text-slate-400">
                Page {pagination.page} of {pagination.pages} ({pagination.total} entries)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                  Prev
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRightIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
