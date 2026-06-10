import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  UserIcon,
  BuildingOfficeIcon,
  BuildingStorefrontIcon,
  BellIcon,
  DevicePhoneMobileIcon,
  SparklesIcon,
  PaintBrushIcon,
  TagIcon,
  GlobeAltIcon,
  ReceiptPercentIcon,
} from '@heroicons/react/24/outline';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Toast, useToast } from '@/components/ui/Toast';
import { api, type NotificationSettings, type TaxSettings } from '@/api/client';
import { useAuthStore } from '@/stores/authStore';
import { useShopStore } from '@/stores/shopStore';
import { getShopType } from '@/data/shopTypes';
import { LanguageSwitcher } from '@/components/ui/CountryPicker';
import { ShopSwitcher } from '@/components/ui/ShopSwitcher';
import { useLocaleStore } from '@/stores/localeStore';

export function Settings() {
  const { t } = useTranslation();
  const { user, shop, updateShop } = useAuthStore();
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

  // ── Notification settings (real, persisted via /api/shops/notifications) ──
  const { toast, showToast, dismissToast } = useToast();
  const [notif, setNotif] = useState<NotificationSettings | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<null | 'notifyWhatsAppReports' | 'notifyLowStock'>(null);

  // Load lazily the first time the Notifications tab is opened.
  useEffect(() => {
    if (activeTab !== 'notifications' || notif || notifLoading) return;
    let cancelled = false;
    setNotifLoading(true);
    api.getNotificationSettings().then((res) => {
      if (cancelled) return;
      if (res.data) {
        setNotif(res.data);
      } else {
        showToast(res.error || 'Failed to load notification settings', 'error');
      }
      setNotifLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeTab, notif, notifLoading, showToast]);

  // ── Tax / VAT settings (real, persisted via /api/shops/tax) ──────────────
  const [tax, setTax] = useState<TaxSettings | null>(null);
  const [taxLoading, setTaxLoading] = useState(false);
  const [taxRateInput, setTaxRateInput] = useState('');
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [taxNumber, setTaxNumber] = useState('');
  const [savingTax, setSavingTax] = useState(false);

  // Load lazily the first time the Tax tab is opened, then mirror into form state.
  useEffect(() => {
    if (activeTab !== 'tax' || tax || taxLoading) return;
    let cancelled = false;
    setTaxLoading(true);
    api.getTaxSettings().then((res) => {
      if (cancelled) return;
      if (res.data) {
        setTax(res.data);
        setTaxRateInput(String(res.data.taxRate ?? 0));
        setTaxInclusive(res.data.taxInclusive ?? false);
        setTaxNumber(res.data.taxNumber ?? '');
      } else {
        showToast(res.error || 'Failed to load tax settings', 'error');
      }
      setTaxLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeTab, tax, taxLoading, showToast]);

  const handleSaveTax = async () => {
    const rate = parseFloat(taxRateInput);
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      showToast('VAT rate must be a number between 0 and 100', 'error');
      return;
    }
    setSavingTax(true);
    const res = await api.updateTaxSettings({
      taxRate: rate,
      taxInclusive,
      taxNumber: taxNumber.trim(),
    });
    setSavingTax(false);
    if (res.data) {
      setTax(res.data);
      setTaxRateInput(String(res.data.taxRate ?? 0));
      setTaxInclusive(res.data.taxInclusive ?? false);
      setTaxNumber(res.data.taxNumber ?? '');
      // Reflect immediately in the POS (cart/receipt read shop.* from authStore).
      updateShop({
        taxRate: res.data.taxRate,
        taxInclusive: res.data.taxInclusive,
        taxNumber: res.data.taxNumber,
      });
      showToast('Tax settings saved', 'success');
    } else {
      showToast(res.error || 'Failed to save tax settings', 'error');
    }
  };

  const toggleNotif = async (key: 'notifyWhatsAppReports' | 'notifyLowStock') => {
    if (!notif || savingKey) return;
    const next = !notif[key];
    const prev = notif;
    // Optimistic: flip immediately, revert on failure (no fake success).
    setNotif({ ...notif, [key]: next });
    setSavingKey(key);
    const res = await api.updateNotificationSettings({ [key]: next });
    setSavingKey(null);
    if (res.data) {
      setNotif(res.data);
    } else {
      setNotif(prev); // revert
      showToast(res.error || 'Failed to update notification settings', 'error');
    }
  };

  const tabs = [
    { id: 'shop', label: t('settings.shop'), icon: BuildingOfficeIcon },
    { id: 'shops', label: t('settings.yourShops') || 'Your Shops', icon: BuildingStorefrontIcon, badge: hasMultipleShops ? shops.length : undefined },
    { id: 'profile', label: t('settings.profile'), icon: UserIcon },
    { id: 'language', label: t('settings.language') || 'Language', icon: GlobeAltIcon },
    { id: 'notifications', label: t('settings.notifications'), icon: BellIcon },
    { id: 'tax', label: 'Tax / VAT', icon: ReceiptPercentIcon },
    { id: 'ai', label: t('settings.aiAssistant'), icon: SparklesIcon },
    { id: 'appearance', label: t('settings.appearance'), icon: PaintBrushIcon },
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
              <CardHeader title={t('settings.notifications')} subtitle="Configure alerts and reports" />
              {notifLoading && !notif ? (
                <p className="text-slate-400 text-sm">Loading…</p>
              ) : !notif ? (
                <p className="text-red-400 text-sm">Couldn't load notification settings.</p>
              ) : (
                <div className="space-y-4">
                  {/* WhatsApp daily reports */}
                  <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl">
                    <div className="flex items-center gap-3">
                      <DevicePhoneMobileIcon className="w-6 h-6 text-amber-400" />
                      <div>
                        <h3 className="font-medium text-white">{t('settings.whatsappReports')}</h3>
                        <p className="text-sm text-slate-400">Daily sales summary to your WhatsApp</p>
                      </div>
                    </div>
                    <Toggle
                      on={notif.notifyWhatsAppReports}
                      busy={savingKey === 'notifyWhatsAppReports'}
                      onClick={() => toggleNotif('notifyWhatsAppReports')}
                      label={t('settings.whatsappReports')}
                    />
                  </div>

                  {/* Low stock alerts */}
                  <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl">
                    <div className="flex items-center gap-3">
                      <BellIcon className="w-6 h-6 text-amber-400" />
                      <div>
                        <h3 className="font-medium text-white">{t('settings.lowStockAlerts')}</h3>
                        <p className="text-sm text-slate-400">Get notified when products run low</p>
                      </div>
                    </div>
                    <Toggle
                      on={notif.notifyLowStock}
                      busy={savingKey === 'notifyLowStock'}
                      onClick={() => toggleNotif('notifyLowStock')}
                      label={t('settings.lowStockAlerts')}
                    />
                  </div>

                  {/* Recipient phone — where the messages actually go. */}
                  <p className="text-sm text-slate-400 px-1">
                    Sent to <span className="font-medium text-slate-200">{notif.recipientPhone}</span>
                    {notif.notifyPhone ? '' : ' (your account phone)'}
                  </p>
                </div>
              )}
            </Card>
          )}

          {activeTab === 'tax' && (
            <Card>
              <CardHeader title="Tax / VAT" subtitle="Charge VAT on sales and print it on receipts" />
              {taxLoading && !tax ? (
                <p className="text-slate-400 text-sm">Loading…</p>
              ) : (
                <div className="space-y-4">
                  <Input
                    label="VAT Rate (%)"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={taxRateInput}
                    onChange={(e) => setTaxRateInput(e.target.value)}
                    placeholder="e.g. 15"
                    hint="Eswatini standard VAT is 15%. Set 0 to disable tax."
                  />

                  {/* Inclusive vs exclusive */}
                  <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl">
                    <div className="flex items-center gap-3">
                      <ReceiptPercentIcon className="w-6 h-6 text-amber-400" />
                      <div>
                        <h3 className="font-medium text-white">Prices include VAT</h3>
                        <p className="text-sm text-slate-400">
                          {taxInclusive
                            ? 'Sell prices already include VAT — the tax is extracted from the price.'
                            : 'VAT is added on top of the sell price at checkout.'}
                        </p>
                      </div>
                    </div>
                    <Toggle
                      on={taxInclusive}
                      busy={savingTax}
                      onClick={() => setTaxInclusive((v) => !v)}
                      label="Prices include VAT"
                    />
                  </div>

                  <Input
                    label="VAT Registration Number"
                    value={taxNumber}
                    onChange={(e) => setTaxNumber(e.target.value)}
                    placeholder="Prints on the receipt (optional)"
                  />

                  <Button onClick={handleSaveTax} isLoading={savingTax}>
                    Save Tax Settings
                  </Button>
                </div>
              )}
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

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}

/**
 * Small accessible on/off switch. Optimistic toggling lives in the parent;
 * `busy` disables interaction while the PATCH is in flight.
 */
function Toggle({
  on,
  busy,
  onClick,
  label,
}: {
  on: boolean;
  busy: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={onClick}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        on ? 'bg-green-500' : 'bg-slate-600'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
