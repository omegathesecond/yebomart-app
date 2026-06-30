import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDownIcon,
  CheckIcon,
  BuildingStorefrontIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
import { useShopStore, type ShopWithRole } from '@/stores/shopStore';

interface ShopSwitcherProps {
  variant?: 'header' | 'dropdown' | 'full';
  className?: string;
}

export function ShopSwitcher({ variant = 'header', className }: ShopSwitcherProps) {
  const navigate = useNavigate();
  const { shops, currentShop, currentShopId, setCurrentShop } = useShopStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelectShop = (shop: ShopWithRole) => {
    setCurrentShop(shop.id);
    setIsOpen(false);
    // Reload data for the new shop
    window.location.reload();
  };

  // Multi-shop ownership isn't supported yet — the backend keys each Shop to a
  // single YeboID owner and has no createShop endpoint. The old "Add Shop"
  // buttons routed to a flow that faked success and silently lost the shop, so
  // they've been removed rather than left to mislead. Switching between shops
  // the owner already has (via YeboID linking) still works below.

  // Manage a shop's settings. Settings is scoped to the active shop, so switch
  // to the chosen shop first (a reload re-scopes the whole app, same as
  // handleSelectShop) — otherwise just open the already-scoped Settings page.
  // Replaces the old dead /settings/shop/:id navigation.
  const handleManageShop = (shop: ShopWithRole) => {
    if (shop.id !== currentShopId) {
      setCurrentShop(shop.id);
      window.location.reload();
      return;
    }
    navigate('/settings');
  };

  if (!currentShop) {
    return null;
  }

  // Header variant - compact button
  if (variant === 'header') {
    return (
      <div className={clsx('relative', className)} ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-lg',
            'bg-slate-800 hover:bg-slate-700 border border-slate-700',
            'transition-colors'
          )}
        >
          <span className="text-lg">{currentShop.countryCode ? 
            (shops.find(s => s.id === currentShopId)?.countryCode === currentShop.countryCode ? 
              getFlag(currentShop.countryCode) : '🏪') 
            : '🏪'}</span>
          <span className="text-sm font-medium text-white max-w-[120px] truncate">
            {currentShop.name}
          </span>
          {shops.length > 1 && (
            <ChevronDownIcon className={clsx(
              'w-4 h-4 text-slate-400 transition-transform',
              isOpen && 'rotate-180'
            )} />
          )}
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute top-full left-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="p-2 border-b border-slate-700">
              <p className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Your Shops
              </p>
            </div>
            
            <div className="max-h-64 overflow-y-auto p-2">
              {shops.map(shop => (
                <button
                  key={shop.id}
                  onClick={() => handleSelectShop(shop)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition',
                    shop.id === currentShopId
                      ? 'bg-amber-500/20 border border-amber-500/30'
                      : 'hover:bg-slate-700 border border-transparent'
                  )}
                >
                  <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center text-lg">
                    {getFlag(shop.countryCode)}
                  </div>
                  <div className="flex-1 text-left">
                    <p className={clsx(
                      'font-medium text-sm',
                      shop.id === currentShopId ? 'text-amber-400' : 'text-white'
                    )}>
                      {shop.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {shop.currencySymbol} • {shop.userRole}
                    </p>
                  </div>
                  {shop.id === currentShopId && (
                    <CheckIcon className="w-5 h-5 text-amber-400" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full variant - card style for settings page
  if (variant === 'full') {
    return (
      <div className={clsx('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Your Shops</h3>
        </div>

        <div className="space-y-2">
          {shops.map(shop => (
            <div
              key={shop.id}
              className={clsx(
                'flex items-center gap-4 p-4 rounded-xl border transition',
                shop.id === currentShopId
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
              )}
            >
              <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center text-2xl">
                {getFlag(shop.countryCode)}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className={clsx(
                    'font-semibold',
                    shop.id === currentShopId ? 'text-amber-400' : 'text-white'
                  )}>
                    {shop.name}
                  </h4>
                  {shop.id === currentShopId && (
                    <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400">
                  {shop.businessType} • {shop.currencySymbol} {shop.currency}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {shop.id !== currentShopId && (
                  <button
                    onClick={() => handleSelectShop(shop)}
                    className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition"
                  >
                    Switch
                  </button>
                )}
                <button
                  onClick={() => handleManageShop(shop)}
                  aria-label={`Manage ${shop.name} settings`}
                  className="p-2 hover:bg-slate-700 rounded-lg transition"
                >
                  <Cog6ToothIcon className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {shops.length === 0 && (
          <div className="text-center py-8">
            <BuildingStorefrontIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No shops yet</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// Helper to get country flag emoji
function getFlag(countryCode?: string): string {
  if (!countryCode) return '🏪';
  
  const flags: Record<string, string> = {
    SZ: '🇸🇿', ZA: '🇿🇦', BW: '🇧🇼', ZM: '🇿🇲', ZW: '🇿🇼',
    MZ: '🇲🇿', MW: '🇲🇼', LS: '🇱🇸', NA: '🇳🇦', KE: '🇰🇪',
    TZ: '🇹🇿', UG: '🇺🇬', RW: '🇷🇼', ET: '🇪🇹', NG: '🇳🇬',
    GH: '🇬🇭', SN: '🇸🇳', CI: '🇨🇮', CM: '🇨🇲', CD: '🇨🇩',
    MA: '🇲🇦', EG: '🇪🇬', TN: '🇹🇳', DZ: '🇩🇿'
  };
  
  return flags[countryCode] || '🏪';
}
