import * as SecureStore from 'expo-secure-store';
import type { AuthResponse, User } from './types';

// Tokens live in the phone's secure storage (Keychain / Keystore), never in plain AsyncStorage.
const KEY = 'arangam.session';

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://arangam-api.onrender.com/api').replace(/\/$/, '');

let cached: Session | null | undefined;

export async function loadSession(): Promise<Session | null> {
  if (cached !== undefined) return cached;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    cached = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    cached = null;
  }
  return cached;
}

export async function saveSession(s: AuthResponse | Session | null) {
  cached = s ? { accessToken: s.accessToken, refreshToken: s.refreshToken, user: s.user } : null;
  try {
    if (cached) await SecureStore.setItemAsync(KEY, JSON.stringify(cached));
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    /* storage unavailable — session lasts until the app closes */
  }
}

let inflight: Promise<Session | null> | null = null;

/** One refresh at a time: the API rotates refresh tokens, so parallel refreshes would sign you out. */
export function refreshSession(): Promise<Session | null> {
  if (inflight) return inflight;
  inflight = (async () => {
    const current = await loadSession();
    if (!current) return null;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (!res.ok) {
        await saveSession(null);
        return null;
      }
      const data = (await res.json()) as AuthResponse;
      await saveSession(data);
      return data;
    } catch {
      return current; // offline — keep the session, the request just fails
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}
