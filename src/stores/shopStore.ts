import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Shop, UserShop, ShopRole } from '@/types';
import { getCountryByCode } from '@/lib/countries';
import api from '@/api/client';

export interface ShopWithRole extends Shop {
  userRole: ShopRole;
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
  businessType?: string;
  assistantName?: string;
  countryCode?: string;
}

function normalizeShop(raw: any, userRole: ShopRole): ShopWithRole {
  const country = getCountryByCode(raw.countryCode || 'SZ');
  return {
    ...raw,
    countryCode: raw.countryCode || 'SZ',
    currency: raw.currency || country?.currency || 'SZL',
    currencySymbol: raw.currencySymbol || country?.currencySymbol || 'E',
    phoneCountryCode: raw.phoneCountryCode || 'SZ',
    userRole,
  };
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
          // GET /api/shops is owner-only (YeboID-authed) — it 401s for a
          // staff PIN session or when signed out. That's the expected shape
          // for those, not a backend failure, so we fall back to the single
          // shop /api/auth/me already resolves for them.
          const { data: ownerShops, error: ownerShopsError } = await api.getShops();

          if (ownerShops) {
            const shopsWithRole = ownerShops.map((shop) => normalizeShop(shop, 'owner'));
            const { currentShopId: persisted } = get();
            const stillValid = persisted && shopsWithRole.some((s) => s.id === persisted);
            const active = stillValid
              ? shopsWithRole.find((s) => s.id === persisted)!
              : shopsWithRole[0] ?? null;

            if (active) api.setActiveShopId(active.id);
            set({
              shops: shopsWithRole,
              currentShopId: active?.id ?? null,
              currentShop: active,
              isLoading: false,
            });
            return;
          }

          const { data, error } = await api.getMe();
          if (error || !data?.shop) {
            set({ isLoading: false, error: ownerShopsError ?? error ?? 'Failed to load shops' });
            return;
          }

          const role: ShopRole = data.user ? 'staff' : 'owner';
          const shop = normalizeShop(data.shop, role);
          api.setActiveShopId(shop.id);
          set({
            shops: [shop],
            currentShopId: shop.id,
            currentShop: shop,
            isLoading: false,
          });
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
        const { data: created, error } = await api.createShop(data);
        if (error || !created) {
          const message = error || 'Failed to create shop';
          set({ isLoading: false, error: message });
          return { success: false, error: message };
        }

        const shop = normalizeShop(created, 'owner');
        set(state => ({
          shops: [...state.shops, shop],
          isLoading: false,
        }));
        // Switch to the new shop immediately — it's what the owner just set out to do.
        get().setCurrentShop(shop.id);

        return { success: true, shop };
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
        api.clearActiveShopId();
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
