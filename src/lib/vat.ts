import type { Shop } from '@/types';

/**
 * Client-side VAT computation. Mirrors the server's `utils/vat.ts` so the POS
 * charges (and displays) the same tax the API persists. The server is always
 * authoritative for the stored `tax`; this keeps the cart total / cash change /
 * `amountPaid` consistent with it so the insufficient-payment guard never trips.
 *
 * `vatRate` is a PERCENTAGE (e.g. 15 = 15%). Exclusive pricing adds VAT on top
 * of the net; inclusive pricing leaves the total unchanged and extracts the VAT
 * component. Non-registered shops (or rate <= 0) → tax 0, total = net.
 */
export interface VatBreakdown {
  /** net = subtotal - discount (never negative). */
  net: number;
  /** VAT amount, rounded to 2 decimals. */
  tax: number;
  /** Amount payable, rounded to 2 decimals. */
  total: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

type ShopVat = Pick<Shop, 'vatRegistered' | 'vatRate' | 'pricesIncludeVat'> | null | undefined;

export function computeVat(subtotal: number, discount: number, shop: ShopVat): VatBreakdown {
  const net = Math.max(0, subtotal - discount);

  const rate = shop?.vatRate ?? 0;
  if (!shop?.vatRegistered || rate <= 0) {
    return { net, tax: 0, total: round2(net) };
  }

  const r = rate / 100;

  if (shop.pricesIncludeVat) {
    const tax = round2(net - net / (1 + r));
    return { net, tax, total: round2(net) };
  }

  const tax = round2(net * r);
  return { net, tax, total: round2(net + tax) };
}
