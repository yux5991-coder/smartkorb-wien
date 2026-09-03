import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, radius } from '../theme';

interface Props {
  emoji: string;
  size?: number;
  /** Use a tinted background instead of the default light grey. */
  tint?: string;
  style?: ViewStyle;
  fullWidth?: boolean;
  height?: number;
}

/**
 * Stand-in for product / recipe photography. Real images will come from the
 * retailer feeds later — see TODO(backend) in `src/data/index.ts`.
 */
export const PlaceholderImage: React.FC<Props> = ({
  emoji,
  size = 64,
  tint = colors.surfaceMuted,
  style,
  fullWidth = false,
  height,
}) => (
  <View
    style={[
      styles.box,
      {
        backgroundColor: tint,
        width: fullWidth ? '100%' : size,
        height: height ?? size,
      },
      style,
    ]}
  >
    <Text style={{ fontSize: (height ?? size) * 0.45 }} allowFontScaling={false}>
      {emoji}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
