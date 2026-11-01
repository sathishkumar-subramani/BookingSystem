import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { errorCode, errorMessage, useBookingQuery, useCancelBookingMutation, useConfirmBookingMutation, useMockCheckoutMutation } from '@/api/api';
import { Anim } from '@/components/Anim';
import { HallArt } from '@/components/HallArt';
import { Button, Card, Chip, ErrorText, Pill, T } from '@/components/ui';
import { radius, usePalette } from '@/theme';
import { clock, EVENT_NAMES, inr, longDate } from '@/utils/format';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function useSecondsLeft(until: string | null | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return until ? Math.max(0, Math.round((Date.parse(until) - now) / 1000)) : 0;
}

function Countdown({ seconds }: { seconds: number }) {
  const c = usePalette();
  const r = 26;
  const circ = 2 * Math.PI * r;
  const progress = useRef(new Animated.Value(seconds / 600)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: seconds / 600, duration: 900, easing: Easing.linear, useNativeDriver: false }).start();
  }, [seconds, progress]);
  const urgent = seconds < 120;
  return (
    <View style={[styles.timer, { backgroundColor: urgent ? c.takenSoft : c.heldSoft }]} accessibilityRole="timer">
      <Svg width={64} height={64} viewBox="0 0 64 64">
        <Circle cx={32} cy={32} r={r} stroke={c.line} strokeWidth={6} fill="none" />
        <AnimatedCircle
          cx={32}
          cy={32}
          r={r}
          stroke={urgent ? c.taken : c.held}
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={progress.interpolate({ inputRange: [0, 1], outputRange: [circ, 0] })}
          transform="rotate(-90 32 32)"
        />
      </Svg>
      <View>
        <T v="title">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </T>
        <T v="small">{seconds > 0 ? 'left to pay, the session is held for you' : 'The hold has run out'}</T>
      </View>
    </View>
  );
}

export default function Checkout() {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, refetch } = useBookingQuery(id);
  const [mockPay, { isLoading: paying }] = useMockCheckoutMutation();
  const [confirm, { isLoading: confirming }] = useConfirmBookingMutation();
  const [cancel] = useCancelBookingMutation();
  const [sheet, setSheet] = useState(false);
  const [method, setMethod] = useState<'upi' | 'card'>('upi');
  const [payError, setPayError] = useState<string | null>(null);
  const b = data?.booking;
  const seconds = useSecondsLeft(b?.holdExpiresAt);

  if (!b) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <Anim name="kolam" style={{ width: 90, height: 90 }} />
      </View>
    );
  }
  const expired = b.status !== 'HELD' || seconds === 0;

  const pay = async (outcome: 'success' | 'failure') => {
    setPayError(null);
    try {
      const paid = await mockPay({ orderId: b.payment!.orderId, outcome }).unwrap();
      await confirm({ id: b.id, ...paid }).unwrap();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSheet(false);
      router.replace({ pathname: '/booking/[id]', params: { id: b.id, fresh: '1' } });
    } catch (e) {
      setPayError(errorMessage(e));
      if (['HOLD_EXPIRED', 'SLOT_TAKEN'].includes(errorCode(e) ?? '')) {
        setSheet(false);
        refetch();
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 140 }}>
        {b.status === 'HELD' ? (
          <Countdown seconds={seconds} />
        ) : (
          <View style={[styles.timer, { backgroundColor: c.takenSoft }]}>
            <T v="body">This hold is {b.status.toLowerCase()}. Pick the date again to start over.</T>
          </View>
        )}
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View style={{ width: 96, height: 60, borderRadius: 10, overflow: 'hidden' }}>
              <HallArt seed={b.venue.coverStyle} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="heading">{b.venue.name}</T>
              <T v="small" soft>
                {[b.venue.area, b.venue.city].filter(Boolean).join(', ')}
              </T>
            </View>
          </View>
          {[
            ['Date', longDate(b.date)],
            ['Session', `${b.slot.label}, ${clock(b.slot.start)} to ${clock(b.slot.end)}`],
            ['Function', `${EVENT_NAMES[b.eventKind] ?? b.eventKind}, ${b.guests} guests`],
          ].map(([k, v]) => (
            <View key={k} style={styles.kv}>
              <T v="small" soft>
                {k}
              </T>
              <T v="label" style={{ flex: 1, textAlign: 'right' }}>
                {v}
              </T>
            </View>
          ))}
        </Card>
        <Card style={{ gap: 8 }}>
          <View style={styles.kv}>
            <T v="small">Hall charge</T>
            <T v="small">{inr(b.pricing.total)}</T>
          </View>
          <View style={styles.kv}>
            <T v="label">Pay now</T>
            <T v="heading" color={c.brand}>
              {inr(b.pricing.advance)}
            </T>
          </View>
          <View style={styles.kv}>
            <T v="small" soft>
              Pay at the hall
            </T>
            <T v="small" soft>
              {inr(b.pricing.balance)}
            </T>
          </View>
        </Card>
        {!expired && (
          <Button
            title="Release this hold"
            kind="ghost"
            onPress={async () => {
              await cancel({ id: b.id, reason: 'Released before payment' });
              router.back();
            }}
          />
        )}
      </ScrollView>
      <View style={[styles.bar, { backgroundColor: c.surface, borderTopColor: c.line, paddingBottom: insets.bottom + 10 }]}>
        <Button title={`Pay ${inr(b.pricing.advance)}`} big disabled={expired} onPress={() => setSheet(true)} />
      </View>

      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(20,10,12,0.5)' }} onPress={() => !paying && !confirming && setSheet(false)} />
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.gateway, { backgroundColor: c.surfaceAlt }]}>
            <View style={styles.kv}>
              <T v="small">Arangam test gateway</T>
              <Pill text="Test mode" tone="held" />
            </View>
            <T v="title">{inr(b.pricing.advance)}</T>
            <T v="tiny" soft>
              Advance for {b.code}
            </T>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label="UPI" on={method === 'upi'} onPress={() => setMethod('upi')} />
            <Chip label="Card" on={method === 'card'} onPress={() => setMethod('card')} />
          </View>
          <T v="small" soft>
            {method === 'upi' ? 'In the real app your UPI app opens here.' : 'In the real app Razorpay takes card details here; this app never sees them.'}
          </T>
          {(paying || confirming) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Anim name="kolam" style={{ width: 40, height: 40 }} />
              <T v="small">{confirming ? 'Confirming with the hall…' : 'Processing payment…'}</T>
            </View>
          )}
          {payError && <ErrorText message={payError} />}
          <Button title={`Pay ${inr(b.pricing.advance)}`} big loading={paying || confirming} onPress={() => pay('success')} />
          <Button title="Simulate a declined payment" kind="quiet" disabled={paying || confirming} onPress={() => pay('failure')} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  timer: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: radius.lg },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, padding: 12 },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 12 },
  gateway: { borderRadius: radius.md, padding: 14, gap: 4 },
});
