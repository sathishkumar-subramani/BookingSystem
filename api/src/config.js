import 'dotenv/config';

const DEV_SECRET = 'local-dev-secret-change-me-0123456789abcdef0123456789';

const env = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || DEV_SECRET;

if (env === 'production' && (jwtSecret === DEV_SECRET || jwtSecret.length < 32)) {
  throw new Error('JWT_SECRET must be set to a random string of 32+ characters in production');
}

const int = (v, d) => (v === undefined || v === '' ? d : Number.parseInt(v, 10));

export const config = {
  env,
  isProd: env === 'production',
  isTest: env === 'test',
  port: int(process.env.PORT, 5090),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017',
  mongoDb: process.env.MONGODB_DB || 'arangam',
  jwtSecret,
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenDays: int(process.env.REFRESH_TOKEN_DAYS, 30),
  clientOrigins: (process.env.CLIENT_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // Booking rules
  holdMinutes: int(process.env.HOLD_MINUTES, 10),
  platformFeePercent: int(process.env.PLATFORM_FEE_PERCENT, 5),
  maxAdvanceDays: int(process.env.MAX_ADVANCE_DAYS, 540),
  timeZone: 'Asia/Kolkata',
  // Providers — swap to "razorpay" / "google" once those adapters are filled in
  paymentProvider: process.env.PAYMENT_PROVIDER || 'mock',
  mockPaymentSecret: process.env.MOCK_PAYMENT_SECRET || 'mock-gateway-secret',
  locationProvider: process.env.LOCATION_PROVIDER || 'static',
  seedDemoData: (process.env.SEED_DEMO_DATA || 'false').toLowerCase() === 'true',
  // Demo mode must be switched on explicitly in production: it allows the mock payment gateway
  // (anyone can "pay") and seeding sample data. A real deployment leaves it off.
  demoMode: (process.env.DEMO_MODE || 'false').toLowerCase() === 'true',
};

if (config.isProd && !config.demoMode) {
  if (config.paymentProvider === 'mock') throw new Error('PAYMENT_PROVIDER=mock is only allowed with DEMO_MODE=true in production');
  if (config.seedDemoData) throw new Error('SEED_DEMO_DATA=true is only allowed with DEMO_MODE=true in production');
}
