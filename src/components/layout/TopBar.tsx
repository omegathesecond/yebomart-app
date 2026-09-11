import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BellIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { useShopStore } from '@/stores/shopStore';
import { ShopSwitcher } from '@/components/ui/ShopSwitcher';
import { YeboLogo } from '@/components/ui/YeboLogo';

/**
 * A hairline, not a bar. The screen name and the connection state are the only
 * things that earn space here; everything else lives in the rail.
 *
 * The date and time are mono so the header does not reflow every minute when
 * the clock ticks — proportional digits change width, tabular ones do not.
 */

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
  '/settings/subscription': 'Subscription',
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
    <header className="sticky top-0 z-40 border-b border-line bg-cream">
      <div className="flex h-14 items-center justify-between gap-4 px-4 md:px-6">
        {/* Left: identity on phones, screen name everywhere */}
        <div className="flex min-w-0 items-baseline gap-3.5">
          <span className="md:hidden">
            <YeboLogo size="sm" />
          </span>
          <h1 className="hidden truncate text-[17px] font-semibold tracking-[-0.02em] md:block">
            {pageName}
          </h1>
          <span className="m hidden text-[11px] text-mute lg:block">
            {currentTime.toLocaleDateString('en-GB', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
            {' · '}
            {currentTime.toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Connection state — a word, not a colour on its own. */}
          <div className="hidden items-center gap-2 border border-line px-2.5 py-1.5 sm:flex">
            <span
              className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-ok' : 'bg-warn'}`}
            />
            <span className="m text-[10.5px] uppercase tracking-[0.1em] text-body">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              aria-label={`Notifications${alerts.length ? ` (${alerts.length})` : ''}`}
              className="relative grid h-10 w-10 place-items-center rounded-sharp transition-colors hover:bg-sand"
            >
              <BellIcon className="h-5 w-5 text-mute" />
              {alerts.length > 0 && (
                <span className="m absolute right-1 top-1 grid h-4 min-w-4 place-items-center bg-bad px-1 text-[10px] font-medium text-cream">
                  {alerts.length > 9 ? '9+' : alerts.length}
                </span>
              )}
            </button>

            {showNotifications && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNotifications(false)}
                />
                <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-sharp border border-line-strong bg-cream shadow-[0_1px_2px_rgba(26,24,20,0.04),0_10px_30px_-12px_rgba(26,24,20,0.18)]">
                  <div className="border-b border-line px-4 py-3">
                    <h3 className="eyebrow">Needs attention</h3>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {alerts.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-mute">
                        Nothing to deal with right now.
                      </p>
                    ) : (
                      alerts.slice(0, 5).map((alert) => (
                        <div
                          key={alert.id}
                          className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
                        >
                          <span
                            className={`h-6 w-[3px] shrink-0 ${
                              alert.severity === 'out' ? 'bg-bad' : 'bg-warn'
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium">
                              {alert.productName}
                            </p>
                            <p className="m mt-0.5 text-[10.5px] uppercase tracking-[0.06em] text-mute">
                              {alert.severity === 'out'
                                ? 'Out of stock'
                                : `${alert.currentQty} left`}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {alerts.length > 0 && (
                    <Link
                      to="/stock"
                      state={{ showAlerts: true }}
                      onClick={() => setShowNotifications(false)}
                      className="m block border-t border-line px-4 py-3 text-center text-[10.5px] uppercase tracking-[0.1em] text-brick hover:bg-sand"
                    >
                      View all alerts
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>

          {hasMultipleShops ? (
            <ShopSwitcher variant="header" />
          ) : (
            <span className="m truncate text-[11px] uppercase tracking-[0.1em] text-mute md:hidden">
              {currentShop?.name?.split(' ')[0] || shop?.name?.split(' ')[0]}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
