import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { maybeSweep } from '../services/booking.service.js';
import { catalog, getVenueType, listVenueTypes } from '../services/catalog.service.js';
import { findPublicVenue, searchVenues, venueAvailability, venueDetail } from '../services/venue.service.js';
import { paymentProvider } from '../providers/payments/index.js';
import { config } from '../config.js';
import { monthQuery, searchQuery, venueParam } from './schemas.js';

const router = Router();

router.get('/catalog', async (_req, res) => {
  res.json({
    ...catalog(),
    venueTypes: await listVenueTypes(),
    booking: { holdMinutes: config.holdMinutes, platformFeePercent: config.platformFeePercent, maxAdvanceDays: config.maxAdvanceDays },
    payments: { provider: paymentProvider().name, testMode: paymentProvider().testMode },
  });
});

router.get('/venues', validate({ query: searchQuery }), async (req, res) => {
  await maybeSweep();
  res.json(await searchVenues(req.data.query));
});

router.get('/venues/:idOrSlug', validate({ params: venueParam }), async (req, res) => {
  res.json({ venue: await venueDetail(req.data.params.idOrSlug) });
});

router.get('/venues/:idOrSlug/availability', validate({ params: venueParam, query: monthQuery }), async (req, res) => {
  await maybeSweep();
  const venue = await findPublicVenue(req.data.params.idOrSlug);
  const type = await getVenueType(venue.typeKey);
  res.json({ month: req.data.query.month, units: type.units, days: await venueAvailability(venue, type, req.data.query.month) });
});

export default router;
