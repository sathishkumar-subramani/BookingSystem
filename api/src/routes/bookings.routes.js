import { Router } from 'express';
import { forbidden } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as bookings from '../services/booking.service.js';
import { cancelBody, confirmBody, createBookingBody, idParam, listBookingsQuery, mockCheckoutBody } from './schemas.js';

const router = Router();
// Mounted at /api next to the public routes, so auth is applied per route (not router.use) —
// otherwise every unknown /api path would answer 401 instead of 404.

// Customers book. Owners may book other people's halls too (they're customers then); admins don't book.
const notAdmin = (req, _res, next) => {
  if (req.user.role === 'admin') throw forbidden('Admin accounts cannot make bookings');
  next();
};

router.post('/bookings', requireAuth, notAdmin, validate({ body: createBookingBody }), async (req, res) => {
  res.status(201).json(await bookings.createBooking(req.user, req.data.body));
});

router.get('/bookings', requireAuth, validate({ query: listBookingsQuery }), async (req, res) => {
  res.json(await bookings.listMyBookings(req.user, req.data.query));
});

router.get('/bookings/:id', requireAuth, validate({ params: idParam }), async (req, res) => {
  res.json({ booking: await bookings.getBooking(req.user, req.data.params.id) });
});

router.get('/bookings/:id/cancel-quote', requireAuth, validate({ params: idParam }), async (req, res) => {
  res.json(await bookings.cancellationQuote(req.user, req.data.params.id));
});

router.post('/bookings/:id/confirm', requireAuth, validate({ params: idParam, body: confirmBody }), async (req, res) => {
  res.json({ booking: await bookings.confirmBooking(req.user, req.data.params.id, req.data.body) });
});

router.post('/bookings/:id/cancel', requireAuth, validate({ params: idParam, body: cancelBody }), async (req, res) => {
  res.json({ booking: await bookings.cancelBooking(req.user, req.data.params.id, req.data.body) });
});

// Stand-in for the gateway's checkout page while PAYMENT_PROVIDER=mock.
router.post('/payments/mock/checkout', requireAuth, validate({ body: mockCheckoutBody }), async (req, res) => {
  res.json(await bookings.simulateCheckout(req.user, req.data.body));
});

export default router;
