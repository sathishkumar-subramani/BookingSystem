import { AppError } from '../lib/errors.js';
import { exclusiveEngine } from './exclusive.js';

// One engine per booking mode. Gym (SUBSCRIPTION / CAPACITY) and concerts (TICKETED) plug in here later
// without touching marriage-hall code — see docs/DESIGN.md "Adding a new venue type".
const ENGINES = {
  EXCLUSIVE: exclusiveEngine,
  CAPACITY: { mode: 'CAPACITY', implemented: false },
  TICKETED: { mode: 'TICKETED', implemented: false },
  SUBSCRIPTION: { mode: 'SUBSCRIPTION', implemented: false },
};

export const isModeImplemented = (mode) => Boolean(ENGINES[mode]?.implemented);

export function engineFor(mode) {
  const engine = ENGINES[mode];
  if (!engine?.implemented) {
    throw new AppError(501, 'MODE_NOT_IMPLEMENTED', `Booking mode ${mode} is coming soon`);
  }
  return engine;
}
