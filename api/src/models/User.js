import mongoose from 'mongoose';

export const ROLES = ['user', 'owner', 'admin'];

const ownerProfileSchema = new mongoose.Schema(
  {
    // Owners can sign in and draft halls immediately, but nothing is listed until an admin approves them.
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    businessName: { type: String, trim: true, maxlength: 120 },
    city: { type: String, trim: true, maxlength: 60 },
    reviewNote: { type: String, maxlength: 300 },
    reviewedAt: Date,
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, maxlength: 15 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'user', index: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    owner: { type: ownerProfileSchema, default: undefined },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    phone: this.phone ?? null,
    role: this.role,
    status: this.status,
    owner: this.owner
      ? {
          status: this.owner.status,
          businessName: this.owner.businessName ?? null,
          city: this.owner.city ?? null,
          reviewNote: this.owner.reviewNote ?? null,
        }
      : null,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model('User', userSchema);
