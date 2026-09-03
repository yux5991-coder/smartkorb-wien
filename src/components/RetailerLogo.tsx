import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { getRetailerLogo } from '../assets/retailerLogos';
import type { Retailer } from '../types';

interface Props {
  retailer: Retailer;
  size?: number;
  /** Draws a white ring around the badge — used on the map. */
  bordered?: boolean;
}

/**
 * The chain's logo. Falls back to a coloured badge with its initials when no
 * artwork is bundled for that chain (see `src/assets/retailerLogos.ts`).
 */
export const RetailerLogo: React.FC<Props> = ({ retailer, size = 36, bordered = false }) => {
  const [failed, setFailed] = useState(false);
  const logo = getRetailerLogo(retailer.id);

  if (logo && !failed) {
    return (
      <View
        style={[
          styles.imageWrap,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: bordered ? 2 : 0,
          },
        ]}
      >
        <Image
          source={logo}
          style={{ width: size * 0.86, height: size * 0.86 }}
          resizeMode="contain"
          onError={() => setFailed(true)}
          accessibilityLabel={retailer.name}
        />
      </View>
    );
  }

  return (
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
};

const styles = StyleSheet.create({
  imageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
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
