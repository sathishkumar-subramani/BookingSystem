// End-to-end API tests against a real MongoDB.
// Run with:  TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm test
// (GitHub Actions does this on every push — see .github/workflows/ci.yml.) Skipped when no URI is set.
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { connectDb } from '../src/db.js';
import { addDays, todayIST } from '../src/lib/dates.js';
import { Booking } from '../src/models/Booking.js';
import { SlotLock } from '../src/models/SlotLock.js';
import { User } from '../src/models/User.js';
import { createBooking } from '../src/services/booking.service.js';
import { DEMO_PASSWORDS, seedDemo } from '../src/seed/demo.js';

const URI = process.env.TEST_MONGODB_URI;
const app = createApp();
const api = () => request(app);
let n = 0;

async function login(email, password) {
  const res = await api().post('/api/auth/login').send({ email, password }).expect(200);
  return res.body.accessToken;
}
async function newUser(role = 'user', extra = {}) {
  n += 1;
  const res = await api()
    .post('/api/auth/register')
    .send({ name: `Test ${role} ${n}`, email: `t${n}-${Date.now()}@example.com`, password: 'Passw0rd!', role, ...extra })
    .expect(201);
  return { token: res.body.accessToken, refresh: res.body.refreshToken, user: res.body.user };
}
const auth = (token) => ({ Authorization: `Bearer ${token}` });

/** First date ≥ `fromDays` ahead where the given slot of this venue is free. */
async function freeDate(venueId, slotKey, fromDays = 20) {
  for (let d = fromDays; d < fromDays + 120; d += 1) {
    const date = addDays(todayIST(), d);
    const res = await api().get(`/api/venues/${venueId}/availability?month=${date.slice(0, 7)}`).expect(200);
    const day = res.body.days.find((x) => x.date === date);
    if (day?.slots.find((s) => s.key === slotKey)?.available) return date;
  }
  throw new Error('no free date found');
}

async function holdAndPay(token, body) {
  const created = await api().post('/api/bookings').set(auth(token)).send(body).expect(201);
  const { booking, checkout } = created.body;
  const paid = await api().post('/api/payments/mock/checkout').set(auth(token)).send({ orderId: checkout.orderId, outcome: 'success' }).expect(200);
  const confirmed = await api().post(`/api/bookings/${booking.id}/confirm`).set(auth(token)).send(paid.body).expect(200);
  return confirmed.body.booking;
}

describe.skipIf(!URI)('Arangam API (MongoDB)', () => {
  const dbName = `arangam_test_${Date.now()}`;
  let userToken;
  let adminToken;
  let coimbatoreHall;

  beforeAll(async () => {
    await connectDb(URI, dbName);
    await seedDemo();
    userToken = await login('user@arangam.demo', DEMO_PASSWORDS.user);
    adminToken = await login('admin@arangam.demo', DEMO_PASSWORDS.admin);
    const res = await api().get('/api/venues?district=Coimbatore&sort=price_asc').expect(200);
    coimbatoreHall = res.body.items[0];
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  // ── auth ──
  describe('auth', () => {
    it('registers, rejects a wrong password, and returns the profile', async () => {
      const { token, user } = await newUser();
      expect(user.role).toBe('user');
      await api().post('/api/auth/login').send({ email: user.email, password: 'wrong-pass' }).expect(401);
      const me = await api().get('/api/auth/me').set(auth(token)).expect(200);
      expect(me.body.user.email).toBe(user.email);
    });

    it('cannot self-register as admin', async () => {
      await api().post('/api/auth/register').send({ name: 'Evil', email: 'evil@example.com', password: 'Passw0rd!', role: 'admin' }).expect(400);
    });

    it('rotates refresh tokens and kills the family when an old one is reused', async () => {
      const { refresh } = await newUser();
      const r1 = await api().post('/api/auth/refresh').send({ refreshToken: refresh }).expect(200);
      expect(r1.body.refreshToken).not.toBe(refresh);
      await api().post('/api/auth/refresh').send({ refreshToken: refresh }).expect(401); // reuse → revoke all
      await api().post('/api/auth/refresh').send({ refreshToken: r1.body.refreshToken }).expect(401);
    });

    it('keeps roles apart', async () => {
      await api().get('/api/owner/summary').set(auth(userToken)).expect(403);
      await api().get('/api/admin/summary').set(auth(userToken)).expect(403);
      const ownerToken = await login('owner@arangam.demo', DEMO_PASSWORDS.owner);
      await api().get('/api/admin/summary').set(auth(ownerToken)).expect(403);
      await api().get('/api/owner/summary').set(auth(ownerToken)).expect(200);
    });
  });

  // ── search ──
  describe('search', () => {
    it('lists venue types with gym and concerts switched off', async () => {
      const res = await api().get('/api/catalog').expect(200);
      const types = Object.fromEntries(res.body.venueTypes.map((t) => [t.key, t]));
      expect(types['marriage-hall'].enabled).toBe(true);
      expect(types.gym.enabled).toBe(false);
      expect(res.body.districts).toHaveLength(38);
    });

    it('filters by district and hides venues that are not approved', async () => {
      const chennai = await api().get('/api/venues?district=Chennai&limit=50').expect(200);
      expect(chennai.body.total).toBeGreaterThan(5);
      expect(chennai.body.items.every((v) => v.address.district === 'Chennai')).toBe(true);
      const karur = await api().get('/api/venues?district=Karur').expect(200);
      expect(karur.body.total).toBe(0); // Amaravathi Mahal is still pending review
    });

    it('finds halls near a point, nearest first, with distance', async () => {
      const res = await api().get('/api/venues?lat=9.9252&lng=78.1198&radiusKm=20').expect(200);
      expect(res.body.items.length).toBeGreaterThan(0);
      expect(res.body.items.every((v) => v.address.city === 'Madurai')).toBe(true);
      const d = res.body.items.map((v) => v.distanceKm);
      expect(d).toEqual([...d].sort((a, b) => a - b));
    });

    it('filters by guests and amenities', async () => {
      const res = await api().get('/api/venues?guests=1500&amenities=valet&limit=50').expect(200);
      expect(res.body.items.every((v) => v.capacity.seating >= 1500 && v.amenities.includes('valet'))).toBe(true);
    });

    it('hides the coming-soon categories', async () => {
      await api().get('/api/venues?type=gym').expect(409);
    });
  });

  // ── booking ──
  describe('booking', () => {
    it('holds, pays (mock) and confirms; the slot then disappears from search', async () => {
      const date = await freeDate(coimbatoreHall.id, 'MORNING');
      const booking = await holdAndPay(userToken, { venueId: coimbatoreHall.id, date, slotKey: 'MORNING', guests: 200, eventKind: 'wedding' });
      expect(booking.status).toBe('CONFIRMED');
      expect(booking.code).toMatch(/^ARG-/);
      expect(booking.pricing.advance + booking.pricing.balance).toBe(booking.pricing.total);
      expect(booking.venueContactPhone).toBeTruthy();

      const search = await api().get(`/api/venues?district=Coimbatore&date=${date}&slot=MORNING&limit=50`).expect(200);
      expect(search.body.items.find((v) => v.id === coimbatoreHall.id)).toBeUndefined();
      const evening = await api().get(`/api/venues?district=Coimbatore&date=${date}&limit=50`).expect(200);
      const card = evening.body.items.find((v) => v.id === coimbatoreHall.id);
      if (card) expect(card.slots.find((s) => s.key === 'MORNING').available).toBe(false);
    });

    it('lets exactly ONE of ten simultaneous bookings for the same slot win', async () => {
      const date = await freeDate(coimbatoreHall.id, 'EVENING', 40);
      const people = await Promise.all(Array.from({ length: 10 }, () => newUser()));
      const results = await Promise.all(
        people.map((p) => api().post('/api/bookings').set(auth(p.token)).send({ venueId: coimbatoreHall.id, date, slotKey: 'EVENING', guests: 100 })),
      );
      const statuses = results.map((r) => r.status).sort();
      expect(statuses.filter((s) => s === 201)).toHaveLength(1);
      expect(statuses.filter((s) => s === 409)).toHaveLength(9);
      expect(results.find((r) => r.status === 409).body.error.code).toBe('SLOT_TAKEN');
      expect(await SlotLock.countDocuments({ venueId: coimbatoreHall.id, date, unit: 'EVENING' })).toBe(1);
    });

    it('blocks FULL_DAY when the morning is held, without leaving a stray evening lock', async () => {
      const date = await freeDate(coimbatoreHall.id, 'FULL_DAY', 60);
      const a = await newUser();
      const b = await newUser();
      await api().post('/api/bookings').set(auth(a.token)).send({ venueId: coimbatoreHall.id, date, slotKey: 'MORNING', guests: 100 }).expect(201);
      await api().post('/api/bookings').set(auth(b.token)).send({ venueId: coimbatoreHall.id, date, slotKey: 'FULL_DAY', guests: 100 }).expect(409);
      expect(await SlotLock.countDocuments({ venueId: coimbatoreHall.id, date, unit: 'EVENING' })).toBe(0);
      await api().post('/api/bookings').set(auth(b.token)).send({ venueId: coimbatoreHall.id, date, slotKey: 'EVENING', guests: 100 }).expect(201);
    });

    it('rejects a forged payment signature', async () => {
      const date = await freeDate(coimbatoreHall.id, 'MORNING', 80);
      const u = await newUser();
      const created = await api().post('/api/bookings').set(auth(u.token)).send({ venueId: coimbatoreHall.id, date, slotKey: 'MORNING', guests: 100 }).expect(201);
      const res = await api()
        .post(`/api/bookings/${created.body.booking.id}/confirm`)
        .set(auth(u.token))
        .send({ orderId: created.body.checkout.orderId, paymentId: 'pay_MOCKFORGED0000', signature: 'f'.repeat(64) })
        .expect(400);
      expect(res.body.error.code).toBe('PAYMENT_INVALID');
    });

    it('refuses guests above capacity, past dates and a second open hold', async () => {
      const u = await newUser();
      const date = await freeDate(coimbatoreHall.id, 'EVENING', 100);
      await api().post('/api/bookings').set(auth(u.token)).send({ venueId: coimbatoreHall.id, date, slotKey: 'EVENING', guests: 99_99 }).expect(400);
      await api().post('/api/bookings').set(auth(u.token)).send({ venueId: coimbatoreHall.id, date: todayIST(), slotKey: 'EVENING', guests: 100 }).expect(400);
      const halls = await api().get('/api/venues?district=Chennai&limit=3').expect(200);
      for (let i = 0; i < 2; i += 1) {
        const d = await freeDate(halls.body.items[i].id, 'EVENING', 30);
        await api().post('/api/bookings').set(auth(u.token)).send({ venueId: halls.body.items[i].id, date: d, slotKey: 'EVENING', guests: 100 }).expect(201);
      }
      const d3 = await freeDate(halls.body.items[2].id, 'EVENING', 30);
      const third = await api().post('/api/bookings').set(auth(u.token)).send({ venueId: halls.body.items[2].id, date: d3, slotKey: 'EVENING', guests: 100 }).expect(409);
      expect(third.body.error.code).toBe('TOO_MANY_HOLDS');
    });

    it('refunds and frees the slot when a hold runs out before payment', async () => {
      const date = await freeDate(coimbatoreHall.id, 'MORNING', 110);
      const late = await newUser();
      const lateUser = await User.findOne({ email: late.user.email });
      // Create the hold 20 minutes in the past — it has already expired.
      const { booking, checkout } = await createBooking(
        lateUser,
        { venueId: coimbatoreHall.id, date, slotKey: 'MORNING', guests: 100, eventKind: 'wedding' },
        new Date(Date.now() - 20 * 60_000),
      );
      // Someone else can take the slot straight away (the stale hold is cleared on the spot).
      const other = await newUser();
      await api().post('/api/bookings').set(auth(other.token)).send({ venueId: coimbatoreHall.id, date, slotKey: 'MORNING', guests: 100 }).expect(201);
      // The late payer's money comes back.
      const paid = await api().post('/api/payments/mock/checkout').set(auth(late.token)).send({ orderId: checkout.orderId }).expect(200);
      const res = await api().post(`/api/bookings/${booking.id}/confirm`).set(auth(late.token)).send(paid.body).expect(410);
      expect(res.body.error.code).toBe('HOLD_EXPIRED');
      expect((await Booking.findById(booking.id)).status).toBe('EXPIRED');
    });

    it('cancels with a refund according to the policy', async () => {
      const date = await freeDate(coimbatoreHall.id, 'EVENING', 150);
      const u = await newUser();
      const b = await holdAndPay(u.token, { venueId: coimbatoreHall.id, date, slotKey: 'EVENING', guests: 150 });
      const quote = await api().get(`/api/bookings/${b.id}/cancel-quote`).set(auth(u.token)).expect(200);
      expect(quote.body.refundPercent).toBe(100); // 150 days out
      const cancelled = await api().post(`/api/bookings/${b.id}/cancel`).set(auth(u.token)).send({ reason: 'Plans changed' }).expect(200);
      expect(cancelled.body.booking.status).toBe('CANCELLED');
      expect(cancelled.body.booking.cancellation.refundAmount).toBe(b.pricing.advance);
      await api().post(`/api/bookings/${b.id}/cancel`).set(auth(u.token)).send({}).expect(409); // no double refund
      // slot is free again
      const again = await newUser();
      await api().post('/api/bookings').set(auth(again.token)).send({ venueId: coimbatoreHall.id, date, slotKey: 'EVENING', guests: 100 }).expect(201);
    });

    it('survives a double-tapped confirm: one booking, locks kept, money not refunded', async () => {
      const date = await freeDate(coimbatoreHall.id, 'MORNING', 160);
      const u = await newUser();
      const created = await api().post('/api/bookings').set(auth(u.token)).send({ venueId: coimbatoreHall.id, date, slotKey: 'MORNING', guests: 100 }).expect(201);
      const paid = await api().post('/api/payments/mock/checkout').set(auth(u.token)).send({ orderId: created.body.checkout.orderId }).expect(200);
      const tries = await Promise.all(
        [1, 2, 3].map(() => api().post(`/api/bookings/${created.body.booking.id}/confirm`).set(auth(u.token)).send(paid.body)),
      );
      expect(tries.some((r) => r.status === 200)).toBe(true);
      expect(tries.every((r) => r.status === 200 || r.body.error?.code === 'PAYMENT_IN_PROGRESS')).toBe(true);
      expect((await Booking.findById(created.body.booking.id)).status).toBe('CONFIRMED');
      expect(await SlotLock.countDocuments({ bookingId: created.body.booking.id, kind: 'booking' })).toBe(1);
      const { Payment } = await import('../src/models/Payment.js');
      expect((await Payment.findOne({ orderId: created.body.checkout.orderId })).status).toBe('PAID');
      expect(await Payment.countDocuments({ bookingId: created.body.booking.id, purpose: 'REFUND' })).toBe(0);
    });

    it('caps open holds at two even when requests arrive together', async () => {
      const u = await newUser();
      const halls = await api().get('/api/venues?district=Chennai&limit=4').expect(200);
      const bodies = [];
      for (const h of halls.body.items.slice(0, 4)) bodies.push({ venueId: h.id, date: await freeDate(h.id, 'EVENING', 200), slotKey: 'EVENING', guests: 100 });
      const results = await Promise.all(bodies.map((b) => api().post('/api/bookings').set(auth(u.token)).send(b)));
      expect(results.filter((r) => r.status === 201)).toHaveLength(2);
      expect(results.filter((r) => r.body.error?.code === 'TOO_MANY_HOLDS')).toHaveLength(2);
    });

    it('refuses to search a date that cannot be booked', async () => {
      await api().get(`/api/venues?date=${todayIST()}`).expect(400);
      await api().get('/api/venues?lat=9.9').expect(400); // lat without lng
    });

    it("hides other people's bookings", async () => {
      const mine = await api().get('/api/bookings').set(auth(userToken)).expect(200);
      const stranger = await newUser();
      await api().get(`/api/bookings/${mine.body.items[0].id}`).set(auth(stranger.token)).expect(404);
    });
  });

  // ── owner + admin ──
  describe('owner and admin', () => {
    it('takes a new hall from draft to live, then blocks a date and cancels a booking', async () => {
      const owner = await newUser('owner', { businessName: 'Test Mahals', phone: '9000000199' });
      expect(owner.user.owner.status).toBe('pending');
      const created = await api()
        .post('/api/owner/venues')
        .set(auth(owner.token))
        .send({
          name: 'Test Kalyana Mandapam',
          address: { area: 'Ganapathy', city: 'Coimbatore', district: 'Coimbatore' },
          capacity: { seating: 600, dining: 300 },
          amenities: ['ac', 'parking'],
          slots: [
            { key: 'MORNING', price: 60_000_00 },
            { key: 'EVENING', price: 50_000_00 },
            { key: 'FULL_DAY', price: 95_000_00 },
          ],
          contactPhone: '9000000199',
        })
        .expect(201);
      const venueId = created.body.venue.id;
      expect(created.body.venue.status).toBe('draft');
      expect(created.body.venue.location.lat).toBeCloseTo(11.0168, 2); // district centre until a pin is set

      await api().post(`/api/owner/venues/${venueId}/submit`).set(auth(owner.token)).expect(200);
      const early = await api().post(`/api/admin/venues/${venueId}/review`).set(auth(adminToken)).send({ action: 'approve' }).expect(409);
      expect(early.body.error.code).toBe('OWNER_NOT_APPROVED');
      await api().post(`/api/admin/owners/${owner.user.id}/review`).set(auth(adminToken)).send({ action: 'approve' }).expect(200);
      await api().post(`/api/admin/venues/${venueId}/review`).set(auth(adminToken)).send({ action: 'approve' }).expect(200);

      const search = await api().get('/api/venues?q=Test%20Kalyana').expect(200);
      expect(search.body.items.map((v) => v.id)).toContain(venueId);

      // Owner blocks a date → customers can't take it.
      const blockDate = addDays(todayIST(), 15);
      await api().post(`/api/owner/venues/${venueId}/blocks`).set(auth(owner.token)).send({ date: blockDate, slotKey: 'FULL_DAY', note: 'Painting' }).expect(201);
      const customer = await newUser();
      await api().post('/api/bookings').set(auth(customer.token)).send({ venueId, date: blockDate, slotKey: 'EVENING', guests: 100 }).expect(409);
      await api().delete(`/api/owner/venues/${venueId}/blocks?date=${blockDate}&unit=EVENING`).set(auth(owner.token)).expect(200);
      const b = await holdAndPay(customer.token, { venueId, date: blockDate, slotKey: 'EVENING', guests: 100 });

      // Owner sees it, marks the balance received, and could cancel with a full refund.
      const list = await api().get('/api/owner/bookings?status=upcoming').set(auth(owner.token)).expect(200);
      expect(list.body.items[0].customer.name).toBeTruthy();
      await api().post(`/api/owner/bookings/${b.id}/balance-paid`).set(auth(owner.token)).expect(200);
      const ownerCancel = await api().post(`/api/owner/bookings/${b.id}/cancel`).set(auth(owner.token)).send({ reason: 'Hall under repair' }).expect(200);
      expect(ownerCancel.body.booking.cancellation.refundPercent).toBe(100);

      const cal = await api().get(`/api/owner/venues/${venueId}/calendar?month=${blockDate.slice(0, 7)}`).set(auth(owner.token)).expect(200);
      expect(cal.body.days.find((d) => d.date === blockDate).units.MORNING).toBe('block');

      // Another owner can't touch this hall.
      const intruder = await newUser('owner');
      await api().get(`/api/owner/venues/${venueId}`).set(auth(intruder.token)).expect(404);
    });

    it("keeps the owner's map pin when only the address text changes", async () => {
      const owner = await newUser('owner');
      const created = await api()
        .post('/api/owner/venues')
        .set(auth(owner.token))
        .send({
          name: 'Pinned Mahal',
          address: { city: 'Madurai', district: 'Madurai' },
          location: { lat: 9.95, lng: 78.15 },
          capacity: { seating: 300, dining: 100 },
          slots: [{ key: 'FULL_DAY', price: 80_000_00 }],
        })
        .expect(201);
      const res = await api()
        .patch(`/api/owner/venues/${created.body.venue.id}`)
        .set(auth(owner.token))
        .send({ address: { city: 'Madurai', district: 'Madurai', pincode: '625020' } })
        .expect(200);
      expect(res.body.venue.location).toEqual({ lat: 9.95, lng: 78.15 });
    });

    it('drops a full-day-only hall from date search once half the day is taken', async () => {
      const owner = await newUser('owner', { phone: '9000000198' });
      const v = await api()
        .post('/api/owner/venues')
        .set(auth(owner.token))
        .send({
          name: 'Fullday Only Mahal',
          address: { city: 'Erode', district: 'Erode' },
          capacity: { seating: 400, dining: 200 },
          slots: [{ key: 'FULL_DAY', price: 90_000_00 }],
          contactPhone: '9000000198',
        })
        .expect(201);
      const id = v.body.venue.id;
      await api().post(`/api/owner/venues/${id}/submit`).set(auth(owner.token)).expect(200);
      await api().post(`/api/admin/owners/${owner.user.id}/review`).set(auth(adminToken)).send({ action: 'approve' }).expect(200);
      await api().post(`/api/admin/venues/${id}/review`).set(auth(adminToken)).send({ action: 'approve' }).expect(200);
      const date = addDays(todayIST(), 33);
      const before = await api().get(`/api/venues?district=Erode&date=${date}&limit=50`).expect(200);
      expect(before.body.items.map((x) => x.id)).toContain(id);
      await api().post(`/api/owner/venues/${id}/blocks`).set(auth(owner.token)).send({ date, slotKey: 'MORNING' }).expect(201);
      const after = await api().get(`/api/venues?district=Erode&date=${date}&limit=50`).expect(200);
      expect(after.body.items.map((x) => x.id)).not.toContain(id);
    });

    it('applies a special-date price to new bookings', async () => {
      const ownerToken = await login('owner@arangam.demo', DEMO_PASSWORDS.owner);
      const venues = await api().get('/api/owner/venues').set(auth(ownerToken)).expect(200);
      const v = venues.body.items.find((x) => x.status === 'approved');
      const date = await freeDate(v.id, 'MORNING', 130);
      await api().put(`/api/owner/venues/${v.id}/special-pricing`).set(auth(ownerToken)).send({ date, percent: 20, note: 'Muhurtham' }).expect(200);
      const u = await newUser();
      const res = await api().post('/api/bookings').set(auth(u.token)).send({ venueId: v.id, date, slotKey: 'MORNING', guests: 100 }).expect(201);
      const base = v.slots.find((s) => s.key === 'MORNING').price;
      expect(res.body.booking.pricing.total).toBe(Math.round((base * 1.2) / 100) * 100);
    });

    it('only switches on venue types whose booking engine exists', async () => {
      const gym = await api().patch('/api/admin/venue-types/gym').set(auth(adminToken)).send({ enabled: true }).expect(409);
      expect(gym.body.error.code).toBe('MODE_NOT_IMPLEMENTED');
      await api().patch('/api/admin/venue-types/party-hall').set(auth(adminToken)).send({ enabled: true }).expect(200);
      await api().get('/api/venues?type=party-hall').expect(200);
    });

    it('shows platform numbers to admin', async () => {
      const res = await api().get('/api/admin/summary').set(auth(adminToken)).expect(200);
      expect(res.body.money.gmv).toBeGreaterThan(0);
      expect(res.body.pendingOwners).toBeGreaterThanOrEqual(1);
    });
  });
});
