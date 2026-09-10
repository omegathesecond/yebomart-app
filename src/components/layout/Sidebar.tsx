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
  ClipboardDocumentListIcon,
  ChatBubbleLeftRightIcon,
  CreditCardIcon,
  CalculatorIcon,
  ShieldExclamationIcon
} from '@heroicons/react/24/outline';
import { SparklesIcon as SparklesSolid } from '@heroicons/react/24/solid';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'POS', href: '/pos', icon: ShoppingCartIcon },
  { name: 'Cash Up', href: '/cash-up', icon: CalculatorIcon },
  { name: 'Products', href: '/products', icon: CubeIcon },
  { name: 'Stock', href: '/stock', icon: ArchiveBoxIcon },
  { name: 'Sales', href: '/sales', icon: BanknotesIcon },
  { name: 'Returns', href: '/returns', icon: ArrowUturnLeftIcon },
  { name: 'Suppliers', href: '/suppliers', icon: BuildingStorefrontIcon },
  { name: 'Purchase Orders', href: '/purchase-orders', icon: ClipboardDocumentListIcon },
  { name: 'Customers', href: '/customers', icon: UserGroupIcon },
  { name: 'Expenses', href: '/expenses', icon: ReceiptPercentIcon },
  { name: 'Reports', href: '/reports', icon: ChartBarIcon },
  { name: 'Staff', href: '/staff', icon: UsersIcon },
  { name: 'Billing', href: '/billing', icon: CreditCardIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon }
];

// Owner-only nav item — the API's GET /api/audit is ownerAuth-gated (see
// api/src/routes/audit.routes.ts), so hide the entry point rather than let a
// non-owner click through to a 403.
const OWNER_ONLY_NAVIGATION = [
  { name: 'Audit Log', href: '/audit-log', icon: ShieldExclamationIcon },
];

export function Sidebar() {
  const { user, shop, authMode, logout } = useAuthStore();
  const { alerts, insights } = useInventoryStore();
  const isOwner = authMode === 'owner' || user?.role === 'owner';

  // Get assistant name from shop settings
  const assistantName = shop?.assistantName || 'AI Assistant';

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 bg-cream border-r border-line flex-col z-50">
      {/* Logo */}
      <div className="p-6 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-sharp bg-brand flex items-center justify-center">
            <ShoppingCartIcon className="w-6 h-6 text-ink" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink">YeboMart</h1>
            <p className="text-xs text-mist truncate max-w-32">
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
            relative group block w-full p-4 rounded-sharp transition-all duration-300 overflow-hidden
            ${isActive 
              ? 'bg-ink shadow-lg' 
              : 'bg-ink hover: hover: shadow-lg hover:'
            }
          `}
        >
          {/* Animated background effect */}
          <div className="absolute inset-0 from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          
          {/* Sparkle decorations */}
          <div className="absolute top-2 right-2 opacity-60">
            <SparklesSolid className="w-4 h-4 text-warn animate-pulse" />
          </div>
          <div className="absolute bottom-3 right-8 opacity-40">
            <SparklesSolid className="w-3 h-3 text-brick animate-pulse delay-300" />
          </div>
          
          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 rounded-sharp bg-cream/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ChatBubbleLeftRightIcon className="w-6 h-6 text-ink" />
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink text-lg">Ask {assistantName}</span>
                {insights.length > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-warn text-brick rounded-full">
                    {insights.length}
                  </span>
                )}
              </div>
              <p className="text-xs text-ink/70 mt-0.5">
                Manage your shop with AI
              </p>
            </div>
          </div>
          
          {/* Glowing border effect */}
          <div className="absolute inset-0 rounded-sharp border border-cream/20 pointer-events-none" />
        </NavLink>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 pb-4 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-semibold text-mist uppercase tracking-wider px-4 py-2">
          Menu
        </p>
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-sharp transition-all duration-200 group ${
                isActive
                  ? 'bg-wash text-brick border border-ink/30'
                  : 'text-mute hover:bg-sand hover:text-ink'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium text-sm">{item.name}</span>

            {/* Badge for alerts */}
            {item.name === 'Stock' && alerts.length > 0 && (
              <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold bg-bad text-cream rounded-full">
                {alerts.length}
              </span>
            )}
          </NavLink>
        ))}

        {isOwner && OWNER_ONLY_NAVIGATION.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-sharp transition-all duration-200 group ${
                isActive
                  ? 'bg-wash text-brick border border-ink/30'
                  : 'text-mute hover:bg-sand hover:text-ink'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium text-sm">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* Alerts Summary */}
      {alerts.length > 0 && (
        <div className="mx-4 mb-4 p-3 rounded-sharp bg-bad/10 border border-bad/30">
          <div className="flex items-center gap-2 text-bad">
            <ExclamationTriangleIcon className="w-5 h-5" />
            <span className="text-sm font-medium">
              {alerts.length} stock alert{alerts.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* User Section */}
      <div className="p-4 border-t border-line">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center">
            <span className="text-ink font-semibold text-sm">
              {user?.name?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink truncate">{user?.name}</p>
            <p className="text-xs text-mist capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-4 py-2 text-mute hover:text-bad hover:bg-bad/10 rounded-sharp transition-colors"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5" />
          <span className="text-sm">Logout</span>
        </button>
      </div>
    </aside>
  );
}
