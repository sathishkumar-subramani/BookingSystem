import { Tabs } from 'expo-router';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useCurrentUser } from '@/store';
import { fonts, usePalette } from '@/theme';

function Icon({ name, color }: { name: 'explore' | 'bookings' | 'account'; color: string }) {
  const p = { stroke: color, strokeWidth: 2, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      {name === 'explore' && (
        <>
          {/* a little mandapam arch */}
          <Path d="M4 21V11a8 8 0 0 1 16 0v10" {...p} />
          <Path d="M9 21v-6a3 3 0 0 1 6 0v6" {...p} />
          <Path d="M2 21h20" {...p} />
        </>
      )}
      {name === 'bookings' && (
        <>
          <Rect x={4} y={5} width={16} height={16} rx={3} {...p} />
          <Path d="M8 3v4M16 3v4M4 10h16M9 15l2 2 4-4" {...p} />
        </>
      )}
      {name === 'account' && (
        <>
          <Circle cx={12} cy={8} r={4} {...p} />
          <Path d="M4 21a8 8 0 0 1 16 0" {...p} />
        </>
      )}
    </Svg>
  );
}

export default function TabsLayout() {
  const c = usePalette();
  const user = useCurrentUser();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.inkSoft,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 12 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Explore', tabBarIcon: ({ color }) => <Icon name="explore" color={String(color)} /> }} />
      <Tabs.Screen
        name="bookings"
        options={{ title: user?.role === 'owner' ? 'My halls' : 'Bookings', tabBarIcon: ({ color }) => <Icon name="bookings" color={String(color)} /> }}
      />
      <Tabs.Screen name="account" options={{ title: user ? 'Account' : 'Sign in', tabBarIcon: ({ color }) => <Icon name="account" color={String(color)} /> }} />
    </Tabs>
  );
}
