import { useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { AvailabilityDay, UnitKey } from '../api/types';
import { fonts, usePalette } from '../theme';
import { monthTitle, shiftMonth, todayISO } from '../utils/format';
import { T, prefersReducedMotion } from './ui';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const UNITS: UnitKey[] = ['MORNING', 'EVENING'];

/** Month grid; each day shows two bars — morning on top, evening below. */
export function Calendar({
  month,
  days,
  selected,
  onSelect,
  onMonth,
  ownerMode,
}: {
  month: string;
  days?: AvailabilityDay[];
  selected?: string;
  onSelect: (d: AvailabilityDay) => void;
  onMonth: (m: string) => void;
  ownerMode?: boolean;
}) {
  const c = usePalette();
  const slide = useRef(new Animated.Value(0)).current;
  const first = new Date(`${month}-01T00:00:00`).getDay();
  const today = todayISO();

  const go = (n: number) => {
    Haptics.selectionAsync().catch(() => {});
    onMonth(shiftMonth(month, n));
    if (prefersReducedMotion()) return;
    slide.setValue(n * 30);
    Animated.timing(slide, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };

  const color = (state: string) =>
    state === 'free' ? c.freeSoft : state === 'held' ? c.held : state === 'block' ? c.inkSoft : c.taken;

  const cells: (AvailabilityDay | null)[] = [...Array(first).fill(null), ...(days ?? [])];
  return (
    <View>
      <View style={styles.head}>
        <Pressable accessibilityLabel="Previous month" onPress={() => go(-1)} disabled={month <= today.slice(0, 7)} style={[styles.nav, { borderColor: c.line, opacity: month <= today.slice(0, 7) ? 0.4 : 1 }]}>
          <T v="heading">‹</T>
        </Pressable>
        <T v="heading">{monthTitle(month)}</T>
        <Pressable accessibilityLabel="Next month" onPress={() => go(1)} style={[styles.nav, { borderColor: c.line }]}>
          <T v="heading">›</T>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {DOW.map((d, i) => (
          <View key={i} style={styles.cell}>
            <T v="tiny" soft style={{ textAlign: 'center' }}>
              {d}
            </T>
          </View>
        ))}
      </View>
      <Animated.View style={[styles.grid, { transform: [{ translateX: slide }] }]}>
        {cells.map((d, i) => {
          if (!d) return <View key={`p${i}`} style={styles.cell} />;
          const clickable = ownerMode ? d.date >= today : d.bookable && d.slots.some((s) => s.available);
          const on = selected === d.date;
          return (
            <View key={d.date} style={styles.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${d.date}: morning ${d.units.MORNING}, evening ${d.units.EVENING}`}
                accessibilityState={{ selected: on, disabled: !clickable }}
                disabled={!clickable}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  onSelect(d);
                }}
                style={[styles.day, { borderColor: on ? c.primary : 'transparent', backgroundColor: on ? c.primarySoft : c.surface, opacity: clickable ? 1 : 0.35 }]}
              >
                <T v="tiny" style={{ fontFamily: fonts.semibold, color: d.date === today ? c.primary : c.ink }}>
                  {Number(d.date.slice(8))}
                </T>
                {UNITS.map((u) => (
                  <View key={u} style={[styles.bar, { backgroundColor: color(d.units[u]) }]} />
                ))}
                {d.adjustmentPercent > 0 && <View style={[styles.peak, { backgroundColor: c.zari }]} />}
              </Pressable>
            </View>
          );
        })}
      </Animated.View>
      <View style={styles.legend}>
        {[
          [c.freeSoft, 'Free'],
          [c.held, 'Paying now'],
          [c.taken, 'Booked'],
          ...(ownerMode ? [[c.inkSoft, 'Blocked']] : []),
        ].map(([col, label]) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: col }]} />
            <T v="tiny" soft>
              {label}
            </T>
          </View>
        ))}
        <View style={styles.legendItem}>
          <View style={[styles.peakKey, { backgroundColor: c.zari }]} />
          <T v="tiny" soft>
            Peak price
          </T>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  nav: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, padding: 2 },
  day: { borderRadius: 6, borderWidth: 1.5, padding: 4, gap: 3, minHeight: 50 },
  bar: { height: 7, borderRadius: 3 },
  peak: { position: 'absolute', top: 5, right: 5, width: 6, height: 6, transform: [{ rotate: '45deg' }] },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 16, height: 8, borderRadius: 3 },
  peakKey: { width: 7, height: 7, transform: [{ rotate: '45deg' }] },
});
