// YeboMart PWA API Client
//
// Two auth flows live behind this client:
//   1. Owner — YeboID OAuth (PKCE). Token storage + silent refresh in
//      lib/yeboid.ts. Used by all owner-facing requests.
//   2. Staff — yebomart-internal token issued by /api/auth/login/user after
//      a phone+PIN check. Stored in localStorage under `yebomart_staff_token`.
//
// `getActiveToken()` returns whichever is present (staff takes precedence,
// since a shared POS device may have an owner-installed but be currently in
// staff mode). On 401 for owner mode we retry once after a yeboid refresh;
// on 401 for staff mode we surface it (no refresh — staff re-signs-in).

import * as yeboid from '@/lib/yeboid';
import type { Expense, ExpenseCategory } from '@/types';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.yebomart.com';

const STAFF_TOKEN_KEY = 'yebomart_staff_token';

/**
 * Sentinel returned by `request()` when the fetch itself fails (offline / DNS /
 * connection reset) rather than the server returning an error response. The
 * offline outbox keys off this to decide "queue + retry" vs "surface to user":
 * a transport failure is retryable; a 4xx is a real rejection that must not be
 * silently retried. Exported so callers compare against the constant, not a
 * brittle string literal.
 */
export const NETWORK_ERROR = 'Network error. Please try again.';

/**
 * Machine-readable `code` returned alongside a 402 from credit-gated endpoints
 * (AI routes). Callers compare against this constant — not a string literal —
 * to tell "out of credits" apart from a generic failure and route the user to
 * the billing/top-up page. Mirrors api/src/middleware/billing.middleware.ts.
 */
export const INSUFFICIENT_CREDITS = 'INSUFFICIENT_CREDITS';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  details?: any;
  /** Machine-readable error code from the API body (e.g. INSUFFICIENT_CREDITS). */
  code?: string;
  /** HTTP status of the response — lets callers branch on 402 etc. */
  status?: number;
}

// ── Customer shapes (mirror api/src/controllers/customer.controller.ts) ──

export interface Customer {
  id: string;
  shopId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  creditLimit: number;
  balance: number; // positive = customer owes the shop
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { sales: number; credits: number };
}

export type CreditType = 'PURCHASE' | 'PAYMENT' | 'ADJUSTMENT' | 'REFUND';

export interface CustomerCredit {
  id: string;
  customerId: string;
  type: CreditType;
  amount: number;
  saleId?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface CustomerSale {
  id: string;
  receiptNumber?: string | null;
  totalAmount: number;
  paymentMethod: string;
  createdAt: string;
  items?: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

export interface CustomerDetail extends Customer {
  credits: CustomerCredit[];
  sales: CustomerSale[];
}

// ── Billing / credits (mirror api/src/config/creditPacks.ts + billing.routes.ts) ──

/** A purchasable credit pack. 1 credit = E1 (SZL); discounts are bonus credits. */
export interface CreditPack {
  id: 'STARTER' | 'STANDARD' | 'BULK';
  name: string;
  description: string;
  priceSzl: number;
  credits: number;
  discountPercent: number;
}

/** The shop's current wallet balance, from YeboPay. */
export interface CreditBalance {
  available: number;
  currency: string;
}

/** Result of POST /api/billing/checkout — the YeboPay-hosted checkout to redirect to. */
export interface TopUpCheckout {
  checkoutId: string;
  url: string | null;
  expiresAt?: string | null;
  status: string;
  pack: string;
  priceSzl: number;
  credits: number;
}

/** Result of POST /api/billing/checkout/confirm — latest balance after a top-up. */
export interface TopUpConfirmResult {
  completed: boolean;
  status: string;
  chargeId: string | null;
  balance: CreditBalance;
}

// ── Expense shapes (mirror api/src/controllers/expense.controller.ts) ──

/** Raw expense as returned by yebomart-api (UPPERCASE category, ISO dates). */
interface ApiExpense {
  id: string;
  shopId: string;
  userId?: string | null;
  category: string;
  amount: number;
  description?: string | null;
  date: string;
  receiptUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseSummary {
  thisMonth: number;
  lastMonth: number;
  count: number;
  byCategory: Record<string, number>;
}

export interface ExpenseListResult {
  expenses: Expense[];
  totals: Record<string, number>;
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface NotificationSettings {
  notifyWhatsAppReports: boolean;
  notifyLowStock: boolean;
  notifyPhone: string | null;
  ownerPhone: string;
  /** Where the daily report actually goes: notifyPhone ?? ownerPhone. */
  recipientPhone: string;
}

/** Map the API's expense shape into the app's domain `Expense` (lowercase category, Date objects). */
function mapApiExpense(e: ApiExpense): Expense {
  return {
    id: e.id,
    shopId: e.shopId,
    category: (e.category?.toLowerCase() || 'other') as ExpenseCategory,
    amount: e.amount,
    description: e.description ?? undefined,
    date: new Date(e.date),
    createdAt: new Date(e.createdAt),
  };
}

class ApiClient {
  // ── Token surface ─────────────────────────────────────────────────────

  private async getActiveToken(): Promise<string | null> {
    const staffToken = localStorage.getItem(STAFF_TOKEN_KEY);
    if (staffToken) return staffToken;
    return yeboid.getAccessToken();
  }

  setStaffToken(token: string) {
    // Clear any existing owner session first — only one principal active.
    yeboid.clearTokens();
    localStorage.setItem(STAFF_TOKEN_KEY, token);
  }

  clearStaffToken() {
    localStorage.removeItem(STAFF_TOKEN_KEY);
  }

  /** Wipe everything — call from logout. */
  clearAllTokens() {
    yeboid.clearTokens();
    this.clearStaffToken();
  }

  private onSessionExpired: (() => void) | null = null;

  setSessionExpiredCallback(callback: () => void) {
    this.onSessionExpired = callback;
  }

  private forceLogout() {
    this.clearAllTokens();
    this.onSessionExpired?.();
  }

  // ── Request core ──────────────────────────────────────────────────────

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    opts: { retried?: boolean } = {},
  ): Promise<ApiResponse<T>> {
    const url = `${API_URL}${endpoint}`;
    const token = await this.getActiveToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    let response: Response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch {
      return { error: NETWORK_ERROR };
    }

    if (
      response.status === 401 &&
      !opts.retried &&
      !endpoint.includes('/auth/')
    ) {
      const staffToken = localStorage.getItem(STAFF_TOKEN_KEY);
      if (staffToken) {
        // Staff tokens don't refresh — surface the session expiry.
        this.forceLogout();
        return { error: 'Session expired. Please sign in again.' };
      }
      // Owner mode: try one silent refresh, then retry.
      yeboid.clearTokens();
      const fresh = await yeboid.getAccessToken();
      if (fresh) {
        return this.request<T>(endpoint, options, { retried: true });
      }
      this.forceLogout();
      return { error: 'Session expired. Please sign in again.' };
    }

    const json = await response.json().catch(() => ({}));

    if (!response.ok || json.success === false) {
      const errorMessage = json.message || json.error || 'Request failed';
      const details = json.details || json.errors;
      return { error: errorMessage, details, code: json.code, status: response.status };
    }

    return { data: json.data ?? json, message: json.message, status: response.status };
  }

  // ── Auth ──────────────────────────────────────────────────────────────

  /**
   * POST /api/auth/yeboid/exchange — owner sign-in / sign-up.
   *
   * Browser already exchanged the PKCE code for tokens. We send the access
   * token (+ optional bootstrap fields for first-time signup) to yebomart-api
   * which validates the token via JWKS and looks up / creates the Shop.
   */
  async exchangeYeboid(
    accessToken: string,
    bootstrap?: { shopName?: string; businessType?: string; assistantName?: string },
  ): Promise<ApiResponse<{ shop: any; isNewShop: boolean }>> {
    return this.request('/api/auth/yeboid/exchange', {
      method: 'POST',
      body: JSON.stringify({ accessToken, ...bootstrap }),
    });
  }

  /** Staff PIN login. Returns the yebomart-issued token; caller stores it. */
  async staffLogin(phone: string, pin: string) {
    const response = await this.request<{
      accessToken: string;
      shop: any;
      user: any;
    }>('/api/auth/login/user', {
      method: 'POST',
      body: JSON.stringify({ phone, pin }),
    });

    if (response.data) {
      this.setStaffToken(response.data.accessToken);
      return {
        data: {
          token: response.data.accessToken,
          user: {
            id: response.data.user.id,
            shopId: response.data.shop.id,
            name: response.data.user.name,
            phone: response.data.user.phone,
            pin: '',
            role: response.data.user.role?.toLowerCase() as
              | 'owner'
              | 'manager'
              | 'cashier',
            isActive: true,
            createdAt: new Date(),
          },
          shop: response.data.shop,
        },
      };
    }
    return { error: response.error || 'Login failed', details: response.details };
  }

  async getMe() {
    return this.request<{ user: any; shop: any; subscription: any }>(
      '/api/auth/me',
    );
  }

  // ── Notification settings ─────────────────────────────────────────────

  /** GET /api/shops/notifications — current shop's WhatsApp report / low-stock prefs. */
  async getNotificationSettings() {
    return this.request<NotificationSettings>('/api/shops/notifications');
  }

  /** PATCH /api/shops/notifications — owner-only. Send only the fields you change. */
  async updateNotificationSettings(data: Partial<Pick<NotificationSettings, 'notifyWhatsAppReports' | 'notifyLowStock' | 'notifyPhone'>>) {
    return this.request<NotificationSettings>('/api/shops/notifications', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // ── Products ──────────────────────────────────────────────────────────

  async getProducts(params?: { page?: number; limit?: number }) {
    const query = params
      ? `?page=${params.page || 1}&limit=${params.limit || 20}`
      : '';
    return this.request<any[]>(`/api/products${query}`);
  }

  async createProduct(data: any) {
    return this.request<any>('/api/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProduct(id: string, data: any) {
    return this.request<any>(`/api/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProduct(id: string) {
    return this.request<void>(`/api/products/${id}`, {
      method: 'DELETE',
    });
  }

  // ── Bulk operations ───────────────────────────────────────────────────

  async bulkImportProducts(products: any[], updateExisting = false) {
    return this.request<{
      created: number;
      updated: number;
      skipped: number;
      errors: any[];
    }>('/api/products/bulk/import', {
      method: 'POST',
      body: JSON.stringify({ products, updateExisting }),
    });
  }

  async bulkUpdateProducts(updates: any[]) {
    return this.request<{ updated: number; failed: number; errors: any[] }>(
      '/api/products/bulk/update',
      {
        method: 'POST',
        body: JSON.stringify({ updates }),
      },
    );
  }

  async exportProducts() {
    const token = await this.getActiveToken();
    const response = await fetch(`${API_URL}/api/products/export`, {
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    });
    return response.text();
  }

  // ── Sales ─────────────────────────────────────────────────────────────

  async getSales(params?: { startDate?: string; endDate?: string }) {
    const query = params ? `?${new URLSearchParams(params as any)}` : '';
    return this.request<any[]>(`/api/sales${query}`);
  }

  async createSale(data: {
    items: any[];
    paymentMethod: string;
    amountPaid: number;
    subtotal?: number;
    discount?: number;
    discountPercent?: number;
    discountReason?: string;
    discountApprovedBy?: string;
    customerId?: string | null;
    // Offline outbox idempotency: a client-generated id (sent on both the live
    // attempt and any queued replay) lets the API dedup, plus when the sale was
    // actually rung up. See SaleService.create + the syncQueue drain.
    localId?: string;
    offlineAt?: string;
  }) {
    return this.request<any>('/api/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ── Stock ─────────────────────────────────────────────────────────────

  async adjustStock(
    productId: string,
    data: { type: string; quantity: number; note?: string },
  ) {
    return this.request<any>('/api/stock/adjust', {
      method: 'POST',
      body: JSON.stringify({ productId, ...data }),
    });
  }

  async receiveStock(
    productId: string,
    data: { quantity: number; note?: string; costPrice?: number },
  ) {
    return this.request<any>('/api/stock/receive', {
      method: 'POST',
      body: JSON.stringify({ productId, ...data }),
    });
  }

  async getStockLogs(productId?: string) {
    const endpoint = productId
      ? `/api/stock/movements?productId=${productId}`
      : '/api/stock/movements';
    return this.request<any[]>(endpoint);
  }

  // ── Reports ───────────────────────────────────────────────────────────

  async getDailyReport(date?: string) {
    const query = date ? `?date=${date}` : '';
    return this.request<any>(`/api/reports/daily${query}`);
  }

  async getSalesReport(startDate: string, endDate: string) {
    return this.request<any>(
      `/api/reports/sales?startDate=${startDate}&endDate=${endDate}`,
    );
  }

  // ── AI Assistant ──────────────────────────────────────────────────────

  async chat(message: string, context?: any) {
    return this.request<{
      response?: string;
      message?: string;
      suggestions?: string[];
      assistantName?: string;
    }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, context }),
    });
  }

  async getInsights() {
    return this.request<{ insights: string[]; alerts: any[] }>(
      '/api/ai/insights',
    );
  }

  // ── Staff/Users ───────────────────────────────────────────────────────

  async getStaff() {
    return this.request<any[]>('/api/users');
  }

  async getStaffDetail(userId: string, days: number = 30) {
    return this.request<any>(`/api/users/${userId}/detail?days=${days}`);
  }

  async createStaff(data: {
    name: string;
    phone: string;
    pin: string;
    role: string;
  }) {
    return this.request<any>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateStaff(
    id: string,
    data: Partial<{
      name: string;
      phone: string;
      pin: string;
      role: string;
      isActive: boolean;
    }>,
  ) {
    return this.request<any>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteStaff(id: string) {
    return this.request<any>(`/api/users/${id}`, {
      method: 'DELETE',
    });
  }

  // ── Health ────────────────────────────────────────────────────────────

  async health() {
    return this.request<any>('/health');
  }

  // ── Returns ───────────────────────────────────────────────────────────

  async getReturns(params?: { status?: string }) {
    const query = params?.status ? `?status=${params.status}` : '';
    return this.request<any[]>(`/api/returns${query}`);
  }

  async getReturn(id: string) {
    return this.request<any>(`/api/returns/${id}`);
  }

  async createReturn(data: any) {
    return this.request<any>('/api/returns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async processReturn(id: string, action: 'approve' | 'reject' | 'complete') {
    return this.request<any>(`/api/returns/${id}/process`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  }

  async searchSaleByReceipt(receiptNumber: string) {
    return this.request<any>(
      `/api/sales/search/receipt?receiptNumber=${encodeURIComponent(receiptNumber)}`,
    );
  }

  // ── Suppliers ─────────────────────────────────────────────────────────

  async getSuppliers(params?: { search?: string }) {
    const query = params?.search ? `?search=${params.search}` : '';
    return this.request<any[]>(`/api/suppliers${query}`);
  }

  async getSupplier(id: string) {
    return this.request<any>(`/api/suppliers/${id}`);
  }

  async createSupplier(data: any) {
    return this.request<any>('/api/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSupplier(id: string, data: any) {
    return this.request<any>(`/api/suppliers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteSupplier(id: string) {
    return this.request<void>(`/api/suppliers/${id}`, {
      method: 'DELETE',
    });
  }

  async setSupplierProducts(supplierId: string, productIds: string[]) {
    return this.request<any>(`/api/suppliers/${supplierId}/products`, {
      method: 'PUT',
      body: JSON.stringify({ productIds }),
    });
  }

  async getProductSuppliers(productId: string) {
    return this.request<any[]>(`/api/suppliers/product/${productId}`);
  }

  async setProductSuppliers(productId: string, supplierIds: string[]) {
    return this.request<any>(`/api/suppliers/product/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({ supplierIds }),
    });
  }

  // ── Purchase Orders ───────────────────────────────────────────────────

  async getPurchaseOrders(params?: { supplierId?: string; status?: string }) {
    const qs = new URLSearchParams();
    if (params?.supplierId) qs.set('supplierId', params.supplierId);
    if (params?.status) qs.set('status', params.status);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<any[]>(`/api/purchase-orders${query}`);
  }

  async getPurchaseOrder(id: string) {
    return this.request<any>(`/api/purchase-orders/${id}`);
  }

  async createPurchaseOrder(data: {
    supplierId: string;
    status?: 'DRAFT' | 'SENT';
    tax?: number;
    expectedDate?: string;
    notes?: string;
    items: { productId: string; qtyOrdered: number; unitCost: number }[];
  }) {
    return this.request<any>('/api/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Receive a PO. Omit `items` to receive every line in full; pass line-level
   * quantities for a partial receipt. `updateCost` rewrites product costPrice
   * from the PO unit cost.
   */
  async receivePurchaseOrder(
    id: string,
    data?: { items?: { poItemId: string; quantity: number }[]; updateCost?: boolean; notes?: string },
  ) {
    return this.request<any>(`/api/purchase-orders/${id}/receive`, {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    });
  }

  // ── Customers ─────────────────────────────────────────────────────────

  /** GET /api/customers — list/search. `search` matches name or phone. */
  async getCustomers(params?: { search?: string; hasBalance?: boolean }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.hasBalance) query.set('hasBalance', 'true');
    const qs = query.toString();
    return this.request<{ customers: Customer[]; totalOwed: number }>(
      `/api/customers${qs ? `?${qs}` : ''}`,
    );
  }

  /** GET /api/customers/:id — detail with recent credits + sales (purchase history). */
  async getCustomer(id: string) {
    return this.request<CustomerDetail>(`/api/customers/${id}`);
  }

  async createCustomer(data: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    creditLimit?: number;
  }) {
    return this.request<Customer>('/api/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /** PATCH /api/customers/:id — manager-only on the API. */
  async updateCustomer(
    id: string,
    data: Partial<{
      name: string;
      phone: string;
      email: string;
      address: string;
      creditLimit: number;
      isActive: boolean;
    }>,
  ) {
    return this.request<null>(`/api/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /** POST /api/customers/:id/credit — record a ledger entry (payment, manual adjustment, etc.). */
  async addCustomerCredit(
    id: string,
    data: {
      type: 'PURCHASE' | 'PAYMENT' | 'ADJUSTMENT' | 'REFUND';
      amount: number;
      note?: string;
      saleId?: string;
    },
  ) {
    return this.request<{ credit: CustomerCredit; newBalance: number }>(
      `/api/customers/${id}/credit`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
  }

  /**
   * POST /api/customers/:id/send-statement — WhatsApp (SMS fallback) the customer
   * their balance + recent ledger, or a short payment reminder. Manager-gated.
   */
  async sendCustomerStatement(id: string, data?: { reminder?: boolean }) {
    return this.request<{ channel: string; messageId: string; balance: number }>(
      `/api/customers/${id}/send-statement`,
      {
        method: 'POST',
        body: JSON.stringify(data ?? {}),
      },
    );
  }

  // ── Expenses ──────────────────────────────────────────────────────────

  /** GET /api/expenses — list (newest first), scoped to the caller's shop. */
  async listExpenses(params?: {
    page?: number;
    limit?: number;
    category?: ExpenseCategory | string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<ExpenseListResult>> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.category) query.set('category', String(params.category).toUpperCase());
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    const qs = query.toString();

    const res = await this.request<{
      expenses: ApiExpense[];
      totals: Record<string, number>;
      pagination: ExpenseListResult['pagination'];
    }>(`/api/expenses${qs ? `?${qs}` : ''}`);

    if (res.error || !res.data) return { error: res.error ?? 'Failed to load expenses', details: res.details };
    return {
      data: {
        expenses: (res.data.expenses || []).map(mapApiExpense),
        totals: res.data.totals || {},
        pagination: res.data.pagination,
      },
    };
  }

  /** GET /api/expenses/summary — this/last month totals + per-category breakdown. */
  async getExpenseSummary() {
    return this.request<ExpenseSummary>('/api/expenses/summary');
  }

  /** POST /api/expenses — manager-only on the API (managerAuth). */
  async createExpense(data: {
    category: ExpenseCategory | string;
    amount: number;
    description?: string;
    date?: string;
    receiptUrl?: string;
  }): Promise<ApiResponse<Expense>> {
    const res = await this.request<ApiExpense>('/api/expenses', {
      method: 'POST',
      body: JSON.stringify({ ...data, category: String(data.category).toUpperCase() }),
    });
    if (res.error || !res.data) return { error: res.error ?? 'Failed to record expense', details: res.details };
    return { data: mapApiExpense(res.data), message: res.message };
  }

  /** DELETE /api/expenses/:id — manager-only on the API (managerAuth). */
  async deleteExpense(id: string) {
    return this.request<null>(`/api/expenses/${id}`, { method: 'DELETE' });
  }

  // ── Billing / credits ─────────────────────────────────────────────────

  /** GET /api/billing/credit-packs — public catalog for the top-up UI. */
  async getCreditPacks() {
    return this.request<{ packs: CreditPack[] }>('/api/billing/credit-packs');
  }

  /** GET /api/billing/balance — the shop's current credit balance (YeboPay wallet). */
  async getBalance() {
    return this.request<CreditBalance>('/api/billing/balance');
  }

  /**
   * POST /api/billing/checkout — start a credit top-up. Pass either `packId`
   * OR `amount` (custom SZL, >=10). Returns a YeboPay-hosted checkout URL to
   * redirect to. The `idempotency-key` guards against double-charging on a
   * double-tap/retry.
   */
  async createTopUpCheckout(
    body: { packId?: string; amount?: number; successUrl?: string; cancelUrl?: string },
    idempotencyKey: string,
  ) {
    return this.request<TopUpCheckout>('/api/billing/checkout', {
      method: 'POST',
      headers: { 'idempotency-key': idempotencyKey },
      body: JSON.stringify(body),
    });
  }

  /**
   * POST /api/billing/checkout/confirm — called from the success page with the
   * checkoutId. Returns the latest balance so the UI can render
   * "+N credits, new balance X".
   */
  async confirmTopUp(checkoutId: string) {
    return this.request<TopUpConfirmResult>('/api/billing/checkout/confirm', {
      method: 'POST',
      body: JSON.stringify({ checkoutId }),
    });
  }

  // ── Email receipt ─────────────────────────────────────────────────────

  async sendReceiptEmail(data: {
    saleId: string;
    email: string;
    shopName: string;
    receiptNumber: string;
    items: any[];
    subtotal: number;
    discount: number;
    total: number;
    date: string;
  }) {
    return this.request<{ success: boolean }>('/api/sales/email-receipt', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();
export default api;
