import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Onboarding's isNewShop (?mode=new-shop) branch is the "Add Shop" flow for
// an already-signed-in owner — it must call the real POST /api/shops via
// shopStore.createShop(), not the removed static dead-end screen.
const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useSearchParams: () => [new URLSearchParams('mode=new-shop')],
}));

const createShop = vi.fn();
vi.mock('@/stores/shopStore', () => ({
  useShopStore: () => ({ createShop }),
}));

vi.mock('@/lib/yeboid', () => ({
  initiateLogin: vi.fn(),
}));

import { Onboarding } from '@/pages/Onboarding';

beforeEach(() => {
  vi.clearAllMocks();
  // Onboarding auto-detects country via ipapi.co on mount — stub it out so
  // the wizard starts from the deterministic 'SZ' default in every test.
  global.fetch = vi.fn().mockRejectedValue(new Error('network disabled in tests'));
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload: vi.fn() },
    writable: true,
  });
});

/** Drive the isNewShop wizard from its 'country' start step to the 'setup' form. */
async function goToSetupStep() {
  render(<Onboarding />);
  // 'country' step (isNewShop starts here, skipping entry/instructions).
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  // 'shopType' step — pick any type so Continue enables.
  await waitFor(() => expect(screen.getByText(/what type of shop/i)).toBeInTheDocument());
  fireEvent.click(screen.getAllByRole('button', { name: /.+/ }).find(
    (b) => b.querySelector('h3'),
  )!);
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  await waitFor(() => expect(screen.getByText('Shop Name')).toBeInTheDocument());
}

/** Input has no id/htmlFor association, so select by DOM order: Shop Name is first. */
function shopNameInput() {
  return screen.getAllByRole('textbox')[0];
}

describe('Onboarding — Add Shop flow (?mode=new-shop)', () => {
  it('does NOT render the old "coming soon" dead-end', async () => {
    render(<Onboarding />);
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });

  it('submits only shop-branding fields to createShop — no ownerName/ownerPhone form fields', async () => {
    createShop.mockResolvedValue({ success: true, shop: { id: 'shop_new' } });
    await goToSetupStep();

    expect(screen.queryByText('Your Name')).not.toBeInTheDocument();
    expect(screen.queryByText('Phone Number')).not.toBeInTheDocument();

    fireEvent.change(shopNameInput(), { target: { value: 'Second Branch' } });
    fireEvent.click(screen.getByRole('button', { name: /create shop/i }));

    await waitFor(() => expect(createShop).toHaveBeenCalledTimes(1));
    const payload = createShop.mock.calls[0][0];
    expect(payload.name).toBe('Second Branch');
    expect(payload).not.toHaveProperty('ownerName');
    expect(payload).not.toHaveProperty('ownerPhone');
  });

  it('on success, reloads to rescope the app onto the new shop', async () => {
    createShop.mockResolvedValue({ success: true, shop: { id: 'shop_new' } });
    await goToSetupStep();

    fireEvent.change(shopNameInput(), { target: { value: 'Second Branch' } });
    fireEvent.click(screen.getByRole('button', { name: /create shop/i }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/'));
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it('on failure, shows the error and re-enables the submit button (never a fake success)', async () => {
    createShop.mockResolvedValue({ success: false, error: 'Failed to create shop' });
    await goToSetupStep();

    fireEvent.change(shopNameInput(), { target: { value: 'Second Branch' } });
    fireEvent.click(screen.getByRole('button', { name: /create shop/i }));

    await waitFor(() => expect(screen.getByText('Failed to create shop')).toBeInTheDocument());
    expect(navigateMock).not.toHaveBeenCalledWith('/');
    expect(window.location.reload).not.toHaveBeenCalled();
    // The button must not be stuck in the loading state after a failure.
    expect(screen.getByRole('button', { name: /create shop/i })).not.toBeDisabled();
  });
});
