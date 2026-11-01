import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage, useMyBookingsQuery, useOwnerBookingsQuery, useOwnerSummaryQuery } from '@/api/api';
import type { Booking } from '@/api/types';
import { Anim } from '@/components/Anim';
import { HallArt } from '@/components/HallArt';
import { Button, Chip, ErrorText, Rise, StatusPill, T } from '@/components/ui';
import { useCurrentUser } from '@/store';
import { radius, usePalette } from '@/theme';
import { inr, longDate, SLOT_NAMES } from '@/utils/format';

function Row({ b, index, owner }: { b: Booking; index: number; owner?: boolean }) {
  const c = usePalette();
  return (
    <Rise index={index}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(b.status === 'HELD' && !owner ? { pathname: '/checkout/[id]', params: { id: b.id } } : { pathname: '/booking/[id]', params: { id: b.id } })}
        style={[styles.row, { backgroundColor: c.surface, borderColor: c.line }]}
      >
        <View style={styles.thumb}>
          <HallArt seed={b.venue.coverStyle} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <T v="label" style={{ flex: 1 }} numberOfLines={1}>
              {owner ? b.contact.name : b.venue.name}
            </T>
            <StatusPill status={b.status} />
          </View>
          <T v="small" soft>
            {longDate(b.date)}, {SLOT_NAMES[b.slot.key].toLowerCase()}
          </T>
          <T v="tiny" soft>
            {owner ? `${b.venue.name}, balance ${b.balanceStatus === 'DUE' ? inr(b.pricing.balance) + ' due' : 'received'}` : `${b.code}, ${inr(b.pricing.total)}`}
          </T>
        </View>
      </Pressable>
    </Rise>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 30, gap: 8 }}>
      <Anim name="lamp" style={{ width: 80, height: 112 }} stillFrame={20} />
      <T v="small" soft style={{ textAlign: 'center' }}>
        {text}
      </T>
    </View>
  );
}

function CustomerBookings() {
  const c = usePalette();
  const [tab, setTab] = useState('upcoming');
  const { data, isLoading, isFetching, error, refetch } = useMyBookingsQuery({ status: tab });
  return (
    <FlatList
      data={data?.items ?? []}
      keyExtractor={(b) => b.id}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => void refetch()} tintColor={c.primary} />}
      ListHeaderComponent={
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {['upcoming', 'past', 'cancelled'].map((k) => (
            <Chip key={k} label={k[0].toUpperCase() + k.slice(1)} on={tab === k} onPress={() => setTab(k)} />
          ))}
        </View>
      }
      ListEmptyComponent={isLoading ? <Anim name="kolam" style={{ width: 80, height: 80, alignSelf: 'center' }} /> : error ? <ErrorText message={errorMessage(error)} /> : <Empty text={tab === 'upcoming' ? 'When you book a hall it shows up here with its booking code.' : 'Nothing here yet.'} />}
      renderItem={({ item, index }) => <Row b={item} index={index} />}
    />
  );
}

function OwnerHome() {
  const c = usePalette();
  const [tab, setTab] = useState('upcoming');
  const { data: summary } = useOwnerSummaryQuery();
  const { data, isLoading, isFetching, error, refetch } = useOwnerBookingsQuery({ status: tab });
  return (
    <FlatList
      data={data?.items ?? []}
      keyExtractor={(b) => b.id}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => void refetch()} tintColor={c.primary} />}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 14 }}>
          {summary && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[
                [String(summary.upcomingCount), 'upcoming'],
                [inr(summary.money.balanceDue), 'to collect'],
              ].map(([v, label]) => (
                <Rise key={label} style={[styles.stat, { backgroundColor: c.surface, borderColor: c.line }]}>
                  <T v="title">{v}</T>
                  <T v="tiny" soft>
                    {label}
                  </T>
                </Rise>
              ))}
            </View>
          )}
          {summary?.ownerStatus !== 'approved' && (
            <View style={{ backgroundColor: c.heldSoft, padding: 12, borderRadius: radius.md }}>
              <T v="small">Your owner account is waiting for admin approval.</T>
            </View>
          )}
          <Button title="Open calendar" kind="quiet" onPress={() => router.push('/owner/calendar')} />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {[
              ['upcoming', 'Upcoming'],
              ['balance', 'Balance due'],
              ['past', 'Past'],
            ].map(([k, label]) => (
              <Chip key={k} label={label} on={tab === k} onPress={() => setTab(k)} />
            ))}
          </View>
          <T v="tiny" soft>
            Add and edit halls from the web console.
          </T>
        </View>
      }
      ListEmptyComponent={isLoading ? <Anim name="kolam" style={{ width: 80, height: 80, alignSelf: 'center' }} /> : error ? <ErrorText message={errorMessage(error)} /> : <Empty text="No bookings here." />}
      renderItem={({ item, index }) => <Row b={item} index={index} owner />}
    />
  );
}

export default function BookingsTab() {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const user = useCurrentUser();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <T v="title" style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        {user?.role === 'owner' ? 'My halls' : 'My bookings'}
      </T>
      {!user ? (
        <View style={{ padding: 16, gap: 12 }}>
          <Empty text="Sign in to see your bookings." />
          <Button title="Sign in" onPress={() => router.push('/login')} />
        </View>
      ) : user.role === 'owner' ? (
        <OwnerHome />
      ) : user.role === 'admin' ? (
        <View style={{ padding: 16 }}>
          <T v="body" soft>
            Admin tools (approvals, users, categories) are in the web console.
          </T>
        </View>
      ) : (
        <CustomerBookings />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, padding: 10, borderRadius: radius.lg, borderWidth: 1, marginBottom: 10, alignItems: 'center' },
  thumb: { width: 72, height: 56, borderRadius: 8, overflow: 'hidden' },
  stat: { flex: 1, padding: 14, borderRadius: radius.lg, borderWidth: 1 },
});
