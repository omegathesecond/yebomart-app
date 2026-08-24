// Pure logic for the supplier-payable payment flow (PurchaseOrders page) —
// extracted so the balance math and input validation can be unit-tested
// without rendering React. Mirrors the server's authoritative checks in
// api/src/controllers/purchaseOrder.controller.ts (getById / recordPayment).

import { round2 } from '@/lib/money';

/** Balance due on a PO = cumulative received value minus cumulative paid. */
export function computeBalanceDue(po: { amountReceived: number; amountPaid: number }): number {
  return round2(po.amountReceived - po.amountPaid);
}

/**
 * Validates a supplier-payment amount against the PO's current balance due.
 * Returns null when valid, or a human-readable reason when not. This mirrors
 * the server's own checks (amount > 0, balanceDue > 0, amount <= balanceDue)
 * so the UI can reject bad input before a round trip — the server remains the
 * source of truth and its error is still surfaced verbatim if this check is
 * ever bypassed (e.g. a stale balance due to a concurrent payment).
 */
export function validatePaymentAmount(amount: number, balanceDue: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Enter an amount greater than 0';
  }
  if (balanceDue <= 0) {
    return 'Nothing is owed on this purchase order';
  }
  if (amount > balanceDue) {
    return `Payment of ${amount} exceeds the ${balanceDue} balance due on this purchase order`;
  }
  return null;
}
