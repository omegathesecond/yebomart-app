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
  ArrowUturnLeftIcon,
  BuildingStorefrontIcon,
  ClipboardDocumentListIcon,
  ChatBubbleLeftRightIcon,
  CreditCardIcon,
  CalculatorIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { YeboLogo } from '@/components/ui/YeboLogo';

/**
 * The one ink band in the app. Nav is a rail: the active screen is marked by a
 * 2px orange rule on its leading edge rather than a filled pill — it reads at
 * a glance on a dark ground and costs no extra weight.
 *
 * Grouped because the list is long. "Till" is what a cashier touches all day,
 * "Shop" is what an owner opens occasionally. The assistant is a row like any
 * other; it used to be a violet gradient card with animated sparkles, which is
 * neither a Yebo colour nor a thing that needs to shout.
 */

type NavItem = {
  name: string;
  href: string;
  icon: typeof HomeIcon;
  /** Renders a count chip on the right of the row. */
  badge?: 'alerts' | 'insights';
};

const TILL: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Point of Sale', href: '/pos', icon: ShoppingCartIcon },
  { name: 'Cash Up', href: '/cash-up', icon: CalculatorIcon },
];

const SHOP: NavItem[] = [
  { name: 'Products', href: '/products', icon: CubeIcon },
  { name: 'Stock', href: '/stock', icon: ArchiveBoxIcon, badge: 'alerts' },
  { name: 'Sales', href: '/sales', icon: BanknotesIcon },
  { name: 'Returns', href: '/returns', icon: ArrowUturnLeftIcon },
  { name: 'Suppliers', href: '/suppliers', icon: BuildingStorefrontIcon },
  { name: 'Purchase Orders', href: '/purchase-orders', icon: ClipboardDocumentListIcon },
  { name: 'Customers', href: '/customers', icon: UserGroupIcon },
  { name: 'Expenses', href: '/expenses', icon: ReceiptPercentIcon },
  { name: 'Reports', href: '/reports', icon: ChartBarIcon },
  { name: 'Staff', href: '/staff', icon: UsersIcon },
];

const ADMIN: NavItem[] = [
  { name: 'Billing', href: '/billing', icon: CreditCardIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

// Owner-only nav item — the API's GET /api/audit is ownerAuth-gated (see
// api/src/routes/audit.routes.ts), so hide the entry point rather than let a
// non-owner click through to a 403.
const OWNER_ONLY: NavItem[] = [
  { name: 'Audit Log', href: '/audit-log', icon: ShieldExclamationIcon },
];

const ROW_BASE =
  'flex items-center gap-3 border-l-2 px-3 py-2.5 text-[13.5px] transition-colors';
const ROW_REST = 'border-transparent text-mist hover:bg-ink-2 hover:text-cream';
const ROW_ACTIVE = 'border-brand bg-ink-2 font-medium text-cream';

function Section({ label }: { label: string }) {
  return <p className="eyebrow px-3 pb-2 pt-5">{label}</p>;
}

export function Sidebar() {
  const { user, shop, authMode, logout } = useAuthStore();
  const { alerts, insights } = useInventoryStore();
  const isOwner = authMode === 'owner' || user?.role === 'owner';

  const assistantName = shop?.assistantName || 'the assistant';
  const counts = { alerts: alerts.length, insights: insights.length };

  const renderRow = (item: NavItem) => {
    const count = item.badge ? counts[item.badge] : 0;
    return (
      <NavLink
        key={item.href}
        to={item.href}
        end={item.href === '/'}
        className={({ isActive }) => `${ROW_BASE} ${isActive ? ROW_ACTIVE : ROW_REST}`}
      >
        {({ isActive }) => (
          <>
            <item.icon
              className={`h-[17px] w-[17px] shrink-0 ${isActive ? 'text-brand-hot' : ''}`}
            />
            <span className="truncate">{item.name}</span>
            {count > 0 && (
              <span className="m ml-auto bg-bad px-1.5 py-px text-[10px] text-cream">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </>
        )}
      </NavLink>
    );
  };

  return (
    <aside className="on-ink fixed left-0 top-0 z-50 hidden h-screen w-64 flex-col bg-ink md:flex">
      {/* Identity */}
      <div className="border-b border-line-ink px-5 py-4">
        <YeboLogo onDark size="md" />
        <p className="m mt-2 truncate text-[10px] uppercase tracking-[0.1em] text-mist">
          {shop?.name || 'My Shop'}
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <Section label="Till" />
        {TILL.map(renderRow)}

        <Section label="Shop" />
        {SHOP.map(renderRow)}

        <Section label="Admin" />
        {ADMIN.map(renderRow)}
        {isOwner && OWNER_ONLY.map(renderRow)}

        {/* The assistant, as a row. */}
        <div className="mt-5 border-t border-line-ink pt-3">
          <NavLink
            to="/assistant"
            className={({ isActive }) => `${ROW_BASE} ${isActive ? ROW_ACTIVE : ROW_REST}`}
          >
            {({ isActive }) => (
              <>
                <ChatBubbleLeftRightIcon
                  className={`h-[17px] w-[17px] shrink-0 ${isActive ? 'text-brand-hot' : ''}`}
                />
                <span className="truncate">Ask {assistantName}</span>
                {insights.length > 0 && (
                  <span className="m ml-auto bg-brand px-1.5 py-px text-[10px] text-ink">
                    {insights.length}
                  </span>
                )}
              </>
            )}
          </NavLink>
        </div>
      </nav>

      {/* Who is signed in */}
      <div className="flex items-center gap-2.5 border-t border-line-ink px-5 py-4">
        <span className="grid h-[30px] w-[30px] shrink-0 place-items-center border border-cream/30 text-xs font-semibold text-cream">
          {user?.name?.charAt(0)?.toUpperCase() || 'U'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-cream">{user?.name}</p>
          <p className="m text-[10px] uppercase tracking-[0.1em] text-mist">{user?.role}</p>
        </div>
        <button
          onClick={logout}
          aria-label="Sign out"
          title="Sign out"
          className="grid h-8 w-8 shrink-0 place-items-center text-mist transition-colors hover:text-cream"
        >
          <ArrowRightOnRectangleIcon className="h-[18px] w-[18px]" />
        </button>
      </div>
    </aside>
  );
}
