import { useNavigate } from 'react-router-dom';
import { 
  ShoppingCartIcon, 
  SparklesIcon, 
  WifiIcon,
  DevicePhoneMobileIcon,
  ArrowRightIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';

const benefits = [
  {
    icon: SparklesIcon,
    title: 'AI-Powered',
    description: 'Smart inventory suggestions & voice commands in your language'
  },
  {
    icon: WifiIcon,
    title: 'Works Offline',
    description: 'No internet? No problem. Sync when you reconnect'
  },
  {
    icon: DevicePhoneMobileIcon,
    title: 'Easy to Use',
    description: 'Simple design made for busy shop owners'
  }
];

const features = [
  'Track sales & inventory',
  'Low stock alerts',
  'Daily reports',
  'Barcode scanning',
  'Multiple staff PINs',
  'WhatsApp sync'
];

export function Landing() {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    localStorage.setItem('yebomart_seen_landing', 'true');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
      </div>

      {/* Content */}
      <div className="relative flex-1 flex flex-col px-6 py-8 max-w-lg mx-auto w-full">
        {/* Hero Section */}
        <div className="flex-1 flex flex-col justify-center text-center">
          {/* Logo */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-sharp bg-brand shadow-lg mb-4">
              <ShoppingCartIcon className="w-12 h-12 text-ink" />
            </div>
            <h1 className="text-4xl font-bold text-ink">YeboMart</h1>
            <p className="text-brick font-medium mt-1">Smart Shop Management</p>
          </div>

          {/* Welcome message */}
          <div className="mb-8">
            <h2 className="text-xl text-ink font-semibold mb-3">
              Run your shop like a pro
            </h2>
            <p className="text-mute text-base leading-relaxed">
              The simple POS & inventory app built for Eswatini's tuck shops, 
              spaza stores, and small businesses. Everything you need in your pocket.
            </p>
          </div>

          {/* Benefits */}
          <div className="grid gap-4 mb-8">
            {benefits.map((benefit) => (
              <div 
                key={benefit.title}
                className="flex items-start gap-4 p-4 rounded-sharp bg-sand/50 border border-line/50 text-left"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-sharp bg-brand flex items-center justify-center">
                  <benefit.icon className="w-5 h-5 text-brick" />
                </div>
                <div>
                  <h3 className="font-semibold text-ink">{benefit.title}</h3>
                  <p className="text-sm text-mute mt-0.5">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Features list */}
          <div className="mb-8">
            <div className="flex flex-wrap justify-center gap-2">
              {features.map((feature) => (
                <span 
                  key={feature}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-sand/50 border border-line/50 text-sm text-body"
                >
                  <CheckCircleIcon className="w-4 h-4 text-ok" />
                  {feature}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="space-y-4 pb-safe">
          <Button 
            size="lg"
            className="w-full text-lg py-4"
            onClick={handleGetStarted}
            rightIcon={<ArrowRightIcon className="w-5 h-5" />}
          >
            Get Started — It's Free
          </Button>
          
          <p className="text-center text-mist text-sm">
            Set up in under 2 minutes. No credit card needed.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-6 border-t border-line">
          <p className="text-center text-mist text-xs">
            © 2026 YeboMart by Omevision · Made in Eswatini
          </p>
        </div>
      </div>
    </div>
  );
}
