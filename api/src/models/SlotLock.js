import mongoose from 'mongoose';

// THE double-booking guard.
// One document per (venue, date, unit) that is taken. The unique index makes MongoDB itself refuse a
// second lock for the same unit — so even two requests arriving in the same millisecond can't both win.
//
//   kind = 'hold'    → someone is paying right now; expiresAt is set (10 min). TTL index cleans it up.
//   kind = 'booking' → paid & confirmed; expiresAt is removed so it never expires.
//   kind = 'block'   → the owner closed this unit (offline booking, maintenance, own function).
const slotLockSchema = new mongoose.Schema(
  {
    venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
    date: { type: String, required: true },
    unit: { type: String, required: true },
    kind: { type: String, enum: ['hold', 'booking', 'block'], required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
    note: { type: String, maxlength: 80 },
    expiresAt: Date,
  },
  { timestamps: true },
);

slotLockSchema.index({ venueId: 1, date: 1, unit: 1 }, { unique: true });
slotLockSchema.index({ date: 1, unit: 1 });
// MongoDB removes expired holds by itself (the TTL monitor runs about once a minute).
// Our code also treats a hold past its expiresAt as free, so that minute of lag never blocks anyone.
slotLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SlotLock = mongoose.model('SlotLock', slotLockSchema);
