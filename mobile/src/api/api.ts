import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import { API_URL, loadSession, refreshSession } from './session';
import { sessionChanged } from '../store/authSlice';
import type { AuthResponse, AvailabilityDay, Booking, CancelQuote, Catalog, Checkout, OwnerCalendar, OwnerSummary, Paged, SearchParams, SearchResult, User, VenueDetail } from './types';

const raw = fetchBaseQuery({
  baseUrl: API_URL,
  timeout: 75_000, // a sleeping Render free instance takes ~50 s to wake
  prepareHeaders: async (headers) => {
    const s = await loadSession();
    if (s) headers.set('Authorization', `Bearer ${s.accessToken}`);
    return headers;
  },
});

const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extra) => {
  let result = await raw(args, api, extra);
  if (result.error?.status === 401 && (await loadSession())) {
    const fresh = await refreshSession();
    api.dispatch(sessionChanged(fresh?.user ?? null));
    if (fresh) result = await raw(args, api, extra);
  }
  return result;
};

export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.') {
  const e = err as { status?: unknown; data?: { error?: { message?: string } } } | undefined;
  if (e?.data?.error?.message) return e.data.error.message;
  if (e?.status === 'FETCH_ERROR') return 'Cannot reach the server. Check your internet — the server may be waking up, try again in a minute.';
  if (e?.status === 'TIMEOUT_ERROR') return 'The server took too long. It may be waking up — try again.';
  return fallback;
}
export const errorCode = (err: unknown) => (err as { data?: { error?: { code?: string } } } | undefined)?.data?.error?.code;

const clean = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== null));

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Bookings', 'Availability', 'Venues', 'Owner', 'Calendar'],
  endpoints: (b) => ({
    login: b.mutation<AuthResponse, { email: string; password: string }>({ query: (body) => ({ url: '/auth/login', method: 'POST', body }) }),
    register: b.mutation<AuthResponse, { name: string; email: string; password: string; phone?: string; role: 'user' | 'owner'; businessName?: string }>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body: clean(body) }),
    }),
    logout: b.mutation<void, { refreshToken: string }>({ query: (body) => ({ url: '/auth/logout', method: 'POST', body }) }),
    me: b.query<{ user: User }, void>({ query: () => '/auth/me' }),

    catalog: b.query<Catalog, void>({ query: () => '/catalog', keepUnusedDataFor: 3600 }),
    searchVenues: b.query<SearchResult, SearchParams>({ query: (p) => ({ url: '/venues', params: clean(p) }), providesTags: ['Venues'] }),
    venue: b.query<{ venue: VenueDetail }, string>({ query: (id) => `/venues/${id}` }),
    availability: b.query<{ month: string; days: AvailabilityDay[] }, { id: string; month: string }>({
      query: ({ id, month }) => ({ url: `/venues/${id}/availability`, params: { month } }),
      providesTags: ['Availability'],
    }),

    createBooking: b.mutation<{ booking: Booking; checkout: Checkout }, { venueId: string; date: string; slotKey: string; guests: number; eventKind: string }>({
      query: (body) => ({ url: '/bookings', method: 'POST', body }),
      invalidatesTags: ['Availability', 'Venues', 'Bookings'],
    }),
    mockCheckout: b.mutation<{ orderId: string; paymentId: string; signature: string }, { orderId: string; outcome: 'success' | 'failure' }>({
      query: (body) => ({ url: '/payments/mock/checkout', method: 'POST', body }),
    }),
    confirmBooking: b.mutation<{ booking: Booking }, { id: string; orderId: string; paymentId: string; signature: string }>({
      query: ({ id, ...body }) => ({ url: `/bookings/${id}/confirm`, method: 'POST', body }),
      invalidatesTags: ['Bookings', 'Availability', 'Venues'],
    }),
    myBookings: b.query<Paged<Booking>, { status: string }>({ query: (params) => ({ url: '/bookings', params }), providesTags: ['Bookings'] }),
    booking: b.query<{ booking: Booking & { cancelQuote?: CancelQuote } }, string>({ query: (id) => `/bookings/${id}`, providesTags: ['Bookings'] }),
    cancelBooking: b.mutation<{ booking: Booking }, { id: string; reason?: string; asOwner?: boolean }>({
      query: ({ id, reason, asOwner }) => ({ url: asOwner ? `/owner/bookings/${id}/cancel` : `/bookings/${id}/cancel`, method: 'POST', body: clean({ reason }) }),
      invalidatesTags: ['Bookings', 'Availability', 'Owner', 'Calendar'],
    }),

    ownerSummary: b.query<OwnerSummary, void>({ query: () => '/owner/summary', providesTags: ['Owner'] }),
    ownerBookings: b.query<Paged<Booking>, { status: string }>({ query: (p) => ({ url: '/owner/bookings', params: p }), providesTags: ['Owner'] }),
    ownerVenues: b.query<{ items: (VenueDetail & { status: string })[] }, void>({ query: () => '/owner/venues', providesTags: ['Owner'] }),
    ownerCalendar: b.query<OwnerCalendar, { id: string; month: string }>({
      query: ({ id, month }) => ({ url: `/owner/venues/${id}/calendar`, params: { month } }),
      providesTags: ['Calendar'],
    }),
    addBlock: b.mutation<void, { id: string; date: string; slotKey: string; note?: string }>({
      query: ({ id, ...body }) => ({ url: `/owner/venues/${id}/blocks`, method: 'POST', body: clean(body) }),
      invalidatesTags: ['Calendar', 'Availability'],
    }),
    removeBlock: b.mutation<void, { id: string; date: string; unit: string }>({
      query: ({ id, date, unit }) => ({ url: `/owner/venues/${id}/blocks`, method: 'DELETE', params: { date, unit } }),
      invalidatesTags: ['Calendar', 'Availability'],
    }),
    markBalancePaid: b.mutation<{ booking: Booking }, string>({
      query: (id) => ({ url: `/owner/bookings/${id}/balance-paid`, method: 'POST' }),
      invalidatesTags: ['Owner', 'Bookings'],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
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
  useOwnerBookingsQuery,
  useOwnerVenuesQuery,
  useOwnerCalendarQuery,
  useAddBlockMutation,
  useRemoveBlockMutation,
  useMarkBalancePaidMutation,
} = api;
