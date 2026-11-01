import mongoose from 'mongoose';
import { isModeImplemented } from '../engines/index.js';
import { AppError, badRequest, conflict, notFound } from '../lib/errors.js';
import { Booking } from '../models/Booking.js';
import { Payment } from '../models/Payment.js';
import { User } from '../models/User.js';
import { Venue } from '../models/Venue.js';
import { VenueType } from '../models/VenueType.js';
import { maybeSweep, toBookingDto } from './booking.service.js';
import { toVenueAdmin } from './venue.service.js';

const rx = (q) => new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

export async function adminSummary() {
  await maybeSweep();
  const paid = { status: { $in: ['CONFIRMED', 'COMPLETED'] } };
  const [roles, pendingOwners, venueStatus, bookingStatus, money, refunds, recent] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]),
    User.countDocuments({ role: 'owner', 'owner.status': 'pending' }),
    Venue.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Booking.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Booking.aggregate([
      { $match: paid },
      {
        $group: {
          _id: null,
          gmv: { $sum: '$pricing.total' },
          advances: { $sum: '$pricing.advance' },
          platformFees: { $sum: '$pricing.platformFee' },
        },
      },
    ]),
    Payment.aggregate([{ $match: { purpose: 'REFUND' } }, { $group: { _id: null, total: { $sum: '$amount' }, n: { $sum: 1 } } }]),
    Booking.find({ status: { $ne: 'HELD' } }).sort({ createdAt: -1 }).limit(8).populate('userId', 'name email phone'),
  ]);
  const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));
  return {
    users: toMap(roles),
    pendingOwners,
    venues: toMap(venueStatus),
    bookings: toMap(bookingStatus),
    money: {
      gmv: money[0]?.gmv ?? 0,
      advances: money[0]?.advances ?? 0,
      platformFees: money[0]?.platformFees ?? 0,
      refunds: refunds[0]?.total ?? 0,
      refundCount: refunds[0]?.n ?? 0,
    },
    recentBookings: recent.map((b) => toBookingDto(b, { view: 'staff' })),
  };
}

// ── owners ──

export async function listOwners({ status, q }) {
  const filter = { role: 'owner' };
  if (status) filter['owner.status'] = status;
  if (q) filter.$or = [{ name: rx(q) }, { email: rx(q) }, { 'owner.businessName': rx(q) }];
  const owners = await User.find(filter).sort({ createdAt: -1 }).limit(200);
  const counts = await Venue.aggregate([
    { $match: { ownerId: { $in: owners.map((o) => o._id) } } },
    { $group: { _id: '$ownerId', n: { $sum: 1 } } },
  ]);
  const byOwner = new Map(counts.map((c) => [c._id.toString(), c.n]));
  return owners.map((o) => ({ ...o.toPublic(), venueCount: byOwner.get(o._id.toString()) ?? 0 }));
}

export async function reviewOwner(ownerId, { action, note }) {
  if (!mongoose.isValidObjectId(ownerId)) throw notFound('Owner');
  const owner = await User.findOne({ _id: ownerId, role: 'owner' });
  if (!owner) throw notFound('Owner');
  if (action === 'reject' && !note) throw badRequest('Tell the owner why (note is required to reject)');
  owner.owner.status = action === 'approve' ? 'approved' : 'rejected';
  owner.owner.reviewNote = note || undefined;
  owner.owner.reviewedAt = new Date();
  await owner.save();
  if (action === 'reject') {
    await Venue.updateMany({ ownerId: owner._id, status: 'approved' }, { $set: { status: 'suspended', reviewNote: 'Owner account not approved' } });
  }
  return owner.toPublic();
}

// ── venues ──

export async function listVenues({ status, q, district, page = 1, limit = 30 }) {
  const filter = {};
  if (status) filter.status = status;
  if (district) filter['address.district'] = district;
  if (q) filter.$or = [{ name: rx(q) }, { 'address.city': rx(q) }];
  const sort = status === 'pending' ? { submittedAt: 1 } : { updatedAt: -1 };
  const [items, total] = await Promise.all([
    Venue.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).populate('ownerId', 'name email phone owner'),
    Venue.countDocuments(filter),
  ]);
  return {
    items: items.map((v) => ({
      ...toVenueAdmin(v),
      owner: v.ownerId
        ? { id: v.ownerId._id.toString(), name: v.ownerId.name, email: v.ownerId.email, businessName: v.ownerId.owner?.businessName ?? null, status: v.ownerId.owner?.status ?? null }
        : null,
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

const VENUE_TRANSITIONS = {
  approve: { from: ['pending', 'rejected', 'suspended'], to: 'approved' },
  reject: { from: ['pending'], to: 'rejected' },
  suspend: { from: ['approved'], to: 'suspended' },
};

export async function reviewVenue(venueId, { action, note }) {
  if (!mongoose.isValidObjectId(venueId)) throw notFound('Venue');
  const venue = await Venue.findById(venueId).populate('ownerId', 'owner');
  if (!venue) throw notFound('Venue');
  const t = VENUE_TRANSITIONS[action];
  if (!t.from.includes(venue.status)) throw conflict(`Cannot ${action} a ${venue.status} venue`);
  if (action !== 'approve' && !note) throw badRequest('A note is required');
  if (action === 'approve' && venue.ownerId?.owner?.status !== 'approved') {
    throw conflict('Approve the owner account first', 'OWNER_NOT_APPROVED');
  }
  venue.status = t.to;
  venue.reviewNote = note || undefined;
  if (action === 'approve') venue.approvedAt = new Date();
  await venue.save();
  return toVenueAdmin(venue);
}

// ── bookings / users / types ──

export async function listAllBookings({ status, q, page = 1, limit = 30 }) {
  await maybeSweep();
  const filter = {};
  if (status) filter.status = status;
  if (q) filter.$or = [{ code: rx(q) }, { 'venue.name': rx(q) }, { 'contact.name': rx(q) }];
  const [items, total] = await Promise.all([
    Booking.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('userId', 'name email phone'),
    Booking.countDocuments(filter),
  ]);
  return { items: items.map((b) => toBookingDto(b, { view: 'staff' })), total, page, pages: Math.ceil(total / limit) };
}

export async function listUsers({ role, q, page = 1, limit = 50 }) {
  const filter = {};
  if (role) filter.role = role;
  if (q) filter.$or = [{ name: rx(q) }, { email: rx(q) }, { phone: rx(q) }];
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  return { items: items.map((u) => u.toPublic()), total, page, pages: Math.ceil(total / limit) };
}

export async function setUserStatus(admin, userId, status) {
  if (!mongoose.isValidObjectId(userId)) throw notFound('User');
  if (admin._id.equals(userId)) throw badRequest('You cannot change your own status');
  const user = await User.findById(userId);
  if (!user) throw notFound('User');
  if (user.role === 'admin') throw badRequest('Admins cannot be suspended here');
  user.status = status;
  await user.save();
  return user.toPublic();
}

export async function updateVenueType(key, { enabled }) {
  const type = await VenueType.findOne({ key });
  if (!type) throw notFound('Venue type');
  if (enabled && !isModeImplemented(type.bookingMode)) {
    throw new AppError(409, 'MODE_NOT_IMPLEMENTED', `${type.name} need the ${type.bookingMode} booking engine, which is not built yet`);
  }
  type.enabled = enabled;
  await type.save();
  return { ...type.toPublic(), modeImplemented: isModeImplemented(type.bookingMode) };
}
