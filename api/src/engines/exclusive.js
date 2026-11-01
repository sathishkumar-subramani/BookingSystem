// EXCLUSIVE booking engine — one booking takes the whole venue for a slot (marriage halls, party halls).
//
// A day is split into "units" (MORNING, EVENING). A slot occupies one or more units:
//   MORNING → [MORNING]    EVENING → [EVENING]    FULL_DAY → [MORNING, EVENING]
// Taking a slot = inserting one SlotLock per unit. The unique index on (venueId, date, unit) means
// a second insert for the same unit fails inside MongoDB, so two people can never hold the same unit.
//
// Analogy: a row of lockers with one key each. Whoever's hand reaches the key first gets the locker;
// the other hand simply finds the hook empty. No "check then take" gap for a race to slip through.

import { SlotLock } from '../models/SlotLock.js';
import { conflict, isDuplicateKey } from '../lib/errors.js';

const SLOT_TAKEN_MESSAGE = 'Sorry — someone just took this slot. Please pick another session or date.';

/** A lock counts as taken unless it is a hold whose time has run out. */
export const activeLockFilter = (now = new Date()) => ({
  $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }],
});

async function insertLock(doc) {
  try {
    return await SlotLock.create(doc);
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    // The unit is locked. If it is only a hold that already expired (MongoDB's TTL sweeper can lag
    // up to a minute), remove that stale hold — only if it is still stale — and try once more.
    const stale = await SlotLock.deleteOne({
      venueId: doc.venueId,
      date: doc.date,
      unit: doc.unit,
      kind: 'hold',
      expiresAt: { $lte: new Date() },
    });
    if (stale.deletedCount === 1) {
      try {
        return await SlotLock.create(doc);
      } catch (err2) {
        if (isDuplicateKey(err2)) throw conflict(SLOT_TAKEN_MESSAGE, 'SLOT_TAKEN');
        throw err2;
      }
    }
    throw conflict(SLOT_TAKEN_MESSAGE, 'SLOT_TAKEN');
  }
}

/**
 * Lock every unit of a slot, all-or-nothing. If any unit is taken, the units this call already
 * locked are released again, so a failed FULL_DAY attempt never leaves a stray MORNING lock behind.
 */
export async function acquireUnits({ venueId, date, units, kind, bookingId, expiresAt, note }) {
  const taken = [];
  for (const unit of units) {
    try {
      const lock = await insertLock({ venueId, date, unit, kind, bookingId, expiresAt, note });
      taken.push(lock._id);
    } catch (err) {
      if (taken.length) await SlotLock.deleteMany({ _id: { $in: taken } });
      throw err;
    }
  }
  return taken;
}

/** Turn a booking's holds into permanent booking locks. Returns how many units are now secured. */
export async function convertHoldsToBooking(bookingId) {
  await SlotLock.updateMany(
    { bookingId, kind: 'hold' },
    { $set: { kind: 'booking' }, $unset: { expiresAt: 1 } },
  );
  return SlotLock.countDocuments({ bookingId, kind: 'booking' });
}

export async function releaseBooking(bookingId) {
  await SlotLock.deleteMany({ bookingId });
}

/** Map of date → unit → lock (only active locks) for one venue across many dates. */
export async function locksByDate(venueId, dates, now = new Date()) {
  const locks = await SlotLock.find({ venueId, date: { $in: dates }, ...activeLockFilter(now) }).lean();
  const map = new Map();
  for (const lock of locks) {
    if (!map.has(lock.date)) map.set(lock.date, {});
    map.get(lock.date)[lock.unit] = lock;
  }
  return map;
}

/** Is every unit of this slot free, given the unit → lock map for that date? */
export const slotIsFree = (slot, unitLocks = {}) => slot.units.every((u) => !unitLocks[u]);

export const exclusiveEngine = {
  mode: 'EXCLUSIVE',
  implemented: true,
  acquireUnits,
  convertHoldsToBooking,
  releaseBooking,
  locksByDate,
  slotIsFree,
};
