import { describe, it, expect } from 'vitest';
import {
  buildReceiptBytes,
  isBluetoothPrintingSupported,
  printReceiptViaBluetooth,
  ThermalPrintError,
} from '@/lib/thermalPrinter';
import type { ReceiptSale } from '@/components/pos/ReceiptModal';
import type { Shop } from '@/types';

// Decode the ESC/POS stream as latin1 so we can assert on the human-readable
// text fragments (control bytes stay as-is between them and don't break a
// contiguous substring search like "YeboMart" or "TOTAL").
const asText = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes);

const shop = {
  name: 'Thandi Spaza',
  address: '12 Market St',
  ownerPhone: '+26876000000',
} as unknown as Shop;

const sale: ReceiptSale = {
  id: 'sale_abcdef123456',
  total: 30,
  subtotal: 35,
  discount: 5,
  items: [
    { productName: 'Bread', quantity: 2, totalPrice: 20 },
    { productName: 'Milk', quantity: 1, totalPrice: 15 },
  ],
  date: new Date('2026-06-27T10:30:00Z'),
  paymentMethod: 'cash',
  cashReceived: 50,
  changeGiven: 20,
};

describe('buildReceiptBytes', () => {
  it('emits an ESC/POS stream initialised with ESC @', () => {
    const bytes = buildReceiptBytes(sale, shop);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes[0]).toBe(0x1b); // ESC
    expect(bytes[1]).toBe(0x40); // @
  });

  it('includes the shop header, line items and totals', () => {
    const text = asText(buildReceiptBytes(sale, shop));
    expect(text).toContain('Thandi Spaza');
    expect(text).toContain('12 Market St');
    expect(text).toContain('Tel: +26876000000');
    expect(text).toContain('Bread');
    expect(text).toContain('Milk');
    expect(text).toContain('TOTAL');
    // formatCurrency uses the default 'E' symbol with 2 decimals in tests.
    expect(text).toContain('E30.00'); // total
    expect(text).toContain('E5.00'); // discount
  });

  it('prints cash + change only for cash sales', () => {
    expect(asText(buildReceiptBytes(sale, shop))).toContain('Change');
    const card: ReceiptSale = { ...sale, paymentMethod: 'card', cashReceived: undefined };
    expect(asText(buildReceiptBytes(card, shop))).not.toContain('Change');
  });

  it('falls back to "YeboMart" when no shop is given and ends with a cut command', () => {
    const bytes = buildReceiptBytes(sale, null);
    expect(asText(bytes)).toContain('YeboMart');
    // GS V 1 (partial cut) closes the stream.
    expect(bytes[bytes.length - 3]).toBe(0x1d);
    expect(bytes[bytes.length - 2]).toBe(0x56);
    expect(bytes[bytes.length - 1]).toBe(0x01);
  });
});

describe('isBluetoothPrintingSupported', () => {
  it('is false in the jsdom test environment (no navigator.bluetooth)', () => {
    expect(isBluetoothPrintingSupported()).toBe(false);
  });
});

describe('printReceiptViaBluetooth', () => {
  it('throws a loud ThermalPrintError when Bluetooth is unsupported (no silent fallback)', async () => {
    await expect(printReceiptViaBluetooth(sale, shop)).rejects.toBeInstanceOf(ThermalPrintError);
  });
});
