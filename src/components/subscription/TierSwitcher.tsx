import { useSubscriptionStore, TIERS, type SubscriptionTier } from '@/stores/subscriptionStore';
import { CheckIcon, BeakerIcon } from '@heroicons/react/24/outline';

/**
 * TierSwitcher - Development component to test different subscription tiers
 * Shows in settings page for testing purposes
 */
export function TierSwitcher() {
  const { currentTier, setTier } = useSubscriptionStore();

  const tiers: SubscriptionTier[] = ['lite', 'starter', 'business', 'professional', 'enterprise'];

  return (
    <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
      <div className="flex items-center gap-2 mb-4">
        <BeakerIcon className="w-5 h-5 text-amber-400" />
        <h3 className="text-lg font-semibold text-white">Test Subscription Tier</h3>
        <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded-full">
          DEV
        </span>
      </div>
      <p className="text-sm text-slate-400 mb-4">
        Switch tiers to test feature gating. This is for development only.
      </p>
      
      <div className="space-y-2">
        {tiers.map((tier) => {
          const info = TIERS[tier];
          const isActive = currentTier === tier;
          
          return (
            <button
              key={tier}
              onClick={() => setTier(tier)}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                isActive 
                  ? 'bg-amber-500/20 border border-amber-500/50' 
                  : 'bg-slate-700/30 border border-transparent hover:bg-slate-700/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isActive ? 'bg-amber-500' : 'bg-slate-600'
                }`}>
                  {isActive && <CheckIcon className="w-5 h-5 text-white" />}
                </div>
                <div className="text-left">
                  <p className={`font-medium ${isActive ? 'text-amber-400' : 'text-white'}`}>
                    {info.name}
                  </p>
                  <p className="text-xs text-slate-400">{info.description}</p>
                </div>
              </div>
              <span className={`text-sm font-medium ${isActive ? 'text-amber-400' : 'text-slate-400'}`}>
                E{info.price}/mo
              </span>
            </button>
          );
        })}
      </div>
      
      <p className="text-xs text-slate-500 mt-4 text-center">
        Current tier is saved to localStorage
      </p>
    </div>
  );
}
