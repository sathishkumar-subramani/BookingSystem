# API

Base URL: `https://arangam-api.onrender.com/api` (local: `http://localhost:5090/api`).
JSON in and out. Money is integer **paise** (₹1 = 100). Dates are `YYYY-MM-DD` in India time.
Errors: `{ "error": { "code": "SLOT_TAKEN", "message": "…", "details"?: … } }`.

Auth: `Authorization: Bearer <accessToken>` (15 min). Refresh with the rotating refresh token (30 days); reusing an old refresh token signs out every session in that family.

## Auth

| Method | Path | Body / notes |
|---|---|---|
| POST | `/auth/register` | `{ name, email, password, phone?, role: "user" \| "owner", businessName?, city? }` → `{ accessToken, refreshToken, user }` |
| POST | `/auth/login` | `{ email, password }` |
| POST | `/auth/refresh` | `{ refreshToken }` → new pair |
| POST | `/auth/logout` | `{ refreshToken }` |
| GET | `/auth/me` | current user |
| PATCH | `/auth/me` | `{ name?, phone?, businessName?, city? }` |
| POST | `/auth/me/password` | `{ currentPassword, newPassword }` (signs out other devices) |

## Public

| Method | Path | Notes |
|---|---|---|
| GET | `/catalog` | districts (38, with lat/lng), amenities, cancellation policies, venue types, hold minutes, payment mode |
| GET | `/venues` | search, see below |
| GET | `/venues/:idOrSlug` | hall detail |
| GET | `/venues/:idOrSlug/availability?month=2026-12` | per day: `bookable`, `units { MORNING, EVENING }` = `free \| held \| taken`, `slots [{ key, available, price }]`, `adjustmentPercent` |

**Search params:** `type` (default `marriage-hall`), `district`, `city`, `q` (name/area), `date`, `slot` (`MORNING \| EVENING \| FULL_DAY`), `guests`, `maxPrice` (paise), `amenities` (comma list), `lat` + `lng` + `radiusKm` (near me, sorted by distance), `sort` (`distance \| price_asc \| price_desc \| capacity_desc \| newest`), `page`, `limit`.
With `date` the results leave out halls that can't take a booking, and each card's `slots[].available` says which sessions are free.

## Bookings (signed in)

| Method | Path | Notes |
|---|---|---|
| POST | `/bookings` | `{ venueId, date, slotKey, guests, eventKind?, contactName?, contactPhone?, notes? }` → `201 { booking (HELD), checkout }`. `409 SLOT_TAKEN`, `409 TOO_MANY_HOLDS` |
| POST | `/payments/mock/checkout` | `{ orderId, outcome: "success" \| "failure" }` → `{ orderId, paymentId, signature }` (stands in for the gateway) |
| POST | `/bookings/:id/confirm` | `{ orderId, paymentId, signature }` → CONFIRMED. `410 HOLD_EXPIRED` (refunded), `400 PAYMENT_INVALID` |
| GET | `/bookings?status=upcoming\|past\|cancelled\|all` | my bookings |
| GET | `/bookings/:id` | includes `cancelQuote`; hall phone once confirmed |
| GET | `/bookings/:id/cancel-quote` | `{ refundPercent, refundAmount, daysBefore, cancellable }` |
| POST | `/bookings/:id/cancel` | `{ reason? }` |

## Owner (`role = owner`)

| Method | Path | Notes |
|---|---|---|
| GET | `/owner/summary` | counts, money, next bookings, bookings by month |
| GET / POST | `/owner/venues` | list / create (draft). Slots: `[{ key, price, start?, end?, enabled }]` |
| GET / PATCH / DELETE | `/owner/venues/:id` | delete only draft/rejected without bookings |
| POST | `/owner/venues/:id/submit` | draft/rejected → pending |
| GET | `/owner/venues/:id/calendar?month=` | availability with `booking`/`block` details |
| POST | `/owner/venues/:id/blocks` | `{ date, slotKey, note? }` |
| DELETE | `/owner/venues/:id/blocks?date=&unit=` | unblock one unit |
| PUT | `/owner/venues/:id/special-pricing` | `{ date, percent (-50…200), note? }`; `percent: 0` clears |
| GET | `/owner/bookings?status=upcoming\|balance\|past\|cancelled\|all&venueId=&q=` | |
| POST | `/owner/bookings/:id/balance-paid` | |
| POST | `/owner/bookings/:id/cancel` | full refund to the customer |

## Admin (`role = admin`)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/summary` | users, approvals waiting, venues, bookings, GMV, fees, refunds |
| GET | `/admin/owners?status=pending` | |
| POST | `/admin/owners/:id/review` | `{ action: "approve" \| "reject", note? }` (note required to reject) |
| GET | `/admin/venues?status=pending` | |
| POST | `/admin/venues/:id/review` | `{ action: "approve" \| "reject" \| "suspend", note? }` — approve needs an approved owner |
| GET | `/admin/bookings?status=&q=` | |
| POST | `/admin/bookings/:id/cancel` | full refund |
| GET | `/admin/users?role=&q=` | |
| POST | `/admin/users/:id/status` | `{ status: "active" \| "suspended" }` |
| GET | `/admin/venue-types` | |
| PATCH | `/admin/venue-types/:key` | `{ enabled }` — `409 MODE_NOT_IMPLEMENTED` if its engine isn't built |

`GET /health` → `{ status: "ok" \| "degraded", db: "up" \| "down" }`.
