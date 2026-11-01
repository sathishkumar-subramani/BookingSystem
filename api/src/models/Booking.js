import mongoose from 'mongoose';

export const BOOKING_STATUSES = ['HELD', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'COMPLETED'];

const bookingSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    typeKey: { type: String, required: true },
    bookingMode: { type: String, required: true },
    // Snapshot so the booking still reads correctly if the owner later renames or reprices the hall.
    venue: {
      name: String,
      slug: String,
      city: String,
      district: String,
      area: String,
      coverStyle: Number,
    },
    date: { type: String, required: true },
    slot: {
      key: String,
      label: String,
      start: String,
      end: String,
      units: [String],
    },
    guests: { type: Number, required: true, min: 1 },
    eventKind: { type: String, default: 'wedding' },
    contact: { name: String, phone: String },
    notes: { type: String, maxlength: 500 },
    pricing: {
      base: Number, // paise — slot price before special-date adjustment
      adjustmentPercent: { type: Number, default: 0 },
      total: Number, // what the hall costs
      advance: Number, // paid online now
      balance: Number, // paid at the venue
      platformFee: Number, // our commission, taken out of the advance
      ownerPayoutNow: Number, // advance − platform fee
    },
    cancellationPolicy: String,
    status: { type: String, enum: BOOKING_STATUSES, default: 'HELD', index: true },
    holdExpiresAt: Date,
    confirmedAt: Date,
    balanceStatus: { type: String, enum: ['DUE', 'PAID_AT_VENUE'], default: 'DUE' },
    balancePaidAt: Date,
    payment: {
      provider: String,
      orderId: String,
      paymentId: String,
      paidAt: Date,
    },
    cancellation: {
      by: { type: String, enum: ['user', 'owner', 'admin', 'system'] },
      reason: String,
      at: Date,
      refundPercent: Number,
      refundAmount: Number,
      refundId: String,
      refundStatus: { type: String, enum: ['NONE', 'PENDING', 'REFUNDED', 'FAILED'] },
    },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ ownerId: 1, date: 1 });
bookingSchema.index({ status: 1, holdExpiresAt: 1 });

export const Booking = mongoose.model('Booking', bookingSchema);
