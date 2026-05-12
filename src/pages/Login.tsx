import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCartIcon,
  KeyIcon,
  PhoneIcon,
  UserIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';

type LoginMode = 'owner' | 'staff';

/**
 * Login screen for the YeboMart PWA.
 *
 * Two modes share the screen because POS devices are shared:
 *   - "Owner" → "Sign in with YeboID" full-page redirect (handles phone + OTP
 *     + PIN on YeboID's hosted UI; we never see credentials).
 *   - "Staff" → phone + 4-digit PIN against /api/auth/login/user
 *     (yebomart-internal; tied to the owner's existing shop).
 *
 * First-time owner signups go through /onboarding to capture the shop fields,
 * then onto YeboID from there.
 */
export function Login() {
  const navigate = useNavigate();
  const { signInWithYeboID, staffLogin } = useAuthStore();

  const [mode, setMode] = useState<LoginMode>('owner');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleOwnerSignIn = async () => {
    setError('');
    setIsLoading(true);
    try {
      await signInWithYeboID();
      // Full-page redirect — this component unmounts.
    } catch (err) {
      setIsLoading(false);
      setError(
        err instanceof Error
          ? err.message
          : 'Could not start sign-in. Try again.',
      );
    }
  };

  const validateStaff = (): boolean => {
    const errors: Record<string, string> = {};
    if (!phone.trim()) errors.phone = 'Phone number is required';
    else if (phone.length < 7) errors.phone = 'Enter a valid phone number';
    if (!pin) errors.pin = 'PIN is required';
    else if (pin.length !== 4) errors.pin = 'PIN must be 4 digits';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateStaff()) return;
    setIsLoading(true);
    try {
      const success = await staffLogin(phone, pin);
      if (success) navigate('/');
      else setError('Invalid phone or PIN');
    } catch {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (newMode: LoginMode) => {
    setMode(newMode);
    setPhone('');
    setPin('');
    setError('');
    setFieldErrors({});
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25 mb-4">
            <ShoppingCartIcon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">YeboMart</h1>
          <p className="text-slate-400 mt-2">AI-Powered Shop Management</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8">
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => switchMode('owner')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${
                mode === 'owner'
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-700/50 text-slate-400 hover:text-white'
              }`}
            >
              <BuildingStorefrontIcon className="w-5 h-5" />
              Owner
            </button>
            <button
              type="button"
              onClick={() => switchMode('staff')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${
                mode === 'staff'
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-700/50 text-slate-400 hover:text-white'
              }`}
            >
              <UserIcon className="w-5 h-5" />
              Staff
            </button>
          </div>

          <h2 className="text-xl font-semibold text-white mb-2">
            {mode === 'staff' ? 'Staff Login' : 'Welcome Back'}
          </h2>

          {mode === 'owner' ? (
            <>
              <p className="text-sm text-slate-400 mb-6">
                Sign in with YeboID — we use it to verify your phone and PIN.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <Button
                type="button"
                onClick={handleOwnerSignIn}
                className="w-full"
                isLoading={isLoading}
              >
                Sign in with YeboID
              </Button>

              <div className="mt-6 text-center">
                <button
                  onClick={() => navigate('/onboarding')}
                  className="text-amber-400 hover:text-amber-300 text-sm transition-colors"
                >
                  New shop? Set up YeboMart →
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleStaffLogin} className="space-y-6">
              <Input
                label="Phone Number"
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (fieldErrors.phone)
                    setFieldErrors({ ...fieldErrors, phone: '' });
                }}
                placeholder="+268 7xxx xxxx"
                leftIcon={<PhoneIcon className="w-5 h-5" />}
                error={fieldErrors.phone}
              />

              <Input
                label="PIN (4 digits)"
                type="password"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                  if (fieldErrors.pin)
                    setFieldErrors({ ...fieldErrors, pin: '' });
                }}
                placeholder="••••"
                leftIcon={<KeyIcon className="w-5 h-5" />}
                maxLength={4}
                error={fieldErrors.pin}
              />

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <Button type="submit" className="w-full" isLoading={isLoading}>
                Sign In
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          © 2026 YeboMart by Omevision. Made in Eswatini 🇸🇿
        </p>
      </div>
    </div>
  );
}
