import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCartIcon, KeyIcon, PhoneIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';

export function Login() {
  const navigate = useNavigate();
  const { login, setupShop, shop } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'setup'>(shop ? 'login' : 'setup');
  
  // Login state
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  
  // Setup state
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [assistantName, setAssistantName] = useState('Yebo');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const success = await login(phone, pin);
      if (success) {
        navigate('/');
      } else {
        setError('Invalid phone or PIN');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const success = await setupShop({
        shopName,
        ownerName,
        ownerPhone,
        assistantName
      });
      if (success) {
        navigate('/');
      } else {
        setError('Setup failed. Please try again.');
      }
    } catch (err) {
      setError('Setup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
          <h1 className="text-3xl font-bold text-white">YeboMart</h1>
          <p className="text-slate-400 mt-2">AI-Powered Shop Management</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8">
          {mode === 'login' ? (
            <>
              <h2 className="text-xl font-semibold text-white mb-6">Welcome Back</h2>

              <form onSubmit={handleLogin} className="space-y-6">
                <Input
                  label="Phone Number"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+268 7xxx xxxx"
                  leftIcon={<PhoneIcon className="w-5 h-5" />}
                  required
                />

                <Input
                  label="PIN"
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  leftIcon={<KeyIcon className="w-5 h-5" />}
                  maxLength={6}
                  required
                />

                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  isLoading={isLoading}
                >
                  Sign In
                </Button>
              </form>

              <div className="mt-6 text-center">
                <button 
                  onClick={() => setMode('setup')}
                  className="text-amber-400 hover:text-amber-300 text-sm"
                >
                  New shop? Set up YeboMart →
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-white mb-6">Set Up Your Shop</h2>

              <form onSubmit={handleSetup} className="space-y-4">
                <Input
                  label="Shop Name"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="My Tuck Shop"
                  required
                />

                <Input
                  label="Your Name"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Your full name"
                  leftIcon={<UserPlusIcon className="w-5 h-5" />}
                  required
                />

                <Input
                  label="WhatsApp Number"
                  type="tel"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  placeholder="+268 7xxx xxxx"
                  leftIcon={<PhoneIcon className="w-5 h-5" />}
                  required
                />

                <Input
                  label="AI Assistant Name"
                  value={assistantName}
                  onChange={(e) => setAssistantName(e.target.value)}
                  placeholder="Yebo"
                  hint="Your shop's AI assistant name"
                />

                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  isLoading={isLoading}
                >
                  Create My Shop
                </Button>
              </form>

              {shop && (
                <div className="mt-6 text-center">
                  <button 
                    onClick={() => setMode('login')}
                    className="text-amber-400 hover:text-amber-300 text-sm"
                  >
                    Already have an account? Sign in →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-6">
          © 2026 YeboMart by Omevision. Made in Eswatini 🇸🇿
        </p>
      </div>
    </div>
  );
}
