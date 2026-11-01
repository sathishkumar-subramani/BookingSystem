import type { BookingStatus, SlotKey } from '../api/types';

/** ₹1,20,000 — Indian digit grouping, whole rupees. Input is paise. */
export const inr = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;

/** ₹1.2 L / ₹85 K for tight spaces. */
export function inrShort(paise: number) {
  const r = paise / 100;
  if (r >= 1_00_00_000) return `₹${(r / 1_00_00_000).toFixed(r % 1_00_00_000 === 0 ? 0 : 1)} Cr`;
  if (r >= 1_00_000) return `₹${(r / 1_00_000).toFixed(r % 1_00_000 === 0 ? 0 : 1)} L`;
  if (r >= 1000) return `₹${Math.round(r / 1000)} K`;
  return `₹${r}`;
}

export const rupeesToPaise = (r: number) => Math.round(r * 100);
export const paiseToRupees = (p: number) => Math.round(p / 100);

const D = (s: string) => new Date(`${s}T00:00:00`);

/** "Sun, 14 Dec 2026" */
export const longDate = (s: string) =>
  D(s).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
/** "14 Dec" */
export const shortDate = (s: string) => D(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
export const monthTitle = (m: string) => D(`${m}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

/** 05:00 → 5 am, 16:30 → 4:30 pm */
export function clock(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
}

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const addDaysISO = (s: string, n: number) => {
  const d = D(s);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const shiftMonth = (m: string, n: number) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const SLOT_NAMES: Record<SlotKey, string> = {
  MORNING: 'Morning',
  EVENING: 'Evening',
  FULL_DAY: 'Full day',
};

export const STATUS_NAMES: Record<BookingStatus, string> = {
  HELD: 'Waiting for payment',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Hold expired',
  COMPLETED: 'Completed',
};

export const EVENT_NAMES: Record<string, string> = {
  wedding: 'Wedding',
  reception: 'Reception',
  engagement: 'Engagement',
  seemantham: 'Seemantham (baby shower)',
  'ear-piercing': 'Ear-piercing ceremony',
  birthday: 'Birthday',
  anniversary: 'Anniversary',
  'get-together': 'Get-together',
  other: 'Other function',
};

export const POLICY_NAMES = { flexible: 'Flexible', moderate: 'Moderate', strict: 'Strict' } as const;

export function describeRules(rules: { minDays: number; percent: number }[]) {
  const parts = rules.map((r) => `${r.percent}% back if you cancel ${r.minDays}+ days before`);
  const last = rules[rules.length - 1];
  return [...parts, `nothing back within ${last.minDays} days`];
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;
