# Deploying

Same setup as Kanakku: API on Render, web on Vercel, database on MongoDB Atlas, Android app through Expo EAS.

## 1. MongoDB Atlas

Use an existing cluster or create a free M0 one.

- **Network Access** → `0.0.0.0/0` (Render's free plan has no fixed IP).
- **Connect → Drivers** → copy `mongodb+srv://USER:PASSWORD@cluster.xxxxx.mongodb.net/...`
- The database name is set separately (`MONGODB_DB=arangam`), so this app's data stays apart from other apps on the same cluster. Collections and indexes are created on first start.

## 2. API on Render

Service **arangam-api** (Singapore, free) is already connected to this repo and redeploys on every push to `main`.

- Build: `npm --prefix api ci --omit=dev` · Start: `npm --prefix api start`
- Environment: `NODE_ENV=production`, `MONGODB_DB=arangam`, `JWT_SECRET`, `MOCK_PAYMENT_SECRET`, `DEMO_MODE=true`, `DEMO_ADMIN_PASSWORD`, `SEED_DEMO_DATA=true`, `PAYMENT_PROVIDER=mock` are set.
- `DEMO_MODE=true` is required for mock payments and demo data in production — the API refuses to start otherwise. Turn it off (and switch to Razorpay) for a real launch.
- The demo admin (`admin@arangam.demo`) uses `DEMO_ADMIN_PASSWORD`; change it there and restart to rotate it.
- **You add:** `MONGODB_URI` = your Atlas string → Save. Render redeploys; logs show `MongoDB connected` then `Demo data seeded`.
- Check: `https://arangam-api.onrender.com/health` → `{"status":"ok","db":"up"}`.

`render.yaml` describes the same service as a Blueprint if you ever recreate it.

**Free-tier sleep:** the service sleeps after 15 minutes idle; the first request takes ~50 s. Web and mobile wait up to 60–75 s and say the server may be waking up.

`SEED_DEMO_DATA=true` only fills an **empty** database. To reset the demo data from your laptop: `cd api && MONGODB_URI="<atlas>" npm run seed -- --reset` (only touches `*@arangam.demo` users and demo halls).

## 3. Web on Vercel

Project **arangam** (root directory `web`, framework Vite) is linked to this repo; every push to `main` deploys.

- Env: `VITE_API_URL=https://arangam-api.onrender.com/api` (baked in at build time — redeploy after changing it).
- `web/vercel.json` rewrites all paths to `index.html` for client-side routing.
- Live at https://arangam-one.vercel.app

Optional: lock CORS by setting `CLIENT_ORIGINS=https://arangam-one.vercel.app` on Render.

## 4. Android APK

GitHub Actions builds the APK (`.github/workflows/android-apk.yml`) whenever `mobile/` changes, or on demand from **Actions → Android APK → Run workflow**, and attaches it to a GitHub release:

https://github.com/sathishkumar-subramani/BookingSystem/releases/latest/download/Arangam.apk

It runs `expo prebuild` and Gradle on GitHub's runner, so no Expo account is needed. The APK is signed with the template's debug key: good for demos and sideloading, not for the Play Store.

For a Play Store build, use EAS (it stores a private release key):

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest init      # once: links the project, writes the project id into app.json
npx eas-cli@latest build -p android --profile production
```

## Razorpay later

1. Get **test** keys from the Razorpay dashboard.
2. On Render: `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
3. Replace the test-payment sheet in web (`web/src/pages/Checkout.tsx`) and mobile (`mobile/src/app/checkout/[id].tsx`) with Razorpay Checkout using the `orderId` and `keyId` the API already returns; send its `razorpay_payment_id` / `razorpay_signature` to `POST /api/bookings/:id/confirm` exactly as now.
4. Add a webhook route for `payment.captured` so a payment completed after the app closed still confirms or refunds.
