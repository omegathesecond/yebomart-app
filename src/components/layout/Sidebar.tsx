import { NavLink } from 'react-router-dom';
import {
  HomeIcon,
  ShoppingCartIcon,
  CubeIcon,
  ArchiveBoxIcon,
  BanknotesIcon,
  ChartBarIcon,
  UsersIcon,
  UserGroupIcon,
  ReceiptPercentIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  ArrowUturnLeftIcon,
  BuildingStorefrontIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import { SparklesIcon as SparklesSolid } from '@heroicons/react/24/solid';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'POS', href: '/pos', icon: ShoppingCartIcon },
  { name: 'Products', href: '/products', icon: CubeIcon },
  { name: 'Stock', href: '/stock', icon: ArchiveBoxIcon },
  { name: 'Sales', href: '/sales', icon: BanknotesIcon },
  { name: 'Returns', href: '/returns', icon: ArrowUturnLeftIcon },
  { name: 'Suppliers', href: '/suppliers', icon: BuildingStorefrontIcon },
  { name: 'Customers', href: '/customers', icon: UserGroupIcon },
  { name: 'Expenses', href: '/expenses', icon: ReceiptPercentIcon },
  { name: 'Reports', href: '/reports', icon: ChartBarIcon },
  { name: 'Staff', href: '/staff', icon: UsersIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon }
];

export function Sidebar() {
  const { user, shop, logout } = useAuthStore();
  const { alerts, insights } = useInventoryStore();

  // Get assistant name from shop settings
  const assistantName = shop?.assistantName || 'AI Assistant';

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 bg-slate-900 border-r border-slate-800 flex-col z-50">
      {/* Logo */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center glow-amber">
            <ShoppingCartIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">YeboMart</h1>
            <p className="text-xs text-slate-500 truncate max-w-32">
              {shop?.name || 'My Shop'}
            </p>
          </div>
        </div>
      </div>

      {/* AI Assistant CTA - Main Action */}
      <div className="p-4">
        <NavLink
          to="/assistant"
          className={({ isActive }) => `
            relative group block w-full p-4 rounded-2xl transition-all duration-300 overflow-hidden
            ${isActive 
              ? 'bg-gradient-to-r from-violet-600 to-purple-600 shadow-lg shadow-purple-500/30' 
              : 'bg-gradient-to-r from-violet-600/80 to-purple-600/80 hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40'
            }
          `}
        >
          {/* Animated background effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          
          {/* Sparkle decorations */}
          <div className="absolute top-2 right-2 opacity-60">
            <SparklesSolid className="w-4 h-4 text-yellow-300 animate-pulse" />
          </div>
          <div className="absolute bottom-3 right-8 opacity-40">
            <SparklesSolid className="w-3 h-3 text-pink-300 animate-pulse delay-300" />
          </div>
          
          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center group-hover:scale-110 transition-transform">
              <ChatBubbleLeftRightIcon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-lg">Ask {assistantName}</span>
                {insights.length > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-yellow-400 text-purple-900 rounded-full">
                    {insights.length}
                  </span>
                )}
              </div>
              <p className="text-xs text-white/70 mt-0.5">
                Manage your shop with AI
              </p>
            </div>
          </div>
          
          {/* Glowing border effect */}
          <div className="absolute inset-0 rounded-2xl border border-white/20 pointer-events-none" />
        </NavLink>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 pb-4 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-2">
          Menu
        </p>
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium text-sm">{item.name}</span>
            
            {/* Badge for alerts */}
            {item.name === 'Stock' && alerts.length > 0 && (
              <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">
                {alerts.length}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Alerts Summary */}
      {alerts.length > 0 && (
        <div className="mx-4 mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <div className="flex items-center gap-2 text-red-400">
            <ExclamationTriangleIcon className="w-5 h-5" />
            <span className="text-sm font-medium">
              {alerts.length} stock alert{alerts.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* User Section */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <span className="text-white font-semibold text-sm">
              {user?.name?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-4 py-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5" />
          <span className="text-sm">Logout</span>
        </button>
      </div>
    </aside>
  );
}
