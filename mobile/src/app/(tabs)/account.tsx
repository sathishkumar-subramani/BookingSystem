import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLogoutMutation } from '@/api/api';
import { loadSession } from '@/api/session';
import { Anim } from '@/components/Anim';
import { Button, Card, T } from '@/components/ui';
import { signOut, useCurrentUser } from '@/store';
import { usePalette } from '@/theme';

export default function Account() {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const user = useCurrentUser();
  const [logout] = useLogoutMutation();

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 24, padding: 20, gap: 14, alignItems: 'stretch' }}>
        <Anim name="kolam" style={{ width: 110, height: 110, alignSelf: 'center' }} />
        <T v="title" style={{ textAlign: 'center' }}>
          Welcome to Arangam
        </T>
        <T v="body" soft style={{ textAlign: 'center' }}>
          Sign in to book halls, or list your own kalyana mandapam.
        </T>
        <Button title="Sign in" big onPress={() => router.push('/login')} />
        <Button title="Create an account" kind="quiet" onPress={() => router.push('/register')} />
      </View>
    );
  }

  const role = user.role === 'owner' ? 'Hall owner' : user.role === 'admin' ? 'Admin' : 'Customer';
  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, padding: 16, gap: 14 }}>
      <T v="title">Account</T>
      <Card style={{ gap: 4 }}>
        <T v="heading">{user.name}</T>
        <T v="small" soft>
          {user.email}
        </T>
        {user.phone && (
          <T v="small" soft>
            {user.phone}
          </T>
        )}
        <T v="small" style={{ marginTop: 6 }}>
          {role}
          {user.owner ? `, ${user.owner.businessName ?? ''} (${user.owner.status})` : ''}
        </T>
      </Card>
      <T v="small" soft>
        The app follows your phone's light or dark setting. Profile changes and hall editing are on the website.
      </T>
      <Button
        title="Sign out"
        kind="danger"
        onPress={async () => {
          const s = await loadSession();
          if (s) logout({ refreshToken: s.refreshToken });
          await signOut();
        }}
      />
    </ScrollView>
  );
}
