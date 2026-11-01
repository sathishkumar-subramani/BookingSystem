import { fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import { API_URL, loadSession, refreshSession } from './session';
import { sessionChanged } from '../store/authSlice';

const raw = fetchBaseQuery({
  baseUrl: API_URL,
  timeout: 60_000, // Render's free tier can take ~50 s to wake up
  prepareHeaders: (headers) => {
    const s = loadSession();
    if (s) headers.set('Authorization', `Bearer ${s.accessToken}`);
    return headers;
  },
});

/** On 401: refresh once, retry once. If refresh fails the user is signed out everywhere in the app. */
export const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extra) => {
  let result = await raw(args, api, extra);
  if (result.error?.status === 401 && loadSession()) {
    const fresh = await refreshSession();
    api.dispatch(sessionChanged(fresh));
    if (fresh) result = await raw(args, api, extra);
  }
  return result;
};

/** Pull the API's human-readable message out of any RTK Query error. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!err || typeof err !== 'object') return fallback;
  const e = err as { status?: unknown; data?: { error?: { message?: string } } };
  if (e.data?.error?.message) return e.data.error.message;
  if (e.status === 'FETCH_ERROR') return 'Cannot reach the server. Check your connection — the server may also be waking up, try again in a minute.';
  if (e.status === 'TIMEOUT_ERROR') return 'The server took too long to answer. It may be waking up — try again.';
  return fallback;
}

export function errorCode(err: unknown): string | undefined {
  return (err as { data?: { error?: { code?: string } } } | undefined)?.data?.error?.code;
}
