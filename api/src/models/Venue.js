import mongoose from 'mongoose';

export const VENUE_STATUSES = ['draft', 'pending', 'approved', 'rejected', 'suspended'];
export const CANCELLATION_POLICIES = ['flexible', 'moderate', 'strict'];

const slotSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // MORNING | EVENING | FULL_DAY
    label: { type: String, required: true },
    start: { type: String, required: true }, // "05:00"
    end: { type: String, required: true }, // "13:00"
    units: { type: [String], required: true }, // units this slot occupies
    price: { type: Number, required: true, min: 0 }, // paise
    enabled: { type: Boolean, default: true },
  },
  { _id: false },
);

const specialPriceSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // YYYY-MM-DD
    percent: { type: Number, required: true, min: -50, max: 200 },
    note: { type: String, maxlength: 60 },
  },
  { _id: false },
);

const venueSchema = new mongoose.Schema(
  {
    typeKey: { type: String, required: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true },
    tagline: { type: String, maxlength: 140 },
    description: { type: String, maxlength: 3000 },
    address: {
      line1: { type: String, maxlength: 160 },
      area: { type: String, maxlength: 80 },
      city: { type: String, required: true, maxlength: 60 },
      district: { type: String, required: true, maxlength: 60 },
      state: { type: String, default: 'Tamil Nadu' },
      pincode: { type: String, maxlength: 6 },
    },
    // GeoJSON — note the order: [longitude, latitude]
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    capacity: {
      seating: { type: Number, required: true, min: 1 },
      dining: { type: Number, default: 0, min: 0 },
    },
    rooms: { type: Number, default: 0, min: 0 },
    parkingCars: { type: Number, default: 0, min: 0 },
    amenities: [String],
    slots: [slotSchema],
    minPrice: { type: Number, default: 0 }, // cheapest enabled slot, kept in sync on save (for sorting)
    advancePercent: { type: Number, default: 25, min: 10, max: 100 },
    cancellationPolicy: { type: String, enum: CANCELLATION_POLICIES, default: 'moderate' },
    specialPricing: [specialPriceSchema],
    contactPhone: { type: String, maxlength: 15 },
    // Until photo upload lands, the UI draws an illustrated cover from this seed.
    coverStyle: { type: Number, default: 0 },
    status: { type: String, enum: VENUE_STATUSES, default: 'draft', index: true },
    reviewNote: { type: String, maxlength: 300 },
    submittedAt: Date,
    approvedAt: Date,
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

venueSchema.pre('save', function syncMinPrice() {
  const prices = (this.slots || []).filter((s) => s.enabled).map((s) => s.price);
  this.minPrice = prices.length ? Math.min(...prices) : 0;
});

venueSchema.index({ location: '2dsphere' });
venueSchema.index({ status: 1, typeKey: 1, 'address.district': 1 });
// Free-text search uses a case-insensitive regex instead of a $text index, because MongoDB
// does not allow $text and $geoNear ("near me") in the same query.

export const Venue = mongoose.model('Venue', venueSchema);
