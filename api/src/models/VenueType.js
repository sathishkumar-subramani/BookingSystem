import mongoose from 'mongoose';

// How a venue type sells its inventory. Each mode is a separate booking engine (src/engines).
//   EXCLUSIVE    — one booking takes the whole venue for a slot (marriage hall, party hall)
//   CAPACITY     — many people share a slot up to a limit (gym class, swimming pool session)
//   TICKETED     — an event with seats / ticket tiers (concert, stand-up show)
//   SUBSCRIPTION — recurring membership for a period (gym monthly plan)
export const BOOKING_MODES = ['EXCLUSIVE', 'CAPACITY', 'TICKETED', 'SUBSCRIPTION'];

const unitSchema = new mongoose.Schema(
  { key: { type: String, required: true }, label: { type: String, required: true } },
  { _id: false },
);

const slotTemplateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    start: String,
    end: String,
    units: [String],
  },
  { _id: false },
);

const venueTypeSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    tamilName: String,
    description: String,
    icon: String,
    bookingMode: { type: String, enum: BOOKING_MODES, required: true },
    enabled: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 100 },
    // EXCLUSIVE venues: the smallest pieces of a day that can be locked, and the slots built from them.
    units: [unitSchema],
    slotTemplates: [slotTemplateSchema],
    eventKinds: [String],
  },
  { timestamps: true },
);

venueTypeSchema.methods.toPublic = function toPublic() {
  return {
    key: this.key,
    name: this.name,
    tamilName: this.tamilName ?? null,
    description: this.description ?? null,
    icon: this.icon ?? null,
    bookingMode: this.bookingMode,
    enabled: this.enabled,
    units: this.units,
    slotTemplates: this.slotTemplates,
    eventKinds: this.eventKinds,
  };
};

export const VenueType = mongoose.model('VenueType', venueTypeSchema);
