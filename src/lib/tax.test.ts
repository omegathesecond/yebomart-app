import { describe, it, expect } from 'vitest';
import { computeTax, shopTaxConfig } from '@/lib/tax';

// Pins the client's VAT math to the server's authoritative formula in
// yebomart-api/src/utils/tax.ts / sale.service.ts createSale — the client MUST
// agree with the server's totalAmount or the "Insufficient payment" guard
// rejects an otherwise-correct sale.

describe('computeTax — no VAT (default 0% shop)', () => {
  it('adds no tax and total is subtotal minus discount', () => {
    expect(computeTax(100, 0, { taxRate: 0, taxInclusive: false })).toEqual({
      subtotal: 100,
      discount: 0,
      tax: 0,
      total: 100,
    });
    expect(computeTax(57, 5.7, { taxRate: 0, taxInclusive: false })).toEqual({
      subtotal: 57,
      discount: 5.7,
      tax: 0,
      total: 51.3,
    });
  });

  it('behaves the same whether inclusive is true or false at 0%', () => {
    expect(computeTax(100, 0, { taxRate: 0, taxInclusive: true }).tax).toBe(0);
    expect(computeTax(100, 0, { taxRate: 0, taxInclusive: true }).total).toBe(100);
  });
});

describe('computeTax — exclusive VAT (added on top, e.g. Eswatini 15%)', () => {
  it('100.00 subtotal @ 15% -> tax 15.00, total 115.00', () => {
    const result = computeTax(100, 0, { taxRate: 15, taxInclusive: false });
    expect(result.tax).toBe(15);
    expect(result.total).toBe(115);
  });

  it('discount is applied before VAT (VAT charged on the discounted base)', () => {
    // base = 100 - 20 = 80; tax = 80 * 15/100 = 12
    const result = computeTax(100, 20, { taxRate: 15, taxInclusive: false });
    expect(result.tax).toBe(12);
    expect(result.total).toBe(92);
  });

  it('rounds to the nearest cent', () => {
    // base = 33.33; tax = 33.33 * 15/100 = 4.9995 -> 5.00
    const result = computeTax(33.33, 0, { taxRate: 15, taxInclusive: false });
    expect(result.tax).toBe(5);
    expect(result.total).toBe(38.33);
  });
});

describe('computeTax — inclusive VAT (already inside the sell price)', () => {
  it('100.00 subtotal @ 15% -> tax 13.04, total unchanged at 100.00', () => {
    const result = computeTax(100, 0, { taxRate: 15, taxInclusive: true });
    expect(result.tax).toBe(13.04);
    expect(result.total).toBe(100);
  });

  it('a 115.00 inclusive total backs out exactly 15.00 VAT', () => {
    const result = computeTax(115, 0, { taxRate: 15, taxInclusive: true });
    expect(result.tax).toBe(15);
    expect(result.total).toBe(115);
  });

  it('discount reduces the base the tax is backed out of', () => {
    // base = 57.5 - 7.5 = 50; tax = 50 * 15/115 = 6.5217... -> 6.52
    const result = computeTax(57.5, 7.5, { taxRate: 15, taxInclusive: true });
    expect(result.tax).toBe(6.52);
    expect(result.total).toBe(50);
  });
});

describe('computeTax — edge cases', () => {
  it('clamps a discount larger than the subtotal to a 0 base (no negative tax/total)', () => {
    expect(computeTax(20, 25, { taxRate: 15, taxInclusive: false })).toEqual({
      subtotal: 20,
      discount: 25,
      tax: 0,
      total: 0,
    });
  });

  it('treats a negative/missing taxRate as 0%', () => {
    expect(computeTax(100, 0, { taxRate: -5, taxInclusive: false }).tax).toBe(0);
  });
});

describe('shopTaxConfig', () => {
  it('defaults to 0% exclusive when the shop has no tax fields set', () => {
    expect(shopTaxConfig(null)).toEqual({ taxRate: 0, taxInclusive: false });
    expect(shopTaxConfig(undefined)).toEqual({ taxRate: 0, taxInclusive: false });
    expect(shopTaxConfig({})).toEqual({ taxRate: 0, taxInclusive: false });
  });

  it('passes through a configured VAT-registered shop', () => {
    expect(shopTaxConfig({ taxRate: 15, taxInclusive: true })).toEqual({
      taxRate: 15,
      taxInclusive: true,
    });
  });
});
