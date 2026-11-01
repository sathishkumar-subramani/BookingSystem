import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { config } from './config.js';
import { dbState } from './db.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import adminRoutes from './routes/admin.routes.js';
import authRoutes from './routes/auth.routes.js';
import bookingRoutes from './routes/bookings.routes.js';
import ownerRoutes from './routes/owner.routes.js';
import publicRoutes from './routes/public.routes.js';

/** Accepts exact origins and simple wildcards like https://*.vercel.app */
function originAllowed(origin) {
  if (!origin || config.clientOrigins.length === 0) return true;
  return config.clientOrigins.some((allowed) => {
    if (!allowed.includes('*')) return allowed === origin;
    const rx = new RegExp(`^${allowed.split('*').map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^.]+')}$`);
    return rx.test(origin);
  });
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Render sits in front of us
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: (origin, cb) => cb(null, originAllowed(origin)), maxAge: 86400 }));
  app.use(express.json({ limit: '200kb' }));
  if (!config.isTest) {
    app.use(
      pinoHttp({
        logger,
        autoLogging: { ignore: (req) => req.url === '/health' },
        serializers: { req: (req) => ({ method: req.method, url: req.url }), res: (res) => ({ status: res.statusCode }) },
      }),
    );
  }

  app.get('/', (_req, res) => res.json({ name: 'Arangam API', docs: '/health, /api/catalog, /api/venues' }));
  // Always 200 so a deploy goes live even before MONGODB_URI is set; the body says if the DB is reachable.
  app.get('/health', (_req, res) => {
    const db = dbState();
    res.json({ status: db === 'up' ? 'ok' : 'degraded', db });
  });

  // Without a database every query would sit in Mongoose's buffer for 10 s and then fail with a vague 500.
  // Answer straight away instead, so the apps can say what's wrong.
  app.use('/api', (_req, res, next) => {
    if (dbState() === 'up') return next();
    res.status(503).json({
      error: { code: 'DB_UNAVAILABLE', message: 'The server is starting up or its database is not connected yet. Please try again in a minute.' },
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api', publicRoutes);
  app.use('/api', bookingRoutes);
  app.use('/api/owner', ownerRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
