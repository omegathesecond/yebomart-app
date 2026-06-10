// Pure money math for the POS — extracted so the safety-critical totals/change
// formulas can be unit-tested without rendering React or hitting the network.
//
// These MUST stay consistent with the server's authoritative recompute in
// api/src/services/sale.service.ts (SaleService.create):
//
//     const tax = 0;                              // VAT not yet enabled
//     const totalAmount = subtotal - discount + tax;
//     const change      = amountPaid - totalAmount;
//
// VAT is currently hardcoded to 0 on the server, so the client adds none either
// — the cart total is simply `subtotal - discount`. If/when a non-zero shop VAT
// rate is introduced server-side, the exclusive/inclusive contract is pinned by
// the reference math in money.test.ts; update BOTH sides together.

/** Round to 2 decimal places (cents), avoiding binary-float drift. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Final amount the customer owes, mirroring the server's
 * `totalAmount = subtotal - discount + tax` (tax = 0 today).
 *
 * Clamped at 0 to match the app's existing behaviour: the discount UI cannot
 * produce a discount larger than the subtotal, but a clamp guards the display
 * from ever showing a negative payable.
 */
export function computeCartTotal(subtotal: number, discount: number): number {
  return Math.max(0, subtotal - discount);
}

/**
 * Cash change due, mirroring the server's `change = amountPaid - totalAmount`.
 * Clamped at 0: the cash UI rejects an underpayment before this is shown, so a
 * negative "change" is never surfaced to the cashier.
 */
export function computeChange(total: number, amountPaid: number): number {
  return Math.max(0, amountPaid - total);
}
