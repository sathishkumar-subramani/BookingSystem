import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as admin from '../services/admin.service.js';
import { cancelBooking } from '../services/booking.service.js';
import { listVenueTypes } from '../services/catalog.service.js';
import { adminListQuery, cancelBody, idParam, reviewBody, userStatusBody, venueReviewBody, venueTypeBody } from './schemas.js';
import { z } from 'zod';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get('/summary', async (_req, res) => res.json(await admin.adminSummary()));

router.get('/owners', validate({ query: adminListQuery }), async (req, res) => {
  res.json({ items: await admin.listOwners(req.data.query) });
});
router.post('/owners/:id/review', validate({ params: idParam, body: reviewBody }), async (req, res) => {
  res.json({ owner: await admin.reviewOwner(req.data.params.id, req.data.body) });
});

router.get('/venues', validate({ query: adminListQuery }), async (req, res) => {
  res.json(await admin.listVenues(req.data.query));
});
router.post('/venues/:id/review', validate({ params: idParam, body: venueReviewBody }), async (req, res) => {
  res.json({ venue: await admin.reviewVenue(req.data.params.id, req.data.body) });
});

router.get('/bookings', validate({ query: adminListQuery }), async (req, res) => {
  res.json(await admin.listAllBookings(req.data.query));
});
router.post('/bookings/:id/cancel', validate({ params: idParam, body: cancelBody }), async (req, res) => {
  res.json({ booking: await cancelBooking(req.user, req.data.params.id, req.data.body) });
});

router.get('/users', validate({ query: adminListQuery }), async (req, res) => {
  res.json(await admin.listUsers(req.data.query));
});
router.post('/users/:id/status', validate({ params: idParam, body: userStatusBody }), async (req, res) => {
  res.json({ user: await admin.setUserStatus(req.user, req.data.params.id, req.data.body.status) });
});

router.get('/venue-types', async (_req, res) => res.json({ items: await listVenueTypes() }));
router.patch('/venue-types/:key', validate({ params: z.object({ key: z.string().max(40) }), body: venueTypeBody }), async (req, res) => {
  res.json({ type: await admin.updateVenueType(req.data.params.key, req.data.body) });
});

export default router;
