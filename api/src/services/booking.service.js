import mongoose from 'mongoose';
import { config } from '../config.js';
import { engineFor } from '../engines/index.js';
import { daysBetween, todayIST } from '../lib/dates.js';
import { AppError, badRequest, conflict, forbidden, gone, notFound } from '../lib/errors.js';
import { bookingCode } from '../lib/ids.js';
import { percentOf } from '../lib/money.js';
import { priceBooking, refundPercent } from '../lib/policy.js';
import { Booking } from '../models/Booking.js';
import { Payment } from '../models/Payment.js';
import { SlotLock } from '../models/SlotLock.js';
import { Venue } from '../models/Venue.js';
import { paymentProvider } from '../providers/payments/index.js';
import { getVenueType } from './catalog.service.js';
import { isBookableDate } from './venue.service.js';

// A hold's SlotLock lives a little longer than the booking's own deadline, so that a payment that
// lands at 9:59 can still convert its locks before anyone else is allowed to treat them as stale.
const LOCK_GRACE_MS = 2 * 60 * 1000;
const SWEEP_GRACE_MS = 60 * 1000;
const MAX_OPEN_HOLDS = 2;

// ───────────────────────────── serialisation ─────────────────────────────

export function toBookingDto(doc, { view = 'user', venueContact } = {}) {
  const b = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    id: b._id.toString(),
    code: b.code,
    status: b.status,
    typeKey: b.typeKey,
    date: b.date,
    slot: b.slot,
    guests: b.guests,
    eventKind: b.eventKind,
    contact: b.contact,
    notes: b.notes ?? null,
    venue: { id: (b.venueId._id ?? b.venueId).toString(), ...b.venue },
    venueContactPhone: view === 'user' && b.status === 'CONFIRMED' ? venueContact ?? null : undefined,
    pricing: b.pricing,
    cancellationPolicy: b.cancellationPolicy,
    holdExpiresAt: b.holdExpiresAt ?? null,
    confirmedAt: b.confirmedAt ?? null,
    balanceStatus: b.balanceStatus,
    balancePaidAt: b.balancePaidAt ?? null,
    payment: b.payment
      ? { provider: b.payment.provider, orderId: b.payment.orderId, paymentId: b.payment.paymentId ?? null, paidAt: b.payment.paidAt ?? null }
      : null,
    cancellation: b.cancellation?.at ? b.cancellation : null,
    customer: view !== 'user' && b.userId?.name ? { name: b.userId.name, email: b.userId.email, phone: b.userId.phone ?? null } : undefined,
    isDemo: Boolean(b.isDemo),
    createdAt: b.createdAt,
  };
}

// ───────────────────────────── housekeeping ─────────────────────────────

/** Expire holds nobody paid for, and mark past confirmed bookings completed. Safe to run any time. */
export async function sweep(now = new Date()) {
  const cutoff = new Date(now.getTime() - SWEEP_GRACE_MS);
  const stale = await Booking.find({ status: 'HELD', holdExpiresAt: { $lte: cutoff } }).select('_id').lean();
  if (stale.length) {
    const ids = stale.map((s) => s._id);
    await Booking.updateMany({ _id: { $in: ids }, status: 'HELD' }, { $set: { status: 'EXPIRED' } });
    // Only 'hold' locks — if one of these got confirmed a moment ago its locks are 'booking' now.
    await SlotLock.deleteMany({ bookingId: { $in: ids }, kind: 'hold' });
  }
  await Booking.updateMany({ status: 'CONFIRMED', date: { $lt: todayIST(now) } }, { $set: { status: 'COMPLETED' } });
}

let lastSweep = 0;
export async function maybeSweep(now = new Date()) {
  if (now.getTime() - lastSweep < 15_000) return;
  lastSweep = now.getTime();
  await sweep(now);
}

// ───────────────────────────── create (hold) ─────────────────────────────

export async function createBooking(user, input, now = new Date()) {
  await maybeSweep(now);
  const venue = await Venue.findOne({ _id: input.venueId, status: 'approved' });
  if (!venue) throw notFound('Venue');
  if (venue.ownerId.equals(user._id)) throw forbidden('You cannot book your own venue — use “Block dates” instead');

  const type = await getVenueType(venue.typeKey);
  if (!type.enabled) throw new AppError(409, 'TYPE_DISABLED', `${type.name} are not taking bookings right now`);
  const engine = engineFor(type.bookingMode);

  if (!isBookableDate(input.date, now)) {
    throw badRequest(`Pick a date from tomorrow up to ${config.maxAdvanceDays} days ahead`);
  }
  const slot = venue.slots.find((s) => s.key === input.slotKey && s.enabled);
  if (!slot) throw badRequest('This hall does not offer that session');
  if (input.guests > venue.capacity.seating) {
    throw badRequest(`This hall seats up to ${venue.capacity.seating} guests`);
  }
  if (type.eventKinds.length && !type.eventKinds.includes(input.eventKind)) {
    throw badRequest('Unsupported event type');
  }

  // Stop one person from sitting on many dates at once (e.g. holding every muhurtham day in a month).
  const openHolds = await Booking.countDocuments({ userId: user._id, status: 'HELD', holdExpiresAt: { $gt: now } });
  if (openHolds >= MAX_OPEN_HOLDS) {
    throw conflict('You already have a booking waiting for payment. Finish or cancel it first.', 'TOO_MANY_HOLDS');
  }

  const special = venue.specialPricing.find((s) => s.date === input.date);
  const pricing = priceBooking({
    slotPrice: slot.price,
    adjustmentPercent: special?.percent ?? 0,
    advancePercent: venue.advancePercent,
    platformFeePercent: config.platformFeePercent,
  });

  const bookingId = new mongoose.Types.ObjectId();
  const holdExpiresAt = new Date(now.getTime() + config.holdMinutes * 60_000);

  // 1. Take the slot (throws 409 SLOT_TAKEN if someone else has it).
  await engine.acquireUnits({
    venueId: venue._id,
    date: input.date,
    units: slot.units,
    kind: 'hold',
    bookingId,
    expiresAt: new Date(holdExpiresAt.getTime() + LOCK_GRACE_MS),
  });

  // 2. Record the booking and open a payment order. Undo the lock if either step fails.
  try {
    const code = bookingCode();
    const provider = paymentProvider();
    const order = await provider.createOrder({ amount: pricing.advance, receipt: code, notes: { bookingId: bookingId.toString() } });
    const booking = await Booking.create({
      _id: bookingId,
      code,
      venueId: venue._id,
      ownerId: venue.ownerId,
      userId: user._id,
      typeKey: venue.typeKey,
      bookingMode: type.bookingMode,
      venue: {
        name: venue.name,
        slug: venue.slug,
        city: venue.address.city,
        district: venue.address.district,
        area: venue.address.area,
        coverStyle: venue.coverStyle,
      },
      date: input.date,
      slot: { key: slot.key, label: slot.label, start: slot.start, end: slot.end, units: slot.units },
      guests: input.guests,
      eventKind: input.eventKind,
      contact: { name: input.contactName || user.name, phone: input.contactPhone || user.phone },
      notes: input.notes,
      pricing,
      cancellationPolicy: venue.cancellationPolicy,
      status: 'HELD',
      holdExpiresAt,
      payment: { provider: provider.name, orderId: order.orderId },
    });
    await Payment.create({
      bookingId,
      userId: user._id,
      provider: provider.name,
      purpose: 'ADVANCE',
      amount: pricing.advance,
      orderId: order.orderId,
    });
    return {
      booking: toBookingDto(booking),
      checkout: { ...provider.checkoutOptions(order), testMode: provider.testMode, bookingCode: code },
    };
  } catch (err) {
    await engine.releaseBooking(bookingId);
    await Booking.deleteOne({ _id: bookingId });
    throw err;
  }
}

// ───────────────────────────── mock checkout ─────────────────────────────

/** Plays the payment gateway's checkout page (mock provider only). */
export async function simulateCheckout(user, { orderId, outcome }) {
  const payment = await Payment.findOne({ orderId, purpose: 'ADVANCE' });
  if (!payment || !payment.userId.equals(user._id)) throw notFound('Payment order');
  if (outcome === 'failure') {
    payment.failureReason = 'Payment declined (simulated)';
    await payment.save();
    throw new AppError(402, 'PAYMENT_FAILED', 'Payment was declined. You can try again before your hold runs out.');
  }
  return paymentProvider().simulateCheckout({ orderId, amount: payment.amount });
}

// ───────────────────────────── confirm (after payment) ─────────────────────────────

/**
 * Give the whole advance back. The Payment row is claimed atomically first (CREATED/PAID → REFUNDED),
 * so two racing requests can never refund the same money twice.
 */
async function refundWholeAdvance(orderId, paymentId) {
  const claimed = await Payment.findOneAndUpdate(
    { orderId, purpose: 'ADVANCE', status: { $in: ['CREATED', 'PAID'] } },
    { $set: { status: 'REFUNDED', paymentId } },
    { returnDocument: 'after' },
  );
  if (!claimed) return null; // already refunded
  const refund = await paymentProvider().refund({ paymentId, amount: claimed.amount });
  claimed.refundId = refund.refundId;
  await claimed.save();
  return refund;
}

export async function confirmBooking(user, bookingId, { orderId, paymentId, signature }, now = new Date()) {
  const booking = await Booking.findById(bookingId);
  if (!booking || !booking.userId.equals(user._id)) throw notFound('Booking');

  // Idempotent: the app may retry after a flaky network.
  if (booking.status === 'CONFIRMED' && booking.payment?.paymentId === paymentId) return toBookingDto(booking);
  if (booking.payment?.orderId !== orderId) throw badRequest('Payment does not belong to this booking');

  const provider = paymentProvider();
  if (!provider.verifyPayment({ orderId, paymentId, signature })) {
    throw new AppError(400, 'PAYMENT_INVALID', 'Payment could not be verified');
  }
  const payment = await Payment.findOne({ orderId });
  const engine = engineFor(booking.bookingMode);

  // Real money for a booking that is no longer waiting (expired by the sweep, or abandoned):
  // never keep it — refund in full, once.
  if (booking.status !== 'HELD') {
    if (['EXPIRED', 'CANCELLED'].includes(booking.status) && !booking.payment?.paymentId) {
      await refundWholeAdvance(orderId, paymentId);
      throw gone('Your hold ran out before the payment finished. The advance has been refunded in full.', 'HOLD_EXPIRED');
    }
    throw conflict(`This booking is ${booking.status.toLowerCase()}`, 'NOT_HELD');
  }

  // Money arrived after the 10 minutes were up: give it back, don't confirm.
  if (booking.holdExpiresAt <= now) {
    await Booking.updateOne({ _id: booking._id, status: 'HELD' }, { $set: { status: 'EXPIRED' } });
    await engine.releaseBooking(booking._id);
    await refundWholeAdvance(orderId, paymentId);
    throw gone('Your hold ran out before the payment finished. The advance has been refunded in full.', 'HOLD_EXPIRED');
  }

  const secured = await engine.convertHoldsToBooking(booking._id);
  if (secured < booking.slot.units.length) {
    await engine.releaseBooking(booking._id);
    await Booking.updateOne(
      { _id: booking._id, status: 'HELD' },
      { $set: { status: 'CANCELLED', cancellation: { by: 'system', reason: 'Slot no longer available', at: now, refundPercent: 100, refundAmount: booking.pricing.advance } } },
    );
    await refundWholeAdvance(orderId, paymentId);
    throw conflict('Sorry — the slot was lost before payment completed. Your advance has been refunded.', 'SLOT_TAKEN');
  }

  const confirmed = await Booking.findOneAndUpdate(
    { _id: booking._id, status: 'HELD' },
    {
      $set: { status: 'CONFIRMED', confirmedAt: now, 'payment.paymentId': paymentId, 'payment.paidAt': now },
      $unset: { holdExpiresAt: 1 },
    },
    { returnDocument: 'after' },
  );
  if (!confirmed) {
    // The expiry sweep got there first.
    await engine.releaseBooking(booking._id);
    await refundWholeAdvance(orderId, paymentId);
    throw gone('Your hold ran out before the payment finished. The advance has been refunded in full.', 'HOLD_EXPIRED');
  }
  if (payment) {
    payment.status = 'PAID';
    payment.paymentId = paymentId;
    await payment.save();
  }
  const venue = await Venue.findById(confirmed.venueId).select('contactPhone');
  return toBookingDto(confirmed, { venueContact: venue?.contactPhone });
}

// ───────────────────────────── cancel ─────────────────────────────

function assertCanTouch(actor, booking) {
  const id = actor._id;
  if (actor.role === 'admin') return 'admin';
  if (actor.role === 'owner' && booking.ownerId.equals(id)) return 'owner';
  if (booking.userId.equals(id)) return 'user';
  throw notFound('Booking');
}

export function quoteCancellation(booking, by, now = new Date()) {
  if (booking.status === 'HELD') return { refundPercent: 0, refundAmount: 0, daysBefore: null, cancellable: true };
  if (booking.status !== 'CONFIRMED') return { refundPercent: 0, refundAmount: 0, daysBefore: null, cancellable: false };
  const daysBefore = daysBetween(todayIST(now), booking.date);
  if (daysBefore < 0) return { refundPercent: 0, refundAmount: 0, daysBefore, cancellable: false };
  const pct = refundPercent(booking.cancellationPolicy, daysBefore, by);
  return { refundPercent: pct, refundAmount: percentOf(booking.pricing.advance, pct), daysBefore, cancellable: true };
}

export async function cancellationQuote(actor, bookingId, now = new Date()) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw notFound('Booking');
  const by = assertCanTouch(actor, booking);
  return { ...quoteCancellation(booking, by, now), policy: booking.cancellationPolicy, by };
}

export async function cancelBooking(actor, bookingId, { reason }, now = new Date()) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw notFound('Booking');
  const by = assertCanTouch(actor, booking);
  const quote = quoteCancellation(booking, by, now);
  if (!quote.cancellable) throw conflict('This booking can no longer be cancelled', 'NOT_CANCELLABLE');
  if (booking.status === 'HELD' && by === 'owner') throw conflict('This booking is still waiting for payment');

  const cancellation = {
    by,
    reason: reason || null,
    at: now,
    refundPercent: quote.refundPercent,
    refundAmount: quote.refundAmount,
  };
  // Flip the status first and only once — this is what prevents a double refund on a double click.
  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: booking.status },
    { $set: { status: 'CANCELLED', cancellation }, $unset: { holdExpiresAt: 1 } },
    { returnDocument: 'after' },
  );
  if (!updated) throw conflict('This booking changed just now — please refresh', 'STALE');
  await engineFor(booking.bookingMode).releaseBooking(booking._id);

  if (quote.refundAmount > 0 && booking.payment?.paymentId) {
    const provider = paymentProvider();
    const refund = await provider.refund({ paymentId: booking.payment.paymentId, amount: quote.refundAmount });
    await Payment.create({
      bookingId: booking._id,
      userId: booking.userId,
      provider: provider.name,
      purpose: 'REFUND',
      amount: quote.refundAmount,
      paymentId: booking.payment.paymentId,
      refundId: refund.refundId,
      status: 'REFUNDED',
    });
    updated.cancellation.refundId = refund.refundId;
    await updated.save();
  }
  return toBookingDto(updated, { view: by === 'user' ? 'user' : 'staff' });
}

// ───────────────────────────── reads ─────────────────────────────

const LIST_FILTERS = {
  upcoming: (today) => ({ status: { $in: ['HELD', 'CONFIRMED'] }, date: { $gte: today } }),
  past: (today) => ({ $or: [{ status: 'COMPLETED' }, { status: 'CONFIRMED', date: { $lt: today } }] }),
  cancelled: () => ({ status: { $in: ['CANCELLED', 'EXPIRED'] } }),
  all: () => ({}),
};

export async function listMyBookings(user, { status = 'all', page = 1, limit = 20 }, now = new Date()) {
  await maybeSweep(now);
  const filter = { userId: user._id, ...(LIST_FILTERS[status] || LIST_FILTERS.all)(todayIST(now)) };
  const sort = status === 'upcoming' ? { date: 1 } : { createdAt: -1 };
  const [items, total] = await Promise.all([
    Booking.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
    Booking.countDocuments(filter),
  ]);
  return { items: items.map((b) => toBookingDto(b)), total, page, pages: Math.ceil(total / limit) };
}

export async function getBooking(actor, bookingId, now = new Date()) {
  await maybeSweep(now);
  const booking = await Booking.findById(bookingId).populate('userId', 'name email phone');
  if (!booking) throw notFound('Booking');
  // userId is populated here, so hand assertCanTouch the raw ids.
  const by = assertCanTouch(actor, { ownerId: booking.ownerId, userId: booking.userId._id });
  const venue = await Venue.findById(booking.venueId).select('contactPhone');
  return {
    ...toBookingDto(booking, { view: by === 'user' ? 'user' : 'staff', venueContact: venue?.contactPhone }),
    cancelQuote: quoteCancellation(booking, by, now),
  };
}

export async function markBalancePaid(owner, bookingId, now = new Date()) {
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, ownerId: owner._id, status: { $in: ['CONFIRMED', 'COMPLETED'] }, balanceStatus: 'DUE' },
    { $set: { balanceStatus: 'PAID_AT_VENUE', balancePaidAt: now } },
    { returnDocument: 'after' },
  ).populate('userId', 'name email phone');
  if (!booking) throw conflict('Only confirmed bookings with a balance due can be marked paid');
  return toBookingDto(booking, { view: 'staff' });
}
