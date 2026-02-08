import { type ReactNode } from 'react';
import { 
  useFeature, 
  type Feature, 
  type SubscriptionTier 
} from '@/stores/subscriptionStore';
import { UpgradePrompt } from './UpgradePrompt';

interface FeatureGateProps {
  feature: Feature;
  children: ReactNode;
  /** What to show when feature is locked */
  fallback?: 'prompt' | 'hidden' | ReactNode;
  /** Prompt variant when using 'prompt' fallback */
  promptVariant?: 'inline' | 'card' | 'fullpage';
  /** Custom upgrade handler */
  onUpgradeClick?: () => void;
}

/**
 * FeatureGate - Conditionally renders children based on subscription tier
 * 
 * Usage:
 * <FeatureGate feature="ai_assistant">
 *   <AIChat />
 * </FeatureGate>
 * 
 * Or with custom fallback:
 * <FeatureGate feature="barcode_scanning" fallback="hidden">
 *   <BarcodeButton />
 * </FeatureGate>
 */
export function FeatureGate({ 
  feature, 
  children, 
  fallback = 'prompt',
  promptVariant = 'card',
  onUpgradeClick
}: FeatureGateProps) {
  const { isAvailable, requiredTier } = useFeature(feature);

  if (isAvailable) {
    return <>{children}</>;
  }

  // Feature is locked
  if (fallback === 'hidden') {
    return null;
  }

  if (fallback === 'prompt') {
    return (
      <UpgradePrompt 
        feature={feature}
        requiredTier={requiredTier as SubscriptionTier}
        variant={promptVariant}
        onUpgradeClick={onUpgradeClick}
      />
    );
  }

  // Custom fallback component
  return <>{fallback}</>;
}

interface FeatureCheckProps {
  feature: Feature;
  children: (props: { 
    isAvailable: boolean; 
    requiredTier: SubscriptionTier | undefined;
    currentTier: SubscriptionTier;
  }) => ReactNode;
}

/**
 * FeatureCheck - Render prop pattern for more control
 * 
 * Usage:
 * <FeatureCheck feature="staff_accounts">
 *   {({ isAvailable, requiredTier }) => (
 *     <MenuItem disabled={!isAvailable} badge={!isAvailable && requiredTier} />
 *   )}
 * </FeatureCheck>
 */
export function FeatureCheck({ feature, children }: FeatureCheckProps) {
  const { isAvailable, requiredTier, currentTier } = useFeature(feature);
  
  return <>{children({ isAvailable, requiredTier, currentTier })}</>;
}

interface GatedRouteProps {
  feature: Feature;
  children: ReactNode;
}

/**
 * GatedRoute - For use in route elements to gate entire pages
 */
export function GatedRoute({ feature, children }: GatedRouteProps) {
  return (
    <FeatureGate feature={feature} promptVariant="fullpage">
      {children}
    </FeatureGate>
  );
}

// Export types for convenience
export type { Feature, SubscriptionTier };
