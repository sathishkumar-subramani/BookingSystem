import { useColorScheme } from 'react-native';
// Copy of shared/theme.json (Metro only bundles files inside the app folder).
import theme from './theme.json';

// Same Kanjivaram palette as the web app (shared/theme.json).
export type Palette = typeof theme.light;

export const fonts = {
  regular: 'AnekTamil_400Regular',
  medium: 'AnekTamil_500Medium',
  semibold: 'AnekTamil_600SemiBold',
  bold: 'AnekTamil_700Bold',
  heavy: 'AnekTamil_800ExtraBold',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 };

export function usePalette(): Palette & { dark: boolean } {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  return { ...(dark ? theme.dark : theme.light), dark };
}
