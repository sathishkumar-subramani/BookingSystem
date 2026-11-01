// npm run seed            → seed demo data if the database has no venues yet
// npm run seed -- --reset → delete the demo data (only *@arangam.demo users and demo halls) and seed again
import mongoose from 'mongoose';
import { connectDb } from '../src/db.js';
import { DEMO_PASSWORDS, resetDemo, seedDemo, seedIfEmpty } from '../src/seed/demo.js';

const reset = process.argv.includes('--reset');

await connectDb();
let result;
if (reset) {
  await resetDemo();
  result = await seedDemo();
} else {
  result = await seedIfEmpty();
}
console.log(result ? { seeded: result } : 'Database already has venues — nothing to do (use --reset to re-seed demo data).');
console.log('Demo logins:', {
  admin: `admin@arangam.demo / ${DEMO_PASSWORDS.admin}`,
  owner: `owner@arangam.demo / ${DEMO_PASSWORDS.owner}`,
  user: `user@arangam.demo / ${DEMO_PASSWORDS.user}`,
});
await mongoose.disconnect();
