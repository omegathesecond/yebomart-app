import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sales } from './Sales';
import { ReceiptModal, type ReceiptSale } from '@/components/pos/ReceiptModal';
import { buildReceiptBytes } from '@/lib/thermalPrinter';
import type { Sale, Shop } from '@/types';

vi.mock('@/api/client', () => ({ default: { sendReceiptEmail: vi.fn(), sendReceiptSMS: vi.fn() } }));

const state = vi.hoisted(() => ({ sales: [] as Sale[], loadAll: vi.fn(), shop: {
  id: 'shop', name: 'Shop', taxRate: 25, taxInclusive: true, taxNumber: 'NEW-VAT',
} as Shop }));
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ shop: state.shop }) }));
vi.mock('@/stores/inventoryStore', () => ({ useInventoryStore: (selector?: (s: unknown) => unknown) => {
  const value = { sales: state.sales, loadAll: state.loadAll, isOnline: true };
  return selector ? selector(value) : value;
} }));

beforeEach(() => { vi.restoreAllMocks(); });

describe('historical receipt VAT', () => {
  it.each([
    { taxRate: 15, taxInclusive: false, tax: 12, totalAmount: 92 },
    { taxRate: 15, taxInclusive: true, tax: 10.43, totalAmount: 80 },
    { taxRate: 0, taxInclusive: false, tax: 0, totalAmount: 80 },
  ])('reopens, prints, shares and thermally encodes $taxRate% inclusive=$taxInclusive', (vat) => {
    state.shop.taxInclusive = !vat.taxInclusive;
    const sale = { id: 'sale', receiptNumber: 'RCP-OLD', subtotal: 100, discount: 20,
      ...vat, taxNumber: 'OLD-VAT', paymentMethod: 'cash', createdAt: new Date(),
      items: [{ productName: 'Bread', quantity: 2, totalPrice: 100 }],
    } as Sale;
    state.sales = [sale];
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    // Remount to exercise loading a saved receipt rather than only a checkout preview.
    for (let i = 0; i < 2; i++) {
      const view = render(<MemoryRouter><Sales /></MemoryRouter>);
      fireEvent.click(screen.getByText('RCP-OLD'));
      const receipt = document.querySelector('#receipt')!;
      expect(receipt.textContent).toContain('VAT No: OLD-VAT');
      expect(receipt.textContent).not.toContain('NEW-VAT');
      if (vat.tax > 0) expect(receipt.textContent).toContain(`VAT (15%${vat.taxInclusive ? ' incl.' : ''})`);
      expect(receipt.textContent).toContain(`E${vat.totalAmount.toFixed(2)}`);
      fireEvent.click(screen.getByRole('button', { name: 'Print', exact: true }));
      fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
      const shared = decodeURIComponent(String(open.mock.calls.at(-1)![0]));
      expect(shared).toContain('VAT No: OLD-VAT');
      expect(shared).toContain(`TOTAL: E${vat.totalAmount.toFixed(2)}`);
      expect(shared).not.toContain('NEW-VAT');
      view.unmount();
    }
    expect(print).toHaveBeenCalledTimes(2);
    const receiptSale: ReceiptSale = { ...sale, total: sale.totalAmount, tax: vat.tax, date: new Date() };
    const modal = render(<ReceiptModal isOpen onClose={() => {}} sale={receiptSale} shop={state.shop} />);
    expect(document.querySelector('#receipt')?.textContent).toContain('VAT No: OLD-VAT');
    expect(document.querySelector('#receipt')?.textContent).not.toContain('NEW-VAT');
    modal.unmount();
    const thermal = new TextDecoder().decode(buildReceiptBytes(receiptSale, state.shop));
    expect(thermal).toContain('VAT No: OLD-VAT');
    expect(thermal).not.toContain('NEW-VAT');
    expect(thermal).toContain(`E${vat.totalAmount.toFixed(2)}`);
  });

  it('shows unavailable metadata on legacy print/share and thermal receipts without borrowing shop settings', () => {
    const sale = { id: 'legacy', receiptNumber: 'RCP-LEGACY', subtotal: 100, discount: 0, tax: 15,
      totalAmount: 115, taxRate: null, taxInclusive: null, taxNumber: null, paymentMethod: 'cash', createdAt: new Date(),
      items: [{ productName: 'Bread', quantity: 1, totalPrice: 100 }],
    } as Sale;
    state.sales = [sale];
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const view = render(<MemoryRouter><Sales /></MemoryRouter>);
    fireEvent.click(screen.getByText('RCP-LEGACY'));
    expect(document.querySelector('#receipt')?.textContent).toContain('Historical VAT settings and registration unavailable');
    expect(document.querySelector('#receipt')?.textContent).not.toContain('NEW-VAT');
    fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
    expect(decodeURIComponent(String(open.mock.calls[0][0]))).toContain('Historical VAT settings and registration unavailable');
    view.unmount();
    const receiptSale = { ...sale, total: 115, date: new Date() } as ReceiptSale;
    const modal = render(<ReceiptModal isOpen onClose={() => {}} sale={receiptSale} shop={state.shop} />);
    expect(document.querySelector('#receipt')?.textContent).toContain('Historical VAT settings and registration unavailable');
    modal.unmount();
    expect(new TextDecoder().decode(buildReceiptBytes(receiptSale, state.shop))).toContain('Historical VAT settings');
  });
});
