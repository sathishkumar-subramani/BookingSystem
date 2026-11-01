import { describe, expect, it } from 'vitest';
import { addDaysISO, clock, describeRules, inr, inrShort, shiftMonth } from '../utils/format';

describe('format', () => {
  it('shows rupees with Indian grouping from paise', () => {
    expect(inr(1_20_000_00)).toBe('₹1,20,000');
    expect(inr(5_00)).toBe('₹5');
  });
  it('shortens big amounts to lakh and crore', () => {
    expect(inrShort(1_50_000_00)).toBe('₹1.5 L');
    expect(inrShort(2_00_00_000_00)).toBe('₹2 Cr');
    expect(inrShort(85_000_00)).toBe('₹85 K');
  });
  it('formats 24-hour times the way people say them', () => {
    expect(clock('05:00')).toBe('5 am');
    expect(clock('16:30')).toBe('4:30 pm');
    expect(clock('12:00')).toBe('12 pm');
  });
  it('moves across month and year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('explains a cancellation policy in plain words', () => {
    expect(describeRules([{ minDays: 30, percent: 100 }, { minDays: 7, percent: 50 }])).toEqual([
      '100% back if you cancel 30+ days before',
      '50% back if you cancel 7+ days before',
      'nothing back within 7 days',
    ]);
  });
});
