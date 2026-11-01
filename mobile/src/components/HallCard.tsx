import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { VenueCard } from '../api/types';
import { radius, usePalette } from '../theme';
import { inr, SLOT_NAMES } from '../utils/format';
import { HallArt } from './HallArt';
import { Pill, Rise, T } from './ui';

export function HallCard({ venue, date, index = 0 }: { venue: VenueCard; date?: string; index?: number }) {
  const c = usePalette();
  const scale = useRef(new Animated.Value(1)).current;
  const press = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 5 }).start();
  return (
    <Rise index={index}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${venue.name}, ${venue.address.city}, from ${inr(venue.minPrice)}`}
          onPressIn={() => press(0.98)}
          onPressOut={() => press(1)}
          onPress={() => router.push({ pathname: '/hall/[slug]', params: { slug: venue.slug, ...(date ? { date } : {}) } })}
          style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}
        >
          <View style={styles.art}>
            <HallArt seed={venue.coverStyle} />
            {venue.amenities.includes('ac') && (
              <View style={styles.badge}>
                <Pill text="AC" tone="zari" />
              </View>
            )}
          </View>
          <View style={{ padding: 14, gap: 6 }}>
            <T v="heading">{venue.name}</T>
            <T v="small" soft>
              {[venue.address.area, venue.address.city].filter(Boolean).join(', ')}
              {venue.distanceKm != null ? `, ${venue.distanceKm} km away` : ''}
            </T>
            <T v="small">
              <T v="label">{venue.capacity.seating.toLocaleString('en-IN')}</T> seated   <T v="label">{venue.capacity.dining.toLocaleString('en-IN')}</T> dining
            </T>
            <View style={styles.row}>
              <T v="small" soft>
                from <T v="heading" color={c.brand}>{inr(venue.minPrice)}</T>
              </T>
            </View>
            {date && (
              <View style={[styles.row, { flexWrap: 'wrap', gap: 6 }]}>
                {venue.slots.map((s) => (
                  <Pill key={s.key} text={`${SLOT_NAMES[s.key]} ${s.available ? 'free' : 'booked'}`} tone={s.available ? 'free' : 'taken'} />
                ))}
              </View>
            )}
          </View>
        </Pressable>
      </Animated.View>
    </Rise>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 14 },
  art: { aspectRatio: 16 / 8 },
  badge: { position: 'absolute', top: 10, right: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
