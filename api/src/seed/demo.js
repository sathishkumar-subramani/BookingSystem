import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { config } from '../config.js';
import { DEFAULT_VENUE_TYPES } from '../data/venueTypes.js';
import { addDays, todayIST } from '../lib/dates.js';
import { randomCode, slugify } from '../lib/ids.js';
import { logger } from '../lib/logger.js';
import { priceBooking } from '../lib/policy.js';
import { Booking } from '../models/Booking.js';
import { Payment } from '../models/Payment.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { SlotLock } from '../models/SlotLock.js';
import { User } from '../models/User.js';
import { Venue } from '../models/Venue.js';
import { ensureVenueTypes } from '../services/catalog.service.js';
import { DEMO_CUSTOMERS, DEMO_HALLS, DEMO_OWNERS } from './halls.js';

export const DEMO_DOMAIN = '@arangam.demo';
export const DEMO_PASSWORDS = { admin: 'Admin@1234', owner: 'Owner@1234', user: 'User@1234' };

// Small deterministic random generator so every seed produces the same halls and prices.
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TIERS = {
  classic: {
    seating: [350, 800],
    rooms: [3, 8],
    parking: [15, 60],
    prices: { MORNING: [45_000, 85_000], EVENING: [35_000, 65_000], FULL_DAY: [75_000, 1_30_000] },
    amenities: ['dining', 'parking', 'kitchen', 'generator', 'bridal-room', 'rooms'],
    extras: ['ac', 'sound', 'stage'],
    policies: ['flexible', 'moderate'],
    advance: [20, 25],
  },
  premium: {
    seating: [800, 1500],
    rooms: [8, 16],
    parking: [60, 150],
    prices: { MORNING: [1_00_000, 1_80_000], EVENING: [90_000, 1_50_000], FULL_DAY: [1_60_000, 3_00_000] },
    amenities: ['ac', 'dining', 'parking', 'kitchen', 'generator', 'bridal-room', 'rooms', 'lift', 'stage', 'sound'],
    extras: ['in-house-catering', 'wheelchair'],
    policies: ['moderate'],
    advance: [25, 30],
  },
  grand: {
    seating: [1500, 3500],
    rooms: [16, 40],
    parking: [150, 400],
    prices: { MORNING: [2_00_000, 3_50_000], EVENING: [1_80_000, 3_00_000], FULL_DAY: [3_50_000, 6_00_000] },
    amenities: ['ac', 'dining', 'parking', 'generator', 'bridal-room', 'rooms', 'lift', 'stage', 'sound', 'in-house-catering', 'valet', 'wheelchair'],
    extras: ['kitchen'],
    policies: ['moderate', 'strict'],
    advance: [30, 40],
  },
};

const CITY_FACTOR = { Chennai: 1.3, Coimbatore: 1.15, Tambaram: 1.1, Madurai: 1.05, Tiruchirappalli: 1.0, Hosur: 1.05 };

const TAGLINES = {
  classic: [
    'Traditional mandapam with banana-leaf dining',
    'Homely hall a short walk from the temple',
    'Old-world mandapam, new kitchen and power backup',
    'Family-run hall known for smooth muhurthams',
  ],
  premium: [
    'Fully air-conditioned hall with a separate dining floor',
    'Bright AC hall, lift to dining, rooms for both families',
    'Modern mahal with parking right at the gate',
  ],
  grand: [
    'Pillarless convention hall with in-house catering',
    'Grand venue for big weddings, valet at the entrance',
    'Twin halls — muhurtham upstairs, reception downstairs',
  ],
};

const describe = (h, tier, seating, dining, rooms) => {
  const base = {
    classic: `${h.name} is a traditional kalyana mandapam in ${h.area}, ${h.city}. The main hall seats about ${seating} guests and the dining hall serves ${dining} at a time in banana-leaf pandhi. ${rooms} rooms for the bride's and groom's families, a large kitchen where your own caterer can cook, and generator backup for the whole building.`,
    premium: `${h.name} in ${h.area}, ${h.city} is a fully air-conditioned marriage hall seating ${seating}. A lift takes guests to the ${dining}-seat dining hall, the stage comes with basic decoration and sound, and ${rooms} AC rooms are included for both families.`,
    grand: `${h.name} is one of the largest venues in ${h.city} — a pillarless hall for ${seating} guests with in-house catering for ${dining} per sitting, valet parking and ${rooms} guest rooms. Popular for combined reception-and-muhurtham bookings.`,
  }[tier];
  return `${base}\n\nThis is demo data for the Arangam prototype — the hall is fictional.`;
};

const between = (rng, [lo, hi]) => lo + Math.floor(rng() * (hi - lo + 1));
const roundTo = (n, step) => Math.round(n / step) * step;
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

export async function resetDemo() {
  const demoUsers = await User.find({ email: { $regex: `${DEMO_DOMAIN.replace('.', '\\.')}$` } }).select('_id');
  const userIds = demoUsers.map((u) => u._id);
  const venues = await Venue.find({ isDemo: true }).select('_id');
  const venueIds = venues.map((v) => v._id);
  await Promise.all([
    SlotLock.deleteMany({ venueId: { $in: venueIds } }),
    Booking.deleteMany({ $or: [{ isDemo: true }, { venueId: { $in: venueIds } }] }),
    Payment.deleteMany({ $or: [{ isDemo: true }, { userId: { $in: userIds } }] }),
    RefreshToken.deleteMany({ userId: { $in: userIds } }),
  ]);
  await Venue.deleteMany({ _id: { $in: venueIds } });
  await User.deleteMany({ _id: { $in: userIds } });
}

export async function seedDemo({ now = new Date() } = {}) {
  await ensureVenueTypes();
  const rng = makeRng(20261101);
  const today = todayIST(now);
  const [adminHash, ownerHash, userHash] = await Promise.all([
    bcrypt.hash(DEMO_PASSWORDS.admin, 10),
    bcrypt.hash(DEMO_PASSWORDS.owner, 10),
    bcrypt.hash(DEMO_PASSWORDS.user, 10),
  ]);

  // ── people ──
  await User.create({ name: 'Arangam Admin', email: `admin${DEMO_DOMAIN}`, passwordHash: adminHash, role: 'admin' });
  const owners = await User.insertMany(
    DEMO_OWNERS.map((o) => ({
      name: o.name,
      email: o.email,
      phone: o.phone,
      passwordHash: ownerHash,
      role: 'owner',
      owner: { status: o.status, businessName: o.business, city: o.city, reviewedAt: o.status === 'approved' ? now : undefined },
    })),
  );
  const customers = await User.insertMany(
    DEMO_CUSTOMERS.map((c) => ({ name: c.name, email: c.email, phone: c.phone, passwordHash: userHash, role: 'user' })),
  );

  // ── halls ──
  const hallTemplates = DEFAULT_VENUE_TYPES.find((t) => t.key === 'marriage-hall').slotTemplates;
  const venues = DEMO_HALLS.map((h, i) => {
    const tier = TIERS[h.tier];
    const factor = CITY_FACTOR[h.city] ?? 0.9 + rng() * 0.15;
    const seating = roundTo(between(rng, tier.seating), 50);
    const dining = roundTo(seating * (0.4 + rng() * 0.2), 25);
    const rooms = between(rng, tier.rooms);
    const amenities = [...tier.amenities, ...tier.extras.filter(() => rng() < 0.4)];
    const slots = hallTemplates.map((t) => ({
      key: t.key,
      label: t.label,
      start: t.start,
      end: t.end,
      units: t.units,
      price: roundTo(between(rng, tier.prices[t.key]) * factor, 500) * 100,
      enabled: !(h.tier === 'grand' && t.key === 'EVENING' && rng() < 0.3), // a few big halls sell only full days + mornings
    }));
    const status = h.status || 'approved';
    return {
      typeKey: 'marriage-hall',
      ownerId: owners[h.owner]._id,
      name: h.name,
      slug: `${slugify(`${h.name} ${h.city}`)}-${String(i + 1).padStart(2, '0')}`,
      tagline: pick(rng, TAGLINES[h.tier]),
      description: describe(h, h.tier, seating, dining, rooms),
      address: { line1: `${10 + Math.floor(rng() * 180)}, ${h.area}`, area: h.area, city: h.city, district: h.district, state: 'Tamil Nadu' },
      location: { type: 'Point', coordinates: [h.lng, h.lat] },
      capacity: { seating, dining },
      rooms,
      parkingCars: between(rng, tier.parking),
      amenities,
      slots,
      minPrice: Math.min(...slots.filter((s) => s.enabled).map((s) => s.price)),
      advancePercent: pick(rng, tier.advance),
      cancellationPolicy: pick(rng, tier.policies),
      contactPhone: DEMO_OWNERS[h.owner].phone,
      coverStyle: i % 8,
      status,
      submittedAt: now,
      approvedAt: status === 'approved' ? now : undefined,
      specialPricing: [],
      isDemo: true,
    };
  });

  // A few busy "peak demand" days per month with higher prices, so the calendar shows the feature.
  const peakDays = [];
  for (let d = 3; d < 150; d += 7 + Math.floor(rng() * 6)) peakDays.push(addDays(today, d));
  for (const v of venues) {
    if (v.status !== 'approved') continue;
    v.specialPricing = peakDays.filter(() => rng() < 0.6).map((date) => ({ date, percent: pick(rng, [15, 20, 25]), note: 'Peak demand' }));
  }
  const savedVenues = await Venue.insertMany(venues);

  // ── bookings ──
  const bookings = [];
  const locks = [];
  const payments = [];
  const used = new Set();
  const take = (venue, date, units) => {
    const keys = units.map((u) => `${venue._id}|${date}|${u}`);
    if (keys.some((k) => used.has(k))) return false;
    keys.forEach((k) => used.add(k));
    return true;
  };

  function makeBooking(venue, customer, date, slot, status, extra = {}) {
    if (!take(venue, date, slot.units)) return null;
    const special = venue.specialPricing.find((s) => s.date === date);
    const pricing = priceBooking({
      slotPrice: slot.price,
      adjustmentPercent: special?.percent ?? 0,
      advancePercent: venue.advancePercent,
      platformFeePercent: config.platformFeePercent,
    });
    const _id = new mongoose.Types.ObjectId();
    const orderId = `order_MOCK${randomCode(12)}`;
    const paymentId = `pay_MOCK${randomCode(12)}`;
    const createdAt = new Date(now.getTime() - (5 + Math.floor(rng() * 60)) * 86_400_000);
    const guests = roundTo(Math.min(venue.capacity.seating, venue.capacity.seating * (0.5 + rng() * 0.45)), 25);
    const booking = {
      _id,
      code: `ARG-${randomCode(6)}`,
      venueId: venue._id,
      ownerId: venue.ownerId,
      userId: customer._id,
      typeKey: 'marriage-hall',
      bookingMode: 'EXCLUSIVE',
      venue: { name: venue.name, slug: venue.slug, city: venue.address.city, district: venue.address.district, area: venue.address.area, coverStyle: venue.coverStyle },
      date,
      slot: { key: slot.key, label: slot.label, start: slot.start, end: slot.end, units: slot.units },
      guests,
      eventKind: slot.key === 'EVENING' ? pick(rng, ['reception', 'engagement', 'reception']) : pick(rng, ['wedding', 'wedding', 'seemantham', 'ear-piercing']),
      contact: { name: customer.name, phone: customer.phone },
      pricing,
      cancellationPolicy: venue.cancellationPolicy,
      status,
      confirmedAt: createdAt,
      balanceStatus: status === 'COMPLETED' ? 'PAID_AT_VENUE' : 'DUE',
      balancePaidAt: status === 'COMPLETED' ? new Date(`${date}T06:00:00Z`) : undefined,
      payment: { provider: 'mock', orderId, paymentId, paidAt: createdAt },
      isDemo: true,
      createdAt,
      updatedAt: createdAt,
      ...extra,
    };
    bookings.push(booking);
    payments.push({ bookingId: _id, userId: customer._id, provider: 'mock', purpose: 'ADVANCE', amount: pricing.advance, orderId, paymentId, status: 'PAID', isDemo: true, createdAt });
    if (status === 'CONFIRMED' || status === 'COMPLETED') {
      for (const unit of slot.units) locks.push({ venueId: venue._id, date, unit, kind: 'booking', bookingId: _id });
    }
    return booking;
  }

  const approved = savedVenues.filter((v) => v.status === 'approved');
  const slotOf = (v, key) => v.slots.find((s) => s.key === key && s.enabled) || v.slots.find((s) => s.enabled);
  const byName = (name) => approved.find((v) => v.name === name);
  const [priya, ...others] = customers;

  // Priya (user@arangam.demo) — one upcoming, one past, one cancelled, so every screen has content.
  makeBooking(byName('Annapoorani Mahal'), priya, addDays(today, 24), slotOf(byName('Annapoorani Mahal'), 'MORNING'), 'CONFIRMED');
  makeBooking(byName('Kaveri Mahal'), priya, addDays(today, -40), slotOf(byName('Kaveri Mahal'), 'EVENING'), 'COMPLETED');
  const cancelled = makeBooking(byName('Ponni Mahal'), priya, addDays(today, 70), slotOf(byName('Ponni Mahal'), 'FULL_DAY'), 'CANCELLED');
  if (cancelled) {
    cancelled.cancellation = { by: 'user', reason: 'Changed the date', at: new Date(now.getTime() - 3 * 86_400_000), refundPercent: 100, refundAmount: cancelled.pricing.advance, refundId: `rfnd_MOCK${randomCode(12)}` };
    payments.push({ bookingId: cancelled._id, userId: priya._id, provider: 'mock', purpose: 'REFUND', amount: cancelled.pricing.advance, paymentId: cancelled.payment.paymentId, refundId: cancelled.cancellation.refundId, status: 'REFUNDED', isDemo: true });
  }

  for (const v of approved) {
    const upcoming = 1 + Math.floor(rng() * 4);
    for (let i = 0; i < upcoming; i += 1) {
      const date = addDays(today, 2 + Math.floor(rng() * 120));
      makeBooking(v, pick(rng, others), date, slotOf(v, pick(rng, ['MORNING', 'MORNING', 'EVENING', 'FULL_DAY'])), 'CONFIRMED');
    }
    if (rng() < 0.6) {
      makeBooking(v, pick(rng, others), addDays(today, -(3 + Math.floor(rng() * 50))), slotOf(v, 'MORNING'), 'COMPLETED');
    }
  }

  // The main owner has a few dates closed for their own reasons.
  const mainOwnerVenues = approved.filter((v) => v.ownerId.equals(owners[0]._id)).slice(0, 3);
  const blockNotes = ['Booked offline (phone)', 'Painting work', "Owner's family function"];
  mainOwnerVenues.forEach((v, i) => {
    const date = addDays(today, 6 + i * 9);
    const units = i === 2 ? ['MORNING', 'EVENING'] : ['EVENING'];
    if (units.every((u) => !used.has(`${v._id}|${date}|${u}`))) {
      units.forEach((u) => {
        used.add(`${v._id}|${date}|${u}`);
        locks.push({ venueId: v._id, date, unit: u, kind: 'block', note: blockNotes[i] });
      });
    }
  });

  await Booking.insertMany(bookings);
  await Payment.insertMany(payments);
  await SlotLock.insertMany(locks);

  logger.info({ venues: savedVenues.length, bookings: bookings.length, blocks: locks.filter((l) => l.kind === 'block').length }, 'Demo data seeded');
  return { venues: savedVenues.length, bookings: bookings.length, owners: owners.length, customers: customers.length };
}

/** Called on startup when SEED_DEMO_DATA=true — only seeds a database that has no venues at all. */
export async function seedIfEmpty() {
  if ((await Venue.estimatedDocumentCount()) > 0) return null;
  if (await User.exists({ email: `admin${DEMO_DOMAIN}` })) return null;
  return seedDemo();
}
