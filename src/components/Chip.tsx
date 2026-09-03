import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Optional colour dot in front of the label (used for retailers). */
  dotColor?: string;
  compact?: boolean;
}

export const Chip: React.FC<Props> = ({ label, selected = false, onPress, dotColor, compact }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    style={({ pressed }) => [
      styles.chip,
      compact && styles.chipCompact,
      selected && styles.chipSelected,
      pressed && styles.chipPressed,
    ]}
  >
    {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
    <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipCompact: {
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipPressed: {
    opacity: 0.7,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  label: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  labelSelected: {
    color: colors.primaryDark,
  },
});
