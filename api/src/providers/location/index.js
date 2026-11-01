import { config } from '../../config.js';
import { TN_DISTRICTS } from '../../data/tnDistricts.js';
import { badRequest } from '../../lib/errors.js';

// Port: where is an address? Today a static table of Tamil Nadu districts answers it.
// Tomorrow a Google Maps adapter (Geocoding + Places Autocomplete) implements the same two
// functions and nothing else in the app changes.
//
// Note: "near me" does NOT need Google — the phone/browser gives the user's lat/lng for free and
// MongoDB's 2dsphere index does the distance maths. Google is for typed-address lookup and maps.

const staticProvider = {
  name: 'static',
  districts() {
    return TN_DISTRICTS;
  },
  /** Best-effort coordinates when an owner hasn't pinned the hall: the district HQ. */
  async geocode({ district }) {
    const d = TN_DISTRICTS.find((x) => x.name.toLowerCase() === String(district).toLowerCase());
    if (!d) throw badRequest(`Unknown district: ${district}`);
    return { lat: d.lat, lng: d.lng, precision: 'district' };
  },
};

const googleProvider = {
  name: 'google',
  districts: staticProvider.districts,
  async geocode(address) {
    // TODO when GOOGLE_MAPS_API_KEY is available:
    //   GET https://maps.googleapis.com/maps/api/geocode/json?address=...&key=...
    // Until then fall back to the district centre so nothing breaks.
    return staticProvider.geocode(address);
  },
};

export const locationProvider = () => (config.locationProvider === 'google' ? googleProvider : staticProvider);
