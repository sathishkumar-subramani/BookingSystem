# Arangam (அரங்கம்)

Book a kalyana mandapam for your muhurtham. Customers find marriage halls across Tamil Nadu, see which sessions are free on their date, hold one for 10 minutes and pay the advance. Hall owners manage prices, blocked dates and balances. Admins approve owners and halls.

Built so other kinds of venues (party halls, gyms, concerts) can plug in later without rewriting the hall code.

| | |
|---|---|
| **Web** | https://arangam-one.vercel.app |
| **API** | https://arangam-api.onrender.com (`/health`) |
| **Android** | Expo app in `mobile/` — APK via EAS |

> Demo mode: halls are sample data and payments are simulated. No real money moves.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Customer | `user@arangam.demo` | `User@1234` |
| Hall owner | `owner@arangam.demo` | `Owner@1234` |
| Admin | `admin@arangam.demo` | `Admin@1234` |

## What's inside

```
api/      Node 22 · Express 5 · Mongoose · zod · JWT (access + rotating refresh)
web/      React 19 · Vite · TypeScript · Redux Toolkit / RTK Query · motion · Lottie
mobile/   Expo (React Native) · expo-router · RTK Query · lottie-react-native · react-native-svg
shared/   theme.json (colours for web + mobile), lottie/build.mjs (generates the animations)
docs/     API.md · DESIGN.md · DEPLOY.md
```

## Features

**Customers** — district search, "near me" (phone/browser location + MongoDB geo search), filters (date, session, guests, budget, amenities), hall pages with a month calendar showing morning/evening availability, 10-minute hold, test payment, booking ticket, cancellation with refund quote.

**Hall owners** — sign up (admin approves), add halls with session prices/timings, advance %, cancellation policy; calendar to block dates (phone bookings, repairs) and raise prices on peak muhurtham days; bookings list with "balance received"; earnings overview.

**Admins** — approve or reject owners and halls, see every booking and platform numbers, cancel with full refund, suspend users, switch venue categories on/off.

**No double booking** — every session is made of "units" (morning, evening). Taking a slot inserts one lock per unit, and a unique MongoDB index refuses a second lock for the same unit. Ten people pressing "Book" at the same moment → exactly one wins (there's a test for it).

## Run locally

```bash
# API + MongoDB in Docker (demo data seeded on first start)
docker compose up --build            # http://localhost:5090/health

# or without Docker (needs a MongoDB)
cd api && cp .env.example .env && npm install && npm run dev

# Web
cd web && cp .env.example .env && npm install && npm run dev      # http://localhost:5173

# Mobile
cd mobile && npm install && npx expo start                         # scan with Expo Go
```

## Tests

```bash
cd api && TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm test   # 36 tests, real MongoDB
cd web && npm test && npm run typecheck && npm run build
cd mobile && npm run typecheck
```

GitHub Actions runs all of these on every push (`.github/workflows/ci.yml`).

## Coming next

Razorpay (adapter written in `api/src/providers/payments/razorpay.js`, needs keys), Google Maps (location provider port ready), hall photos, email/SMS confirmations, gym memberships and concert tickets (new booking engines in `api/src/engines`).
