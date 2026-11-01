import mongoose from 'mongoose';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { ensureVenueTypes } from './services/catalog.service.js';

mongoose.set('strictQuery', true);

export async function connectDb(uri = config.mongoUri, dbName = config.mongoDb) {
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 15_000 });
  try {
    await mongoose.connection.syncIndexes();
  } catch (err) {
    logger.error({ err }, 'Could not create MongoDB indexes');
  }
  await ensureVenueTypes();
  logger.info({ db: dbName }, 'MongoDB connected');
}

export const dbState = () => (mongoose.connection.readyState === 1 ? 'up' : 'down');
