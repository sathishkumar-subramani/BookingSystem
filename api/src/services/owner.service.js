import mongoose from 'mongoose';
import { engineFor } from '../engines/index.js';
import { todayIST } from '../lib/dates.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { randomCode, slugify } from '../lib/ids.js';
import { Booking } from '../models/Booking.js';
import { SlotLock } from '../models/SlotLock.js';
import { Venue } from '../models/Venue.js';
import { locationProvider } from '../providers/location/index.js';
import { maybeSweep, toBookingDto } from './booking.service.js';
import { getVenueType } from './catalog.service.js';
import { toVenueAdmin, venueAvailability } from './venue.service.js';

async function ownVenue(owner, venueId) {
  if (!mongoose.isValidObjectId(venueId)) throw notFound('Venue');
  const venue = await Venue.findOne({ _id: venueId, ownerId: owner._id });
  if (!venue) throw notFound('Venue');
  return venue;
}

/** Build the venue's slots from its type's templates + the owner's prices and timings. */
function buildSlots(type, inputSlots) {
  const slots = type.slotTemplates.map((t) => {
    const s = inputSlots.find((x) => x.key === t.key);
    return {
      key: t.key,
      label: t.label,
      start: s?.start || t.start,
      end: s?.end || t.end,
      units: t.units,
      price: s?.price ?? 0,
      enabled: Boolean(s?.enabled && s.price > 0),
    };
  });
  if (!slots.some((s) => s.enabled)) throw badRequest('Offer at least one session with a price');
  return slots;
}

async function resolveLocation(data) {
  if (data.location) return { type: 'Point', coordinates: [data.location.lng, data.location.lat] };
  const p = await locationProvider().geocode({ district: data.address.district, city: data.address.city });
  return { type: 'Point', coordinates: [p.lng, p.lat] };
}

export async function createVenue(owner, data) {
  const type = await getVenueType(data.typeKey);
  engineFor(type.bookingMode); // 501 if this kind of venue can't be booked yet
  const venue = new Venue({
    typeKey: type.key,
    ownerId: owner._id,
    name: data.name,
    slug: `${slugify(`${data.name} ${data.address.city}`)}-${randomCode(4).toLowerCase()}`,
    tagline: data.tagline,
    description: data.description,
    address: { ...data.address, state: 'Tamil Nadu' },
    location: await resolveLocation(data),
    capacity: data.capacity,
    rooms: data.rooms,
    parkingCars: data.parkingCars,
    amenities: data.amenities,
    slots: buildSlots(type, data.slots),
    advancePercent: data.advancePercent,
    cancellationPolicy: data.cancellationPolicy,
    contactPhone: data.contactPhone,
    coverStyle: Math.floor(Math.random() * 8),
    status: 'draft',
  });
  await venue.save();
  return toVenueAdmin(venue);
}

export async function updateVenue(owner, venueId, data) {
  const venue = await ownVenue(owner, venueId);
  if (venue.status === 'suspended') throw conflict('This venue is suspended by admin');
  const type = await getVenueType(venue.typeKey);
  const simple = ['name', 'tagline', 'description', 'capacity', 'rooms', 'parkingCars', 'amenities', 'advancePercent', 'cancellationPolicy', 'contactPhone'];
  for (const k of simple) if (data[k] !== undefined) venue[k] = data[k];
  if (data.address) {
    const districtChanged = data.address.district && data.address.district !== venue.address.district;
    venue.address = { ...venue.address.toObject(), ...data.address, state: 'Tamil Nadu' };
    // Only fall back to the district centre when the hall moved district and no new pin was sent;
    // editing a pincode must not throw away a location the owner pinned.
    if (!data.location && districtChanged) venue.location = await resolveLocation({ address: venue.address });
  }
  if (data.location) venue.location = { type: 'Point', coordinates: [data.location.lng, data.location.lat] };
  if (data.slots) venue.slots = buildSlots(type, data.slots);
  await venue.save();
  return toVenueAdmin(venue);
}

export async function submitVenue(owner, venueId) {
  const venue = await ownVenue(owner, venueId);
  if (!['draft', 'rejected'].includes(venue.status)) throw conflict(`Venue is already ${venue.status}`);
  if (!venue.contactPhone) throw badRequest('Add a contact phone number before submitting');
  venue.status = 'pending';
  venue.submittedAt = new Date();
  venue.reviewNote = undefined;
  await venue.save();
  return toVenueAdmin(venue);
}

export async function deleteVenue(owner, venueId) {
  const venue = await ownVenue(owner, venueId);
  if (!['draft', 'rejected'].includes(venue.status)) throw conflict('Only draft or rejected venues can be deleted');
  if (await Booking.exists({ venueId: venue._id })) throw conflict('This venue has bookings and cannot be deleted');
  await SlotLock.deleteMany({ venueId: venue._id });
  await venue.deleteOne();
}

export async function listOwnerVenues(owner) {
  const venues = await Venue.find({ ownerId: owner._id }).sort({ createdAt: -1 });
  const today = todayIST();
  const counts = await Booking.aggregate([
    { $match: { ownerId: owner._id, status: 'CONFIRMED', date: { $gte: today } } },
    { $group: { _id: '$venueId', n: { $sum: 1 } } },
  ]);
  const byVenue = new Map(counts.map((c) => [c._id.toString(), c.n]));
  return venues.map((v) => ({ ...toVenueAdmin(v), upcomingBookings: byVenue.get(v._id.toString()) ?? 0 }));
}

export async function getOwnerVenue(owner, venueId) {
  return toVenueAdmin(await ownVenue(owner, venueId));
}

export async function ownerCalendar(owner, venueId, month) {
  await maybeSweep();
  const venue = await ownVenue(owner, venueId);
  const type = await getVenueType(venue.typeKey);
  const days = await venueAvailability(venue, type, month, { detailed: true });
  const ids = days.flatMap((d) => d.locks.map((l) => l.bookingId)).filter(Boolean);
  const bookings = await Booking.find({ _id: { $in: ids } }).populate('userId', 'name phone');
  const info = new Map(
    bookings.map((b) => [
      b._id.toString(),
      { id: b._id.toString(), code: b.code, status: b.status, slot: b.slot.key, guests: b.guests, eventKind: b.eventKind, customer: b.contact?.name || b.userId?.name },
    ]),
  );
  for (const d of days) {
    d.bookings = [...new Set(d.locks.map((l) => l.bookingId).filter(Boolean))].map((id) => info.get(id)).filter(Boolean);
  }
  return { venue: { id: venue._id.toString(), name: venue.name, status: venue.status }, units: type.units, month, days };
}

export async function addBlock(owner, venueId, { date, slotKey, note }) {
  const venue = await ownVenue(owner, venueId);
  const type = await getVenueType(venue.typeKey);
  if (date < todayIST()) throw badRequest('Cannot block a past date');
  const tmpl = type.slotTemplates.find((t) => t.key === slotKey);
  if (!tmpl) throw badRequest('Unknown session');
  await engineFor(type.bookingMode).acquireUnits({ venueId: venue._id, date, units: tmpl.units, kind: 'block', note });
  return { ok: true };
}

export async function removeBlock(owner, venueId, { date, unit }) {
  const venue = await ownVenue(owner, venueId);
  const res = await SlotLock.deleteOne({ venueId: venue._id, date, unit, kind: 'block' });
  if (!res.deletedCount) throw notFound('Block');
  return { ok: true };
}

export async function setSpecialPrice(owner, venueId, { date, percent, note }) {
  const venue = await ownVenue(owner, venueId);
  if (date < todayIST()) throw badRequest('Cannot price a past date');
  venue.specialPricing = venue.specialPricing.filter((s) => s.date !== date);
  if (percent !== 0) venue.specialPricing.push({ date, percent, note });
  venue.specialPricing.sort((a, b) => a.date.localeCompare(b.date));
  // Drop past entries so the list doesn't grow forever.
  const today = todayIST();
  venue.specialPricing = venue.specialPricing.filter((s) => s.date >= today);
  await venue.save();
  return venue.specialPricing;
}

const OWNER_FILTERS = {
  upcoming: (today) => ({ status: { $in: ['HELD', 'CONFIRMED'] }, date: { $gte: today } }),
  past: (today) => ({ $or: [{ status: 'COMPLETED' }, { status: 'CONFIRMED', date: { $lt: today } }] }),
  cancelled: () => ({ status: { $in: ['CANCELLED', 'EXPIRED'] } }),
  balance: () => ({ status: { $in: ['CONFIRMED', 'COMPLETED'] }, balanceStatus: 'DUE' }),
  all: () => ({}),
};

export async function listOwnerBookings(owner, { status = 'upcoming', venueId, q, page = 1, limit = 20 }) {
  await maybeSweep();
  const filter = { ownerId: owner._id, ...(OWNER_FILTERS[status] || OWNER_FILTERS.all)(todayIST()) };
  if (venueId) filter.venueId = venueId;
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$and = [{ $or: [{ code: rx }, { 'contact.name': rx }, { 'contact.phone': rx }] }];
  }
  const sort = status === 'upcoming' ? { date: 1 } : { date: -1 };
  const [items, total] = await Promise.all([
    Booking.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).populate('userId', 'name email phone'),
    Booking.countDocuments(filter),
  ]);
  return { items: items.map((b) => toBookingDto(b, { view: 'staff' })), total, page, pages: Math.ceil(total / limit) };
}

export async function ownerSummary(owner) {
  await maybeSweep();
  const today = todayIST();
  const paid = { ownerId: owner._id, status: { $in: ['CONFIRMED', 'COMPLETED'] } };
  const [venueStatus, upcomingCount, nextBookings, moneyRows, byMonth, held] = await Promise.all([
    Venue.aggregate([{ $match: { ownerId: owner._id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Booking.countDocuments({ ownerId: owner._id, status: 'CONFIRMED', date: { $gte: today } }),
    Booking.find({ ownerId: owner._id, status: 'CONFIRMED', date: { $gte: today } }).sort({ date: 1 }).limit(6).populate('userId', 'name email phone'),
    Booking.aggregate([
      { $match: paid },
      {
        $group: {
          _id: null,
          bookings: { $sum: 1 },
          bookedValue: { $sum: '$pricing.total' },
          advanceCollected: { $sum: '$pricing.advance' },
          payoutFromAdvance: { $sum: '$pricing.ownerPayoutNow' },
          platformFees: { $sum: '$pricing.platformFee' },
          balanceDue: { $sum: { $cond: [{ $eq: ['$balanceStatus', 'DUE'] }, '$pricing.balance', 0] } },
        },
      },
    ]),
    Booking.aggregate([
      { $match: paid },
      { $group: { _id: { $substrBytes: ['$date', 0, 7] }, bookings: { $sum: 1 }, value: { $sum: '$pricing.total' } } },
      { $sort: { _id: 1 } },
    ]),
    Booking.countDocuments({ ownerId: owner._id, status: 'HELD' }),
  ]);
  const m = moneyRows[0] || {};
  return {
    ownerStatus: owner.owner?.status ?? 'pending',
    venues: Object.fromEntries(venueStatus.map((r) => [r._id, r.n])),
    upcomingCount,
    heldNow: held,
    nextBookings: nextBookings.map((b) => toBookingDto(b, { view: 'staff' })),
    money: {
      bookings: m.bookings ?? 0,
      bookedValue: m.bookedValue ?? 0,
      advanceCollected: m.advanceCollected ?? 0,
      payoutFromAdvance: m.payoutFromAdvance ?? 0,
      platformFees: m.platformFees ?? 0,
      balanceDue: m.balanceDue ?? 0,
    },
    byMonth: byMonth.map((r) => ({ month: r._id, bookings: r.bookings, value: r.value })),
  };
}
