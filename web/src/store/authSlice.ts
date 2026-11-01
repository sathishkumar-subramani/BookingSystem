import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { loadSession, saveSession, type Session } from '../api/session';
import type { AuthResponse, User } from '../api/types';

interface AuthState {
  user: User | null;
}

const initialState: AuthState = { user: loadSession()?.user ?? null };

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    signedIn(state, action: PayloadAction<AuthResponse>) {
      saveSession(action.payload);
      state.user = action.payload.user;
    },
    /** Mirror of whatever is in storage after a token refresh (null = signed out). */
    sessionChanged(state, action: PayloadAction<Session | null>) {
      state.user = action.payload?.user ?? null;
    },
    userUpdated(state, action: PayloadAction<User>) {
      const s = loadSession();
      if (s) saveSession({ ...s, user: action.payload });
      state.user = action.payload;
    },
    signedOut(state) {
      saveSession(null);
      state.user = null;
    },
  },
});

export const { signedIn, sessionChanged, userUpdated, signedOut } = authSlice.actions;
export default authSlice.reducer;
