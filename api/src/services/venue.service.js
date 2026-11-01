import mongoose from 'mongoose';
import { config } from '../config.js';
import { activeLockFilter, locksByDate, slotIsFree } from '../engines/exclusive.js';
import { daysBetween, monthDays, todayIST } from '../lib/dates.js';
import { AppError, badRequest, notFound } from '../lib/errors.js';
import { describePolicy } from '../lib/policy.js';
import { SlotLock } from '../models/SlotLock.js';
import { Venue } from '../models/Venue.js';
import { getVenueType } from './catalog.service.js';

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const adjustedPrice = (price, percent = 0) => Math.round((price * (100 + percent)) / 100 / 100) * 100;

export function toVenueCard(v, extra = {}) {
  return {
    id: v._id.toString(),
    slug: v.slug,
    name: v.name,
    tagline: v.tagline ?? null,
    typeKey: v.typeKey,
    address: { area: v.address?.area ?? null, city: v.address.city, district: v.address.district },
    location: { lat: v.location.coordinates[1], lng: v.location.coordinates[0] },
    capacity: { seating: v.capacity.seating, dining: v.capacity.dining ?? 0 },
    rooms: v.rooms ?? 0,
    parkingCars: v.parkingCars ?? 0,
    amenities: v.amenities ?? [],
    minPrice: v.minPrice,
    advancePercent: v.advancePercent,
    coverStyle: v.coverStyle ?? 0,
    slots: (v.slots || [])
      .filter((s) => s.enabled)
      .map((s) => ({
        key: s.key,
        label: s.label,
        start: s.start,
        end: s.end,
        price: s.price,
        ...(extra.unitLocks ? { available: slotIsFree(s, extra.unitLocks) } : {}),
      })),
    distanceKm: extra.distanceMeters != null ? Math.round(extra.distanceMeters / 100) / 10 : null,
  };
}

export function toVenueDetail(v, ownerDoc) {
  return {
    ...toVenueCard(v),
    description: v.description ?? null,
    address: {
      line1: v.address?.line1 ?? null,
      area: v.address?.area ?? null,
      city: v.address.city,
      district: v.address.district,
      state: v.address.state,
      pincode: v.address?.pincode ?? null,
    },
    cancellationPolicy: v.cancellationPolicy,
    cancellationRules: describePolicy(v.cancellationPolicy),
    host: ownerDoc ? { name: ownerDoc.owner?.businessName || ownerDoc.name } : null,
    status: v.status,
    isDemo: Boolean(v.isDemo),
  };
}

/** For owner/admin screens: everything, including review state and raw slot settings. */
export function toVenueAdmin(v) {
  return {
    ...toVenueDetail(v),
    ownerId: v.ownerId?._id ? v.ownerId._id.toString() : v.ownerId?.toString(),
    slots: v.slots.map((s) => ({
      key: s.key,
      label: s.label,
      start: s.start,
      end: s.end,
      units: s.units,
      price: s.price,
      enabled: s.enabled,
    })),
    specialPricing: v.specialPricing ?? [],
    contactPhone: v.contactPhone ?? null,
    reviewNote: v.reviewNote ?? null,
    submittedAt: v.submittedAt ?? null,
    approvedAt: v.approvedAt ?? null,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

/** Venue ids that cannot take a booking for this date (and slot, if given). */
async function unavailableVenueIds(type, date, slotKey, now) {
  const active = activeLockFilter(now);
  if (slotKey) {
    const tmpl = type.slotTemplates.find((t) => t.key === slotKey);
    const units = tmpl ? tmpl.units : [slotKey];
    return SlotLock.distinct('venueId', { date, unit: { $in: units }, ...active });
  }
  // No session chosen: hide a hall when none of ITS enabled sessions is completely free that day
  // (a hall that only sells full days is gone as soon as either half is taken).
  const locks = await SlotLock.find({ date, ...active }).select('venueId unit').lean();
  const byVenue = new Map();
  for (const l of locks) {
    const k = l.venueId.toString();
    if (!byVenue.has(k)) byVenue.set(k, new Set());
    byVenue.get(k).add(l.unit);
  }
  if (!byVenue.size) return [];
  const venues = await Venue.find({ _id: { $in: [...byVenue.keys()] } }).select('slots').lean();
  return venues
    .filter((v) => !v.slots.some((s) => s.enabled && s.units.every((u) => !byVenue.get(v._id.toString()).has(u))))
    .map((v) => v._id);
}

const SORTS = {
  price_asc: { minPrice: 1, _id: 1 },
  price_desc: { minPrice: -1, _id: 1 },
  capacity_desc: { 'capacity.seating': -1, _id: 1 },
  newest: { approvedAt: -1, _id: 1 },
};

export async function searchVenues(p, now = new Date()) {
  const type = await getVenueType(p.type);
  if (!type.enabled) throw new AppError(409, 'TYPE_DISABLED', `${type.name} are coming soon`);

  if (p.date && !isBookableDate(p.date, now)) {
    throw badRequest(`Pick a date from tomorrow up to ${config.maxAdvanceDays} days ahead`);
  }
  const match = { status: 'approved', typeKey: type.key };
  if (p.district) match['address.district'] = p.district;
  if (p.city) match['address.city'] = new RegExp(`^${escapeRx(p.city)}$`, 'i');
  if (p.q) {
    const rx = new RegExp(escapeRx(p.q), 'i');
    match.$or = [{ name: rx }, { 'address.city': rx }, { 'address.area': rx }, { tagline: rx }];
  }
  if (p.guests) match['capacity.seating'] = { $gte: p.guests };
  if (p.amenities?.length) match.amenities = { $all: p.amenities };
  if (p.slot) {
    match.slots = { $elemMatch: { key: p.slot, enabled: true, ...(p.maxPrice ? { price: { $lte: p.maxPrice } } : {}) } };
  } else if (p.maxPrice) {
    match.minPrice = { $lte: p.maxPrice };
  }
  if (p.date) {
    const taken = await unavailableVenueIds(type, p.date, p.slot, now);
    if (taken.length) match._id = { $nin: taken };
  }

  const limit = p.limit;
  const skip = (p.page - 1) * limit;
  const geo = p.lat != null && p.lng != null;
  let rows;
  let total;

  if (geo) {
    const geoNear = {
      $geoNear: {
        near: { type: 'Point', coordinates: [p.lng, p.lat] },
        distanceField: 'distanceMeters',
        maxDistance: p.radiusKm * 1000,
        query: match,
        spherical: true,
        key: 'location',
      },
    };
    const sort = p.sort && p.sort !== 'distance' ? SORTS[p.sort] : { distanceMeters: 1, _id: 1 };
    const [data, count] = await Promise.all([
      Venue.aggregate([geoNear, { $sort: sort }, { $skip: skip }, { $limit: limit }]),
      Venue.aggregate([geoNear, { $count: 'n' }]),
    ]);
    rows = data;
    total = count[0]?.n ?? 0;
  } else {
    const sort = SORTS[p.sort] || SORTS.price_asc;
    [rows, total] = await Promise.all([
      Venue.find(match).sort(sort).skip(skip).limit(limit).lean(),
      Venue.countDocuments(match),
    ]);
  }

  // Per-slot availability for the chosen date, so cards can say "Morning ✓ Evening ✗".
  let lockMap = new Map();
  if (p.date && rows.length) {
    const locks = await SlotLock.find({ venueId: { $in: rows.map((r) => r._id) }, date: p.date, ...activeLockFilter(now) }).lean();
    lockMap = locks.reduce((m, l) => {
      const key = l.venueId.toString();
      if (!m.has(key)) m.set(key, {});
      m.get(key)[l.unit] = l;
      return m;
    }, new Map());
  }

  return {
    items: rows.map((v) =>
      toVenueCard(v, {
        distanceMeters: v.distanceMeters,
        unitLocks: p.date ? lockMap.get(v._id.toString()) || {} : undefined,
      }),
    ),
    page: p.page,
    limit,
    total,
    pages: Math.ceil(total / limit),
    type: { key: type.key, name: type.name },
  };
}

/** Public venue lookup by id or slug — only approved venues. */
export async function findPublicVenue(idOrSlug) {
  const filter = mongoose.isValidObjectId(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug };
  const venue = await Venue.findOne({ ...filter, status: 'approved' }).populate('ownerId', 'name owner.businessName');
  if (!venue) throw notFound('Venue');
  return venue;
}

export async function venueDetail(idOrSlug) {
  const venue = await findPublicVenue(idOrSlug);
  return toVenueDetail(venue, venue.ownerId);
}

/** Bookable window: from tomorrow up to MAX_ADVANCE_DAYS ahead (India time). */
export function isBookableDate(date, now = new Date()) {
  const today = todayIST(now);
  const ahead = daysBetween(today, date);
  return ahead >= 1 && ahead <= config.maxAdvanceDays;
}

/**
 * Day-by-day availability for a month.
 * Public view says only free / held / taken. The owner view (detailed) also says *why* a unit is
 * taken (booking or block) and carries the lock so the calendar can show booking details.
 */
export async function venueAvailability(venue, type, month, { now = new Date(), detailed = false } = {}) {
  const dates = monthDays(month);
  const locks = await locksByDate(venue._id, dates, now);
  const special = new Map((venue.specialPricing || []).map((s) => [s.date, s]));
  const unitKeys = type.units.map((u) => u.key);

  return dates.map((date) => {
    const unitLocks = locks.get(date) || {};
    const bookable = isBookableDate(date, now);
    const sp = special.get(date);
    const units = {};
    for (const u of unitKeys) {
      const lock = unitLocks[u];
      units[u] = !lock ? 'free' : lock.kind === 'hold' ? 'held' : detailed ? lock.kind : 'taken';
    }
    const day = {
      date,
      bookable,
      adjustmentPercent: sp?.percent ?? 0,
      specialNote: sp?.note ?? null,
      units,
      slots: venue.slots
        .filter((s) => s.enabled)
        .map((s) => ({
          key: s.key,
          available: bookable && slotIsFree(s, unitLocks),
          price: adjustedPrice(s.price, sp?.percent ?? 0),
        })),
    };
    if (detailed) {
      day.locks = Object.values(unitLocks).map((l) => ({
        unit: l.unit,
        kind: l.kind,
        bookingId: l.bookingId?.toString() ?? null,
        note: l.note ?? null,
      }));
    }
    return day;
  });
}
