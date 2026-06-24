import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Shop, Subscription } from '@/types';
import api from '@/api/client';
import { clearDatabase } from '@/lib/db';
import { useLocaleStore } from '@/stores/localeStore';
import { setCurrencyConfig } from '@/types';
import * as yeboid from '@/lib/yeboid';
import type { ShopBootstrap } from '@/lib/yeboid';

// Sync currency/locale from shop's country
function syncShopLocale(shop: Shop | null) {
  if (shop?.countryCode) {
    useLocaleStore.getState().setCountry(shop.countryCode);
    setCurrencyConfig(shop.currencySymbol || 'E', 2);
  }
}

let storeInitialized = false;

interface AuthState {
  user: User | null;
  shop: Shop | null;
  subscription: Subscription | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  /** 'owner' when YeboID-authed, 'staff' when PIN-authed, null when signed out. */
  authMode: 'owner' | 'staff' | null;

  /** Owner sign-in: full-page redirect to YeboID. Optionally stashes bootstrap fields for a first-time signup. */
  signInWithYeboID: (bootstrap?: ShopBootstrap) => Promise<void>;

  /**
   * Owner callback handler: takes the YeboID access_token (already obtained
   * by the AuthCallback page via PKCE code → token exchange) and hands it to
   * yebomart-api which looks up / creates the Shop keyed on the YeboID `sub`.
   */
  exchangeYeboidToken: (
    accessToken: string,
    bootstrap?: ShopBootstrap,
  ) => Promise<{ success: boolean; isNewShop?: boolean; error?: string }>;

  /** Staff PIN login (cashier signing in on a shop's POS device). */
  staffLogin: (phone: string, pin: string) => Promise<boolean>;

  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateShop: (updates: Partial<Shop>) => Promise<{ success: boolean; error?: string }>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => {
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
        authMode: null,

        signInWithYeboID: async (bootstrap) => {
          await yeboid.initiateLogin({ bootstrap });
        },

        exchangeYeboidToken: async (accessToken, bootstrap) => {
          const { data, error } = await api.exchangeYeboid(accessToken, bootstrap);
          if (error || !data) {
            return { success: false, error: error ?? 'Sign-in failed' };
          }
          set({
            user: null,
            shop: data.shop,
            isAuthenticated: true,
            isLoading: false,
            authMode: 'owner',
          });
          syncShopLocale(data.shop);
          return { success: true, isNewShop: data.isNewShop };
        },

        staffLogin: async (phone, pin) => {
          try {
            const { data, error } = await api.staffLogin(phone, pin);
            if (error || !data) return false;

            set({
              user: data.user,
              shop: data.shop,
              isAuthenticated: true,
              isLoading: false,
              authMode: 'staff',
            });
            syncShopLocale(data.shop);
            return true;
          } catch (err) {
            console.error('Staff login failed:', err);
            return false;
          }
        },

        logout: async () => {
          api.clearAllTokens();
          await clearDatabase();
          set({
            user: null,
            shop: null,
            subscription: null,
            isAuthenticated: false,
            authMode: null,
          });
        },

        loadUser: async () => {
          try {
            set({ isLoading: true });

            const staffToken = localStorage.getItem('yebomart_staff_token');
            const yeboidToken = await yeboid.getAccessToken();
            const hasToken = !!staffToken || !!yeboidToken;

            if (!hasToken) {
              set({ isLoading: false, isAuthenticated: false, authMode: null });
              return;
            }

            const { data, error } = await api.getMe();
            if (error || !data) {
              api.clearAllTokens();
              set({ isLoading: false, isAuthenticated: false, authMode: null });
              return;
            }

            set({
              user: data.user,
              shop: data.shop,
              subscription: data.subscription,
              isAuthenticated: true,
              isLoading: false,
              authMode: staffToken ? 'staff' : 'owner',
            });
            syncShopLocale(data.shop);
          } catch (err) {
            console.error('Failed to load user:', err);
            api.clearAllTokens();
            set({ isLoading: false, isAuthenticated: false, authMode: null });
          }
        },

        updateShop: async (updates: Partial<Shop>) => {
          const { shop } = get();
          if (!shop) return { success: false, error: 'No active shop' };

          // Persist to the API. Only on a real 2xx do we mutate local state —
          // never show success for a write that didn't reach the server.
          const { data, error } = await api.updateShop(shop.id, {
            name: updates.name,
            ownerName: updates.ownerName,
            assistantName: updates.assistantName,
            address: updates.address,
          });
          if (error || !data) {
            return { success: false, error: error ?? 'Failed to save shop settings' };
          }

          // Replace with the authoritative server record (it may derive fields
          // like currency from businessType/country).
          set({ shop: { ...shop, ...data } as Shop });
          syncShopLocale(get().shop);
          return { success: true };
        },
      };
    },
    {
      name: 'yebomart-auth',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        shop: state.shop,
        authMode: state.authMode,
      }),
    },
  ),
);
