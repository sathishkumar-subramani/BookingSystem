import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '../api/api';
import auth from './authSlice';

export function makeStore() {
  return configureStore({
    reducer: { auth, [api.reducerPath]: api.reducer },
    middleware: (gdm) => gdm().concat(api.middleware),
  });
}

export const store = makeStore();
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useCurrentUser = () => useAppSelector((s) => s.auth.user);
