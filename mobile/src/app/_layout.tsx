import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Provider } from 'react-redux';
import { useFonts, AnekTamil_400Regular, AnekTamil_500Medium, AnekTamil_600SemiBold, AnekTamil_700Bold, AnekTamil_800ExtraBold } from '@expo-google-fonts/anek-tamil';
import { loadSession } from '@/api/session';
import { restored } from '@/store/authSlice';
import { store, useAppSelector } from '@/store';
import { fonts, usePalette } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const c = usePalette();
  const ready = useAppSelector((s) => s.auth.ready);
  const [fontsLoaded] = useFonts({ AnekTamil_400Regular, AnekTamil_500Medium, AnekTamil_600SemiBold, AnekTamil_700Bold, AnekTamil_800ExtraBold });

  useEffect(() => {
    loadSession().then((s) => store.dispatch(restored(s?.user ?? null)));
  }, []);
  useEffect(() => {
    if (fontsLoaded && ready) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, ready]);
  if (!fontsLoaded || !ready) return null;

  return (
    <>
      <StatusBar style={c.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.brand,
          headerTitleStyle: { fontFamily: fonts.bold, color: c.ink },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="hall/[slug]" options={{ title: '', headerTransparent: true }} />
        <Stack.Screen name="checkout/[id]" options={{ title: 'Confirm booking' }} />
        <Stack.Screen name="booking/[id]" options={{ title: 'Booking' }} />
        <Stack.Screen name="results" options={{ title: 'Halls' }} />
        <Stack.Screen name="login" options={{ title: 'Sign in', presentation: 'modal' }} />
        <Stack.Screen name="register" options={{ title: 'Create account', presentation: 'modal' }} />
        <Stack.Screen name="owner/calendar" options={{ title: 'Calendar' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <Root />
    </Provider>
  );
}
