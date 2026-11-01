// Mirrors the API responses (see docs/API.md). Money is always integer paise.

export type Role = 'user' | 'owner' | 'admin';
export type SlotKey = 'MORNING' | 'EVENING' | 'FULL_DAY';
export type UnitKey = 'MORNING' | 'EVENING';
export type BookingStatus = 'HELD' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | 'COMPLETED';
export type VenueStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended';
export type Policy = 'flexible' | 'moderate' | 'strict';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: 'active' | 'suspended';
  owner: { status: 'pending' | 'approved' | 'rejected'; businessName: string | null; city: string | null; reviewNote: string | null } | null;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface District {
  name: string;
  lat: number;
  lng: number;
}

export interface VenueType {
  key: string;
  name: string;
  tamilName: string | null;
  description: string | null;
  icon: string | null;
  bookingMode: 'EXCLUSIVE' | 'CAPACITY' | 'TICKETED' | 'SUBSCRIPTION';
  enabled: boolean;
  modeImplemented: boolean;
  units: { key: UnitKey; label: string }[];
  slotTemplates: { key: SlotKey; label: string; start: string; end: string; units: UnitKey[] }[];
  eventKinds: string[];
}

export interface Catalog {
  districts: District[];
  amenities: { key: string; label: string }[];
  cancellationPolicies: { key: Policy; rules: { minDays: number; percent: number }[] }[];
  venueTypes: VenueType[];
  booking: { holdMinutes: number; platformFeePercent: number; maxAdvanceDays: number };
  payments: { provider: string; testMode: boolean };
}

export interface VenueSlot {
  key: SlotKey;
  label: string;
  start: string;
  end: string;
  price: number;
  available?: boolean;
  units?: UnitKey[];
  enabled?: boolean;
}

export interface VenueCard {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  typeKey: string;
  address: { area: string | null; city: string; district: string; line1?: string | null; state?: string; pincode?: string | null };
  location: { lat: number; lng: number };
  capacity: { seating: number; dining: number };
  rooms: number;
  parkingCars: number;
  amenities: string[];
  minPrice: number;
  advancePercent: number;
  coverStyle: number;
  slots: VenueSlot[];
  distanceKm: number | null;
}

export interface VenueDetail extends VenueCard {
  description: string | null;
  cancellationPolicy: Policy;
  cancellationRules: { minDays: number; percent: number }[];
  host: { name: string } | null;
  status: VenueStatus;
  isDemo: boolean;
}

export interface OwnerVenue extends VenueDetail {
  ownerId: string;
  specialPricing: { date: string; percent: number; note?: string }[];
  contactPhone: string | null;
  reviewNote: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  upcomingBookings?: number;
  owner?: { id: string; name: string; email: string; businessName: string | null; status: string | null } | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export interface SearchResult extends Paged<VenueCard> {
  limit: number;
  type: { key: string; name: string };
}

export interface SearchParams {
  type?: string;
  district?: string;
  q?: string;
  date?: string;
  slot?: SlotKey;
  guests?: number;
  maxPrice?: number;
  amenities?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  sort?: string;
  page?: number;
}

export type UnitState = 'free' | 'held' | 'taken' | 'booking' | 'block';

export interface AvailabilityDay {
  date: string;
  bookable: boolean;
  adjustmentPercent: number;
  specialNote: string | null;
  units: Record<UnitKey, UnitState>;
  slots: { key: SlotKey; available: boolean; price: number }[];
  locks?: { unit: UnitKey; kind: 'hold' | 'booking' | 'block'; bookingId: string | null; note: string | null }[];
  bookings?: { id: string; code: string; status: BookingStatus; slot: SlotKey; guests: number; eventKind: string; customer: string }[];
}

export interface Pricing {
  base: number;
  adjustmentPercent: number;
  total: number;
  advance: number;
  balance: number;
  platformFee: number;
  ownerPayoutNow: number;
}

export interface Booking {
  id: string;
  code: string;
  status: BookingStatus;
  typeKey: string;
  date: string;
  slot: { key: SlotKey; label: string; start: string; end: string; units: UnitKey[] };
  guests: number;
  eventKind: string;
  contact: { name: string; phone: string | null };
  notes: string | null;
  venue: { id: string; name: string; slug: string; city: string; district: string; area: string | null; coverStyle: number };
  venueContactPhone?: string | null;
  pricing: Pricing;
  cancellationPolicy: Policy;
  holdExpiresAt: string | null;
  confirmedAt: string | null;
  balanceStatus: 'DUE' | 'PAID_AT_VENUE';
  balancePaidAt: string | null;
  payment: { provider: string; orderId: string; paymentId: string | null; paidAt: string | null } | null;
  cancellation: { by: string; reason: string | null; at: string; refundPercent: number; refundAmount: number; refundId?: string } | null;
  customer?: { name: string; email: string; phone: string | null };
  cancelQuote?: CancelQuote;
  isDemo: boolean;
  createdAt: string;
}

export interface CancelQuote {
  refundPercent: number;
  refundAmount: number;
  daysBefore: number | null;
  cancellable: boolean;
  policy?: Policy;
}

export interface Checkout {
  provider: string;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string | null;
  testMode: boolean;
  bookingCode: string;
}

export interface OwnerSummary {
  ownerStatus: string;
  venues: Partial<Record<VenueStatus, number>>;
  upcomingCount: number;
  heldNow: number;
  nextBookings: Booking[];
  money: { bookings: number; bookedValue: number; advanceCollected: number; payoutFromAdvance: number; platformFees: number; balanceDue: number };
  byMonth: { month: string; bookings: number; value: number }[];
}

export interface AdminSummary {
  users: Partial<Record<Role, number>>;
  pendingOwners: number;
  venues: Partial<Record<VenueStatus, number>>;
  bookings: Partial<Record<BookingStatus, number>>;
  money: { gmv: number; advances: number; platformFees: number; refunds: number; refundCount: number };
  recentBookings: Booking[];
}

export interface OwnerCalendar {
  venue: { id: string; name: string; status: VenueStatus };
  units: { key: UnitKey; label: string }[];
  month: string;
  days: AvailabilityDay[];
}

export interface VenueInput {
  typeKey?: string;
  name: string;
  tagline?: string;
  description?: string;
  address: { line1?: string; area?: string; city: string; district: string; pincode?: string };
  location?: { lat: number; lng: number };
  capacity: { seating: number; dining: number };
  rooms: number;
  parkingCars: number;
  amenities: string[];
  slots: { key: SlotKey; price: number; start?: string; end?: string; enabled: boolean }[];
  advancePercent: number;
  cancellationPolicy: Policy;
  contactPhone?: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
