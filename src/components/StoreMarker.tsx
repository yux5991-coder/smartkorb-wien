import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { getRetailerLogo } from '../assets/retailerLogos';
import { colors } from '../theme';
import type { Retailer } from '../types';

interface Props {
  retailer: Retailer;
  selected?: boolean;
}

/**
 * Content of a custom `<Marker>`: the chain's logo on a white tile with a
 * pointer in the chain colour, instead of the platform default pin. The colour
 * keeps the chains apart at a glance even where the logos look similar.
 */
export const StoreMarker: React.FC<Props> = ({ retailer, selected = false }) => {
  const logo = getRetailerLogo(retailer.id);

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.bubble,
          { borderColor: retailer.logoColor },
          selected && styles.bubbleSelected,
        ]}
      >
        {logo ? (
          <Image source={logo} style={styles.logo} resizeMode="contain" />
        ) : (
          <Text
            style={[styles.initials, { color: retailer.logoColor }]}
            allowFontScaling={false}
            numberOfLines={1}
          >
            {retailer.logoInitials}
          </Text>
        )}
      </View>
      <View style={[styles.pointer, { borderTopColor: retailer.logoColor }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    width: 48,
    height: 50,
  },
  bubble: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
  },
  bubbleSelected: {
    borderColor: colors.text,
    transform: [{ scale: 1.14 }],
  },
  logo: {
    width: 28,
    height: 28,
  },
  initials: {
    fontSize: 13,
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
});
