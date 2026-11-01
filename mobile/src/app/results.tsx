import { FlatList, RefreshControl, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { errorMessage, useSearchVenuesQuery } from '@/api/api';
import type { SlotKey } from '@/api/types';
import { Anim } from '@/components/Anim';
import { HallCard } from '@/components/HallCard';
import { ErrorText, T } from '@/components/ui';
import { usePalette } from '@/theme';
import { longDate } from '@/utils/format';

export default function Results() {
  const c = usePalette();
  const p = useLocalSearchParams<{ district?: string; date?: string; slot?: SlotKey; guests?: string; lat?: string; lng?: string; radiusKm?: string }>();
  const near = p.lat && p.lng;
  const { data, isLoading, isFetching, error, refetch } = useSearchVenuesQuery({
    district: near ? undefined : p.district,
    date: p.date,
    slot: p.slot,
    guests: p.guests ? Number(p.guests) : undefined,
    lat: near ? Number(p.lat) : undefined,
    lng: near ? Number(p.lng) : undefined,
    radiusKm: p.radiusKm ? Number(p.radiusKm) : undefined,
  });
  const title = near ? 'Near you' : p.district ?? 'All halls';

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ title }} />
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => void refetch()} tintColor={c.primary} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 12 }}>
            {data && (
              <T v="small" soft>
                {data.total} found{p.date ? ` that are free on ${longDate(p.date)}` : ''}
                {p.guests ? ` for ${p.guests} guests` : ''}
              </T>
            )}
            {error && <ErrorText message={errorMessage(error)} />}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ alignItems: 'center', paddingTop: 40, gap: 8 }}>
              <Anim name="kolam" style={{ width: 90, height: 90 }} />
              <T v="small" soft style={{ textAlign: 'center' }}>
                Finding halls… the server may take a moment to wake up.
              </T>
            </View>
          ) : !error ? (
            <View style={{ alignItems: 'center', paddingTop: 30, gap: 8 }}>
              <Anim name="lamp" style={{ width: 80, height: 112 }} stillFrame={20} />
              <T v="heading">No hall matches</T>
              <T v="small" soft style={{ textAlign: 'center' }}>
                Try another date or session, or a nearby district.
              </T>
            </View>
          ) : undefined
        }
        renderItem={({ item, index }) => <HallCard venue={item} date={p.date} index={index} />}
      />
    </View>
  );
}
