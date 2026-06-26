import { Link, useLocation } from 'react-router-dom';
import { 
  BellIcon, 
  MagnifyingGlassIcon,
  Bars3Icon
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { useShopStore } from '@/stores/shopStore';
import { ShopSwitcher } from '@/components/ui/ShopSwitcher';
import { formatCurrency } from '@/types';
import { useState, useEffect } from 'react';

const pageNames: Record<string, string> = {
  '/': 'Dashboard',
  '/pos': 'Point of Sale',
  '/products': 'Products',
  '/products/new': 'Add Product',
  '/stock': 'Stock Management',
  '/stock/adjust': 'Adjust Stock',
  '/sales': 'Sales History',
  '/reports': 'Reports',
  '/staff': 'Staff Management',
  '/staff/new': 'Add Staff',
  '/assistant': 'AI Assistant',
  '/billing': 'Billing & Credits',
  '/billing/success': 'Top-up Complete',
  '/billing/cancel': 'Top-up Cancelled',
  '/settings': 'Settings',
  '/settings/subscription': 'Subscription'
};

export function TopBar() {
  const location = useLocation();
  const { shop } = useAuthStore();
  const { shops, currentShop } = useShopStore();
  const { alerts, isOnline } = useInventoryStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNotifications, setShowNotifications] = useState(false);
  
  const hasMultipleShops = shops.length > 1;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const pageName = pageNames[location.pathname] || 'YeboMart';

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-lg border-b border-slate-800">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left: Mobile menu + Page title */}
        <div className="flex items-center gap-3">
          <button className="md:hidden p-2 hover:bg-slate-800 rounded-lg">
            <Bars3Icon className="w-6 h-6 text-slate-400" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-white">{pageName}</h1>
            <p className="text-xs text-slate-500 hidden sm:block">
              {currentTime.toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short'
              })} • {currentTime.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Online/Offline indicator */}
          <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            isOnline 
              ? 'bg-emerald-500/20 text-emerald-400' 
              : 'bg-amber-500/20 text-amber-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              isOnline ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
            }`} />
            {isOnline ? 'Online' : 'Offline'}
          </div>

          {/* Notifications */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 hover:bg-slate-800 rounded-lg relative"
            >
              <BellIcon className="w-6 h-6 text-slate-400" />
              {alerts.length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {alerts.length > 9 ? '9+' : alerts.length}
                </span>
              )}
            </button>

            {/* Notifications dropdown */}
            {showNotifications && (
              <>
                <div 
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNotifications(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-slate-700">
                    <h3 className="font-semibold text-white">Notifications</h3>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {alerts.length === 0 ? (
                      <p className="p-4 text-center text-slate-500 text-sm">
                        No new notifications
                      </p>
                    ) : (
                      alerts.slice(0, 5).map(alert => (
                        <div 
                          key={alert.id} 
                          className="p-3 border-b border-slate-700/50 hover:bg-slate-700/50"
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-2 h-2 rounded-full mt-2 ${
                              alert.severity === 'out' ? 'bg-red-500' :
                              alert.severity === 'critical' ? 'bg-amber-500' : 'bg-yellow-500'
                            }`} />
                            <div>
                              <p className="text-sm text-white font-medium">
                                {alert.productName}
                              </p>
                              <p className="text-xs text-slate-400">
                                {alert.severity === 'out' ? 'Out of stock' : 
                                 `Low stock: ${alert.currentQty} remaining`}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {alerts.length > 0 && (
                    <Link
                      to="/stock?filter=alerts"
                      onClick={() => setShowNotifications(false)}
                      className="block p-3 text-center text-sm text-amber-400 hover:bg-slate-700/50"
                    >
                      View all alerts
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Shop Switcher (if multiple shops) */}
          {hasMultipleShops ? (
            <ShopSwitcher variant="header" />
          ) : (
            /* Mobile: Shop name */
            <div className="md:hidden pl-2">
              <span className="text-sm font-medium text-amber-400">
                {currentShop?.name?.split(' ')[0] || shop?.name?.split(' ')[0]}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
