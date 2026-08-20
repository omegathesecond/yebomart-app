/**
 * VAT / sales-tax computation for the POS. Mirrors the server
 * (yebomart-api/src/utils/tax.ts) EXACTLY so the cart shows what the server
 * persists, and the amountPaid we send always matches the server's total
 * (otherwise the server's "Insufficient payment" guard would reject the sale).
 *
 *  - taxInclusive=false → VAT is added on top:  tax = base * rate/100
 *  - taxInclusive=true  → VAT is already inside the price (extract it):
 *                         tax = base * rate/(100+rate)   (total unchanged)
 *
 * where `base = subtotal - discount`.
 */
export interface TaxConfig {
  taxRate: number;       // percent, e.g. 15
  taxInclusive: boolean;
}

export interface TaxBreakdown {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function computeTax(subtotal: number, discount: number, cfg: TaxConfig): TaxBreakdown {
  const base = Math.max(0, subtotal - discount);
  const rate = cfg.taxRate || 0;

  if (rate <= 0) {
    return { subtotal, discount, tax: 0, total: round2(base) };
  }

  if (cfg.taxInclusive) {
    // Tax is the portion already inside the price; total is unchanged.
    const tax = round2((base * rate) / (100 + rate));
    return { subtotal, discount, tax, total: round2(base) };
  }

  // Exclusive: tax is added on top.
  const tax = round2((base * rate) / 100);
  return { subtotal, discount, tax, total: round2(base + tax) };
}

/** Pull a shop's tax config (with safe 0% defaults) into a TaxConfig. */
export function shopTaxConfig(shop?: { taxRate?: number; taxInclusive?: boolean } | null): TaxConfig {
  return {
    taxRate: shop?.taxRate ?? 0,
    taxInclusive: shop?.taxInclusive ?? false,
  };
}
