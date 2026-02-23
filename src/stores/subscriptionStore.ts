import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Subscription tiers with pricing
export type SubscriptionTier = 'lite' | 'starter' | 'business' | 'pro' | 'enterprise';

export interface TierInfo {
  id: SubscriptionTier;
  name: string;
  price: number; // Monthly price in local currency
  description: string;
  color: string;
}

// Country pricing matrix — revolutionary prices, cheapest POS+AI in Africa
export interface CountryPricingInfo {
  currency: string;
  currencySymbol: string;
  tiers: { lite: number; starter: number; business: number; pro: number; enterprise: number };
}

export const COUNTRY_PRICING: Record<string, CountryPricingInfo> = {
  SZ: { currency: 'SZL', currencySymbol: 'E', tiers: { lite: 299, starter: 899, business: 2499, pro: 4999, enterprise: 9999 } },
  ZA: { currency: 'ZAR', currencySymbol: 'R', tiers: { lite: 399, starter: 1299, business: 3499, pro: 6999, enterprise: 13999 } },
  KE: { currency: 'KES', currencySymbol: 'KSh', tiers: { lite: 2499, starter: 7499, business: 19999, pro: 39999, enterprise: 79999 } },
  NG: { currency: 'NGN', currencySymbol: '₦', tiers: { lite: 24999, starter: 74999, business: 199999, pro: 399999, enterprise: 799999 } },
  GH: { currency: 'GHS', currencySymbol: 'GH₵', tiers: { lite: 349, starter: 999, business: 2699, pro: 5499, enterprise: 10999 } },
  TZ: { currency: 'TZS', currencySymbol: 'TSh', tiers: { lite: 29999, starter: 89999, business: 249999, pro: 499999, enterprise: 999999 } },
  UG: { currency: 'UGX', currencySymbol: 'USh', tiers: { lite: 59999, starter: 179999, business: 499999, pro: 999999, enterprise: 1999999 } },
  RW: { currency: 'RWF', currencySymbol: 'FRw', tiers: { lite: 14999, starter: 44999, business: 124999, pro: 249999, enterprise: 499999 } },
  ET: { currency: 'ETB', currencySymbol: 'Br', tiers: { lite: 1499, starter: 4499, business: 12499, pro: 24999, enterprise: 49999 } },
  CI: { currency: 'XOF', currencySymbol: 'CFA', tiers: { lite: 9999, starter: 29999, business: 84999, pro: 169999, enterprise: 339999 } },
  SN: { currency: 'XOF', currencySymbol: 'CFA', tiers: { lite: 7999, starter: 24999, business: 64999, pro: 129999, enterprise: 259999 } },
  ZM: { currency: 'ZMW', currencySymbol: 'ZK', tiers: { lite: 299, starter: 899, business: 2499, pro: 4999, enterprise: 9999 } },
  ZW: { currency: 'USD', currencySymbol: '$', tiers: { lite: 9, starter: 29, business: 79, pro: 149, enterprise: 299 } },
  BW: { currency: 'BWP', currencySymbol: 'P', tiers: { lite: 549, starter: 1699, business: 4499, pro: 8999, enterprise: 17999 } },
  MZ: { currency: 'MZN', currencySymbol: 'MT', tiers: { lite: 299, starter: 899, business: 2499, pro: 4999, enterprise: 9999 } },
};

function getPricingForCountry(countryCode: string): CountryPricingInfo {
  return COUNTRY_PRICING[countryCode] || COUNTRY_PRICING['SZ'];
}

function buildTiers(countryCode: string): Record<SubscriptionTier, TierInfo> {
  const pricing = getPricingForCountry(countryCode);
  return {
    lite: { id: 'lite', name: 'Lite', price: pricing.tiers.lite, description: 'Perfect for getting started', color: 'slate' },
    starter: { id: 'starter', name: 'Starter', price: pricing.tiers.starter, description: 'For growing businesses', color: 'blue' },
    business: { id: 'business', name: 'Business', price: pricing.tiers.business, description: 'Advanced insights & reports', color: 'purple' },
    pro: { id: 'pro', name: 'Professional', price: pricing.tiers.pro, description: 'AI-powered automation', color: 'amber' },
    enterprise: { id: 'enterprise', name: 'Enterprise', price: pricing.tiers.enterprise, description: 'Full platform access', color: 'emerald' },
  };
}

// Default TIERS (Eswatini) — will be overridden by country selection
export let TIERS: Record<SubscriptionTier, TierInfo> = buildTiers('SZ');

export function formatPriceForCountry(amount: number, countryCode: string): string {
  const pricing = getPricingForCountry(countryCode);
  return `${pricing.currencySymbol}${amount.toLocaleString()}`;
}

// Feature definitions with minimum tier required
export type Feature = 
  | 'pos'
  | 'stock_management'
  | 'basic_reports'
  | 'barcode_scanning'
  | 'low_stock_alerts'
  | 'staff_accounts'
  | 'whatsapp_reports'
  | 'advanced_reports'
  | 'ai_assistant'
  | 'multi_location'
  | 'accounting_module'
  | 'api_access'
  | 'dedicated_support';

export interface FeatureInfo {
  id: Feature;
  name: string;
  description: string;
  minTier: SubscriptionTier;
  icon?: string;
}

export const FEATURES: Record<Feature, FeatureInfo> = {
  // Lite features (base tier)
  pos: {
    id: 'pos',
    name: 'Point of Sale',
    description: 'Process sales quickly',
    minTier: 'lite'
  },
  stock_management: {
    id: 'stock_management',
    name: 'Stock Management',
    description: 'Track inventory levels',
    minTier: 'lite'
  },
  basic_reports: {
    id: 'basic_reports',
    name: 'Basic Reports',
    description: 'Daily sales summaries',
    minTier: 'lite'
  },
  
  // Starter features
  barcode_scanning: {
    id: 'barcode_scanning',
    name: 'Barcode Scanning',
    description: 'Scan products for quick lookup',
    minTier: 'starter'
  },
  low_stock_alerts: {
    id: 'low_stock_alerts',
    name: 'Low Stock Alerts',
    description: 'Get notified when stock is low',
    minTier: 'starter'
  },
  staff_accounts: {
    id: 'staff_accounts',
    name: 'Staff Accounts',
    description: 'Add team members with roles',
    minTier: 'starter'
  },
  
  // Business features
  whatsapp_reports: {
    id: 'whatsapp_reports',
    name: 'WhatsApp Reports',
    description: 'Daily reports via WhatsApp',
    minTier: 'business'
  },
  advanced_reports: {
    id: 'advanced_reports',
    name: 'Advanced Reports',
    description: 'Detailed analytics & trends',
    minTier: 'business'
  },
  
  // Professional features
  ai_assistant: {
    id: 'ai_assistant',
    name: 'AI Assistant',
    description: 'Smart business insights',
    minTier: 'pro'
  },
  multi_location: {
    id: 'multi_location',
    name: 'Multi-Location',
    description: 'Manage multiple stores',
    minTier: 'pro'
  },
  accounting_module: {
    id: 'accounting_module',
    name: 'Accounting Module',
    description: 'Full financial tracking',
    minTier: 'pro'
  },
  
  // Enterprise features
  api_access: {
    id: 'api_access',
    name: 'API Access',
    description: 'Integrate with other systems',
    minTier: 'enterprise'
  },
  dedicated_support: {
    id: 'dedicated_support',
    name: 'Dedicated Support',
    description: 'Priority assistance',
    minTier: 'enterprise'
  }
};

// Tier hierarchy for comparison
const TIER_ORDER: SubscriptionTier[] = ['lite', 'starter', 'business', 'pro', 'enterprise'];

export function getTierLevel(tier: SubscriptionTier): number {
  return TIER_ORDER.indexOf(tier);
}

export function hasMinTier(currentTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  return getTierLevel(currentTier) >= getTierLevel(requiredTier);
}

interface SubscriptionState {
  currentTier: SubscriptionTier;
  countryCode: string;
  expiresAt: Date | null;
  
  // Actions
  setTier: (tier: SubscriptionTier) => void;
  setCountry: (code: string) => void;
  hasFeature: (feature: Feature) => boolean;
  getMinTierForFeature: (feature: Feature) => SubscriptionTier;
  getUpgradeTier: (feature: Feature) => SubscriptionTier | null;
  canAccessRoute: (route: string) => boolean;
}

// Map routes to required features
const ROUTE_FEATURES: Record<string, Feature> = {
  '/app/assistant': 'ai_assistant',
  '/app/staff': 'staff_accounts',
  '/app/reports/advanced': 'advanced_reports',
  '/app/locations': 'multi_location',
  '/app/accounting': 'accounting_module'
};

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      // Default to lite for testing - can be changed via localStorage
      currentTier: 'lite' as SubscriptionTier,
      countryCode: 'SZ',
      expiresAt: null,

      setTier: (tier: SubscriptionTier) => {
        set({ currentTier: tier });
      },

      setCountry: (code: string) => {
        const pricing = getPricingForCountry(code);
        if (pricing) {
          TIERS = buildTiers(code);
          set({ countryCode: code });
        }
      },

      hasFeature: (feature: Feature): boolean => {
        const { currentTier } = get();
        const featureInfo = FEATURES[feature];
        if (!featureInfo) return false;
        return hasMinTier(currentTier, featureInfo.minTier);
      },

      getMinTierForFeature: (feature: Feature): SubscriptionTier => {
        return FEATURES[feature]?.minTier ?? 'enterprise';
      },

      getUpgradeTier: (feature: Feature): SubscriptionTier | null => {
        const { currentTier, hasFeature } = get();
        if (hasFeature(feature)) return null;
        
        const requiredTier = FEATURES[feature]?.minTier;
        if (!requiredTier) return null;
        
        // Return the next tier that has this feature
        const currentLevel = getTierLevel(currentTier);
        const requiredLevel = getTierLevel(requiredTier);
        
        if (requiredLevel > currentLevel) {
          return requiredTier;
        }
        return null;
      },

      canAccessRoute: (route: string): boolean => {
        const feature = ROUTE_FEATURES[route];
        if (!feature) return true; // Routes without mapping are accessible
        return get().hasFeature(feature);
      }
    }),
    {
      name: 'yebomart-subscription',
      partialize: (state) => ({
        currentTier: state.currentTier,
        countryCode: state.countryCode
      })
    }
  )
);

// Hook for easy feature checking
export function useFeature(feature: Feature) {
  const { hasFeature, getUpgradeTier, currentTier } = useSubscriptionStore();
  
  const isAvailable = hasFeature(feature);
  const upgradeTier = getUpgradeTier(feature);
  const featureInfo = FEATURES[feature];
  
  return {
    isAvailable,
    upgradeTier,
    featureInfo,
    currentTier,
    requiredTier: featureInfo?.minTier
  };
}
