import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from './baseQuery';
import type {
  AdminSummary,
  AuthResponse,
  AvailabilityDay,
  Booking,
  CancelQuote,
  Catalog,
  Checkout,
  OwnerCalendar,
  OwnerSummary,
  OwnerVenue,
  Paged,
  SearchParams,
  SearchResult,
  User,
  VenueDetail,
  VenueInput,
  VenueType,
} from './types';

const clean = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== null));

export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Me', 'Venues', 'Venue', 'Availability', 'Bookings', 'OwnerVenues', 'OwnerBookings', 'OwnerSummary', 'Calendar', 'Admin', 'Catalog'],
  endpoints: (b) => ({
    // ── auth ──
    register: b.mutation<AuthResponse, { name: string; email: string; password: string; phone?: string; role: 'user' | 'owner'; businessName?: string; city?: string }>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body: clean(body) }),
    }),
    login: b.mutation<AuthResponse, { email: string; password: string }>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    logout: b.mutation<void, { refreshToken: string }>({
      query: (body) => ({ url: '/auth/logout', method: 'POST', body }),
    }),
    me: b.query<{ user: User }, void>({ query: () => '/auth/me', providesTags: ['Me'] }),
    updateProfile: b.mutation<{ user: User }, { name?: string; phone?: string; businessName?: string; city?: string }>({
      query: (body) => ({ url: '/auth/me', method: 'PATCH', body }),
      invalidatesTags: ['Me'],
    }),
    changePassword: b.mutation<void, { currentPassword: string; newPassword: string }>({
      query: (body) => ({ url: '/auth/me/password', method: 'POST', body }),
    }),

    // ── public ──
    catalog: b.query<Catalog, void>({ query: () => '/catalog', providesTags: ['Catalog'], keepUnusedDataFor: 3600 }),
    searchVenues: b.query<SearchResult, SearchParams>({
      query: (p) => ({ url: '/venues', params: clean(p) }),
      providesTags: ['Venues'],
    }),
    venue: b.query<{ venue: VenueDetail }, string>({ query: (id) => `/venues/${id}`, providesTags: (_r, _e, id) => [{ type: 'Venue', id }] }),
    availability: b.query<{ month: string; days: AvailabilityDay[] }, { id: string; month: string }>({
      query: ({ id, month }) => ({ url: `/venues/${id}/availability`, params: { month } }),
      providesTags: (_r, _e, a) => [{ type: 'Availability', id: `${a.id}:${a.month}` }, 'Availability'],
    }),

    // ── bookings ──
    createBooking: b.mutation<{ booking: Booking; checkout: Checkout }, { venueId: string; date: string; slotKey: string; guests: number; eventKind: string; contactName?: string; contactPhone?: string; notes?: string }>({
      query: (body) => ({ url: '/bookings', method: 'POST', body: clean(body) }),
      invalidatesTags: ['Availability', 'Venues', 'Bookings'],
    }),
    mockCheckout: b.mutation<{ orderId: string; paymentId: string; signature: string }, { orderId: string; outcome: 'success' | 'failure' }>({
      query: (body) => ({ url: '/payments/mock/checkout', method: 'POST', body }),
    }),
    confirmBooking: b.mutation<{ booking: Booking }, { id: string; orderId: string; paymentId: string; signature: string }>({
      query: ({ id, ...body }) => ({ url: `/bookings/${id}/confirm`, method: 'POST', body }),
      invalidatesTags: ['Bookings', 'Availability', 'Venues'],
    }),
    myBookings: b.query<Paged<Booking>, { status: string; page?: number }>({
      query: (params) => ({ url: '/bookings', params }),
      providesTags: ['Bookings'],
    }),
    booking: b.query<{ booking: Booking }, string>({ query: (id) => `/bookings/${id}`, providesTags: ['Bookings'] }),
    cancelQuote: b.query<CancelQuote, string>({ query: (id) => `/bookings/${id}/cancel-quote` }),
    cancelBooking: b.mutation<{ booking: Booking }, { id: string; reason?: string; as?: 'owner' | 'admin' }>({
      query: ({ id, reason, as }) => ({
        url: as === 'owner' ? `/owner/bookings/${id}/cancel` : as === 'admin' ? `/admin/bookings/${id}/cancel` : `/bookings/${id}/cancel`,
        method: 'POST',
        body: clean({ reason }),
      }),
      invalidatesTags: ['Bookings', 'OwnerBookings', 'OwnerSummary', 'Calendar', 'Availability', 'Admin', 'Venues'],
    }),

    // ── owner ──
    ownerSummary: b.query<OwnerSummary, void>({ query: () => '/owner/summary', providesTags: ['OwnerSummary'] }),
    ownerVenues: b.query<{ items: OwnerVenue[] }, void>({ query: () => '/owner/venues', providesTags: ['OwnerVenues'] }),
    ownerVenue: b.query<{ venue: OwnerVenue }, string>({ query: (id) => `/owner/venues/${id}`, providesTags: ['OwnerVenues'] }),
    createVenue: b.mutation<{ venue: OwnerVenue }, VenueInput>({
      query: (body) => ({ url: '/owner/venues', method: 'POST', body }),
      invalidatesTags: ['OwnerVenues', 'OwnerSummary'],
    }),
    updateVenue: b.mutation<{ venue: OwnerVenue }, { id: string } & Partial<VenueInput>>({
      query: ({ id, ...body }) => ({ url: `/owner/venues/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['OwnerVenues', 'Venues', 'Venue', 'Calendar'],
    }),
    submitVenue: b.mutation<{ venue: OwnerVenue }, string>({
      query: (id) => ({ url: `/owner/venues/${id}/submit`, method: 'POST' }),
      invalidatesTags: ['OwnerVenues', 'OwnerSummary'],
    }),
    deleteVenue: b.mutation<void, string>({
      query: (id) => ({ url: `/owner/venues/${id}`, method: 'DELETE' }),
      invalidatesTags: ['OwnerVenues', 'OwnerSummary'],
    }),
    ownerCalendar: b.query<OwnerCalendar, { id: string; month: string }>({
      query: ({ id, month }) => ({ url: `/owner/venues/${id}/calendar`, params: { month } }),
      providesTags: ['Calendar'],
    }),
    addBlock: b.mutation<void, { id: string; date: string; slotKey: string; note?: string }>({
      query: ({ id, ...body }) => ({ url: `/owner/venues/${id}/blocks`, method: 'POST', body: clean(body) }),
      invalidatesTags: ['Calendar', 'Availability', 'Venues'],
    }),
    removeBlock: b.mutation<void, { id: string; date: string; unit: string }>({
      query: ({ id, date, unit }) => ({ url: `/owner/venues/${id}/blocks`, method: 'DELETE', params: { date, unit } }),
      invalidatesTags: ['Calendar', 'Availability', 'Venues'],
    }),
    setSpecialPrice: b.mutation<void, { id: string; date: string; percent: number; note?: string }>({
      query: ({ id, ...body }) => ({ url: `/owner/venues/${id}/special-pricing`, method: 'PUT', body: clean(body) }),
      invalidatesTags: ['Calendar', 'Availability', 'OwnerVenues'],
    }),
    ownerBookings: b.query<Paged<Booking>, { status: string; venueId?: string; q?: string; page?: number }>({
      query: (p) => ({ url: '/owner/bookings', params: clean(p) }),
      providesTags: ['OwnerBookings'],
    }),
    markBalancePaid: b.mutation<{ booking: Booking }, string>({
      query: (id) => ({ url: `/owner/bookings/${id}/balance-paid`, method: 'POST' }),
      invalidatesTags: ['OwnerBookings', 'OwnerSummary', 'Bookings'],
    }),

    // ── admin ──
    adminSummary: b.query<AdminSummary, void>({ query: () => '/admin/summary', providesTags: ['Admin'] }),
    adminOwners: b.query<{ items: (User & { venueCount: number })[] }, { status?: string; q?: string }>({
      query: (p) => ({ url: '/admin/owners', params: clean(p) }),
      providesTags: ['Admin'],
    }),
    reviewOwner: b.mutation<{ owner: User }, { id: string; action: 'approve' | 'reject'; note?: string }>({
      query: ({ id, ...body }) => ({ url: `/admin/owners/${id}/review`, method: 'POST', body: clean(body) }),
      invalidatesTags: ['Admin'],
    }),
    adminVenues: b.query<Paged<OwnerVenue>, { status?: string; q?: string; page?: number }>({
      query: (p) => ({ url: '/admin/venues', params: clean(p) }),
      providesTags: ['Admin'],
    }),
    reviewVenue: b.mutation<{ venue: OwnerVenue }, { id: string; action: 'approve' | 'reject' | 'suspend'; note?: string }>({
      query: ({ id, ...body }) => ({ url: `/admin/venues/${id}/review`, method: 'POST', body: clean(body) }),
      invalidatesTags: ['Admin', 'Venues'],
    }),
    adminBookings: b.query<Paged<Booking>, { status?: string; q?: string; page?: number }>({
      query: (p) => ({ url: '/admin/bookings', params: clean(p) }),
      providesTags: ['Admin'],
    }),
    adminUsers: b.query<Paged<User>, { role?: string; q?: string; page?: number }>({
      query: (p) => ({ url: '/admin/users', params: clean(p) }),
      providesTags: ['Admin'],
    }),
    setUserStatus: b.mutation<{ user: User }, { id: string; status: 'active' | 'suspended' }>({
      query: ({ id, status }) => ({ url: `/admin/users/${id}/status`, method: 'POST', body: { status } }),
      invalidatesTags: ['Admin'],
    }),
    adminVenueTypes: b.query<{ items: VenueType[] }, void>({ query: () => '/admin/venue-types', providesTags: ['Admin'] }),
    setVenueTypeEnabled: b.mutation<{ type: VenueType }, { key: string; enabled: boolean }>({
      query: ({ key, enabled }) => ({ url: `/admin/venue-types/${key}`, method: 'PATCH', body: { enabled } }),
      invalidatesTags: ['Admin', 'Catalog'],
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useLogoutMutation,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useCatalogQuery,
  useSearchVenuesQuery,
  useVenueQuery,
  useAvailabilityQuery,
  useCreateBookingMutation,
  useMockCheckoutMutation,
  useConfirmBookingMutation,
  useMyBookingsQuery,
  useBookingQuery,
  useCancelBookingMutation,
  useOwnerSummaryQuery,
  useOwnerVenuesQuery,
  useOwnerVenueQuery,
  useCreateVenueMutation,
  useUpdateVenueMutation,
  useSubmitVenueMutation,
  useDeleteVenueMutation,
  useOwnerCalendarQuery,
  useAddBlockMutation,
  useRemoveBlockMutation,
  useSetSpecialPriceMutation,
  useOwnerBookingsQuery,
  useMarkBalancePaidMutation,
  useAdminSummaryQuery,
  useAdminOwnersQuery,
  useReviewOwnerMutation,
  useAdminVenuesQuery,
  useReviewVenueMutation,
  useAdminBookingsQuery,
  useAdminUsersQuery,
  useSetUserStatusMutation,
  useAdminVenueTypesQuery,
  useSetVenueTypeEnabledMutation,
} = api;
