import { NavLink } from 'react-router-dom';
import {
  HomeIcon,
  ShoppingCartIcon,
  CubeIcon,
  BanknotesIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  ShoppingCartIcon as ShoppingCartIconSolid,
  CubeIcon as CubeIconSolid,
  BanknotesIcon as BanknotesIconSolid,
  Cog6ToothIcon as Cog6ToothIconSolid
} from '@heroicons/react/24/solid';

const navItems = [
  { 
    name: 'Home', 
    href: '/', 
    icon: HomeIcon, 
    activeIcon: HomeIconSolid 
  },
  { 
    name: 'POS', 
    href: '/pos', 
    icon: ShoppingCartIcon, 
    activeIcon: ShoppingCartIconSolid,
    primary: true
  },
  { 
    name: 'Products', 
    href: '/products', 
    icon: CubeIcon, 
    activeIcon: CubeIconSolid 
  },
  { 
    name: 'Sales', 
    href: '/sales', 
    icon: BanknotesIcon, 
    activeIcon: BanknotesIconSolid 
  },
  { 
    name: 'More', 
    href: '/settings', 
    icon: Cog6ToothIcon, 
    activeIcon: Cog6ToothIconSolid 
  }
];

export function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 z-50 safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) => `
              flex flex-col items-center justify-center min-w-[56px] py-2 px-3 rounded-xl transition-all duration-200
              ${item.primary && !isActive ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-600/30 -mt-4' : ''}
              ${item.primary && isActive ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-600/40 -mt-4 scale-105' : ''}
              ${!item.primary && isActive ? 'text-amber-400' : ''}
              ${!item.primary && !isActive ? 'text-slate-500' : ''}
            `}
          >
            {({ isActive }) => (
              <>
                {isActive ? (
                  <item.activeIcon className={`${item.primary ? 'w-6 h-6' : 'w-5 h-5'}`} />
                ) : (
                  <item.icon className={`${item.primary ? 'w-6 h-6' : 'w-5 h-5'}`} />
                )}
                <span className={`text-[10px] font-medium mt-0.5 ${item.primary ? 'text-white' : ''}`}>
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
