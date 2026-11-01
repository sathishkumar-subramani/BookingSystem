import mongoose from 'mongoose';

// One row per money movement attempt — an order (advance) or a refund.
// Mirrors Razorpay's objects so swapping the mock for the real gateway changes no schema.
const paymentSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, required: true },
    purpose: { type: String, enum: ['ADVANCE', 'REFUND'], required: true },
    amount: { type: Number, required: true }, // paise
    currency: { type: String, default: 'INR' },
    orderId: { type: String, index: true, unique: true, sparse: true },
    paymentId: String,
    refundId: String,
    status: { type: String, enum: ['CREATED', 'PAID', 'FAILED', 'REFUNDED'], default: 'CREATED' },
    failureReason: String,
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Payment = mongoose.model('Payment', paymentSchema);
