// YeboMart API Client
const API_URL = import.meta.env.VITE_API_URL || 'https://api.yebomart.com';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('yebomart_token', token);
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('yebomart_token');
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('yebomart_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
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

      const data = await response.json();

      if (!response.ok) {
        return { error: data.message || 'Request failed' };
      }

      return { data };
    } catch (error) {
      return { error: 'Network error. Please try again.' };
    }
  }

  // Auth
  async login(phone: string, password: string) {
    const response = await this.request<{ success: boolean; data: { accessToken: string; refreshToken: string; shop: any; user?: any }; message: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    });
    
    // Normalize response to expected format
    // API returns: { success, data: { shop, accessToken, refreshToken }, message }
    if (response.data?.success && response.data?.data) {
      const apiData = response.data.data;
      return {
        data: {
          token: apiData.accessToken,
          user: apiData.user || { id: apiData.shop.id, phone, role: 'OWNER' },
          shop: apiData.shop,
        }
      };
    }
    return { error: response.data?.message || response.error || 'Login failed' };
  }

  async register(data: { shopName: string; ownerName: string; phone: string; password: string; assistantName?: string }) {
    // Map to API expected field names
    const payload = {
      name: data.shopName,
      ownerName: data.ownerName,
      ownerPhone: data.phone.startsWith('+') ? data.phone : `+268${data.phone.replace(/^0/, '')}`,
      password: data.password,
      assistantName: data.assistantName,
    };
    const response = await this.request<{ success: boolean; data: { accessToken: string; refreshToken: string; shop: any }; message: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    
    // Normalize response to expected format
    // API returns: { success, data: { shop, accessToken, refreshToken }, message }
    if (response.data?.success && response.data?.data) {
      const apiData = response.data.data;
      return {
        data: {
          token: apiData.accessToken,
          user: { id: apiData.shop.id, phone: data.phone, role: 'OWNER' },
          shop: apiData.shop,
        }
      };
    }
    return { error: response.data?.message || response.error || 'Registration failed' };
  }

  // Products
  async getProducts() {
    return this.request<any[]>('/api/products');
  }

  async createProduct(data: any) {
    return this.request<any>('/api/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProduct(id: string, data: any) {
    return this.request<any>(`/api/products/${id}`, {
      method: 'PUT',
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

  async createSale(data: { items: any[]; paymentMethod: string; amountPaid: number }) {
    return this.request<any>('/api/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Stock
  async adjustStock(productId: string, data: { type: string; quantity: number; note?: string }) {
    return this.request<any>(`/api/stock/${productId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getStockLogs(productId?: string) {
    const endpoint = productId ? `/api/stock/logs/${productId}` : '/api/stock/logs';
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
    return this.request<{ response: string; suggestions?: string[] }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, context }),
    });
  }

  async getInsights() {
    return this.request<{ insights: string[]; alerts: any[] }>('/api/ai/insights');
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
}

export const api = new ApiClient();
export default api;
