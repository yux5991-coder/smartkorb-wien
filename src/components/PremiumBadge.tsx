import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../theme';

/** Marks the AI features that are planned as a paid tier. */
export const PremiumBadge: React.FC<{ label?: string }> = ({ label = 'Premium' }) => (
  <View style={styles.badge}>
    <Text style={styles.text}>★ {label}</Text>
  </View>
);

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.premiumSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    color: colors.premium,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
