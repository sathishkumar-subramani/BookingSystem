import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { cancelBooking, markBalancePaid } from '../services/booking.service.js';
import * as owner from '../services/owner.service.js';
import {
  blockBody,
  cancelBody,
  createVenueBody,
  idParam,
  monthQuery,
  ownerBookingsQuery,
  specialPriceBody,
  unblockQuery,
  updateVenueBody,
} from './schemas.js';

const router = Router();
router.use(requireAuth, requireRole('owner'));

router.get('/summary', async (req, res) => res.json(await owner.ownerSummary(req.user)));

router.get('/venues', async (req, res) => res.json({ items: await owner.listOwnerVenues(req.user) }));

router.post('/venues', validate({ body: createVenueBody }), async (req, res) => {
  res.status(201).json({ venue: await owner.createVenue(req.user, req.data.body) });
});

router.get('/venues/:id', validate({ params: idParam }), async (req, res) => {
  res.json({ venue: await owner.getOwnerVenue(req.user, req.data.params.id) });
});

router.patch('/venues/:id', validate({ params: idParam, body: updateVenueBody }), async (req, res) => {
  res.json({ venue: await owner.updateVenue(req.user, req.data.params.id, req.data.body) });
});

router.delete('/venues/:id', validate({ params: idParam }), async (req, res) => {
  await owner.deleteVenue(req.user, req.data.params.id);
  res.status(204).end();
});

router.post('/venues/:id/submit', validate({ params: idParam }), async (req, res) => {
  res.json({ venue: await owner.submitVenue(req.user, req.data.params.id) });
});

router.get('/venues/:id/calendar', validate({ params: idParam, query: monthQuery }), async (req, res) => {
  res.json(await owner.ownerCalendar(req.user, req.data.params.id, req.data.query.month));
});

router.post('/venues/:id/blocks', validate({ params: idParam, body: blockBody }), async (req, res) => {
  res.status(201).json(await owner.addBlock(req.user, req.data.params.id, req.data.body));
});

router.delete('/venues/:id/blocks', validate({ params: idParam, query: unblockQuery }), async (req, res) => {
  res.json(await owner.removeBlock(req.user, req.data.params.id, req.data.query));
});

router.put('/venues/:id/special-pricing', validate({ params: idParam, body: specialPriceBody }), async (req, res) => {
  res.json({ specialPricing: await owner.setSpecialPrice(req.user, req.data.params.id, req.data.body) });
});

router.get('/bookings', validate({ query: ownerBookingsQuery }), async (req, res) => {
  res.json(await owner.listOwnerBookings(req.user, req.data.query));
});

router.post('/bookings/:id/balance-paid', validate({ params: idParam }), async (req, res) => {
  res.json({ booking: await markBalancePaid(req.user, req.data.params.id) });
});

router.post('/bookings/:id/cancel', validate({ params: idParam, body: cancelBody }), async (req, res) => {
  res.json({ booking: await cancelBooking(req.user, req.data.params.id, req.data.body) });
});

export default router;
