// YeboMart API Client
const API_URL = import.meta.env.VITE_API_URL || 'https://api.yebomart.com';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  details?: any; // validation errors, field-specific errors
}

class ApiClient {
  private token: string | null = null;
  private refreshToken: string | null = null;

  setToken(token: string, refresh?: string) {
    this.token = token;
    localStorage.setItem('yebomart_token', token);
    if (refresh) {
      this.refreshToken = refresh;
      localStorage.setItem('yebomart_refresh_token', refresh);
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('yebomart_token');
    }
    return this.token;
  }

  // Check if token is expired or about to expire (within 5 minutes)
  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresAt = payload.exp * 1000; // Convert to milliseconds
      const fiveMinutes = 5 * 60 * 1000;
      return Date.now() > expiresAt - fiveMinutes;
    } catch {
      return true;
    }
  }

  // Proactively refresh token if it's about to expire
  async ensureValidToken(): Promise<boolean> {
    const token = this.getToken();
    console.log('[ApiClient] ensureValidToken called, hasToken:', !!token);
    if (!token) return false;
    
    const expired = this.isTokenExpired();
    console.log('[ApiClient] isTokenExpired:', expired);
    if (expired) {
      return this.tryRefreshToken();
    }
    return true;
  }

  getRefreshToken(): string | null {
    if (!this.refreshToken) {
      this.refreshToken = localStorage.getItem('yebomart_refresh_token');
    }
    return this.refreshToken;
  }

  private onSessionExpired: (() => void) | null = null;

  // Register callback for session expiration (called by authStore)
  setSessionExpiredCallback(callback: () => void) {
    this.onSessionExpired = callback;
  }

  clearToken() {
    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem('yebomart_token');
    localStorage.removeItem('yebomart_refresh_token');
  }

  // Force logout and redirect
  forceLogout() {
    console.log('[ApiClient] forceLogout called');
    console.trace('[ApiClient] forceLogout stack trace');
    this.clearToken();
    if (this.onSessionExpired) {
      this.onSessionExpired();
    }
  }

  // Refresh the access token using refresh token
  async refreshAccessToken(): Promise<boolean> {
    const refresh = this.getRefreshToken();
    console.log('[ApiClient] refreshAccessToken called, hasRefreshToken:', !!refresh);
    if (!refresh) return false;

    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh })
      });
      
      const json = await response.json();
      console.log('[ApiClient] refresh response:', json.success);
      if (json.success && json.data?.accessToken) {
        this.setToken(json.data.accessToken, json.data.refreshToken);
        return true;
      }
    } catch (e) {
      console.error('[ApiClient] Token refresh failed:', e);
    }
    return false;
  }

  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false
  ): Promise<ApiResponse<T>> {
    const url = `${API_URL}${endpoint}`;
    const token = this.getToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const json = await response.json();

      // Handle 401 Unauthorized - try to refresh token
      if (response.status === 401 && !isRetry && !endpoint.includes('/auth/')) {
        const refreshed = await this.tryRefreshToken();
        if (refreshed) {
          // Retry the original request with new token
          return this.request<T>(endpoint, options, true);
        }
        // Refresh failed - force logout and redirect
        this.forceLogout();
        return { error: 'Session expired. Please login again.' };
      }

      if (!response.ok || json.success === false) {
        // Handle validation errors with details
        const errorMessage = json.message || json.error || 'Request failed';
        const details = json.details || json.errors;
        return { 
          error: errorMessage,
          details 
        };
      }

      // API returns { success, data, message } - unwrap the data
      return { data: json.data ?? json, message: json.message };
    } catch (error) {
      return { error: 'Network error. Please try again.' };
    }
  }

  // Prevent multiple simultaneous refresh attempts
  private async tryRefreshToken(): Promise<boolean> {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.refreshAccessToken();
    
    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  // Auth
  async login(phone: string, password: string) {
    const response = await this.request<{ accessToken: string; refreshToken: string; shop: any; user?: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    });
    
    if (response.data) {
      // Store both tokens
      this.setToken(response.data.accessToken, response.data.refreshToken);
      
      return {
        data: {
          token: response.data.accessToken,
          user: response.data.user || { 
            id: response.data.shop.id, 
            shopId: response.data.shop.id,
            name: response.data.shop.ownerName || '',
            phone, 
            pin: '',
            role: 'owner' as const,
            isActive: true,
            createdAt: new Date()
          },
          shop: response.data.shop,
        }
      };
    }
    return { error: response.error || 'Login failed', details: response.details };
  }

  // Staff login with phone + PIN
  async staffLogin(phone: string, pin: string) {
    const response = await this.request<{ accessToken: string; refreshToken: string; shop: any; user: any }>('/api/auth/login/user', {
      method: 'POST',
      body: JSON.stringify({ phone, pin }),
    });
    
    if (response.data) {
      // Store both tokens
      this.setToken(response.data.accessToken, response.data.refreshToken);
      
      return {
        data: {
          token: response.data.accessToken,
          user: {
            id: response.data.user.id,
            shopId: response.data.shop.id,
            name: response.data.user.name,
            phone: response.data.user.phone,
            pin: '',
            role: response.data.user.role?.toLowerCase() as 'owner' | 'manager' | 'cashier',
            isActive: true,
            createdAt: new Date()
          },
          shop: response.data.shop,
        }
      };
    }
    return { error: response.error || 'Login failed', details: response.details };
  }

  async register(data: { shopName: string; ownerName: string; phone: string; password: string; assistantName?: string; businessType?: string }) {
    // Map to API expected field names
    const payload = {
      name: data.shopName,
      ownerName: data.ownerName,
      ownerPhone: data.phone.startsWith('+') ? data.phone : `+268${data.phone.replace(/^0/, '')}`,
      password: data.password,
      assistantName: data.assistantName,
      businessType: data.businessType || 'general',
    };
    const response = await this.request<{ accessToken: string; refreshToken: string; shop: any }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    
    if (response.data) {
      // Store both tokens
      this.setToken(response.data.accessToken, response.data.refreshToken);
      
      return {
        data: {
          token: response.data.accessToken,
          user: { 
            id: response.data.shop.id, 
            shopId: response.data.shop.id,
            name: data.ownerName,
            phone: data.phone, 
            pin: '',
            role: 'owner' as const,
            isActive: true,
            createdAt: new Date()
          },
          shop: response.data.shop,
        }
      };
    }
    return { error: response.error || 'Registration failed', details: response.details };
  }

  // Products
  async getProducts(params?: { page?: number; limit?: number }) {
    const query = params ? `?page=${params.page || 1}&limit=${params.limit || 20}` : '';
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

  // Bulk operations
  async bulkImportProducts(products: any[], updateExisting = false) {
    return this.request<{ created: number; updated: number; skipped: number; errors: any[] }>(
      '/api/products/bulk/import',
      {
        method: 'POST',
        body: JSON.stringify({ products, updateExisting }),
      }
    );
  }

  async bulkUpdateProducts(updates: any[]) {
    return this.request<{ updated: number; failed: number; errors: any[] }>(
      '/api/products/bulk/update',
      {
        method: 'POST',
        body: JSON.stringify({ updates }),
      }
    );
  }

  async exportProducts() {
    const response = await fetch(`${this.getBaseUrl()}/api/products/export`, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
    });
    return response.text();
  }

  private getBaseUrl() {
    return API_URL;
  }

  // Sales
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
  }) {
    return this.request<any>('/api/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Stock
  async adjustStock(productId: string, data: { type: string; quantity: number; note?: string }) {
    return this.request<any>('/api/stock/adjust', {
      method: 'POST',
      body: JSON.stringify({ productId, ...data }),
    });
  }

  async receiveStock(productId: string, data: { quantity: number; note?: string; costPrice?: number }) {
    return this.request<any>('/api/stock/receive', {
      method: 'POST',
      body: JSON.stringify({ productId, ...data }),
    });
  }

  async getStockLogs(productId?: string) {
    const endpoint = productId ? `/api/stock/movements?productId=${productId}` : '/api/stock/movements';
    return this.request<any[]>(endpoint);
  }

  // Reports
  async getDailyReport(date?: string) {
    const query = date ? `?date=${date}` : '';
    return this.request<any>(`/api/reports/daily${query}`);
  }

  async getSalesReport(startDate: string, endDate: string) {
    return this.request<any>(`/api/reports/sales?startDate=${startDate}&endDate=${endDate}`);
  }

  // AI Assistant
  async chat(message: string, context?: any) {
    return this.request<{ response?: string; message?: string; suggestions?: string[]; assistantName?: string }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, context }),
    });
  }

  async getInsights() {
    return this.request<{ insights: string[]; alerts: any[] }>('/api/ai/insights');
  }

  // Staff/Users
  async getStaff() {
    const result = await this.request<any[]>('/api/users');
    console.log('[API] getStaff result:', result);
    return result;
  }

  async getStaffDetail(userId: string, days: number = 30) {
    return this.request<any>(`/api/users/${userId}/detail?days=${days}`);
  }

  async createStaff(data: { name: string; phone: string; pin: string; role: string }) {
    return this.request<any>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateStaff(id: string, data: Partial<{ name: string; phone: string; pin: string; role: string; isActive: boolean }>) {
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

  // Get current user info
  async getMe() {
    return this.request<{ user: any; shop: any; subscription: any }>('/api/auth/me');
  }

  // License
  async getLicenseStatus() {
    return this.request<any>('/api/license/status');
  }

  async applyLicense(licenseKey: string) {
    return this.request<any>('/api/license/validate', {
      method: 'POST',
      body: JSON.stringify({ licenseKey }),
    });
  }

  async startTrial() {
    return this.request<any>('/api/license/trial', {
      method: 'POST',
    });
  }

  // Health
  async health() {
    return this.request<any>('/health');
  }

  // Returns
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

  // Search sale by receipt number (for returns)
  async searchSaleByReceipt(receiptNumber: string) {
    return this.request<any>(`/api/sales/search/receipt?receiptNumber=${encodeURIComponent(receiptNumber)}`);
  }

  // Suppliers
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

  // Supplier-Product linking
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

  // Email receipt
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
