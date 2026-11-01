import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { errorMessage, useLoginMutation } from '@/api/api';
import { Anim } from '@/components/Anim';
import { Button, ErrorText, Field, T } from '@/components/ui';
import { signIn } from '@/store';
import { usePalette } from '@/theme';

const DEMO = [
  ['Customer', 'user@arangam.demo', 'User@1234'],
  ['Hall owner', 'owner@arangam.demo', 'Owner@1234'],
] as const;

export default function Login() {
  const c = usePalette();
  const [login, { isLoading, error }] = useLoginMutation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const go = async (creds = { email, password }) => {
    try {
      const res = await login(creds).unwrap();
      await signIn(res);
      router.back();
    } catch {
      /* shown below */
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Anim name="kolam" style={{ width: 90, height: 90, alignSelf: 'center' }} stillFrame={45} />
        <Field label="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <Field label="Password" secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} />
        {error && <ErrorText message={errorMessage(error)} />}
        <Button title="Sign in" big loading={isLoading} disabled={!email || !password} onPress={() => go()} />
        <Button title="Create an account" kind="ghost" onPress={() => router.replace('/register')} />
        <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 14 }}>
          <T v="small" soft>
            Try a demo account
          </T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {DEMO.map(([label, e, p]) => (
              <Button key={e} title={label} kind="quiet" disabled={isLoading} onPress={() => go({ email: e, password: p })} style={{ flex: 1 }} />
            ))}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
