# Feature Gating System

YeboMart uses a tier-based subscription model to gate premium features.

## Subscription Tiers

| Tier | Price/mo | Features |
|------|----------|----------|
| **Lite** | E499 | POS, Stock Management, Basic Reports |
| **Starter** | E1,499 | + Barcode Scanning, Low Stock Alerts, Staff Accounts |
| **Business** | E3,999 | + WhatsApp Reports, Advanced Reports |
| **Professional** | E7,999 | + AI Assistant, Multi-Location, Accounting Module |
| **Enterprise** | E15,999 | + API Access, Dedicated Support (all features) |

## Usage

### 1. Gate a Route/Page

```tsx
import { GatedRoute } from '@/components/subscription/FeatureGate';

<Route path="assistant" element={
  <GatedRoute feature="ai_assistant">
    <AIChat />
  </GatedRoute>
} />
```

### 2. Gate a Component

```tsx
import { FeatureGate } from '@/components/subscription/FeatureGate';

<FeatureGate feature="barcode_scanning">
  <BarcodeScanner />
</FeatureGate>
```

### 3. Conditional Rendering with FeatureCheck

```tsx
import { FeatureCheck } from '@/components/subscription/FeatureGate';

<FeatureCheck feature="ai_assistant">
  {({ isAvailable, requiredTier }) => (
    <button 
      disabled={!isAvailable}
      className={isAvailable ? '' : 'opacity-50'}
    >
      {isAvailable ? 'Open AI Chat' : `Upgrade to ${TIERS[requiredTier].name}`}
    </button>
  )}
</FeatureCheck>
```

### 4. Check Feature in Code

```tsx
import { useSubscriptionStore, useFeature } from '@/stores/subscriptionStore';

// Using the store directly
const { hasFeature, currentTier } = useSubscriptionStore();
if (hasFeature('ai_assistant')) {
  // Allow access
}

// Using the hook
const { isAvailable, requiredTier, featureInfo } = useFeature('staff_accounts');
```

## Available Features

| Feature ID | Name | Min Tier |
|-----------|------|----------|
| `pos` | Point of Sale | Lite |
| `stock_management` | Stock Management | Lite |
| `basic_reports` | Basic Reports | Lite |
| `barcode_scanning` | Barcode Scanning | Starter |
| `low_stock_alerts` | Low Stock Alerts | Starter |
| `staff_accounts` | Staff Accounts | Starter |
| `whatsapp_reports` | WhatsApp Reports | Business |
| `advanced_reports` | Advanced Reports | Business |
| `ai_assistant` | AI Assistant | Professional |
| `multi_location` | Multi-Location | Professional |
| `accounting_module` | Accounting Module | Professional |
| `api_access` | API Access | Enterprise |
| `dedicated_support` | Dedicated Support | Enterprise |

## Testing

During development, use the **TierSwitcher** component in Settings > Subscription to switch between tiers. The current tier is persisted to localStorage.

```tsx
import { TierSwitcher } from '@/components/subscription';

<TierSwitcher />
```

You can also set the tier programmatically:

```tsx
const { setTier } = useSubscriptionStore();
setTier('professional'); // Switch to Professional tier
```

## UX Guidelines

1. **Show, don't hide**: Prefer showing locked features with upgrade prompts over completely hiding them
2. **Subtle indicators**: Use small lock icons and tier badges instead of aggressive paywalls
3. **Blurred previews**: For dashboard widgets, show a blurred preview of what the feature offers
4. **Clear upgrade path**: Always show which tier unlocks the feature
5. **Don't block navigation**: Allow users to click locked nav items but show upgrade prompt on the page
