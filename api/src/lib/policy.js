// Pure business rules — no database, so they are easy to read and unit-test.
import { percentOf } from './money.js';

// Refund of the ADVANCE when the customer cancels, by days left before the event.
// Owner or admin cancelling always refunds 100% — the customer did nothing wrong.
export const REFUND_RULES = {
  flexible: [
    { minDays: 7, percent: 100 },
    { minDays: 2, percent: 50 },
  ],
  moderate: [
    { minDays: 30, percent: 100 },
    { minDays: 7, percent: 50 },
  ],
  strict: [
    { minDays: 90, percent: 75 },
    { minDays: 30, percent: 25 },
  ],
};

export function refundPercent(policy, daysBefore, cancelledBy = 'user') {
  if (cancelledBy !== 'user') return 100;
  const rules = REFUND_RULES[policy] || REFUND_RULES.moderate;
  const rule = rules.find((r) => daysBefore >= r.minDays);
  return rule ? rule.percent : 0;
}

export const describePolicy = (policy) =>
  (REFUND_RULES[policy] || REFUND_RULES.moderate).map((r) => ({ minDays: r.minDays, percent: r.percent }));

/**
 * Price breakdown for one booking. Everything in paise.
 *   total   = slot price ± special-date adjustment (e.g. +20% on a big muhurtham day)
 *   advance = advancePercent of total, paid online now
 *   balance = paid at the hall
 *   platformFee = our commission on the total, taken from the advance
 */
export function priceBooking({ slotPrice, adjustmentPercent = 0, advancePercent, platformFeePercent }) {
  const total = Math.round((slotPrice * (100 + adjustmentPercent)) / 100 / 100) * 100;
  const advance = Math.min(total, percentOf(total, advancePercent));
  const platformFee = Math.min(advance, percentOf(total, platformFeePercent));
  return {
    base: slotPrice,
    adjustmentPercent,
    total,
    advance,
    balance: total - advance,
    platformFee,
    ownerPayoutNow: advance - platformFee,
  };
}
