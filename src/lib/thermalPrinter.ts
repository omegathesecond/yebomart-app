// Web Bluetooth ESC/POS thermal-receipt printing for the POS.
//
// Cheap 58mm/80mm Bluetooth receipt printers (Goojprt, Xprinter, BT58, MUNBYN,
// etc.) speak the ESC/POS command language over a BLE GATT "transparent serial"
// characteristic. Chrome / Edge (desktop + Android) expose Web Bluetooth, which
// lets the browser pair with one of those printers and stream raw command bytes
// — no native app, no driver, no print dialog.
//
// Design notes:
//   • `buildReceiptBytes()` is a PURE function (sale + shop -> Uint8Array) so the
//     ESC/POS encoding is unit-testable without Bluetooth or the DOM — same split
//     as money.ts. `printReceiptViaBluetooth()` is the thin I/O wrapper.
//   • Per the project's no-silent-fallback rule, every failure path THROWS a
//     typed `ThermalPrintError`; the caller surfaces it (toast). The one
//     non-error case is the user cancelling the device chooser, flagged via
//     `.cancelled` so the UI can stay quiet instead of crying "print failed".
//   • Web Bluetooth types aren't in this project's lib.dom, so the minimal slice
//     of the GATT API we touch is declared locally below.

import { formatCurrency, type Shop } from '@/types';
import type { ReceiptSale } from '@/components/pos/ReceiptModal';

/* ------------------------------------------------------------------ *
 * Minimal Web Bluetooth typings (not in this project's TS lib.dom)    *
 * ------------------------------------------------------------------ */

interface BluetoothRemoteGATTCharacteristic {
  readonly properties: { write: boolean; writeWithoutResponse: boolean };
  writeValue(value: Uint8Array): Promise<void>;
  writeValueWithoutResponse?(value: Uint8Array): Promise<void>;
}
interface BluetoothRemoteGATTService {
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
}
interface BluetoothRemoteGATTServer {
  readonly connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>;
}
interface BluetoothDevice {
  readonly name?: string;
  readonly gatt?: BluetoothRemoteGATTServer;
}
interface RequestDeviceOptions {
  acceptAllDevices?: boolean;
  optionalServices?: string[];
}
interface Bluetooth {
  requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>;
}

function getBluetooth(): Bluetooth | undefined {
  return (navigator as unknown as { bluetooth?: Bluetooth }).bluetooth;
}

/** Web Bluetooth needs a secure context (HTTPS or localhost) and a Chromium browser. */
export function isBluetoothPrintingSupported(): boolean {
  return typeof navigator !== 'undefined' && !!getBluetooth() && (window.isSecureContext ?? false);
}

/**
 * Failure raised by the thermal-print flow. `cancelled` distinguishes the
 * benign "user closed the Bluetooth chooser" case from real failures so the UI
 * can stay silent for cancellations but loudly report everything else.
 */
export class ThermalPrintError extends Error {
  readonly cancelled: boolean;
  constructor(message: string, opts: { cancelled?: boolean } = {}) {
    super(message);
    this.name = 'ThermalPrintError';
    this.cancelled = opts.cancelled ?? false;
  }
}

/* ------------------------------------------------------------------ *
 * ESC/POS byte encoding (pure)                                        *
 * ------------------------------------------------------------------ */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

// 58mm printers fit 32 monospace chars per line; 80mm fit 48. 32 is the safe
// common denominator — it just leaves a little extra margin on wider paper.
const LINE_WIDTH = 32;

/**
 * GATT service UUIDs commonly exposed by ESC/POS Bluetooth printers. Web
 * Bluetooth only lets us read a service if it's declared in `optionalServices`
 * up front, so we list every printer service we know of and then probe at
 * connect time for whichever one the paired device actually offers.
 */
const KNOWN_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // generic ESC/POS printer service (most BT58 / Goojprt / Xprinter)
  '0000ff00-0000-1000-8000-00805f9b34fb', // alt vendor printer service
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 style serial bridge
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC / Microchip transparent UART
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service
];

/** Encode a string to single-byte chars; anything outside 0x00–0xFF becomes '?'. */
function encodeText(text: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    out.push(code <= 0xff ? code : 0x3f);
  }
  return out;
}

/** Growable byte builder for assembling the ESC/POS stream. */
class EscPosBuilder {
  private readonly bytes: number[] = [];

  cmd(...bytes: number[]): this {
    this.bytes.push(...bytes);
    return this;
  }
  /** Append text followed by a line feed. */
  line(text = ''): this {
    this.bytes.push(...encodeText(text), LF);
    return this;
  }
  init(): this {
    return this.cmd(ESC, 0x40);
  }
  align(mode: 'left' | 'center' | 'right'): this {
    return this.cmd(ESC, 0x61, mode === 'center' ? 0x01 : mode === 'right' ? 0x02 : 0x00);
  }
  bold(on: boolean): this {
    return this.cmd(ESC, 0x45, on ? 0x01 : 0x00);
  }
  /** Double width + height (0x11) or back to normal (0x00). */
  doubleSize(on: boolean): this {
    return this.cmd(GS, 0x21, on ? 0x11 : 0x00);
  }
  feed(lines: number): this {
    return this.cmd(ESC, 0x64, lines);
  }
  /** Partial cut — harmlessly ignored by printers without a cutter. */
  cut(): this {
    return this.cmd(GS, 0x56, 0x01);
  }
  build(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

/** A left label and a right value padded to fill `width` (left truncated if needed). */
function twoColumns(left: string, right: string, width = LINE_WIDTH): string {
  if (left.length + right.length >= width) {
    const room = Math.max(0, width - right.length - 1);
    return `${left.slice(0, room)} ${right}`;
  }
  return left + ' '.repeat(width - left.length - right.length) + right;
}

const divider = (width = LINE_WIDTH) => '-'.repeat(width);

/**
 * Render a completed sale to an ESC/POS byte stream that mirrors the on-screen
 * receipt (header, line items, totals, cash/change, footer). Pure — no I/O.
 */
export function buildReceiptBytes(sale: ReceiptSale, shop: Shop | null): Uint8Array {
  const b = new EscPosBuilder().init();

  // Header — shop name big & centred, then address / phone.
  b.align('center').bold(true).doubleSize(true).line(shop?.name || 'YeboMart').doubleSize(false).bold(false);
  if (shop?.address) b.line(shop.address);
  if (shop?.ownerPhone) b.line(`Tel: ${shop.ownerPhone}`);

  // Meta — date + receipt number, left aligned.
  b.align('left').line(divider());
  b.line(`Date: ${sale.date.toLocaleDateString()} ${sale.date.toLocaleTimeString()}`);
  b.line(`Receipt #: ${sale.receiptNumber || sale.id.slice(-8).toUpperCase()}`);
  if (sale.pendingSync) b.line('** Saved offline - will sync **');
  b.line(divider());

  // Line items — name on its own row, then "qty x unit ........ total".
  for (const item of sale.items) {
    const name = String(item.productName ?? 'Item');
    const qty = Number(item.quantity ?? 1);
    const total = Number(item.totalPrice ?? 0);
    const unit = qty > 0 ? total / qty : total;
    b.line(name);
    b.line(twoColumns(`  ${qty} x ${formatCurrency(unit)}`, formatCurrency(total)));
  }
  b.line(divider());

  // Totals.
  b.line(twoColumns('Subtotal', formatCurrency(sale.subtotal || sale.total)));
  if (sale.discount > 0) b.line(twoColumns('Discount', `-${formatCurrency(sale.discount)}`));
  b.bold(true).line(twoColumns('TOTAL', formatCurrency(sale.total))).bold(false);

  // Cash tendered / change, when paid in cash.
  if (sale.paymentMethod === 'cash' && sale.cashReceived) {
    b.line(twoColumns('Cash', formatCurrency(sale.cashReceived)));
    b.line(twoColumns('Change', formatCurrency(sale.changeGiven || 0)));
  }

  // Footer.
  b.align('center').line('').line('Thank you for shopping with us!').line('Powered by YeboMart');
  b.feed(3).cut();

  return b.build();
}

/* ------------------------------------------------------------------ *
 * Bluetooth transport                                                 *
 * ------------------------------------------------------------------ */

/** Find the first writable characteristic across the device's GATT services. */
async function findWritableCharacteristic(
  server: BluetoothRemoteGATTServer,
): Promise<BluetoothRemoteGATTCharacteristic | undefined> {
  const services = await server.getPrimaryServices();
  for (const service of services) {
    let characteristics: BluetoothRemoteGATTCharacteristic[];
    try {
      characteristics = await service.getCharacteristics();
    } catch {
      continue; // some services refuse enumeration; skip them
    }
    const writable = characteristics.find(
      (c) => c.properties.writeWithoutResponse || c.properties.write,
    );
    if (writable) return writable;
  }
  return undefined;
}

/**
 * Stream bytes to the printer in small chunks. BLE characteristic writes are
 * MTU-limited (often ~20–180 bytes), and cheap printers have tiny input buffers
 * that overflow if fed too fast, so we send ~100-byte chunks and yield briefly
 * between them. Prefer write-without-response when supported (faster, and what
 * most serial-bridge characteristics expect).
 */
async function writeInChunks(
  characteristic: BluetoothRemoteGATTCharacteristic,
  data: Uint8Array,
): Promise<void> {
  const CHUNK = 100;
  const useNoResponse =
    characteristic.properties.writeWithoutResponse && !!characteristic.writeValueWithoutResponse;

  for (let offset = 0; offset < data.length; offset += CHUNK) {
    const slice = data.subarray(offset, offset + CHUNK);
    if (useNoResponse) {
      await characteristic.writeValueWithoutResponse!(slice);
    } else {
      await characteristic.writeValue(slice);
    }
    // Small breather so the printer's buffer keeps up.
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/**
 * Pair with (or reuse) a Bluetooth ESC/POS printer and print the sale receipt.
 * Throws `ThermalPrintError` on every failure; `.cancelled` is true when the
 * user simply dismissed the device chooser (the caller should stay silent).
 */
export async function printReceiptViaBluetooth(sale: ReceiptSale, shop: Shop | null): Promise<void> {
  if (!isBluetoothPrintingSupported()) {
    throw new ThermalPrintError(
      'Bluetooth printing needs Chrome or Edge (desktop or Android) over HTTPS.',
    );
  }

  const bytes = buildReceiptBytes(sale, shop);
  const bluetooth = getBluetooth()!;

  let device: BluetoothDevice;
  try {
    device = await bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: KNOWN_PRINTER_SERVICES,
    });
  } catch (err: unknown) {
    // The chooser rejects with NotFoundError both when the user cancels and when
    // no devices are around; treat it as a (silent) cancellation.
    if (err instanceof Error && err.name === 'NotFoundError') {
      throw new ThermalPrintError('No printer selected.', { cancelled: true });
    }
    throw new ThermalPrintError('Could not open the Bluetooth device picker.');
  }

  if (!device.gatt) {
    throw new ThermalPrintError('That device does not support Bluetooth printing.');
  }

  let server: BluetoothRemoteGATTServer;
  try {
    server = await device.gatt.connect();
  } catch {
    throw new ThermalPrintError(`Could not connect to "${device.name || 'the printer'}".`);
  }

  try {
    const characteristic = await findWritableCharacteristic(server);
    if (!characteristic) {
      throw new ThermalPrintError(
        'Connected, but no compatible ESC/POS print service was found on this device.',
      );
    }
    try {
      await writeInChunks(characteristic, bytes);
    } catch {
      throw new ThermalPrintError('Lost connection while printing. Please try again.');
    }
  } finally {
    if (server.connected) server.disconnect();
  }
}
