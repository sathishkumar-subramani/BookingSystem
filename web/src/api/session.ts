import type { AuthResponse, User } from './types';

// Tokens live in localStorage so a refresh of the page keeps you signed in.
// Access tokens are short-lived (15 min); the refresh token is rotated on every use by the API.
const KEY = 'arangam.session';

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:5090/api';

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(s: AuthResponse | Session | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify({ accessToken: s.accessToken, refreshToken: s.refreshToken, user: s.user }));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode — the session simply won't survive a reload */
  }
}

let inflight: Promise<Session | null> | null = null;

/**
 * Exchange the refresh token for a new pair. "Single-flight": if five requests hit a 401 at once,
 * only one refresh call goes out and all five wait for it (the API rotates tokens, so a second
 * parallel refresh would be treated as token theft and sign you out).
 */
export function refreshSession(): Promise<Session | null> {
  if (inflight) return inflight;
  const current = loadSession();
  if (!current) return Promise.resolve(null);
  inflight = fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) {
        saveSession(null);
        return null;
      }
      const data = (await res.json()) as AuthResponse;
      saveSession(data);
      return data;
    })
    .catch(() => current) // offline: keep the old session, the request will just fail
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
