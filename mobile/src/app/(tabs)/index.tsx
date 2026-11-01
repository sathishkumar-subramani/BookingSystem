import { useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useCatalogQuery, useSearchVenuesQuery } from '@/api/api';
import type { SlotKey } from '@/api/types';
import { Anim } from '@/components/Anim';
import { HallCard } from '@/components/HallCard';
import { SilkBorder } from '@/components/HallArt';
import { Button, Chip, ErrorText, Rise, T } from '@/components/ui';
import { fonts, radius, usePalette } from '@/theme';
import { addDaysISO, todayISO } from '@/utils/format';

const POPULAR = ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Vellore', 'Thanjavur'];
const CREAM = '#FFF8EF';

export default function Explore() {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const { data: catalog } = useCatalogQuery();
  const { data: big } = useSearchVenuesQuery({ sort: 'capacity_desc' });
  const [district, setDistrict] = useState('Chennai');
  const [picking, setPicking] = useState(false);
  const [date, setDate] = useState(addDaysISO(todayISO(), 30));
  const [slot, setSlot] = useState<SlotKey>('MORNING');
  const [guests, setGuests] = useState(500);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  // 120 days of dates as tappable chips — quicker than a date picker for "which muhurtham day?"
  const dates = useMemo(() => Array.from({ length: 120 }, (_, i) => addDaysISO(todayISO(), i + 1)), []);

  const search = () => router.push({ pathname: '/results', params: { district, date, slot, guests: String(guests) } });
  const nearMe = async () => {
    setError(null);
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') throw new Error('Location permission was not given. Pick a district instead.');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      router.push({ pathname: '/results', params: { lat: pos.coords.latitude.toFixed(4), lng: pos.coords.longitude.toFixed(4), date, slot, guests: String(guests), radiusKm: '30' } });
    } catch (e) {
      setError((e as Error).message || 'Could not get your location.');
    } finally {
      setLocating(false);
    }
  };

  const lampShift = scrollY.interpolate({ inputRange: [0, 300], outputRange: [0, 50], extrapolate: 'clamp' });

  return (
    <Animated.ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      scrollEventThrottle={16}
    >
      <View style={[styles.hero, { paddingTop: insets.top }]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Anim name="petals-drift" resizeMode="cover" style={{ flex: 1, opacity: 0.5 }} />
        </View>
        <Anim name="thoranam" resizeMode="cover" style={{ width: '100%', height: 92 }} />
        <Animated.View style={[styles.lamp, { transform: [{ translateY: lampShift }] }]} pointerEvents="none">
          <Anim name="lamp" style={{ width: 110, height: 154 }} stillFrame={20} />
        </Animated.View>
        <View style={{ paddingHorizontal: 18, paddingBottom: 22 }}>
          <Rise delay={100}>
            <T v="body" color="#E7B652">
              உங்கள் முகூர்த்த நாளுக்கு ஒரு மண்டபம்
            </T>
          </Rise>
          <Rise delay={200}>
            <T v="display" color={CREAM} style={{ marginTop: 6, maxWidth: 260 }}>
              Book the mandapam for your muhurtham
            </T>
          </Rise>
          <Rise delay={320}>
            <View style={styles.searchCard}>
              <T v="label" color="#5E5254">
                District
              </T>
              <Pressable accessibilityRole="button" onPress={() => setPicking(true)} style={styles.select}>
                <T v="heading" color="#6E1423">
                  {district}
                </T>
                <T v="heading" color="#6E1423">
                  ▾
                </T>
              </Pressable>

              <T v="label" color="#5E5254" style={{ marginTop: 12 }}>
                Date
              </T>
              <FlatList
                horizontal
                data={dates}
                keyExtractor={(d) => d}
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={29}
                getItemLayout={(_, i) => ({ length: 58, offset: 58 * i, index: i })}
                style={{ marginTop: 6, marginHorizontal: -4 }}
                renderItem={({ item }) => {
                  const d = new Date(`${item}T00:00:00`);
                  const on = item === date;
                  return (
                    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={d.toDateString()} onPress={() => setDate(item)} style={[styles.dateChip, on && { backgroundColor: '#0B5D5E', borderColor: '#0B5D5E' }]}>
                      <T v="tiny" color={on ? '#DCEDEA' : '#5E5254'}>
                        {d.toLocaleDateString('en-IN', { weekday: 'short' })}
                      </T>
                      <T v="heading" color={on ? '#FFFFFF' : '#221A1C'}>
                        {d.getDate()}
                      </T>
                      <T v="tiny" color={on ? '#DCEDEA' : '#5E5254'}>
                        {d.toLocaleDateString('en-IN', { month: 'short' })}
                      </T>
                    </Pressable>
                  );
                }}
              />

              <T v="label" color="#5E5254" style={{ marginTop: 12 }}>
                Session
              </T>
              <View style={styles.rowWrap}>
                {(
                  [
                    ['MORNING', 'Morning'],
                    ['EVENING', 'Evening'],
                    ['FULL_DAY', 'Full day'],
                  ] as const
                ).map(([k, label]) => (
                  <Chip key={k} label={label} on={slot === k} onPress={() => setSlot(k)} />
                ))}
              </View>

              <View style={[styles.rowBetween, { marginTop: 12 }]}>
                <T v="label" color="#5E5254">
                  Guests
                </T>
                <View style={styles.stepper}>
                  <Pressable accessibilityLabel="Fewer guests" onPress={() => setGuests((g) => Math.max(50, g - 50))} style={styles.stepBtn}>
                    <T v="heading" color="#0B5D5E">
                      −
                    </T>
                  </Pressable>
                  <T v="heading" color="#221A1C" style={{ minWidth: 56, textAlign: 'center' }}>
                    {guests}
                  </T>
                  <Pressable accessibilityLabel="More guests" onPress={() => setGuests((g) => Math.min(5000, g + 50))} style={styles.stepBtn}>
                    <T v="heading" color="#0B5D5E">
                      +
                    </T>
                  </Pressable>
                </View>
              </View>

              {error && <ErrorText message={error} />}
              <Button title="Show free halls" big onPress={search} style={{ marginTop: 14 }} />
              <Button title={locating ? 'Finding you…' : 'Halls near me'} kind="quiet" onPress={nearMe} loading={locating} style={{ marginTop: 8 }} />
            </View>
          </Rise>
        </View>
        <SilkBorder />
      </View>

      <View style={{ padding: 18, gap: 10 }}>
        <T v="title">Popular districts</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {POPULAR.map((d) => (
            <Chip key={d} label={d} onPress={() => router.push({ pathname: '/results', params: { district: d } })} />
          ))}
        </ScrollView>

        {big && big.items.length > 0 && (
          <>
            <T v="title" style={{ marginTop: 18 }}>
              Large halls for big weddings
            </T>
            <T v="small" soft style={{ marginBottom: 8 }}>
              Seating for a thousand or more, with parking and dining on site.
            </T>
            {big.items.slice(0, 4).map((v, i) => (
              <HallCard key={v.id} venue={v} index={i} />
            ))}
          </>
        )}
      </View>

      <Modal visible={picking} animationType="slide" transparent onRequestClose={() => setPicking(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPicking(false)} />
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 12 }]}>
          <T v="heading" style={{ padding: 16 }}>
            Choose a district
          </T>
          <FlatList
            data={catalog?.districts.map((d) => d.name) ?? POPULAR}
            keyExtractor={(d) => d}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setDistrict(item);
                  setPicking(false);
                }}
                style={[styles.option, { borderBottomColor: c.line }]}
              >
                <T v="body" style={{ fontFamily: item === district ? fonts.bold : fonts.regular, color: item === district ? c.primary : c.ink }}>
                  {item}
                </T>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: '#6E1423', overflow: 'hidden' },
  lamp: { position: 'absolute', right: 6, top: 120, opacity: 0.95 },
  searchCard: { backgroundColor: CREAM, borderRadius: radius.lg, padding: 16, marginTop: 18 },
  select: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F6ECD3', borderBottomWidth: 2, borderBottomColor: '#C8962E', borderTopLeftRadius: 6, borderTopRightRadius: 6, paddingHorizontal: 12, paddingVertical: 10, marginTop: 6 },
  dateChip: { width: 52, marginHorizontal: 3, alignItems: 'center', paddingVertical: 6, borderRadius: 12, borderWidth: 1.5, borderColor: '#E4DED3', backgroundColor: '#FFFFFF' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1.5, borderColor: '#E4DED3' },
  stepBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(20,10,12,0.5)' },
  sheet: { maxHeight: '70%', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  option: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
});
