// Money is always an integer number of paise (₹1 = 100 paise) — the same unit Razorpay uses,
// so no floating point ever touches an amount.

export const rupees = (r) => Math.round(r * 100);

/** percent of an amount in paise, rounded to the nearest rupee (whole 100 paise). */
export const percentOf = (paise, percent) => Math.round((paise * percent) / 100 / 100) * 100;

export const formatINR = (paise) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
