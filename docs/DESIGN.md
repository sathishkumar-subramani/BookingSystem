# Design notes

## The core idea: venue type → booking engine

"Registration" for a marriage hall, a gym and a concert are three different businesses:

| | Marriage hall | Gym | Concert |
|---|---|---|---|
| What is sold | the whole hall for a session | a membership or a slot in a class | a seat for one show |
| People per slot | 1 booking | many (capacity) | many (seats / tiers) |
| Length | a session or a day | a month | one show |

So the data model never says "marriage hall". It says **VenueType → Venue → Slot → Booking → Payment**, and each venue type has a `bookingMode`:

| Mode | Engine | Status |
|---|---|---|
| `EXCLUSIVE` | one booking takes the whole venue for a slot | **built** (`api/src/engines/exclusive.js`) — marriage halls, party halls |
| `CAPACITY` | many bookings per slot up to a limit | reserved |
| `TICKETED` | seats / tiers per event | reserved |
| `SUBSCRIPTION` | recurring memberships | reserved |

Admin can only switch on a category whose engine exists (the API returns `409 MODE_NOT_IMPLEMENTED` otherwise). Party halls already work — they reuse the exclusive engine.

### Adding a new venue type later

1. Add a row to `api/src/data/venueTypes.js` (or insert into the `venuetypes` collection).
2. If it needs a new booking mode, write `api/src/engines/<mode>.js` with the same shape as `exclusive.js` (`acquireUnits`, `convertHoldsToBooking`, `releaseBooking`, availability) and register it in `engines/index.js`.
3. Give the web and mobile a page for its offering. Search, payments, owner approval, admin and auth are shared.

## Sessions are built from units

A day has two **units**: `MORNING` and `EVENING`. A **slot** occupies units:

```
MORNING  → [MORNING]
EVENING  → [EVENING]
FULL_DAY → [MORNING, EVENING]
```

Owners set price and timings per slot. Units are what get locked, so "full day" automatically conflicts with "morning" and "evening".

## How double booking is impossible

`slotlocks` has a **unique index on (venueId, date, unit)**. Taking a slot = inserting one lock per unit:

- `hold` — someone is paying; has `expiresAt` (hold + 2 min grace). A TTL index deletes expired holds; code also treats an expired hold as free and takes it over on the spot.
- `booking` — paid; `expiresAt` removed, so it never expires.
- `block` — the owner closed the unit.

If any unit of a slot is taken, the units already inserted by that request are deleted again (all-or-nothing without transactions, so it works on any MongoDB including Atlas free tier and local single-node).

Think of a row of lockers with one key each: whoever reaches the key first gets the locker; the other hand finds the hook empty. There is no "check, then take" gap for a race to slip through.

## Booking lifecycle

```
POST /bookings ──► HELD (10 min, locks = hold)
                    │  pay (mock gateway / Razorpay later)
                    ▼
POST /bookings/:id/confirm ──► CONFIRMED (locks = booking) ──► COMPLETED (after the date)
                    │                         │
            hold runs out                cancel (user / owner / admin)
                    ▼                         ▼
                 EXPIRED                  CANCELLED (+ refund per policy)
```

Money rules:
- Money is integer **paise** everywhere (the unit Razorpay uses).
- Advance = owner's `advancePercent` of the total (default 25%). Balance is paid at the hall; owner marks it received.
- Platform fee = 5% of the total, taken from the advance.
- If a payment arrives after the hold expired, or the booking was released, the advance is refunded in full. The payment row is claimed atomically first, so a double click can't refund twice.
- Cancellation refunds come from the hall's policy (flexible / moderate / strict, by days before the event). Owner or admin cancelling always refunds 100%.
- A customer can have at most 2 open holds, so nobody can sit on every muhurtham date in a month.

## Location

"Near me" does **not** need Google Maps. Each venue stores a GeoJSON point; MongoDB's `2dsphere` index + `$geoNear` returns halls by distance from the phone/browser location. Google Maps will add map display, address autocomplete and geocoding of typed addresses — behind `api/src/providers/location`, so nothing else changes. Until then a hall without a pin uses its district's centre.

## Payments

`api/src/providers/payments` is a port with `createOrder · checkoutOptions · verifyPayment · refund`. The mock gateway signs payments with Razorpay's exact formula (`HMAC-SHA256(secret, orderId|paymentId)`), so the confirm step is already the real verification. To go live: set `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, load Razorpay Checkout in the web/mobile pay step, and add a webhook endpoint for payments that complete after the app is closed.

## Roles

| | Customer | Hall owner | Admin |
|---|---|---|---|
| Search, book, cancel own | ✓ | ✓ (not own halls) | — |
| Add / edit own halls | | ✓ (live after admin approval) | |
| Calendar blocks, peak prices, balances | | ✓ own halls | |
| Approve owners & halls, all bookings, users, categories | | | ✓ |

New owners sign up as `pending`; a hall goes live only when both the owner and the hall are approved.

## Visual design

- **Palette** from Kanjivaram silk: peacock teal for actions, arakku maroon for brand ink, zari gold only for the temple border and peak-day markers, jasmine near-white background. Dark mode uses a deep maroon-brown, not black.
- **Type:** Anek Tamil (Latin + Tamil in one family, variable width). Wide width for headings, normal for body.
- **The one ornament:** the Kanjivaram "korvai" temple border — under the hero, on the hall page, on the booking ticket.
- **Animations** (original Lottie files, generated by `shared/lottie/build.mjs`): mango-leaf thoranam with marigolds, kuthuvilakku with flickering flames, petal celebration on a confirmed booking, kolam loader, drifting petals. Plus motion: page transitions, staggered lists, sliding calendar, count-up stats, countdown ring. Everything respects "reduce motion".
- **Hall covers** are illustrated (mandapam facade, banana trees, thoranam, kolam) until owners upload photos.
