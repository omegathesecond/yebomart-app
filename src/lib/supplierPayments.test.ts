import { describe, it, expect } from 'vitest';
import { computeBalanceDue, validatePaymentAmount } from '@/lib/supplierPayments';

describe('computeBalanceDue', () => {
  it('derives balance due as amountReceived - amountPaid', () => {
    expect(computeBalanceDue({ amountReceived: 1200, amountPaid: 500 })).toBe(700);
  });

  it('rounds float drift to 2 decimals', () => {
    expect(computeBalanceDue({ amountReceived: 100.1, amountPaid: 33.33 })).toBe(66.77);
  });

  it('is 0 when fully paid', () => {
    expect(computeBalanceDue({ amountReceived: 500, amountPaid: 500 })).toBe(0);
  });
});

describe('validatePaymentAmount — happy path', () => {
  it('accepts a partial payment within the balance due', () => {
    expect(validatePaymentAmount(500, 1200)).toBeNull();
  });

  it('accepts a payment that exactly settles the balance', () => {
    expect(validatePaymentAmount(700, 700)).toBeNull();
  });
});

describe('validatePaymentAmount — validation errors', () => {
  it('rejects a zero or negative amount', () => {
    expect(validatePaymentAmount(0, 700)).toMatch(/greater than 0/);
    expect(validatePaymentAmount(-10, 700)).toMatch(/greater than 0/);
  });

  it('rejects a non-finite amount', () => {
    expect(validatePaymentAmount(NaN, 700)).toMatch(/greater than 0/);
  });

  it('rejects when nothing is owed on the PO', () => {
    expect(validatePaymentAmount(50, 0)).toMatch(/nothing is owed/i);
  });

  it('rejects an amount exceeding the balance due (over-payment)', () => {
    expect(validatePaymentAmount(1500, 700)).toMatch(/exceeds the 700 balance due/);
  });
});
