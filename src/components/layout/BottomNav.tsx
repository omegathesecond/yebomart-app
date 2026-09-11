import { NavLink } from 'react-router-dom';
import {
  HomeIcon,
  ShoppingCartIcon,
  CubeIcon,
  BanknotesIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';

/**
 * Phone navigation. The active tab is marked by a 2px orange rule along its
 * top edge — the same device the desktop rail uses on its leading edge, so the
 * two surfaces read as one system.
 *
 * The POS tab used to be a raised gradient pill floating above the bar. It is
 * a flat tab now: on a phone held one-handed the raised pill sat under the
 * thumb's own shadow, and the extra 16px it stole came out of the list above.
 */

const navItems = [
  { name: 'Home', href: '/', icon: HomeIcon, end: true },
  { name: 'Till', href: '/pos', icon: ShoppingCartIcon },
  { name: 'Stock', href: '/products', icon: CubeIcon },
  { name: 'Sales', href: '/sales', icon: BanknotesIcon },
  { name: 'More', href: '/settings', icon: Bars3Icon },
];

export function BottomNav() {
  return (
    <nav className="safe-area-bottom fixed bottom-0 left-0 right-0 z-50 border-t border-line bg-cream md:hidden">
      <div className="flex items-stretch">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.end}
            className={({ isActive }) =>
              `flex min-h-[62px] flex-1 flex-col items-center justify-center gap-1 border-t-2 -mt-px transition-colors ${
                isActive ? 'border-brand text-ink' : 'border-transparent text-mute'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className="h-5 w-5"
                  strokeWidth={isActive ? 1.9 : 1.6}
                />
                <span
                  className={`m text-[9px] uppercase tracking-[0.08em] ${
                    isActive ? 'font-semibold' : ''
                  }`}
                >
                  {item.name}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
