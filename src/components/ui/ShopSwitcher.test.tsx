import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mirrors the vi.mock('@/stores/authStore', ...) pattern used in
// src/pages/AuditLog.test.tsx / ProductForm.test.tsx — ShopSwitcher reads
// shop state from shopStore directly, so mock that instead.
const setCurrentShop = vi.fn();
let mockShopState: {
  shops: any[];
  currentShop: any;
  currentShopId: string | null;
};
vi.mock('@/stores/shopStore', () => ({
  useShopStore: () => ({ ...mockShopState, setCurrentShop }),
}));

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}));

import { ShopSwitcher } from './ShopSwitcher';

// jsdom's window.location.reload isn't configurable enough for vi.spyOn —
// replace the whole location object for the tests that need to assert on it.
function mockLocationReload(): ReturnType<typeof vi.fn> {
  const reload = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload },
  });
  return reload;
}

const SHOP_A = {
  id: 'shop-a',
  name: 'Corner Store',
  countryCode: 'SZ',
  currencySymbol: 'E',
  currency: 'SZL',
  businessType: 'general',
  userRole: 'owner' as const,
};

const SHOP_B = {
  id: 'shop-b',
  name: 'Second Branch',
  countryCode: 'ZA',
  currencySymbol: 'R',
  currency: 'ZAR',
  businessType: 'general',
  userRole: 'owner' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockShopState = {
    shops: [SHOP_A, SHOP_B],
    currentShop: SHOP_A,
    currentShopId: SHOP_A.id,
  };
});

describe('ShopSwitcher — header variant (shop-switch UI flow)', () => {
  it('renders nothing when there is no active shop', () => {
    mockShopState = { shops: [], currentShop: null, currentShopId: null };
    const { container } = render(<ShopSwitcher variant="header" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('opens the dropdown and lists every shop the owner has', () => {
    render(<ShopSwitcher variant="header" />);

    fireEvent.click(screen.getByText('Corner Store'));

    // The trigger button already shows "Corner Store"; the dropdown adds a
    // second row for it plus one for the other shop.
    expect(screen.getAllByText('Corner Store')).toHaveLength(2);
    expect(screen.getByText('Second Branch')).toBeInTheDocument();
  });

  it('switching to a different shop sets it active and reloads the app', () => {
    const reload = mockLocationReload();

    render(<ShopSwitcher variant="header" />);
    fireEvent.click(screen.getByText('Corner Store'));
    fireEvent.click(screen.getByText('Second Branch'));

    expect(setCurrentShop).toHaveBeenCalledWith('shop-b');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('shows "Add Shop" for an owner and navigates to the new-shop onboarding flow', () => {
    render(<ShopSwitcher variant="header" />);
    fireEvent.click(screen.getByText('Corner Store'));

    fireEvent.click(screen.getByText('Add Shop'));

    expect(navigate).toHaveBeenCalledWith('/onboarding?mode=new-shop');
  });

  it('hides "Add Shop" for a staff-PIN session (userRole: staff)', () => {
    mockShopState = {
      shops: [{ ...SHOP_A, userRole: 'staff' }],
      currentShop: { ...SHOP_A, userRole: 'staff' },
      currentShopId: SHOP_A.id,
    };
    render(<ShopSwitcher variant="header" />);
    // Only one shop, and header hides the switcher chevron, but the
    // dropdown is still reachable via the button itself.
    fireEvent.click(screen.getByText('Corner Store'));

    expect(screen.queryByText('Add Shop')).not.toBeInTheDocument();
  });
});

describe('ShopSwitcher — full variant (Settings "Your Shops" tab)', () => {
  it('lists every shop with the active one marked, and lets you switch', () => {
    const reload = mockLocationReload();

    render(<ShopSwitcher variant="full" />);

    expect(screen.getByText('Corner Store')).toBeInTheDocument();
    expect(screen.getByText('Second Branch')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Switch'));

    expect(setCurrentShop).toHaveBeenCalledWith('shop-b');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('shows an "Add Shop" action for an owner', () => {
    render(<ShopSwitcher variant="full" />);
    expect(screen.getByText('Add Shop')).toBeInTheDocument();
  });
});
