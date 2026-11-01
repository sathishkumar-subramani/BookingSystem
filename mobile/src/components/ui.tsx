import { useEffect, useRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { fonts, radius, space, usePalette } from '../theme';
import type { BookingStatus } from '../api/types';
import { STATUS_NAMES } from '../utils/format';

// ───────── text ─────────
type Variant = 'display' | 'title' | 'heading' | 'body' | 'small' | 'tiny' | 'label';
const VARIANTS: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.heavy, fontSize: 34, lineHeight: 38, letterSpacing: -0.5 },
  title: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 30, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  tiny: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18 },
};

export function T({ v = 'body', soft, color, style, ...rest }: TextProps & { v?: Variant; soft?: boolean; color?: string }) {
  const c = usePalette();
  return <Text {...rest} style={[VARIANTS[v], { color: color ?? (soft ? c.inkSoft : c.ink) }, style]} />;
}

// ───────── buttons ─────────
type Kind = 'primary' | 'quiet' | 'danger' | 'ghost';
export function Button({ title, kind = 'primary', loading, big, style, onPress, disabled, ...rest }: PressableProps & { title: string; kind?: Kind; loading?: boolean; big?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = usePalette();
  const scale = useRef(new Animated.Value(1)).current;
  const bg = kind === 'primary' ? c.primary : kind === 'ghost' ? 'transparent' : c.surface;
  const fg = kind === 'primary' ? c.primaryInk : kind === 'danger' ? c.danger : kind === 'ghost' ? c.primary : c.ink;
  const border = kind === 'primary' ? c.primary : kind === 'ghost' ? 'transparent' : kind === 'danger' ? c.danger : c.line;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled || loading, busy: loading }}
        disabled={disabled || loading}
        onPressIn={() => to(0.97)}
        onPressOut={() => to(1)}
        onPress={(e) => {
          Haptics.selectionAsync().catch(() => {});
          onPress?.(e);
        }}
        style={[
          styles.btn,
          { backgroundColor: bg, borderColor: border, minHeight: big ? 54 : 46, opacity: disabled ? 0.5 : 1 },
        ]}
        {...rest}
      >
        {loading ? <ActivityIndicator color={fg} /> : <Text style={{ fontFamily: fonts.semibold, fontSize: big ? 18 : 16, color: fg }}>{title}</Text>}
      </Pressable>
    </Animated.View>
  );
}

export function Chip({ label, on, onPress, disabled }: { label: string; on?: boolean; onPress?: () => void; disabled?: boolean }) {
  const c = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.chip,
        { borderColor: on ? c.primary : c.line, backgroundColor: on ? c.primarySoft : c.surface, opacity: disabled ? 0.45 : 1 },
      ]}
    >
      <Text style={{ fontFamily: on ? fonts.semibold : fonts.regular, fontSize: 14, color: on ? c.primary : c.ink, textDecorationLine: disabled ? 'line-through' : 'none' }}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, hint, ...rest }: TextInputProps & { label: string; hint?: string }) {
  const c = usePalette();
  return (
    <View style={{ gap: 6 }}>
      <T v="label">
        {label} {hint ? <T v="tiny" soft>{hint}</T> : null}
      </T>
      <TextInput
        placeholderTextColor={c.inkSoft}
        style={[styles.input, { borderColor: c.line, backgroundColor: c.surface, color: c.ink }]}
        {...rest}
      />
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = usePalette();
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }, style]}>{children}</View>;
}

export function Pill({ text, tone = 'neutral' }: { text: string; tone?: 'free' | 'held' | 'taken' | 'zari' | 'neutral' }) {
  const c = usePalette();
  const map = {
    free: [c.freeSoft, c.free],
    held: [c.heldSoft, c.held],
    taken: [c.takenSoft, c.taken],
    zari: [c.zariSoft, c.zari],
    neutral: [c.surfaceAlt, c.inkSoft],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: fg }}>{text}</Text>
    </View>
  );
}

const STATUS_TONE: Record<BookingStatus, 'free' | 'held' | 'taken' | 'neutral'> = {
  CONFIRMED: 'free',
  HELD: 'held',
  CANCELLED: 'taken',
  EXPIRED: 'neutral',
  COMPLETED: 'neutral',
};
export const StatusPill = ({ status }: { status: BookingStatus }) => <Pill text={STATUS_NAMES[status]} tone={STATUS_TONE[status]} />;

export function ErrorText({ message }: { message: string }) {
  const c = usePalette();
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    Animated.sequence([-6, 6, -3, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 60, useNativeDriver: true }))).start();
  }, [message, shake]);
  return (
    <Animated.View accessibilityRole="alert" style={[styles.error, { backgroundColor: c.takenSoft, transform: [{ translateX: shake }] }]}>
      <T v="small" color={c.danger}>
        {message}
      </T>
    </Animated.View>
  );
}

// ───────── motion helpers ─────────
let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled().then((v) => (reduceMotion = v)).catch(() => {});
AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => (reduceMotion = v));
export const prefersReducedMotion = () => reduceMotion;

/** Fades and lifts its children in; `index` staggers items in a list. */
export function Rise({ children, index = 0, delay = 0, style }: { children: ReactNode; index?: number; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(v, { toValue: 1, duration: 480, delay: delay + Math.min(index, 8) * 70, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, index, delay]);
  return <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  btn: { borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  chip: { minHeight: 38, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 48, borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 16 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  error: { padding: 12, borderRadius: radius.md },
});
