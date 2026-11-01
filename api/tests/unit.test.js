import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, isDateString, monthDays, todayIST } from '../src/lib/dates.js';
import { percentOf } from '../src/lib/money.js';
import { priceBooking, refundPercent } from '../src/lib/policy.js';
import { createMockProvider } from '../src/providers/payments/mock.js';
import { createBookingBody, registerBody, searchQuery } from '../src/routes/schemas.js';

describe('dates (India time)', () => {
  it('uses IST for "today" — 11 pm UTC is already the next day in Chennai', () => {
    expect(todayIST(new Date('2026-11-01T18:29:00Z'))).toBe('2026-11-01');
    expect(todayIST(new Date('2026-11-01T18:31:00Z'))).toBe('2026-11-02');
  });
  it('validates real calendar dates only', () => {
    expect(isDateString('2026-02-28')).toBe(true);
    expect(isDateString('2026-02-29')).toBe(false);
    expect(isDateString('2028-02-29')).toBe(true);
    expect(isDateString('14-12-2026')).toBe(false);
  });
  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(daysBetween('2026-11-01', '2026-12-01')).toBe(30);
    expect(monthDays('2027-02')).toHaveLength(28);
  });
});

describe('pricing', () => {
  it('splits a ₹1,20,000 hall into 25% advance, balance and 5% platform fee', () => {
    const p = priceBooking({ slotPrice: 1_20_000_00, advancePercent: 25, platformFeePercent: 5 });
    expect(p).toMatchObject({ total: 1_20_000_00, advance: 30_000_00, balance: 90_000_00, platformFee: 6_000_00, ownerPayoutNow: 24_000_00 });
  });
  it('applies a special-date surcharge before splitting', () => {
    const p = priceBooking({ slotPrice: 80_000_00, adjustmentPercent: 20, advancePercent: 25, platformFeePercent: 5 });
    expect(p.total).toBe(96_000_00);
    expect(p.advance + p.balance).toBe(p.total);
  });
  it('never takes a platform fee bigger than the advance', () => {
    const p = priceBooking({ slotPrice: 10_000_00, advancePercent: 10, platformFeePercent: 50 });
    expect(p.platformFee).toBeLessThanOrEqual(p.advance);
    expect(p.ownerPayoutNow).toBeGreaterThanOrEqual(0);
  });
  it('rounds to whole rupees', () => {
    expect(percentOf(33_333_33, 25) % 100).toBe(0);
  });
});

describe('refund policy', () => {
  it('moderate: 100% a month out, 50% a week out, nothing in the last week', () => {
    expect(refundPercent('moderate', 45)).toBe(100);
    expect(refundPercent('moderate', 30)).toBe(100);
    expect(refundPercent('moderate', 10)).toBe(50);
    expect(refundPercent('moderate', 3)).toBe(0);
  });
  it('flexible and strict', () => {
    expect(refundPercent('flexible', 7)).toBe(100);
    expect(refundPercent('flexible', 2)).toBe(50);
    expect(refundPercent('strict', 100)).toBe(75);
    expect(refundPercent('strict', 40)).toBe(25);
    expect(refundPercent('strict', 10)).toBe(0);
  });
  it('owner or admin cancelling always refunds in full', () => {
    expect(refundPercent('strict', 1, 'owner')).toBe(100);
    expect(refundPercent('strict', 1, 'admin')).toBe(100);
  });
});

describe('mock payment gateway', () => {
  const gw = createMockProvider({ secret: 'test-secret' });
  it('signs like Razorpay and verifies its own signature', async () => {
    const { orderId } = await gw.createOrder({ amount: 500000 });
    const paid = gw.simulateCheckout({ orderId });
    expect(gw.verifyPayment(paid)).toBe(true);
  });
  it('rejects a tampered payment', async () => {
    const { orderId } = await gw.createOrder({ amount: 500000 });
    const paid = gw.simulateCheckout({ orderId });
    expect(gw.verifyPayment({ ...paid, paymentId: 'pay_MOCKFAKE00000' })).toBe(false);
    expect(gw.verifyPayment({ ...paid, signature: 'x'.repeat(64) })).toBe(false);
  });
});

describe('request validation', () => {
  it('only lets people sign up as user or owner', () => {
    expect(() => registerBody.parse({ name: 'X Y', email: 'a@b.co', password: '12345678', role: 'admin' })).toThrow();
    expect(registerBody.parse({ name: 'Priya', email: 'P@B.CO', password: '12345678' })).toMatchObject({ role: 'user', email: 'p@b.co' });
  });
  it('parses search filters from the query string', () => {
    const q = searchQuery.parse({ district: 'Madurai', guests: '500', amenities: 'ac,parking', lat: '9.92', lng: '78.12' });
    expect(q).toMatchObject({ type: 'marriage-hall', guests: 500, amenities: ['ac', 'parking'], radiusKm: 25, page: 1 });
    expect(() => searchQuery.parse({ district: 'Bengaluru' })).toThrow();
  });
  it('accepts Indian mobile numbers only', () => {
    const base = { venueId: 'a'.repeat(24), date: '2026-12-14', slotKey: 'MORNING', guests: 300 };
    expect(createBookingBody.parse({ ...base, contactPhone: '9876543210' }).contactPhone).toBe('9876543210');
    expect(() => createBookingBody.parse({ ...base, contactPhone: '12345' })).toThrow();
  });
});
