import { create } from 'zustand';
import api, { type CreditBalance } from '@/api/client';

/**
 * Below this many credits we surface the low-balance banner + nudge the shop to
 * top up. Cheapest billable action is 0.5 credits (AI Flash), priciest common
 * one is 2 (WhatsApp), so ~20 credits is "you'll run out soon, not stranded yet".
 */
export const LOW_BALANCE_THRESHOLD = 20;

interface BillingState {
  balance: CreditBalance | null;
  loading: boolean;
  error: string | null;
  /** True once a fetch has resolved (success or failure) — gates the banner so
   *  it never flashes before we actually know the balance. */
  loaded: boolean;

  /** Fetch the shop's credit balance. Errors are surfaced (no silent fallback). */
  fetchBalance: () => Promise<void>;
  /** Overwrite the cached balance (e.g. after a confirmed top-up). */
  setBalance: (balance: CreditBalance) => void;
  /** Reset on logout / shop switch so a stale balance can't leak across shops. */
  reset: () => void;
}

export const useBillingStore = create<BillingState>((set) => ({
  balance: null,
  loading: false,
  error: null,
  loaded: false,

  fetchBalance: async () => {
    set({ loading: true, error: null });
    const { data, error } = await api.getBalance();
    if (error || !data) {
      set({ loading: false, loaded: true, error: error || 'Failed to load balance' });
      return;
    }
    set({ balance: data, loading: false, loaded: true, error: null });
  },

  setBalance: (balance) => set({ balance, loaded: true, error: null }),

  reset: () => set({ balance: null, loading: false, error: null, loaded: false }),
}));

/** Whether a given balance is at/below the low threshold (and known). */
export function isLowBalance(balance: CreditBalance | null): boolean {
  return !!balance && balance.available <= LOW_BALANCE_THRESHOLD;
}
