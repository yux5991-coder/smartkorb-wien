import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import type { Retailer } from '../types';

interface Props {
  retailer: Retailer;
  /** Number of running offers, rendered as a small counter bubble. */
  offerCount: number;
  selected?: boolean;
}

/**
 * Content of a custom `<Marker>` on the map — a rounded logo badge with a
 * pointer, instead of the platform default pin.
 */
export const StoreMarker: React.FC<Props> = ({ retailer, offerCount, selected = false }) => (
  <View style={styles.wrapper}>
    <View
      style={[
        styles.bubble,
        { backgroundColor: retailer.logoColor },
        selected && styles.bubbleSelected,
      ]}
    >
      <Text style={[styles.initials, { color: retailer.logoTextColor }]} allowFontScaling={false}>
        {retailer.logoInitials}
      </Text>
    </View>
    <View style={[styles.pointer, { borderTopColor: retailer.logoColor }]} />
    {offerCount > 0 ? (
      <View style={styles.counter}>
        <Text style={styles.counterText} allowFontScaling={false}>
          {offerCount}
        </Text>
      </View>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    width: 56,
    height: 56,
  },
  bubble: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  bubbleSelected: {
    borderColor: colors.text,
    transform: [{ scale: 1.12 }],
  },
  initials: {
    fontSize: 14,
    fontWeight: '800',
  },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  counter: {
    position: 'absolute',
    top: -6,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: {
    color: colors.textInverse,
    fontSize: 10,
    fontWeight: '800',
  },
});
