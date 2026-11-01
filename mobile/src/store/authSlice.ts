import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { User } from '../api/types';

interface AuthState {
  user: User | null;
  ready: boolean; // false until secure storage has been read on launch
}

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, ready: false } as AuthState,
  reducers: {
    restored(state, action: PayloadAction<User | null>) {
      state.user = action.payload;
      state.ready = true;
    },
    sessionChanged(state, action: PayloadAction<User | null>) {
      state.user = action.payload;
    },
  },
});

export const { restored, sessionChanged } = authSlice.actions;
export default authSlice.reducer;
