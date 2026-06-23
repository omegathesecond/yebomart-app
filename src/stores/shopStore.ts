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
  ownerName: string;
  ownerPhone: string;
  phoneCountryCode: string;
  countryCode: string;
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
          // For now, load from the auth store's shop
          // In full implementation, this would call api.getShops()
          const { data, error } = await api.getMe();
          
          if (error || !data) {
            set({ isLoading: false, error: error || 'Failed to load shops' });
            return;
          }

          if (data.shop) {
            const shop = data.shop as Shop;
            const country = getCountryByCode(shop.countryCode || 'SZ');
            
            const shopWithRole: ShopWithRole = {
              ...shop,
              countryCode: shop.countryCode || 'SZ',
              currency: country?.currency || 'SZL',
              currencySymbol: country?.currencySymbol || 'E',
              phoneCountryCode: shop.phoneCountryCode || 'SZ',
              userRole: 'owner'
            };

            set({
              shops: [shopWithRole],
              currentShopId: shop.id,
              currentShop: shopWithRole,
              isLoading: false
            });
          } else {
            set({ shops: [], currentShopId: null, currentShop: null, isLoading: false });
          }
        } catch (err) {
          console.error('Failed to load shops:', err);
          set({ isLoading: false, error: 'Failed to load shops' });
        }
      },

      setCurrentShop: (shopId: string) => {
        const { shops } = get();
        const shop = shops.find(s => s.id === shopId);
        if (shop) {
          set({ currentShopId: shopId, currentShop: shop });
        }
      },

      createShop: async () => {
        // Multi-shop ownership is NOT supported yet. The backend keys each shop
        // to a single YeboID owner (Shop.ownerYeboidSub is @unique) and exposes
        // no createShop endpoint — adding a second shop needs a backend redesign
        // (owner↔shops relation + shop-switching on every authed request),
        // tracked as a future feature in the YeboID plan.
        //
        // Per the "fail loudly, never fake success" rule we surface this plainly
        // instead of returning a phantom in-memory shop that vanishes on reload.
        const error = 'Adding additional shops isn\'t available yet.';
        set({ isLoading: false, error });
        return { success: false, error };
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
