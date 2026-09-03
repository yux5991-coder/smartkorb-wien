import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Retailer } from '../types';

interface Props {
  retailer: Retailer;
  size?: number;
  /** Draws a white ring around the badge — used on the map. */
  bordered?: boolean;
}

/**
 * Placeholder logo: a coloured circle with the chain's initials.
 * Deliberately NOT the real trademark — swap for licensed assets later.
 */
export const RetailerLogo: React.FC<Props> = ({ retailer, size = 36, bordered = false }) => (
  <View
    style={[
      styles.circle,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: retailer.logoColor,
        borderWidth: bordered ? 2 : 0,
      },
    ]}
  >
    <Text
      style={[styles.initials, { color: retailer.logoTextColor, fontSize: size * 0.4 }]}
      numberOfLines={1}
      allowFontScaling={false}
    >
      {retailer.logoInitials}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#FFFFFF',
  },
  initials: {
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
