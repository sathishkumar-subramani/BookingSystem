import { createApp } from './app.js';
import { config } from './config.js';
import { connectDb } from './db.js';
import { logger } from './lib/logger.js';
import { sweep } from './services/booking.service.js';
import { seedIfEmpty, syncDemoAdminPassword } from './seed/demo.js';

const app = createApp();

// Listen first so Render's health check gets an answer while MongoDB is still connecting.
const server = app.listen(config.port, '0.0.0.0', () => logger.info(`Arangam API on :${config.port}`));

async function start(attempt = 1) {
  try {
    await connectDb();
    if (config.seedDemoData) await seedIfEmpty();
    if (config.demoMode || !config.isProd) await syncDemoAdminPassword();
  } catch (err) {
    // Keep the API up (health says "degraded") and try again with backoff, e.g. while Atlas wakes up.
    const wait = Math.min(60, 5 * attempt);
    logger.error({ err: { message: err.message }, db: config.mongoDb }, `MongoDB connection failed — retrying in ${wait}s`);
    setTimeout(() => start(attempt + 1), wait * 1000).unref();
    return;
  }
  // Expire unpaid holds every minute (requests also trigger this lazily, for when the free instance sleeps).
  setInterval(() => sweep().catch((err) => logger.warn({ err }, 'sweep failed')), 60_000).unref();
}

start();

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
