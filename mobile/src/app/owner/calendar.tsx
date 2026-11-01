import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { errorMessage, useAddBlockMutation, useOwnerCalendarQuery, useOwnerVenuesQuery, useRemoveBlockMutation } from '@/api/api';
import type { AvailabilityDay, SlotKey, UnitKey } from '@/api/types';
import { Anim } from '@/components/Anim';
import { Calendar } from '@/components/Calendar';
import { Button, Card, Chip, ErrorText, T } from '@/components/ui';
import { usePalette } from '@/theme';
import { longDate, SLOT_NAMES, todayISO } from '@/utils/format';

export default function OwnerCalendarScreen() {
  const c = usePalette();
  const { data: venues } = useOwnerVenuesQuery();
  const [venueId, setVenueId] = useState<string | undefined>();
  const id = venueId ?? venues?.items[0]?.id;
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const { data, isFetching } = useOwnerCalendarQuery({ id: id!, month }, { skip: !id });
  const [day, setDay] = useState<AvailabilityDay | null>(null);
  const [addBlock, add] = useAddBlockMutation();
  const [removeBlock, remove] = useRemoveBlockMutation();
  const live = day ? data?.days.find((d) => d.date === day.date) ?? day : null;
  const err = add.error || remove.error;

  if (!venues) return <Anim name="kolam" style={{ width: 80, height: 80, alignSelf: 'center', marginTop: 40 }} />;
  if (!venues.items.length) {
    return (
      <View style={{ padding: 16 }}>
        <T v="body" soft>
          Add a hall on the website first.
        </T>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {venues.items.map((v) => (
          <Chip key={v.id} label={v.name} on={v.id === id} onPress={() => setVenueId(v.id)} />
        ))}
      </ScrollView>
      <Card style={{ opacity: isFetching ? 0.6 : 1 }}>
        <Calendar month={month} days={data?.days} selected={day?.date} onMonth={setMonth} onSelect={setDay} ownerMode />
      </Card>
      {live && (
        <Card style={{ gap: 10 }}>
          <T v="heading">{longDate(live.date)}</T>
          {(['MORNING', 'EVENING'] as UnitKey[]).map((u) => {
            const state = live.units[u];
            const booking = live.bookings?.find((b) => b.slot === u || b.slot === 'FULL_DAY');
            return (
              <View key={u} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <T v="label">{u === 'MORNING' ? 'Morning' : 'Evening'}</T>
                  <T v="small" soft>
                    {state === 'free' ? 'Free' : state === 'held' ? 'A customer is paying now' : state === 'block' ? 'Blocked by you' : booking ? `${booking.code}: ${booking.customer}, ${booking.guests} guests` : 'Booked'}
                  </T>
                </View>
                {state === 'block' && <Button title="Unblock" kind="quiet" loading={remove.isLoading} onPress={() => removeBlock({ id: id!, date: live.date, unit: u })} />}
              </View>
            );
          })}
          {live.date >= todayISO() && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(['MORNING', 'EVENING', 'FULL_DAY'] as SlotKey[]).map((s) => (
                <Chip
                  key={s}
                  label={`Block ${SLOT_NAMES[s].toLowerCase()}`}
                  onPress={() =>
                    Alert.alert(`Block ${SLOT_NAMES[s].toLowerCase()}?`, 'Customers will see it as booked.', [
                      { text: 'Back', style: 'cancel' },
                      { text: 'Block', onPress: () => addBlock({ id: id!, date: live.date, slotKey: s, note: 'Blocked from the app' }) },
                    ])
                  }
                />
              ))}
            </View>
          )}
          {err && <ErrorText message={errorMessage(err)} />}
        </Card>
      )}
    </ScrollView>
  );
}
