import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { errorMessage, useBookingQuery, useCancelBookingMutation, useMarkBalancePaidMutation } from '@/api/api';
import { Anim } from '@/components/Anim';
import { SilkBorder } from '@/components/HallArt';
import { Button, ErrorText, Rise, StatusPill, T } from '@/components/ui';
import { useCurrentUser } from '@/store';
import { fonts, radius, usePalette } from '@/theme';
import { clock, EVENT_NAMES, inr, longDate, POLICY_NAMES } from '@/utils/format';

export default function BookingTicket() {
  const c = usePalette();
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const user = useCurrentUser();
  const { data } = useBookingQuery(id);
  const [cancel, { isLoading: cancelling, error: cancelError }] = useCancelBookingMutation();
  const [markPaid, { isLoading: marking }] = useMarkBalancePaidMutation();
  const [celebrating, setCelebrating] = useState(fresh === '1');
  const b = data?.booking;
  if (!b) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <Anim name="kolam" style={{ width: 90, height: 90 }} />
      </View>
    );
  }
  const owner = user?.role === 'owner' && !!b.customer;
  const quote = b.cancelQuote;

  const askCancel = () => {
    const msg = owner
      ? `The customer gets the full advance of ${inr(b.pricing.advance)} back.`
      : quote && quote.refundAmount > 0
        ? `You'll get ${inr(quote.refundAmount)} back (${quote.refundPercent}% of the advance).`
        : 'Under this hall’s policy the advance is not refunded this close to the date.';
    Alert.alert('Cancel this booking?', msg, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel booking', style: 'destructive', onPress: () => cancel({ id: b.id, asOwner: owner }) },
    ]);
  };

  const rows: [string, string][] = [
    ['Date', longDate(b.date)],
    ['Session', `${b.slot.label}, ${clock(b.slot.start)} to ${clock(b.slot.end)}`],
    ['Function', `${EVENT_NAMES[b.eventKind] ?? b.eventKind}, ${b.guests} guests`],
    ['Contact', [b.contact.name, b.contact.phone].filter(Boolean).join(', ')],
    ['Total', inr(b.pricing.total)],
    ['Advance paid', b.status === 'HELD' ? 'Not yet' : inr(b.pricing.advance)],
    ['Balance', `${inr(b.pricing.balance)} ${b.balanceStatus === 'DUE' ? '(due at the hall)' : '(paid)'}`],
    ['Cancellation', `${POLICY_NAMES[b.cancellationPolicy]} policy`],
  ];
  if (b.cancellation) rows.push(['Cancelled', `by ${b.cancellation.by}, refund ${inr(b.cancellation.refundAmount)}`]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        {fresh === '1' && b.status === 'CONFIRMED' && (
          <Rise delay={500} style={{ alignItems: 'center' }}>
            <T v="title">The hall is yours</T>
            <T v="small" soft style={{ textAlign: 'center' }}>
              Show this code to the hall manager. The balance is paid at the hall.
            </T>
          </Rise>
        )}
        <Rise delay={fresh === '1' ? 600 : 0}>
          <View style={[styles.ticket, { backgroundColor: c.surface, borderColor: c.line }]}>
            <SilkBorder />
            <View style={{ padding: 18, gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                  <T v="tiny" soft>
                    Booking code
                  </T>
                  <T v="display" color={c.brand} style={{ fontFamily: fonts.heavy, letterSpacing: 1 }} selectable>
                    {b.code}
                  </T>
                </View>
                <StatusPill status={b.status} />
              </View>
              <T v="heading">{b.venue.name}</T>
              <T v="small" soft>
                {[b.venue.area, b.venue.city].filter(Boolean).join(', ')}
              </T>
              {rows.map(([k, v]) => (
                <View key={k} style={styles.kv}>
                  <T v="small" soft>
                    {k}
                  </T>
                  <T v="label" style={{ flex: 1, textAlign: 'right' }}>
                    {v}
                  </T>
                </View>
              ))}
              {b.venueContactPhone && <Button title={`Call the hall (${b.venueContactPhone})`} kind="quiet" onPress={() => Linking.openURL(`tel:${b.venueContactPhone}`)} />}
            </View>
          </View>
        </Rise>
        {cancelError && <ErrorText message={errorMessage(cancelError)} />}
        {b.status === 'HELD' && !owner && <Button title="Finish payment" onPress={() => router.push({ pathname: '/checkout/[id]', params: { id: b.id } })} />}
        {owner && ['CONFIRMED', 'COMPLETED'].includes(b.status) && b.balanceStatus === 'DUE' && (
          <Button title={`Mark ${inr(b.pricing.balance)} received`} loading={marking} onPress={() => markPaid(b.id)} />
        )}
        {quote?.cancellable && b.status === 'CONFIRMED' && <Button title="Cancel booking" kind="danger" loading={cancelling} onPress={askCancel} />}
      </ScrollView>
      {celebrating && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: c.dark ? 'rgba(27,18,20,0.6)' : 'rgba(251,250,246,0.6)' }]}>
          <Anim name="celebrate" loop={false} stillFrame={60} style={{ width: 320, height: 320 }} onFinish={() => setCelebrating(false)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
});
