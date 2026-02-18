import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ShoppingCartIcon, 
  RocketLaunchIcon,
  ClockIcon,
  DevicePhoneMobileIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  UserPlusIcon,
  CheckIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { ShopCountryPicker } from '@/components/ui/ShopCountryPicker';
import { useAuthStore } from '@/stores/authStore';
import { useShopStore } from '@/stores/shopStore';
import { shopTypes, ShopType } from '@/data/shopTypes';
import { COUNTRIES, getCountryByCode, type Country } from '@/lib/countries';

type OnboardingStep = 'entry' | 'instructions' | 'shopType' | 'country' | 'setup';

export function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setupShop } = useAuthStore();
  const { createShop } = useShopStore();
  
  const isNewShop = searchParams.get('mode') === 'new-shop';
  const [step, setStep] = useState<OnboardingStep>(isNewShop ? 'country' : 'entry');
  
  // Setup form state
  const [selectedShopType, setSelectedShopType] = useState<string>('');
  const [shopTypeSearch, setShopTypeSearch] = useState<string>('');
  const [shopCountryCode, setShopCountryCode] = useState<string>('SZ');
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('SZ');
  const [fullPhoneNumber, setFullPhoneNumber] = useState('');
  const [pin, setPin] = useState('');
  const [assistantName, setAssistantName] = useState('Yebo');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Auto-detect country on first load
  useEffect(() => {
    const detectCountry = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        if (response.ok) {
          const data = await response.json();
          const detectedCode = data.country_code;
          // Only set if we support this country and user hasn't changed it
          if (detectedCode && COUNTRIES.find(c => c.code === detectedCode)) {
            setShopCountryCode(detectedCode);
            setPhoneCountryCode(detectedCode);
          }
        }
      } catch (e) {
        console.log('Could not auto-detect country');
      }
    };
    detectCountry();
  }, []);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!shopName.trim()) {
      errors.shopName = 'Shop name is required';
    } else if (shopName.trim().length < 2) {
      errors.shopName = 'Shop name must be at least 2 characters';
    }
    
    if (!ownerName.trim()) {
      errors.ownerName = 'Your name is required';
    }
    
    if (!ownerPhone.trim()) {
      errors.ownerPhone = 'Phone number is required';
    } else if (ownerPhone.length < 7) {
      errors.ownerPhone = 'Enter a valid phone number';
    }
    
    if (!pin) {
      errors.pin = 'PIN is required';
    } else if (!/^\d{6}$/.test(pin)) {
      errors.pin = 'PIN must be exactly 6 digits';
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors({ ...fieldErrors, [field]: '' });
    }
  };

  const handlePhoneChange = (phone: string, countryCode: string, fullNumber: string) => {
    setOwnerPhone(phone);
    setPhoneCountryCode(countryCode);
    setFullPhoneNumber(fullNumber);
    clearFieldError('ownerPhone');
  };

  const handleShopCountryChange = (country: Country) => {
    setShopCountryCode(country.code);
    // Also update phone country if user hasn't entered a phone yet
    if (!ownerPhone) {
      setPhoneCountryCode(country.code);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!validate()) return;
    
    setIsLoading(true);

    try {
      if (isNewShop) {
        // Creating additional shop
        const result = await createShop({
          name: shopName,
          ownerName,
          ownerPhone: ownerPhone,
          phoneCountryCode,
          countryCode: shopCountryCode,
          businessType: selectedShopType || 'general',
          assistantName
        });
        
        if (result.success) {
          navigate('/');
        } else {
          setError(result.error || 'Failed to create shop');
        }
      } else {
        // First-time setup
        const result = await setupShop({
          shopName,
          ownerName,
          ownerPhone: fullPhoneNumber || ownerPhone,
          pin,
          assistantName,
          businessType: selectedShopType || 'general',
          // Pass country info
          countryCode: shopCountryCode,
          phoneCountryCode
        });
        
        if (result.success) {
          navigate('/');
        } else {
          setError(result.error || 'Setup failed. Please try again.');
        }
      }
    } catch (err) {
      setError('Setup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedType = shopTypes.find(t => t.id === selectedShopType);
  const shopCountry = getCountryByCode(shopCountryCode);

  // Entry screen
  if (step === 'entry') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative w-full max-w-md text-center">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25 mb-4">
              <ShoppingCartIcon className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">YeboMart</h1>
            <p className="text-slate-400 mt-2">AI-Powered Shop Management</p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8 mb-6">
            <h2 className="text-xl font-semibold text-white mb-3">Welcome!</h2>
            <p className="text-slate-400 mb-8">
              Ready to take control of your shop? Set up in just 2 minutes and start tracking every sale.
            </p>

            <Button 
              onClick={() => setStep('instructions')}
              className="w-full text-lg py-4 mb-4"
            >
              <RocketLaunchIcon className="w-5 h-5 mr-2" />
              Setup Your Shop
            </Button>

            <div className="flex items-center gap-3 text-sm text-slate-500">
              <div className="flex-1 h-px bg-slate-700" />
              <span>or</span>
              <div className="flex-1 h-px bg-slate-700" />
            </div>
          </div>

          <button 
            onClick={() => navigate('/login')}
            className="text-amber-400 hover:text-amber-300 text-sm font-medium transition-colors"
          >
            Already have an account? Login →
          </button>

          <p className="text-slate-500 text-sm mt-8">
            © 2026 YeboMart by Omevision. Available across Africa 🌍
          </p>
        </div>
      </div>
    );
  }

  // Instructions screen
  if (step === 'instructions') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25 mb-4">
              <ShoppingCartIcon className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Let's Get You Started</h1>
            <p className="text-slate-400 mt-2">Here's what you need to know</p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8 mb-6">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-6">
              <ClockIcon className="w-8 h-8 text-amber-400" />
              <div>
                <p className="text-white font-medium">Just 2 minutes</p>
                <p className="text-slate-400 text-sm">Quick setup, then you're ready to go</p>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-white font-medium mb-3">What you'll need:</h3>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-slate-300">
                  <CheckCircleIcon className="w-5 h-5 text-green-400 shrink-0" />
                  <span>Your shop name & type</span>
                </li>
                <li className="flex items-center gap-3 text-slate-300">
                  <CheckCircleIcon className="w-5 h-5 text-green-400 shrink-0" />
                  <span>Your shop's country (for currency)</span>
                </li>
                <li className="flex items-center gap-3 text-slate-300">
                  <CheckCircleIcon className="w-5 h-5 text-green-400 shrink-0" />
                  <span>Your name & phone number</span>
                </li>
                <li className="flex items-center gap-3 text-slate-300">
                  <CheckCircleIcon className="w-5 h-5 text-green-400 shrink-0" />
                  <span>A 6-digit PIN (for login)</span>
                </li>
              </ul>
            </div>

            <div className="border-t border-slate-700 pt-6">
              <h3 className="text-white font-medium mb-3">What you'll get:</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <DevicePhoneMobileIcon className="w-4 h-4 text-amber-400" />
                  <span>Point of Sale</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <ChartBarIcon className="w-4 h-4 text-amber-400" />
                  <span>Sales Tracking</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <ShoppingCartIcon className="w-4 h-4 text-amber-400" />
                  <span>Stock Management</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <ChatBubbleLeftRightIcon className="w-4 h-4 text-amber-400" />
                  <span>AI Assistant</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep('entry')} className="flex-1">
              Back
            </Button>
            <Button onClick={() => setStep('country')} className="flex-[2]">
              Continue
              <ArrowRightIcon className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Country Picker Step (NOW FIRST)
  if (step === 'country') {
    return (
      <div className="min-h-screen bg-slate-900 p-4 pb-24">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-lg mx-auto pt-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25 mb-4">
              <GlobeAltIcon className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Where is your shop?</h1>
            <p className="text-slate-400 mt-2">This determines your currency and settings</p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 mb-6">
            <ShopCountryPicker
              label="Shop Country"
              value={shopCountryCode}
              onChange={handleShopCountryChange}
              hint="Your shop's prices will be in this country's currency"
            />

            {shopCountry && (
              <div className="mt-6 p-4 bg-slate-700/30 rounded-xl">
                <h4 className="text-sm font-medium text-slate-300 mb-3">Your shop will use:</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400">Currency</p>
                    <p className="text-white font-medium">
                      {shopCountry.currencySymbol} {shopCountry.currencyName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Currency Code</p>
                    <p className="text-white font-medium">{shopCountry.currency}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => isNewShop ? navigate(-1) : setStep('instructions')} className="flex-1">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button onClick={() => setStep('shopType')} className="flex-[2]">
              Continue
              <ArrowRightIcon className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Shop Type Picker (NOW SECOND - with search)
  const filteredShopTypes = shopTypes.filter(type => 
    shopTypeSearch === '' ||
    type.name.toLowerCase().includes(shopTypeSearch.toLowerCase()) ||
    type.description.toLowerCase().includes(shopTypeSearch.toLowerCase())
  );

  if (step === 'shopType') {
    return (
      <div className="min-h-screen bg-slate-900 p-4 pb-24">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-2xl mx-auto pt-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white">What type of shop do you have?</h1>
            <p className="text-slate-400 mt-2">
              {shopCountry && <span className="text-amber-400">{shopCountry.flag} {shopCountry.name}</span>}
              {' • '}We'll customize categories and features for your business
            </p>
          </div>

          {/* Search Input */}
          <div className="mb-6">
            <Input
              placeholder="Search shop types..."
              value={shopTypeSearch}
              onChange={(e) => setShopTypeSearch(e.target.value)}
              className="bg-slate-800/80"
            />
          </div>

          {filteredShopTypes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 text-lg">No shop types match "{shopTypeSearch}"</p>
              <button 
                onClick={() => setShopTypeSearch('')}
                className="text-amber-400 hover:text-amber-300 mt-2 text-sm"
              >
                Clear search
              </button>
            </div>
          ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filteredShopTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedShopType(type.id)}
                className={`relative p-4 rounded-2xl border-2 transition-all text-left ${
                  selectedShopType === type.id
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
              >
                {selectedShopType === type.id && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                    <CheckIcon className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${type.color} flex items-center justify-center mb-3`}>
                  <type.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-white text-sm">{type.name}</h3>
                <p className="text-slate-400 text-xs mt-1 line-clamp-2">{type.description}</p>
              </button>
            ))}
          </div>
          )}

          {/* Selected type preview */}
          {selectedType && (
            <div className="mt-6 p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
              <h3 className="text-white font-medium mb-2">Categories for {selectedType.name}:</h3>
              <div className="flex flex-wrap gap-2">
                {selectedType.categories.slice(0, 8).map((cat) => (
                  <span key={cat} className="px-3 py-1 bg-slate-700 rounded-full text-xs text-slate-300">
                    {cat}
                  </span>
                ))}
                {selectedType.categories.length > 8 && (
                  <span className="px-3 py-1 bg-slate-700 rounded-full text-xs text-slate-400">
                    +{selectedType.categories.length - 8} more
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-xs mt-3">You can customize these later in settings</p>
            </div>
          )}
        </div>

        {/* Fixed bottom actions */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/90 backdrop-blur-lg border-t border-slate-800">
          <div className="max-w-2xl mx-auto flex gap-3">
            <Button variant="ghost" onClick={() => setStep('country')} className="flex-1">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button 
              onClick={() => setStep('setup')} 
              className="flex-[2]"
              disabled={!selectedShopType}
            >
              Continue
              <ArrowRightIcon className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Setup form
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          {selectedType && (
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${selectedType.color} shadow-lg mb-4`}>
              <selectedType.icon className="w-10 h-10 text-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-white">Set Up Your {selectedType?.name || 'Shop'}</h1>
          <p className="text-slate-400 mt-2">
            {shopCountry && (
              <span className="inline-flex items-center gap-1">
                <span>{shopCountry.flag}</span>
                <span>{shopCountry.name}</span>
                <span className="text-amber-400">• {shopCountry.currencySymbol} {shopCountry.currency}</span>
              </span>
            )}
          </p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8">
          <form onSubmit={handleSetup} className="space-y-4">
            <Input
              label="Shop Name"
              value={shopName}
              onChange={(e) => { setShopName(e.target.value); clearFieldError('shopName'); }}
              placeholder={selectedType?.id === 'tyre' ? "e.g., Quick Fit Tyres" : "e.g., Thandi's Tuck Shop"}
              error={fieldErrors.shopName}
            />

            <Input
              label="Your Name"
              value={ownerName}
              onChange={(e) => { setOwnerName(e.target.value); clearFieldError('ownerName'); }}
              placeholder="Your full name"
              leftIcon={<UserPlusIcon className="w-5 h-5" />}
              error={fieldErrors.ownerName}
            />

            <PhoneInput
              label="Phone Number"
              value={ownerPhone}
              onChange={handlePhoneChange}
              defaultCountryCode={phoneCountryCode}
              placeholder="Phone number"
              error={fieldErrors.ownerPhone}
              hint={!fieldErrors.ownerPhone ? "We'll send daily reports here via WhatsApp" : undefined}
            />

            {!isNewShop && (
              <Input
                label="Create PIN"
                type="password"
                value={pin}
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); clearFieldError('pin'); }}
                placeholder="6-digit PIN"
                hint={!fieldErrors.pin ? "You'll use this to login" : undefined}
                maxLength={6}
                error={fieldErrors.pin}
              />
            )}

            <Input
              label="AI Assistant Name"
              value={assistantName}
              onChange={(e) => setAssistantName(e.target.value)}
              placeholder="Yebo"
              hint="Give your shop's AI a name (optional)"
            />

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep('shopType')} className="flex-1">
                Back
              </Button>
              <Button type="submit" className="flex-[2]" isLoading={isLoading}>
                {isNewShop ? 'Create Shop' : 'Create My Shop'}
                <ArrowRightIcon className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </form>
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          © 2026 YeboMart by Omevision. Available across Africa 🌍
        </p>
      </div>
    </div>
  );
}
