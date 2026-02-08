import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingCartIcon, 
  RocketLaunchIcon,
  ClockIcon,
  DevicePhoneMobileIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  PhoneIcon,
  UserPlusIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';

type OnboardingStep = 'entry' | 'instructions' | 'setup';

export function Onboarding() {
  const navigate = useNavigate();
  const { setupShop, shop } = useAuthStore();
  const [step, setStep] = useState<OnboardingStep>('entry');
  
  // Setup form state
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [pin, setPin] = useState('');
  const [assistantName, setAssistantName] = useState('Yebo');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!validate()) return;
    
    setIsLoading(true);

    try {
      const result = await setupShop({
        shopName,
        ownerName,
        ownerPhone,
        pin,
        assistantName
      });
      if (result.success) {
        navigate('/');
      } else {
        setError(result.error || 'Setup failed. Please try again.');
      }
    } catch (err) {
      setError('Setup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Entry screen - two options
  if (step === 'entry') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative w-full max-w-md text-center">
          {/* Logo */}
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25 mb-4">
              <ShoppingCartIcon className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">YeboMart</h1>
            <p className="text-slate-400 mt-2">AI-Powered Shop Management</p>
          </div>

          {/* Main CTA Card */}
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

          {/* Login link */}
          <button 
            onClick={() => navigate('/login')}
            className="text-amber-400 hover:text-amber-300 text-sm font-medium transition-colors"
          >
            Already have an account? Login →
          </button>

          {/* Footer */}
          <p className="text-slate-500 text-sm mt-8">
            © 2026 YeboMart by Omevision. Made in Eswatini 🇸🇿
          </p>
        </div>
      </div>
    );
  }

  // Instructions screen - what to expect
  if (step === 'instructions') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative w-full max-w-lg">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25 mb-4">
              <ShoppingCartIcon className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Let's Get You Started</h1>
            <p className="text-slate-400 mt-2">Here's what you need to know</p>
          </div>

          {/* Info Card */}
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8 mb-6">
            {/* Time estimate */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-6">
              <ClockIcon className="w-8 h-8 text-amber-400" />
              <div>
                <p className="text-white font-medium">Just 2 minutes</p>
                <p className="text-slate-400 text-sm">Quick setup, then you're ready to go</p>
              </div>
            </div>

            {/* What you'll need */}
            <div className="mb-6">
              <h3 className="text-white font-medium mb-3">What you'll need:</h3>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-slate-300">
                  <CheckCircleIcon className="w-5 h-5 text-green-400 shrink-0" />
                  <span>Your shop name</span>
                </li>
                <li className="flex items-center gap-3 text-slate-300">
                  <CheckCircleIcon className="w-5 h-5 text-green-400 shrink-0" />
                  <span>Your name</span>
                </li>
                <li className="flex items-center gap-3 text-slate-300">
                  <CheckCircleIcon className="w-5 h-5 text-green-400 shrink-0" />
                  <span>WhatsApp number (for daily reports)</span>
                </li>
                <li className="flex items-center gap-3 text-slate-300">
                  <CheckCircleIcon className="w-5 h-5 text-green-400 shrink-0" />
                  <span>A 6-digit PIN (for login)</span>
                </li>
              </ul>
            </div>

            {/* What you'll get */}
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

          {/* Actions */}
          <div className="flex gap-3">
            <Button 
              variant="ghost"
              onClick={() => setStep('entry')}
              className="flex-1"
            >
              Back
            </Button>
            <Button 
              onClick={() => setStep('setup')}
              className="flex-[2]"
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
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25 mb-4">
            <ShoppingCartIcon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Set Up Your Shop</h1>
          <p className="text-slate-400 mt-2">Almost there! Just a few details...</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8">
          <form onSubmit={handleSetup} className="space-y-4">
            <Input
              label="Shop Name"
              value={shopName}
              onChange={(e) => { setShopName(e.target.value); clearFieldError('shopName'); }}
              placeholder="e.g., Thandi's Tuck Shop"
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

            <Input
              label="WhatsApp Number"
              type="tel"
              value={ownerPhone}
              onChange={(e) => { setOwnerPhone(e.target.value); clearFieldError('ownerPhone'); }}
              placeholder="+268 7xxx xxxx"
              leftIcon={<PhoneIcon className="w-5 h-5" />}
              hint={!fieldErrors.ownerPhone ? "We'll send daily reports here" : undefined}
              error={fieldErrors.ownerPhone}
            />

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
              <Button 
                type="button"
                variant="ghost"
                onClick={() => setStep('instructions')}
                className="flex-1"
              >
                Back
              </Button>
              <Button 
                type="submit" 
                className="flex-[2]" 
                isLoading={isLoading}
              >
                Create My Shop
                <ArrowRightIcon className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-6">
          © 2026 YeboMart by Omevision. Made in Eswatini 🇸🇿
        </p>
      </div>
    </div>
  );
}
