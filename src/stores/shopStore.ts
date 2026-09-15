import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Shop, UserShop, ShopRole } from '@/types';
import { getCountryByCode } from '@/lib/countries';
import api from '@/api/client';
import { useAuthStore } from '@/stores/authStore';

export interface ShopWithRole extends Shop {
  userRole: ShopRole;
}

function toShopWithRole(shop: Shop, userRole: ShopRole): ShopWithRole {
  const country = getCountryByCode(shop.countryCode || 'SZ');
  return {
    ...shop,
    countryCode: shop.countryCode || 'SZ',
    currency: shop.currency || country?.currency || 'SZL',
    currencySymbol: shop.currencySymbol || country?.currencySymbol || 'E',
    phoneCountryCode: shop.phoneCountryCode || 'SZ',
    userRole,
  };
}

interface ShopState {
  shops: ShopWithRole[];
  currentShopId: string | null;
  currentShop: ShopWithRole | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadShops: () => Promise<void>;
  setCurrentShop: (shopId: string) => void;
  createShop: (data: CreateShopData) => Promise<{ success: boolean; shop?: Shop; error?: string }>;
  updateShop: (shopId: string, updates: Partial<Shop>) => Promise<void>;
  clearShops: () => void;
  
  // Helpers
  getShopCurrency: () => { symbol: string; code: string };
  formatCurrency: (amount: number) => string;
}

export interface CreateShopData {
  name: string;
  businessType: string;
  assistantName?: string;
}

export const useShopStore = create<ShopState>()(
  persist(
    (set, get) => ({
      shops: [],
      currentShopId: null,
      currentShop: null,
      isLoading: false,
      error: null,

      loadShops: async () => {
        set({ isLoading: true, error: null });
        try {
          const authMode = useAuthStore.getState().authMode;

          if (authMode === 'staff') {
            // Staff PIN sessions carry no YeboID identity to list shops with
            // (GET /api/shops is owner-only) — they're pinned to the single
            // shop their token was issued for, resolved via /api/auth/me.
            const { data, error } = await api.getMe();
            if (error || !data?.shop) {
              set({ isLoading: false, error: error || 'Failed to load shop' });
              return;
            }
            const shopWithRole = toShopWithRole(data.shop as Shop, 'staff');
            set({
              shops: [shopWithRole],
              currentShopId: shopWithRole.id,
              currentShop: shopWithRole,
              isLoading: false,
            });
            return;
          }

          // Owner (YeboID): every shop this owner has, oldest first.
          const { data, error } = await api.getShops();
          if (error || !data) {
            set({ isLoading: false, error: error || 'Failed to load shops' });
            return;
          }

          if (data.length === 0) {
            set({ shops: [], currentShopId: null, currentShop: null, isLoading: false });
            return;
          }

          const shopsWithRole = data.map((s) => toShopWithRole(s as Shop, 'owner'));

          // Keep the previously-active shop selected if it's still in the
          // list, else default to the oldest — the same default the API
          // itself uses when no X-Shop-Id header is sent, so single-shop
          // owners (and a fresh load with nothing persisted yet) land on the
          // right shop without an extra round trip. api.getActiveShopId()
          // (the actual X-Shop-Id source of truth) takes priority over the
          // zustand-persisted id — it's what a just-created/just-switched
          // shop is set through, ahead of this store's own state catching up.
          const persistedId = api.getActiveShopId() ?? get().currentShopId;
          const active = shopsWithRole.find((s) => s.id === persistedId) ?? shopsWithRole[0];

          set({
            shops: shopsWithRole,
            currentShopId: active.id,
            currentShop: active,
            isLoading: false,
          });
          api.setActiveShopId(active.id);
        } catch (err) {
          console.error('Failed to load shops:', err);
          set({ isLoading: false, error: 'Failed to load shops' });
        }
      },

      setCurrentShop: (shopId: string) => {
        const { shops } = get();
        const shop = shops.find(s => s.id === shopId);
        if (shop) {
          api.setActiveShopId(shopId);
          set({ currentShopId: shopId, currentShop: shop });
        }
      },

      createShop: async (data: CreateShopData) => {
        set({ isLoading: true, error: null });
        try {
          const { data: created, error } = await api.createShop({
            shopName: data.name,
            businessType: data.businessType,
            assistantName: data.assistantName,
          });
          if (error || !created) {
            const message = error || 'Failed to create shop';
            set({ isLoading: false, error: message });
            return { success: false, error: message };
          }
          set({ isLoading: false });
          return { success: true, shop: created as Shop };
        } catch (err) {
          console.error('Failed to create shop:', err);
          const message = 'Failed to create shop';
          set({ isLoading: false, error: message });
          return { success: false, error: message };
        }
      },

      updateShop: async (shopId: string, updates: Partial<Shop>) => {
        set({ isLoading: true, error: null });
        try {
          // Update country-derived fields if country changed
          if (updates.countryCode) {
            const country = getCountryByCode(updates.countryCode);
            if (country) {
              updates.currency = country.currency;
              updates.currencySymbol = country.currencySymbol;
            }
          }

          // In production: await api.updateShop(shopId, updates);
          
          set(state => ({
            shops: state.shops.map(s => 
              s.id === shopId ? { ...s, ...updates, updatedAt: new Date() } : s
            ),
            currentShop: state.currentShop?.id === shopId 
              ? { ...state.currentShop, ...updates, updatedAt: new Date() }
              : state.currentShop,
            isLoading: false
          }));
        } catch (err) {
          console.error('Failed to update shop:', err);
          set({ isLoading: false, error: 'Failed to update shop' });
        }
      },

      clearShops: () => {
        set({
          shops: [],
          currentShopId: null,
          currentShop: null,
          isLoading: false,
          error: null
        });
      },

      getShopCurrency: () => {
        const { currentShop } = get();
        return {
          symbol: currentShop?.currencySymbol || 'E',
          code: currentShop?.currency || 'SZL'
        };
      },

      formatCurrency: (amount: number) => {
        const { currentShop } = get();
        const symbol = currentShop?.currencySymbol || 'E';
        const country = currentShop?.countryCode 
          ? getCountryByCode(currentShop.countryCode) 
          : null;
        const decimals = country?.decimalPlaces ?? 2;

        return `${symbol}${amount.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        })}`;
      }
    }),
    {
      name: 'yebomart-shops',
      partialize: (state) => ({
        currentShopId: state.currentShopId
      })
    }
  )
);
