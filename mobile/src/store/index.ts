import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '../api/api';
import { saveSession, type Session } from '../api/session';
import type { AuthResponse } from '../api/types';
import auth, { sessionChanged } from './authSlice';

export const store = configureStore({
  reducer: { auth, [api.reducerPath]: api.reducer },
  middleware: (gdm) => gdm().concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useCurrentUser = () => useAppSelector((s) => s.auth.user);

export async function signIn(res: AuthResponse | Session) {
  await saveSession(res);
  store.dispatch(sessionChanged(res.user));
}
export async function signOut() {
  await saveSession(null);
  store.dispatch(sessionChanged(null));
  store.dispatch(api.util.resetApiState());
}
