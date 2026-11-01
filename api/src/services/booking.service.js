import mongoose from 'mongoose';
import { config } from '../config.js';
import { engineFor } from '../engines/index.js';
import { daysBetween, todayIST } from '../lib/dates.js';
import { AppError, badRequest, conflict, forbidden, gone, isDuplicateKey, notFound } from '../lib/errors.js';
import { bookingCode } from '../lib/ids.js';
import { percentOf } from '../lib/money.js';
import { priceBooking, refundPercent } from '../lib/policy.js';
import { logger } from '../lib/logger.js';
import { Booking } from '../models/Booking.js';
import { HoldTicket } from '../models/HoldTicket.js';
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
const EXPIRED_MESSAGE = 'Your hold ran out before the payment finished. The advance has been refunded in full.';

/** Take one of the user's hold tickets, atomically. Throws TOO_MANY_HOLDS when both are in use. */
async function acquireHoldTicket(userId, bookingId, expiresAt, now) {
  for (let n = 0; n < MAX_OPEN_HOLDS; n += 1) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await HoldTicket.create({ userId, n, bookingId, expiresAt });
        return;
      } catch (err) {
        if (!isDuplicateKey(err)) throw err;
        // A ticket whose hold already ran out doesn't count (the TTL sweeper may lag a minute).
        const stale = await HoldTicket.deleteOne({ userId, n, expiresAt: { $lte: now } });
        if (!stale.deletedCount) break;
      }
    }
  }
  throw conflict('You already have bookings waiting for payment. Finish or cancel one first.', 'TOO_MANY_HOLDS');
}
const releaseHoldTicket = (bookingId) => HoldTicket.deleteMany({ bookingId });

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
    await HoldTicket.deleteMany({ bookingId: { $in: ids } });
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

  const special = venue.specialPricing.find((s) => s.date === input.date);
  const pricing = priceBooking({
    slotPrice: slot.price,
    adjustmentPercent: special?.percent ?? 0,
    advancePercent: venue.advancePercent,
    platformFeePercent: config.platformFeePercent,
  });

  const bookingId = new mongoose.Types.ObjectId();
  const holdExpiresAt = new Date(now.getTime() + config.holdMinutes * 60_000);

  // 1. Stop one person sitting on many dates at once (e.g. every muhurtham day in a month): 2 open holds max.
  await acquireHoldTicket(user._id, bookingId, holdExpiresAt, now);

  // 2. Take the slot (throws 409 SLOT_TAKEN if someone else has it).
  try {
    await engine.acquireUnits({
      venueId: venue._id,
      date: input.date,
      units: slot.units,
      kind: 'hold',
      bookingId,
      expiresAt: new Date(holdExpiresAt.getTime() + LOCK_GRACE_MS),
    });
  } catch (err) {
    await releaseHoldTicket(bookingId);
    throw err;
  }

  // 3. Record the booking and open a payment order. Undo the locks if either step fails.
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
    await releaseHoldTicket(bookingId);
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
 * Give the whole advance back. Only ever called by the request that owns the payment (status PROCESSING).
 * The row goes REFUNDING → REFUNDED, or REFUND_FAILED if the gateway errors, so a failed refund is visible
 * (admin can retry it) instead of being silently marked as done.
 */
async function refundWholeAdvance(orderId, paymentId) {
  const row = await Payment.findOneAndUpdate(
    { orderId, purpose: 'ADVANCE', status: 'PROCESSING' },
    { $set: { status: 'REFUNDING', paymentId } },
    { returnDocument: 'after' },
  );
  if (!row) return null;
  try {
    const refund = await paymentProvider().refund({ paymentId, amount: row.amount });
    await Payment.updateOne({ _id: row._id, status: 'REFUNDING' }, { $set: { status: 'REFUNDED', refundId: refund.refundId } });
    return refund;
  } catch (err) {
    await Payment.updateOne({ _id: row._id, status: 'REFUNDING' }, { $set: { status: 'REFUND_FAILED', failureReason: err.message } });
    logger.error({ err: { message: err.message }, orderId }, 'Refund failed — needs a manual retry');
    return null;
  }
}

export async function confirmBooking(user, bookingId, { orderId, paymentId, signature }, now = new Date()) {
  const booking = await Booking.findById(bookingId);
  if (!booking || !booking.userId.equals(user._id)) throw notFound('Booking');

  const done = async (b) => {
    const venue = await Venue.findById(b.venueId).select('contactPhone');
    return toBookingDto(b, { venueContact: venue?.contactPhone });
  };
  // Idempotent: the app may retry after a flaky network.
  if (booking.status === 'CONFIRMED' && booking.payment?.paymentId === paymentId) return done(booking);
  if (booking.payment?.orderId !== orderId) throw badRequest('Payment does not belong to this booking');

  if (!paymentProvider().verifyPayment({ orderId, paymentId, signature })) {
    throw new AppError(400, 'PAYMENT_INVALID', 'Payment could not be verified');
  }

  // Claim the payment. From here on exactly one request handles this money: a double tap or a retry
  // that arrives while we're working gets "already processing" and touches nothing.
  const claim = await Payment.findOneAndUpdate(
    { orderId, purpose: 'ADVANCE', status: 'CREATED' },
    { $set: { status: 'PROCESSING', paymentId } },
    { returnDocument: 'after' },
  );
  if (!claim) {
    const fresh = await Booking.findById(booking._id);
    if (fresh?.status === 'CONFIRMED' && fresh.payment?.paymentId === paymentId) return done(fresh);
    throw conflict('This payment is already being processed. Refresh in a moment.', 'PAYMENT_IN_PROGRESS');
  }

  const engine = engineFor(booking.bookingMode);
  // Not confirming after all: give the money back. We own the payment, so no other request can confirm
  // this booking, which makes releasing its locks safe in every branch below.
  const giveBack = async (bookingUpdate, error) => {
    if (bookingUpdate) await Booking.updateOne({ _id: booking._id, status: 'HELD' }, { $set: bookingUpdate });
    await engine.releaseBooking(booking._id);
    await releaseHoldTicket(booking._id);
    await refundWholeAdvance(orderId, paymentId);
    throw error;
  };

  // Money for a hold that already ran out, or that was released/cancelled: never keep it.
  if (booking.status !== 'HELD' || booking.holdExpiresAt <= now) {
    return giveBack({ status: 'EXPIRED' }, gone(EXPIRED_MESSAGE, 'HOLD_EXPIRED'));
  }

  const secured = await engine.convertHoldsToBooking(booking._id);
  if (secured < booking.slot.units.length) {
    return giveBack(
      { status: 'CANCELLED', cancellation: { by: 'system', reason: 'Slot no longer available', at: now, refundPercent: 100, refundAmount: booking.pricing.advance, refundStatus: 'REFUNDED' } },
      conflict('Sorry — the slot was lost before payment completed. Your advance has been refunded.', 'SLOT_TAKEN'),
    );
  }

  const confirmed = await Booking.findOneAndUpdate(
    { _id: booking._id, status: 'HELD' },
    {
      $set: { status: 'CONFIRMED', confirmedAt: now, 'payment.paymentId': paymentId, 'payment.paidAt': now },
      $unset: { holdExpiresAt: 1 },
    },
    { returnDocument: 'after' },
  );
  // The expiry sweep or a "release hold" got there first.
  if (!confirmed) return giveBack(null, gone(EXPIRED_MESSAGE, 'HOLD_EXPIRED'));

  await Payment.updateOne({ _id: claim._id, status: 'PROCESSING' }, { $set: { status: 'PAID' } });
  await releaseHoldTicket(booking._id);
  return done(confirmed);
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

  const willRefund = quote.refundAmount > 0 && Boolean(booking.payment?.paymentId);
  const cancellation = {
    by,
    reason: reason || null,
    at: now,
    refundPercent: quote.refundPercent,
    refundAmount: quote.refundAmount,
    refundStatus: willRefund ? 'PENDING' : 'NONE',
  };
  // Flip the status first and only once — this is what prevents a double refund on a double click.
  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: booking.status },
    { $set: { status: 'CANCELLED', cancellation }, $unset: { holdExpiresAt: 1 } },
    { returnDocument: 'after' },
  );
  if (!updated) throw conflict('This booking changed just now — please refresh', 'STALE');
  await engineFor(booking.bookingMode).releaseBooking(booking._id);
  await releaseHoldTicket(booking._id);

  if (willRefund) {
    // Write the refund down before calling the gateway, so a failure leaves a visible, retryable record.
    const provider = paymentProvider();
    const row = await Payment.create({
      bookingId: booking._id,
      userId: booking.userId,
      provider: provider.name,
      purpose: 'REFUND',
      amount: quote.refundAmount,
      paymentId: booking.payment.paymentId,
      status: 'PENDING',
    });
    try {
      const refund = await provider.refund({ paymentId: booking.payment.paymentId, amount: quote.refundAmount });
      row.status = 'REFUNDED';
      row.refundId = refund.refundId;
      updated.cancellation.refundId = refund.refundId;
      updated.cancellation.refundStatus = 'REFUNDED';
    } catch (err) {
      row.status = 'REFUND_FAILED';
      row.failureReason = err.message;
      updated.cancellation.refundStatus = 'FAILED';
      logger.error({ err: { message: err.message }, bookingId: booking._id.toString() }, 'Refund failed — needs a manual retry');
    }
    await row.save();
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
  const by = assertCanTouch(actor, { ownerId: booking.ownerId, userId: booking.userId?._id ?? booking.populated('userId') ?? booking.userId });
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
