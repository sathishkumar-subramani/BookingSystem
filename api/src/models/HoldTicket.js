import mongoose from 'mongoose';

// Caps how many unpaid holds one person can have at once (2), atomically.
// Each open hold takes one of the user's numbered tickets; the unique index on (userId, n) means two
// parallel "Book" requests can't both take ticket 0. Tickets expire with the hold (TTL), and are
// deleted as soon as the hold is paid, cancelled or expires.
const holdTicketSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    n: { type: Number, required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

holdTicketSchema.index({ userId: 1, n: 1 }, { unique: true });
holdTicketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const HoldTicket = mongoose.model('HoldTicket', holdTicketSchema);
