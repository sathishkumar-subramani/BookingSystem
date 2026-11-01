import { AMENITIES, TN_DISTRICTS } from '../data/tnDistricts.js';
import { DEFAULT_VENUE_TYPES } from '../data/venueTypes.js';
import { describePolicy } from '../lib/policy.js';
import { notFound } from '../lib/errors.js';
import { VenueType } from '../models/VenueType.js';
import { isModeImplemented } from '../engines/index.js';

/** Insert any default venue type that doesn't exist yet. Never overwrites admin changes. */
export async function ensureVenueTypes() {
  for (const t of DEFAULT_VENUE_TYPES) {
    await VenueType.updateOne({ key: t.key }, { $setOnInsert: t }, { upsert: true });
  }
}

export async function listVenueTypes({ includeDisabled = true } = {}) {
  const filter = includeDisabled ? {} : { enabled: true };
  const types = await VenueType.find(filter).sort({ sortOrder: 1 });
  return types.map((t) => ({ ...t.toPublic(), modeImplemented: isModeImplemented(t.bookingMode) }));
}

export async function getVenueType(key) {
  const type = await VenueType.findOne({ key });
  if (!type) throw notFound('Venue type');
  return type;
}

export function catalog() {
  return {
    districts: TN_DISTRICTS,
    amenities: AMENITIES,
    cancellationPolicies: ['flexible', 'moderate', 'strict'].map((key) => ({ key, rules: describePolicy(key) })),
  };
}
