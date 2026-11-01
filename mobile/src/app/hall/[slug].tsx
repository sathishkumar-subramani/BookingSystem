import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorCode, errorMessage, useAvailabilityQuery, useCatalogQuery, useCreateBookingMutation, useVenueQuery } from '@/api/api';
import type { SlotKey } from '@/api/types';
import { Anim } from '@/components/Anim';
import { Calendar } from '@/components/Calendar';
import { HallArt, SilkBorder } from '@/components/HallArt';
import { Button, Card, Chip, ErrorText, Pill, Rise, T } from '@/components/ui';
import { useCurrentUser } from '@/store';
import { radius, usePalette } from '@/theme';
import { clock, describeRules, EVENT_NAMES, inr, longDate, POLICY_NAMES, todayISO } from '@/utils/format';

export default function Hall() {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const { slug, date: initialDate } = useLocalSearchParams<{ slug: string; date?: string }>();
  const user = useCurrentUser();
  const { data: catalog } = useCatalogQuery();
  const { data, isLoading, error } = useVenueQuery(slug);
  const venue = data?.venue;
  const [month, setMonth] = useState((initialDate ?? todayISO()).slice(0, 7));
  const [date, setDate] = useState<string | undefined>(initialDate);
  const [slot, setSlot] = useState<SlotKey | undefined>();
  const [guests, setGuests] = useState(300);
  const [eventKind, setEventKind] = useState('wedding');
  const { data: avail, refetch } = useAvailabilityQuery({ id: slug, month }, { skip: !venue });
  const [hold, { isLoading: holding }] = useCreateBookingMutation();
  const [holdError, setHoldError] = useState<string | null>(null);
  const day = useMemo(() => avail?.days.find((d) => d.date === date), [avail, date]);

  if (isLoading || !venue) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        {error ? <ErrorText message={errorMessage(error)} /> : <Anim name="kolam" style={{ width: 90, height: 90 }} />}
      </View>
    );
  }

  const price = day?.slots.find((s) => s.key === slot)?.price ?? 0;
  const advance = Math.min(price, Math.round((price * venue.advancePercent) / 10000) * 100);
  const type = catalog?.venueTypes.find((t) => t.key === venue.typeKey);

  const book = async () => {
    setHoldError(null);
    if (!user) return router.push('/login');
    if (!date || !slot) return;
    try {
      const res = await hold({ venueId: venue.id, date, slotKey: slot, guests, eventKind }).unwrap();
      router.push({ pathname: '/checkout/[id]', params: { id: res.booking.id } });
    } catch (e) {
      setHoldError(errorMessage(e));
      if (errorCode(e) === 'SLOT_TAKEN') refetch();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={{ height: 260 + insets.top }}>
          <HallArt seed={venue.coverStyle} wide />
        </View>
        <SilkBorder height={12} />
        <View style={{ padding: 18, gap: 14 }}>
          <Rise>
            <T v="small" color={c.primary}>
              {venue.address.district}
            </T>
            <T v="title">{venue.name}</T>
            <T v="small" soft>
              {[venue.address.line1, venue.address.city].filter(Boolean).join(', ')}
              {venue.host ? `, run by ${venue.host.name}` : ''}
            </T>
          </Rise>

          <Rise delay={80}>
            <View style={[styles.facts, { borderColor: c.line }]}>
              {[
                [venue.capacity.seating, 'seated'],
                [venue.capacity.dining, 'dining'],
                [venue.rooms, 'rooms'],
                [venue.parkingCars, 'cars'],
              ].map(([n, label], i) => (
                <View key={label} style={[styles.fact, { backgroundColor: c.surface, borderLeftWidth: i ? 1 : 0, borderColor: c.line }]}>
                  <T v="heading">{Number(n).toLocaleString('en-IN')}</T>
                  <T v="tiny" soft>
                    {label}
                  </T>
                </View>
              ))}
            </View>
          </Rise>

          <Card>
            <T v="heading" style={{ marginBottom: 10 }}>
              Check a date
            </T>
            <Calendar
              month={month}
              days={avail?.days}
              selected={date}
              onMonth={setMonth}
              onSelect={(d) => {
                setDate(d.date);
                const first = d.slots.find((s) => s.available);
                if (!slot || !d.slots.find((s) => s.key === slot)?.available) setSlot(first?.key);
              }}
            />
            {date && day && (
              <Rise style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <T v="label">{longDate(date)}</T>
                  {day.adjustmentPercent > 0 && <Pill text={`Peak day +${day.adjustmentPercent}%`} tone="zari" />}
                </View>
                <View style={styles.wrap}>
                  {venue.slots.map((s) => (
                    <Chip key={s.key} label={s.label} on={slot === s.key} disabled={!day.slots.find((x) => x.key === s.key)?.available} onPress={() => setSlot(s.key)} />
                  ))}
                </View>
                <View style={[styles.wrap, { alignItems: 'center' }]}>
                  <T v="label">Guests</T>
                  <Chip label="−" onPress={() => setGuests((g) => Math.max(50, g - 50))} />
                  <T v="heading">{guests}</T>
                  <Chip label="+" onPress={() => setGuests((g) => Math.min(venue.capacity.seating, g + 50))} />
                </View>
                <View style={styles.wrap}>
                  {(type?.eventKinds ?? ['wedding']).slice(0, 5).map((k) => (
                    <Chip key={k} label={EVENT_NAMES[k] ?? k} on={eventKind === k} onPress={() => setEventKind(k)} />
                  ))}
                </View>
              </Rise>
            )}
          </Card>

          <View style={{ gap: 6 }}>
            <T v="heading">Sessions and prices</T>
            {venue.slots.map((s) => (
              <View key={s.key} style={[styles.sessionRow, { borderColor: c.line }]}>
                <View>
                  <T v="label">{s.label}</T>
                  <T v="tiny" soft>
                    {clock(s.start)} to {clock(s.end)}
                  </T>
                </View>
                <T v="body">{inr(s.price)}</T>
              </View>
            ))}
            <T v="tiny" soft>
              Pay {venue.advancePercent}% online to book, the rest at the hall.
            </T>
          </View>

          {venue.description && <T v="body">{venue.description}</T>}

          <View style={{ gap: 6 }}>
            <T v="heading">What's included</T>
            <View style={styles.wrap}>
              {venue.amenities.map((a) => (
                <Pill key={a} text={catalog?.amenities.find((x) => x.key === a)?.label ?? a} />
              ))}
            </View>
          </View>

          <View style={{ gap: 4 }}>
            <T v="heading">If plans change</T>
            <T v="small">{POLICY_NAMES[venue.cancellationPolicy]} policy, on the advance:</T>
            {describeRules(venue.cancellationRules).map((r) => (
              <T key={r} v="small" soft>
                • {r}
              </T>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bookBar, { backgroundColor: c.surface, borderTopColor: c.line, paddingBottom: insets.bottom + 10 }]}>
        {holdError && <ErrorText message={holdError} />}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            {price ? (
              <>
                <T v="tiny" soft>
                  Pay now
                </T>
                <T v="heading" color={c.brand}>
                  {inr(advance)}
                </T>
                <T v="tiny" soft>
                  of {inr(price)}
                </T>
              </>
            ) : (
              <T v="small" soft>
                Pick a date and session
              </T>
            )}
          </View>
          <Button
            title={!date ? 'Pick a date' : !slot ? 'Pick a session' : user ? 'Hold 10 min' : 'Sign in to book'}
            onPress={book}
            loading={holding}
            disabled={!!user && (!date || !slot)}
            big
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  facts: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  fact: { flex: 1, padding: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sessionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  bookBar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 10, gap: 8 },
});
