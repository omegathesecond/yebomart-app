import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Subscription tiers with pricing
export type SubscriptionTier = 'lite' | 'starter' | 'business' | 'pro' | 'enterprise';

export interface TierInfo {
  id: SubscriptionTier;
  name: string;
  price: number; // Monthly price in SZL
  description: string;
  color: string;
}

export const TIERS: Record<SubscriptionTier, TierInfo> = {
  lite: {
    id: 'lite',
    name: 'Lite',
    price: 499,
    description: 'Perfect for getting started',
    color: 'slate'
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 1499,
    description: 'For growing businesses',
    color: 'blue'
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 3999,
    description: 'Advanced insights & reports',
    color: 'purple'
  },
  pro: {
    id: 'pro',
    name: 'Professional',
    price: 7999,
    description: 'AI-powered automation',
    color: 'amber'
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 15999,
    description: 'Full platform access',
    color: 'emerald'
  }
};

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
  expiresAt: Date | null;
  
  // Actions
  setTier: (tier: SubscriptionTier) => void;
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
      expiresAt: null,

      setTier: (tier: SubscriptionTier) => {
        set({ currentTier: tier });
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
        currentTier: state.currentTier
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
