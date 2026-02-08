import { ArrowUpCircleIcon, LockClosedIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { TIERS, type SubscriptionTier, type Feature, FEATURES } from '@/stores/subscriptionStore';
import { Button } from '@/components/ui/Button';

interface UpgradePromptProps {
  feature: Feature;
  requiredTier: SubscriptionTier;
  variant?: 'inline' | 'card' | 'fullpage';
  onUpgradeClick?: () => void;
}

export function UpgradePrompt({ 
  feature, 
  requiredTier, 
  variant = 'card',
  onUpgradeClick 
}: UpgradePromptProps) {
  const tierInfo = TIERS[requiredTier];
  const featureInfo = FEATURES[feature];

  const handleUpgrade = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
    } else {
      // Default: navigate to pricing/upgrade page or show modal
      window.location.href = '/app/settings?tab=subscription';
    }
  };

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2 text-slate-400">
        <LockClosedIcon className="w-4 h-4" />
        <span className="text-sm">
          Upgrade to <span className="text-amber-400 font-medium">{tierInfo.name}</span>
        </span>
      </div>
    );
  }

  if (variant === 'fullpage') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mb-6">
          <SparklesIcon className="w-10 h-10 text-amber-400" />
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2 text-center">
          {featureInfo.name}
        </h2>
        <p className="text-slate-400 text-center max-w-md mb-6">
          {featureInfo.description}. This feature is available on the{' '}
          <span className="text-amber-400 font-medium">{tierInfo.name}</span> plan and above.
        </p>

        <div className="bg-slate-800/50 rounded-2xl p-6 mb-6 border border-slate-700/50 max-w-sm w-full">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-lg font-semibold text-white">{tierInfo.name}</p>
              <p className="text-sm text-slate-400">{tierInfo.description}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-amber-400">E{tierInfo.price}</p>
              <p className="text-xs text-slate-500">/month</p>
            </div>
          </div>
        </div>

        <Button 
          variant="primary" 
          onClick={handleUpgrade}
          className="gap-2"
        >
          <ArrowUpCircleIcon className="w-5 h-5" />
          Upgrade to {tierInfo.name}
        </Button>
        
        <p className="text-xs text-slate-500 mt-4">
          30-day money-back guarantee
        </p>
      </div>
    );
  }

  // Default card variant
  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
          <LockClosedIcon className="w-6 h-6 text-amber-400" />
        </div>
        
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-1">
            Upgrade to unlock {featureInfo.name}
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            {featureInfo.description}. Available on {tierInfo.name} (E{tierInfo.price}/month) and above.
          </p>
          
          <Button 
            variant="primary" 
            size="sm"
            onClick={handleUpgrade}
            className="gap-2"
          >
            <ArrowUpCircleIcon className="w-4 h-4" />
            Upgrade Now
          </Button>
        </div>
      </div>
    </div>
  );
}

// Compact badge for locked nav items
interface UpgradeBadgeProps {
  tier: SubscriptionTier;
  compact?: boolean;
}

export function UpgradeBadge({ tier, compact = false }: UpgradeBadgeProps) {
  const tierInfo = TIERS[tier];
  
  if (compact) {
    return (
      <span className="ml-auto px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 rounded">
        {tierInfo.name.toUpperCase()}
      </span>
    );
  }
  
  return (
    <span className="ml-auto flex items-center gap-1 px-2 py-1 text-xs font-medium bg-amber-500/20 text-amber-400 rounded-lg">
      <LockClosedIcon className="w-3 h-3" />
      {tierInfo.name}
    </span>
  );
}
