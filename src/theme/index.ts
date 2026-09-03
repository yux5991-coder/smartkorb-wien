/**
 * Central design tokens. NativeWind was evaluated for this prototype but the
 * plain `StyleSheet` route keeps the Expo Go setup dependency-free and avoids
 * Babel/Metro configuration drift — see README ("Styling").
 */
export const colors = {
  primary: '#0E7C5A',
  primaryDark: '#0A5C43',
  primarySoft: '#E3F3ED',
  accent: '#F2A104',
  danger: '#D7263D',
  premium: '#7A4FD6',
  premiumSoft: '#EFE8FD',
  background: '#F4F6F8',
  surface: '#FFFFFF',
  surfaceMuted: '#EDF1F4',
  border: '#DCE3E8',
  text: '#12212B',
  textMuted: '#5C6B76',
  textInverse: '#FFFFFF',
  shadow: '#0B1B26',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  sectionTitle: { fontSize: 17, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 14, color: colors.text },
  small: { fontSize: 12, color: colors.textMuted },
} as const;

export const shadow = {
  card: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
} as const;
