import { z } from 'zod';
import { AMENITY_KEYS, DISTRICT_NAMES } from '../data/tnDistricts.js';
import { isDateString, isMonthString } from '../lib/dates.js';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const dateStr = z.string().refine(isDateString, 'Use a date like 2026-12-14');
export const monthStr = z.string().refine(isMonthString, 'Use a month like 2026-12');
export const phone = z
  .string()
  .trim()
  .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour time like 05:30');
const paise = z.number().int().min(0).max(100_000_000); // up to ₹10 lakh per slot
const district = z.enum(DISTRICT_NAMES);
const csvList = z
  .string()
  .optional()
  .transform((s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []));

export const idParam = z.object({ id: objectId });

// ── auth ──
export const registerBody = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8, 'Use at least 8 characters').max(100),
    phone: phone.optional(),
    role: z.enum(['user', 'owner']).default('user'),
    businessName: z.string().trim().max(120).optional(),
    city: z.string().trim().max(60).optional(),
  })
  .strict();
export const loginBody = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });
export const refreshBody = z.object({ refreshToken: z.string().min(10) });
export const profileBody = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: phone.or(z.literal('')).optional(),
    businessName: z.string().trim().max(120).optional(),
    city: z.string().trim().max(60).optional(),
  })
  .strict();
export const passwordBody = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(100) });

// ── search ──
export const searchQuery = z.object({
  type: z.string().default('marriage-hall'),
  district: district.optional(),
  city: z.string().trim().max(60).optional(),
  q: z.string().trim().max(60).optional(),
  date: dateStr.optional(),
  slot: z.enum(['MORNING', 'EVENING', 'FULL_DAY']).optional(),
  guests: z.coerce.number().int().min(1).max(20000).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  amenities: csvList.pipe(z.array(z.enum(AMENITY_KEYS))),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(1).max(300).default(25),
  sort: z.enum(['distance', 'price_asc', 'price_desc', 'capacity_desc', 'newest']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});
export const monthQuery = z.object({ month: monthStr });
export const venueParam = z.object({ idOrSlug: z.string().min(1).max(100) });

// ── bookings ──
export const createBookingBody = z
  .object({
    venueId: objectId,
    date: dateStr,
    slotKey: z.enum(['MORNING', 'EVENING', 'FULL_DAY']),
    guests: z.number().int().min(1).max(20000),
    eventKind: z.string().max(30).default('wedding'),
    contactName: z.string().trim().min(2).max(80).optional(),
    contactPhone: phone.optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();
export const confirmBody = z.object({ orderId: z.string().min(5), paymentId: z.string().min(5), signature: z.string().min(10) });
export const cancelBody = z.object({ reason: z.string().trim().max(300).optional() });
export const listBookingsQuery = z.object({
  status: z.enum(['upcoming', 'past', 'cancelled', 'all']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export const mockCheckoutBody = z.object({ orderId: z.string().min(5), outcome: z.enum(['success', 'failure']).default('success') });

// ── owner ──
const slotInput = z.object({
  key: z.enum(['MORNING', 'EVENING', 'FULL_DAY']),
  price: paise,
  start: hhmm.optional(),
  end: hhmm.optional(),
  enabled: z.boolean().default(true),
});
const addressInput = z.object({
  line1: z.string().trim().max(160).optional(),
  area: z.string().trim().max(80).optional(),
  city: z.string().trim().min(2).max(60),
  district,
  pincode: z
    .string()
    .regex(/^[1-9]\d{5}$/, 'Pincode must be 6 digits')
    .optional(),
});
// No defaults here: an update must only touch the fields that were actually sent.
const venueFields = {
  name: z.string().trim().min(3).max(100),
  tagline: z.string().trim().max(140),
  description: z.string().trim().max(3000),
  address: addressInput,
  location: z.object({ lat: z.number().min(8).max(14), lng: z.number().min(76).max(81) }), // Tamil Nadu bounds
  capacity: z.object({ seating: z.number().int().min(10).max(20000), dining: z.number().int().min(0).max(20000) }),
  rooms: z.number().int().min(0).max(200),
  parkingCars: z.number().int().min(0).max(5000),
  amenities: z.array(z.enum(AMENITY_KEYS)).max(AMENITY_KEYS.length),
  slots: z.array(slotInput).min(1).max(3),
  advancePercent: z.number().int().min(10).max(100),
  cancellationPolicy: z.enum(['flexible', 'moderate', 'strict']),
  contactPhone: phone,
};
export const createVenueBody = z
  .object({
    ...venueFields,
    typeKey: z.string().default('marriage-hall'),
    tagline: venueFields.tagline.optional(),
    description: venueFields.description.optional(),
    location: venueFields.location.optional(),
    capacity: z.object({ seating: z.number().int().min(10).max(20000), dining: z.number().int().min(0).max(20000).default(0) }),
    rooms: venueFields.rooms.default(0),
    parkingCars: venueFields.parkingCars.default(0),
    amenities: venueFields.amenities.default([]),
    advancePercent: venueFields.advancePercent.default(25),
    cancellationPolicy: venueFields.cancellationPolicy.default('moderate'),
    contactPhone: phone.optional(),
  })
  .strict();
export const updateVenueBody = z
  .object(Object.fromEntries(Object.entries(venueFields).map(([k, v]) => [k, v.optional()])))
  .strict()
  .refine((o) => Object.keys(o).length > 0, 'Nothing to update');
export const blockBody = z.object({ date: dateStr, slotKey: z.enum(['MORNING', 'EVENING', 'FULL_DAY']), note: z.string().trim().max(80).optional() });
export const unblockQuery = z.object({ date: dateStr, unit: z.enum(['MORNING', 'EVENING']) });
export const specialPriceBody = z.object({ date: dateStr, percent: z.number().int().min(-50).max(200), note: z.string().trim().max(60).optional() });
export const ownerBookingsQuery = z.object({
  status: z.enum(['upcoming', 'past', 'cancelled', 'balance', 'all']).default('upcoming'),
  venueId: objectId.optional(),
  q: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ── admin ──
export const reviewBody = z.object({ action: z.enum(['approve', 'reject']), note: z.string().trim().max(300).optional() });
export const venueReviewBody = z.object({ action: z.enum(['approve', 'reject', 'suspend']), note: z.string().trim().max(300).optional() });
export const adminListQuery = z.object({
  status: z.string().max(20).optional(),
  q: z.string().trim().max(60).optional(),
  role: z.enum(['user', 'owner', 'admin']).optional(),
  district: district.optional(),
  page: z.coerce.number().int().min(1).default(1),
});
export const userStatusBody = z.object({ status: z.enum(['active', 'suspended']) });
export const venueTypeBody = z.object({ enabled: z.boolean() });
