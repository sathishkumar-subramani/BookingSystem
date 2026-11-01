import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { errorMessage, useRegisterMutation } from '@/api/api';
import { Button, Chip, ErrorText, Field, T } from '@/components/ui';
import { signIn } from '@/store';
import { usePalette } from '@/theme';

export default function Register() {
  const c = usePalette();
  const [register, { isLoading, error }] = useRegisterMutation();
  const [role, setRole] = useState<'user' | 'owner'>('user');
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', businessName: '' });

  const submit = async () => {
    try {
      const res = await register({ ...f, role, phone: f.phone || undefined, businessName: role === 'owner' ? f.businessName : undefined }).unwrap();
      await signIn(res);
      router.back();
    } catch {
      /* shown below */
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label="I want to book" on={role === 'user'} onPress={() => setRole('user')} />
          <Chip label="I own a hall" on={role === 'owner'} onPress={() => setRole('owner')} />
        </View>
        <Field label="Your name" value={f.name} onChangeText={(name) => setF({ ...f, name })} autoComplete="name" />
        <Field label="Email" value={f.email} onChangeText={(email) => setF({ ...f, email })} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Field label="Mobile number" hint="optional" value={f.phone} onChangeText={(phone) => setF({ ...f, phone })} keyboardType="phone-pad" maxLength={10} />
        {role === 'owner' && <Field label="Business name" value={f.businessName} onChangeText={(businessName) => setF({ ...f, businessName })} />}
        <Field label="Password" hint="at least 8 characters" value={f.password} onChangeText={(password) => setF({ ...f, password })} secureTextEntry autoComplete="new-password" />
        {role === 'owner' && (
          <T v="small" soft>
            An admin checks new owners before their halls go live.
          </T>
        )}
        {error && <ErrorText message={errorMessage(error)} />}
        <Button title="Create account" big loading={isLoading} disabled={!f.name || !f.email || f.password.length < 8} onPress={submit} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
