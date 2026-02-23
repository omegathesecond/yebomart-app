import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  UserIcon,
  BuildingOfficeIcon,
  BuildingStorefrontIcon,
  KeyIcon,
  BellIcon,
  DevicePhoneMobileIcon,
  SparklesIcon,
  PaintBrushIcon,
  TagIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useAuthStore } from '@/stores/authStore';
import { useShopStore } from '@/stores/shopStore';
import { TierSwitcher } from '@/components/subscription';
import { useSubscriptionStore, TIERS, FEATURES, type Feature } from '@/stores/subscriptionStore';
import { getShopType } from '@/data/shopTypes';
import { LanguageSwitcher } from '@/components/ui/CountryPicker';
import { ShopSwitcher } from '@/components/ui/ShopSwitcher';
import { useLocaleStore } from '@/stores/localeStore';

// Internal components for subscription tab
function CurrentPlanCard() {
  const { currentTier, hasFeature } = useSubscriptionStore();
  const tierInfo = TIERS[currentTier];
  
  return (
    <div className="p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-white">{tierInfo.name}</h3>
            <Badge variant="warning">Active</Badge>
          </div>
          <p className="text-slate-400 mt-1">{tierInfo.description}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-amber-400">E{tierInfo.price}</p>
          <p className="text-sm text-slate-500">/month</p>
        </div>
      </div>
    </div>
  );
}

function PricingCard({ tier, features, highlight }: { 
  tier: keyof typeof TIERS; 
  features: Feature[];
  highlight?: boolean;
}) {
  const { currentTier } = useSubscriptionStore();
  const tierInfo = TIERS[tier];
  const isCurrentTier = currentTier === tier;
  
  return (
    <div className={`p-4 rounded-xl border ${
      isCurrentTier 
        ? 'border-amber-500/50 bg-amber-500/10' 
        : highlight 
          ? 'border-blue-500/50 bg-blue-500/5' 
          : 'border-slate-700 bg-slate-800/30'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className={`font-semibold ${isCurrentTier ? 'text-amber-400' : 'text-white'}`}>
          {tierInfo.name}
        </h4>
        {isCurrentTier && <Badge variant="success" size="sm">Current</Badge>}
      </div>
      <p className="text-2xl font-bold text-white">
        E{tierInfo.price}
        <span className="text-sm font-normal text-slate-400">/mo</span>
      </p>
      <p className="text-xs text-slate-500 mb-3">{tierInfo.description}</p>
      <ul className="space-y-2 text-sm">
        {features.map((featureId) => {
          const feature = FEATURES[featureId];
          return (
            <li key={featureId} className="flex items-center gap-2 text-slate-300">
              <span className="text-emerald-400">✓</span>
              {feature.name}
            </li>
          );
        })}
      </ul>
      {!isCurrentTier && (
        <Button 
          variant={highlight ? 'primary' : 'secondary'} 
          size="sm" 
          className="w-full mt-4"
        >
          {currentTier && TIERS[currentTier] && tierInfo.price > TIERS[currentTier].price 
            ? 'Upgrade' 
            : 'Switch'
          }
        </Button>
      )}
    </div>
  );
}

export function Settings() {
  const { t } = useTranslation();
  const { user, shop, subscription, updateShop } = useAuthStore();
  const { shops } = useShopStore();
  const { country } = useLocaleStore();
  const [activeTab, setActiveTab] = useState('shop');
  
  const hasMultipleShops = shops.length > 1;
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form state
  const [shopName, setShopName] = useState(shop?.name || '');
  const [ownerName, setOwnerName] = useState(shop?.ownerName || '');
  const [assistantName, setAssistantName] = useState(shop?.assistantName || 'Yebo');
  const [address, setAddress] = useState(shop?.address || '');
  
  const clearError = (field: string) => {
    if (errors[field]) setErrors({ ...errors, [field]: '' });
  };

  const tabs = [
    { id: 'shop', label: t('settings.shop'), icon: BuildingOfficeIcon },
    { id: 'shops', label: t('settings.yourShops') || 'Your Shops', icon: BuildingStorefrontIcon, badge: hasMultipleShops ? shops.length : undefined },
    { id: 'profile', label: t('settings.profile'), icon: UserIcon },
    { id: 'language', label: t('settings.language') || 'Language', icon: GlobeAltIcon },
    { id: 'subscription', label: t('settings.subscription'), icon: KeyIcon },
    { id: 'notifications', label: t('settings.notifications'), icon: BellIcon },
    { id: 'ai', label: t('settings.aiAssistant'), icon: SparklesIcon },
    { id: 'appearance', label: t('settings.appearance'), icon: PaintBrushIcon }
  ];

  const validateShop = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!shopName.trim()) {
      newErrors.shopName = 'Shop name is required';
    }
    if (!ownerName.trim()) {
      newErrors.ownerName = 'Owner name is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveShop = async () => {
    if (!validateShop()) return;
    
    setIsSaving(true);
    setSaveSuccess(false);
    await updateShop({
      name: shopName,
      ownerName,
      assistantName,
      address
    });
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const getPlanBadge = () => {
    const plan = subscription?.plan || 'free';
    const variants: Record<string, 'success' | 'warning' | 'info'> = {
      free: 'info',
      pro: 'warning',
      business: 'success'
    };
    return <Badge variant={variants[plan]}>{plan.toUpperCase()}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-1">Manage your shop and account settings</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <div className="md:w-64 flex-shrink-0">
          <Card className="p-2">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    activeTab === tab.id
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <span className="font-medium flex-1 text-left">{tab.label}</span>
                  {tab.badge && (
                    <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded-full">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'shop' && (
            <Card>
              <CardHeader title="Shop Information" subtitle="Basic details about your shop" />
              <div className="space-y-4">
                {saveSuccess && (
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
                    Settings saved successfully!
                  </div>
                )}
                
                {/* Business Type Display */}
                {shop?.businessType && (
                  <div className="p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                        <TagIcon className="w-6 h-6 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Business Type</p>
                        <h3 className="text-lg font-semibold text-white">
                          {getShopType(shop.businessType)?.name || shop.businessType}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {getShopType(shop.businessType)?.description}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <Input
                  label="Shop Name"
                  value={shopName}
                  onChange={(e) => { setShopName(e.target.value); clearError('shopName'); }}
                  placeholder="My Tuck Shop"
                  error={errors.shopName}
                />
                <Input
                  label="Owner Name"
                  value={ownerName}
                  onChange={(e) => { setOwnerName(e.target.value); clearError('ownerName'); }}
                  placeholder="Your name"
                  error={errors.ownerName}
                />
                <Input
                  label="Address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Shop location (optional)"
                />
                <Button onClick={handleSaveShop} isLoading={isSaving}>
                  Save Changes
                </Button>
              </div>
            </Card>
          )}

          {activeTab === 'shops' && (
            <Card>
              <CardHeader 
                title="Your Shops" 
                subtitle="Manage multiple shops across different countries"
              />
              <div className="p-4">
                <ShopSwitcher variant="full" />
              </div>
            </Card>
          )}

          {activeTab === 'profile' && (
            <Card>
              <CardHeader title="Your Profile" subtitle="Your account details" />
              <div className="space-y-4">
                <div className="p-4 bg-slate-700/30 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center">
                      <UserIcon className="w-8 h-8 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{user?.name}</h3>
                      <p className="text-slate-400">{user?.phone}</p>
                      <Badge variant="success" className="mt-1">{user?.role}</Badge>
                    </div>
                  </div>
                </div>
                
                {/* Shop Info */}
                {shop && (
                  <div className="p-4 bg-slate-700/30 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-slate-600/50 flex items-center justify-center">
                        <BuildingOfficeIcon className="w-8 h-8 text-slate-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white">{shop.name}</h3>
                        {shop.businessType && (
                          <p className="text-amber-400">
                            {getShopType(shop.businessType)?.name || shop.businessType}
                          </p>
                        )}
                        {shop.address && (
                          <p className="text-sm text-slate-500">{shop.address}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {activeTab === 'language' && (
            <div className="space-y-6">
              {country && country.languages.length > 1 ? (
                <Card>
                  <CardHeader 
                    title={t('settings.language') || 'Language'} 
                    subtitle={t('settings.selectLanguage') || 'Choose your preferred language'}
                  />
                  <div className="p-4">
                    <LanguageSwitcher />
                  </div>
                </Card>
              ) : (
                <Card>
                  <CardHeader 
                    title={t('settings.language') || 'Language'} 
                    subtitle="Your country only supports one language"
                  />
                  <div className="p-4 text-slate-400 text-sm">
                    {country?.languages[0] === 'fr' ? 'Français' : 'English'} is the default language for your region.
                  </div>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'subscription' && (
            <div className="space-y-6">
              <Card>
                <CardHeader title="Current Plan" subtitle="Your subscription status" />
                <div className="space-y-4">
                  <CurrentPlanCard />
                </div>
              </Card>
              
              <Card>
                <CardHeader title="Available Plans" subtitle="Choose the right plan for your business" />
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  <PricingCard tier="lite" features={['pos', 'stock_management', 'basic_reports', 'ai_assistant']} />
                  <PricingCard tier="starter" features={['barcode_scanning', 'low_stock_alerts', 'staff_accounts', 'ai_assistant']} highlight />
                  <PricingCard tier="business" features={['whatsapp_reports', 'advanced_reports', 'ai_assistant']} />
                  <PricingCard tier="pro" features={['multi_location', 'accounting_module', 'ai_assistant']} />
                  <PricingCard tier="enterprise" features={['api_access', 'dedicated_support', 'ai_assistant']} />
                </div>
              </Card>
              
              {/* Dev testing tool */}
              <TierSwitcher />
            </div>
          )}

          {activeTab === 'ai' && (
            <Card>
              <CardHeader title="AI Assistant" subtitle="Customize your shop assistant" />
              <div className="space-y-4">
                <Input
                  label="Assistant Name"
                  value={assistantName}
                  onChange={(e) => setAssistantName(e.target.value)}
                  placeholder="Yebo"
                  hint="This is how your AI assistant introduces itself"
                />
                <div className="p-4 bg-slate-700/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                      <SparklesIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{assistantName}</h3>
                      <p className="text-sm text-slate-400">
                        "Hello! I'm {assistantName}, your AI shop assistant!"
                      </p>
                    </div>
                  </div>
                </div>
                <Button onClick={handleSaveShop} isLoading={isSaving}>
                  Save Changes
                </Button>
              </div>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card>
              <CardHeader title="Notifications" subtitle="Configure alerts and reports" />
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <DevicePhoneMobileIcon className="w-6 h-6 text-amber-400" />
                    <div>
                      <h3 className="font-medium text-white">WhatsApp Reports</h3>
                      <p className="text-sm text-slate-400">Daily summary to your WhatsApp</p>
                    </div>
                  </div>
                  <Badge variant={subscription?.hasWhatsApp ? 'success' : 'info'}>
                    {subscription?.hasWhatsApp ? 'Enabled' : 'Pro Plan'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <BellIcon className="w-6 h-6 text-amber-400" />
                    <div>
                      <h3 className="font-medium text-white">Low Stock Alerts</h3>
                      <p className="text-sm text-slate-400">Get notified when products run low</p>
                    </div>
                  </div>
                  <Badge variant="success">Enabled</Badge>
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'appearance' && (
            <Card>
              <CardHeader title="Appearance" subtitle="Customize how YeboMart looks" />
              <div className="space-y-4">
                <p className="text-slate-400">Coming soon! You'll be able to customize themes and colors.</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
