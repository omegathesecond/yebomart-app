import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Shop, Subscription } from '@/types';
import api from '@/api/client';

// Flag to prevent circular dependency issues
let storeInitialized = false;

interface AuthState {
  user: User | null;
  shop: Shop | null;
  subscription: Subscription | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  login: (phone: string, password: string) => Promise<boolean>;
  staffLogin: (phone: string, pin: string) => Promise<boolean>;
  logout: () => void;
  register: (data: { shopName: string; ownerName: string; phone: string; password: string }) => Promise<boolean>;
  loadUser: () => Promise<void>;
  updateShop: (updates: Partial<Shop>) => Promise<void>;
  setupShop: (data: { shopName: string; ownerName: string; ownerPhone: string; pin: string; assistantName: string; businessType?: string }) => Promise<{ success: boolean; error?: string }>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => {
      // Register session expired callback once store is created
      if (!storeInitialized) {
        storeInitialized = true;
        api.setSessionExpiredCallback(() => {
          console.log('[AuthStore] Session expired callback triggered');
          get().logout();
        });
      }

      return {
      user: null,
      shop: null,
      subscription: null,
      isAuthenticated: false,
      isLoading: true,

      login: async (phone: string, password: string) => {
        try {
          const { data, error } = await api.login(phone, password);
          
          if (error || !data) {
            return false;
          }

          api.setToken(data.token);
          
          set({ 
            user: data.user, 
            shop: data.shop,
            isAuthenticated: true, 
            isLoading: false 
          });
          
          return true;
        } catch (error) {
          console.error('Login failed:', error);
          return false;
        }
      },

      staffLogin: async (phone: string, pin: string) => {
        try {
          // Staff login with phone + PIN
          const { data, error } = await api.staffLogin(phone, pin);
          
          if (error || !data) {
            return false;
          }
          
          set({ 
            user: data.user, 
            shop: data.shop,
            isAuthenticated: true, 
            isLoading: false 
          });
          
          return true;
        } catch (error) {
          console.error('Staff login failed:', error);
          return false;
        }
      },

      register: async (data) => {
        try {
          const { data: result, error } = await api.register(data);
          
          if (error || !result) {
            return false;
          }

          api.setToken(result.token);
          
          set({ 
            user: result.user, 
            shop: result.shop,
            isAuthenticated: true, 
            isLoading: false 
          });
          
          return true;
        } catch (error) {
          console.error('Registration failed:', error);
          return false;
        }
      },

      logout: () => {
        api.clearToken();
        set({ 
          user: null, 
          shop: null,
          subscription: null,
          isAuthenticated: false 
        });
      },

      loadUser: async () => {
        try {
          set({ isLoading: true });
          
          const token = api.getToken();
          if (!token) {
            set({ isLoading: false, isAuthenticated: false });
            return;
          }

          // Ensure token is valid before making request
          const hasValidToken = await api.ensureValidToken();
          if (!hasValidToken) {
            api.clearToken();
            set({ isLoading: false, isAuthenticated: false });
            return;
          }

          // Verify token by getting user info
          const { data, error } = await api.getMe();
          
          if (error || !data) {
            // The request method already handles token refresh on 401
            // If we still got an error, the session is truly invalid
            api.clearToken();
            set({ isLoading: false, isAuthenticated: false });
            return;
          }

          set({
            user: data.user,
            shop: data.shop,
            subscription: data.subscription,
            isAuthenticated: true,
            isLoading: false
          });
        } catch (error) {
          console.error('Failed to load user:', error);
          api.clearToken();
          set({ isLoading: false, isAuthenticated: false });
        }
      },

      updateShop: async (updates: Partial<Shop>) => {
        const { shop } = get();
        if (!shop) return;
        
        // Optimistic update
        set({ shop: { ...shop, ...updates } as Shop });
        
        // TODO: Call API to persist
        // await api.updateShop(updates);
      },

      setupShop: async (data) => {
        try {
          const { data: result, error } = await api.register({
            shopName: data.shopName,
            ownerName: data.ownerName,
            phone: data.ownerPhone,
            password: data.pin,
            assistantName: data.assistantName,
            businessType: data.businessType
          });
          
          if (error || !result) {
            return { success: false, error: error || 'Registration failed' };
          }

          api.setToken(result.token);
          
          set({
            shop: result.shop,
            user: result.user,
            isAuthenticated: true,
            isLoading: false
          });

          return { success: true };
        } catch (error) {
          console.error('Shop setup failed:', error);
          return { success: false, error: 'Something went wrong. Please try again.' };
        }
      }
    }},
    {
      name: 'yebomart-auth',
      partialize: (state) => ({ 
        isAuthenticated: state.isAuthenticated 
      })
    }
  )
);
