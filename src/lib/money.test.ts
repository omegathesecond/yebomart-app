import { describe, it, expect } from 'vitest';
import { round2, computeCartTotal, computeChange } from '@/lib/money';

// These tests pin the POS money math to the server's authoritative recompute in
// api/src/services/sale.service.ts:
//
//     const tax = 0;                              // VAT not yet enabled
//     const totalAmount = subtotal - discount + tax;
//     const change      = amountPaid - totalAmount;
//
// VAT is hardcoded to 0 server-side today, so `computeCartTotal` adds none. The
// exclusive/inclusive contract below documents how a future non-zero shop VAT
// rate MUST be applied so the client and server agree the day it is switched on.

describe('round2', () => {
  it('rounds to two decimals and tames float drift', () => {
    expect(round2(4.2)).toBe(4.2);
    expect(round2(0.1 + 0.2)).toBe(0.3); // 0.30000000000000004 → 0.3
    expect(round2(57.005)).toBe(57.01);
    expect(round2(12.344)).toBe(12.34);
  });
});

describe('computeCartTotal (mirrors server totalAmount = subtotal - discount + tax, tax=0)', () => {
  it('returns subtotal when there is no discount', () => {
    expect(computeCartTotal(42, 0)).toBe(42);
  });

  it('subtracts a fixed discount', () => {
    expect(computeCartTotal(100, 15)).toBe(85);
  });

  it('adds NO VAT — total equals subtotal minus discount (server tax = 0)', () => {
    // Representative basket: 3×15 + 1×12 = 57, 10% discount = 5.70.
    const subtotal = 57;
    const discount = round2(subtotal * 0.1); // 5.7
    expect(computeCartTotal(subtotal, discount)).toBe(51.3);
  });

  it('clamps at 0 rather than ever showing a negative payable', () => {
    expect(computeCartTotal(20, 25)).toBe(0);
  });
});

describe('computeChange (mirrors server change = amountPaid - totalAmount)', () => {
  it('is the cash tendered minus the total', () => {
    // Faithful to the production formula (amountPaid - total, unrounded), so a
    // binary-float remainder is expected here; the receipt formats to cents.
    expect(computeChange(51.3, 60)).toBeCloseTo(8.7, 2);
    expect(computeChange(42, 50)).toBe(8);
  });

  it('is 0 for exact payment', () => {
    expect(computeChange(100, 100)).toBe(0);
  });

  it('clamps at 0 — an underpayment never surfaces as negative change', () => {
    // The cash modal rejects underpayment before this runs; the clamp is a guard.
    expect(computeChange(100, 80)).toBe(0);
  });
});

// ── VAT contract reference ────────────────────────────────────────────────────
// Not production code — these encode the agreed exclusive/inclusive VAT formulas
// so that, when the server stops hardcoding `tax = 0`, both sides compute the
// same numbers. `base` is the taxable amount the server already derives
// (subtotal - discount).
function base(subtotal: number, discount: number): number {
  return subtotal - discount;
}
// Exclusive VAT: tax is ADDED on top of the displayed (tax-exclusive) prices.
function exclusiveVat(subtotal: number, discount: number, rate: number) {
  const b = base(subtotal, discount);
  const tax = round2(b * rate);
  return { tax, total: round2(b + tax) };
}
// Inclusive VAT: displayed prices ALREADY contain VAT; the total is unchanged
// and the tax component is backed out for reporting.
function inclusiveVat(subtotal: number, discount: number, rate: number) {
  const b = base(subtotal, discount);
  const tax = round2((b * rate) / (1 + rate));
  return { tax, total: round2(b) };
}

describe('VAT contract (exclusive vs inclusive)', () => {
  it('at the CURRENT 0% server rate, both models equal computeCartTotal with no tax', () => {
    for (const [subtotal, discount] of [
      [100, 0],
      [57, 5.7],
      [250, 25],
    ] as const) {
      const expectedTotal = computeCartTotal(subtotal, discount);
      const exc = exclusiveVat(subtotal, discount, 0);
      const inc = inclusiveVat(subtotal, discount, 0);
      expect(exc.tax).toBe(0);
      expect(inc.tax).toBe(0);
      expect(exc.total).toBe(expectedTotal);
      expect(inc.total).toBe(expectedTotal);
    }
  });

  it('exclusive VAT adds the rate on top (15% Eswatini VAT)', () => {
    expect(exclusiveVat(100, 0, 0.15)).toEqual({ tax: 15, total: 115 });
    // base 50 after discount → +15% = 7.50 tax, 57.50 total
    expect(exclusiveVat(57.5, 7.5, 0.15)).toEqual({ tax: 7.5, total: 57.5 });
  });

  it('inclusive VAT backs the tax out of an unchanged total (15%)', () => {
    // A 115.00 VAT-inclusive total contains 15.00 VAT (115 × 15/115).
    expect(inclusiveVat(115, 0, 0.15)).toEqual({ tax: 15, total: 115 });
    // base 50 inclusive → tax 50×0.15/1.15 = 6.5217… → 6.52, total unchanged 50
    expect(inclusiveVat(57.5, 7.5, 0.15)).toEqual({ tax: 6.52, total: 50 });
  });
});
