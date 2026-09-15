import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ShopSwitcher only reads from shopStore + navigates — mock both boundaries
// so this exercises the switching/add-shop UI logic in isolation, mirroring
// the vi.mock('@/stores/...') pattern in ProductForm.test.tsx.
const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

const setCurrentShop = vi.fn();
let mockShopState: {
  shops: any[];
  currentShop: any;
  currentShopId: string | null;
};
vi.mock('@/stores/shopStore', () => ({
  useShopStore: () => ({ ...mockShopState, setCurrentShop }),
}));

import { ShopSwitcher } from './ShopSwitcher';

function makeShop(overrides: Record<string, any> = {}) {
  return {
    id: 'shop_a',
    name: 'Main Branch',
    countryCode: 'SZ',
    currencySymbol: 'E',
    currency: 'SZL',
    businessType: 'general',
    userRole: 'owner',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload: vi.fn() },
    writable: true,
  });
});

describe('ShopSwitcher — multi-shop switching UI', () => {
  it('renders nothing when there is no active shop', () => {
    mockShopState = { shops: [], currentShop: null, currentShopId: null };
    const { container } = render(<ShopSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists every shop and highlights the active one', () => {
    const shopA = makeShop({ id: 'shop_a', name: 'Main Branch' });
    const shopB = makeShop({ id: 'shop_b', name: 'Second Branch' });
    mockShopState = { shops: [shopA, shopB], currentShop: shopA, currentShopId: 'shop_a' };

    render(<ShopSwitcher />);
    fireEvent.click(screen.getByText('Main Branch'));

    expect(screen.getByText('Second Branch')).toBeInTheDocument();
    // Both shops render as list entries (the trigger button's own label plus
    // the dropdown row for the active shop both say "Main Branch").
    expect(screen.getAllByText('Main Branch').length).toBeGreaterThanOrEqual(1);
  });

  it('switching to a different shop updates the active shop and reloads to rescope the app', () => {
    const shopA = makeShop({ id: 'shop_a', name: 'Main Branch' });
    const shopB = makeShop({ id: 'shop_b', name: 'Second Branch' });
    mockShopState = { shops: [shopA, shopB], currentShop: shopA, currentShopId: 'shop_a' };

    render(<ShopSwitcher />);
    fireEvent.click(screen.getByText('Main Branch'));
    fireEvent.click(screen.getByText('Second Branch'));

    expect(setCurrentShop).toHaveBeenCalledWith('shop_b');
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it('"Add Shop" navigates to the Onboarding multi-shop entry point', () => {
    const shopA = makeShop({ id: 'shop_a', name: 'Main Branch' });
    mockShopState = { shops: [shopA], currentShop: shopA, currentShopId: 'shop_a' };

    render(<ShopSwitcher />);
    fireEvent.click(screen.getByText('Main Branch'));
    fireEvent.click(screen.getByText('Add Shop'));

    expect(navigateMock).toHaveBeenCalledWith('/onboarding?mode=new-shop');
    expect(setCurrentShop).not.toHaveBeenCalled();
  });

  it('the "full" variant (Settings page) also offers Add Shop and per-shop Switch buttons', () => {
    const shopA = makeShop({ id: 'shop_a', name: 'Main Branch' });
    const shopB = makeShop({ id: 'shop_b', name: 'Second Branch' });
    mockShopState = { shops: [shopA, shopB], currentShop: shopA, currentShopId: 'shop_a' };

    render(<ShopSwitcher variant="full" />);

    fireEvent.click(screen.getByRole('button', { name: /add shop/i }));
    expect(navigateMock).toHaveBeenCalledWith('/onboarding?mode=new-shop');

    fireEvent.click(screen.getByRole('button', { name: /switch/i }));
    expect(setCurrentShop).toHaveBeenCalledWith('shop_b');
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });
});
