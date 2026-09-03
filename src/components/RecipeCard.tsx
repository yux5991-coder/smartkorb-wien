import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCatalog } from '../data';
import { costRecipe, retailerNames } from '../services/pricing';
import { colors, radius, shadow, spacing } from '../theme';
import type { Recipe } from '../types';
import { formatPrice } from '../utils/format';
import { PlaceholderImage } from './PlaceholderImage';

interface Props {
  recipe: Recipe;
  saved: boolean;
  onPress: () => void;
  onToggleSave: () => void;
}

export const RecipeCard: React.FC<Props> = ({ recipe, saved, onPress, onToggleSave }) => {
  const catalog = useCatalog();
  const cost = useMemo(() => costRecipe(catalog, recipe), [catalog, recipe]);
  const cheapestRetailers = useMemo(() => retailerNames(cost), [cost]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View>
        <PlaceholderImage emoji={recipe.emoji} fullWidth height={92} tint={colors.primarySoft} />
        <Pressable
          onPress={onToggleSave}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Rezept entfernen' : 'Rezept speichern'}
          style={styles.heart}
        >
          <Text style={styles.heartIcon}>{saved ? '❤️' : '🤍'}</Text>
        </Pressable>
        <View style={styles.timePill}>
          <Text style={styles.timeText}>{recipe.cookingTimeMin} Min</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {recipe.title}
        </Text>
        <Text style={styles.price}>{formatPrice(cost.pricePerPortion)} / Portion</Text>
        <Text style={styles.stores} numberOfLines={2}>
          {cheapestRetailers ? `Günstig bei ${cheapestRetailers}` : 'Keine Aktion aktiv'}
        </Text>
        {cost.savings > 0.05 ? (
          <Text style={styles.savings}>Du sparst {formatPrice(cost.savings)}</Text>
        ) : null}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    margin: spacing.xs,
    ...shadow.card,
  },
  pressed: {
    opacity: 0.85,
  },
  heart: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  heartIcon: {
    fontSize: 14,
  },
  timePill: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(18,33,43,0.72)',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  timeText: {
    color: colors.textInverse,
    fontSize: 11,
    fontWeight: '700',
  },
  body: {
    padding: spacing.md,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    minHeight: 36,
  },
  price: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primaryDark,
    marginTop: spacing.xs,
  },
  stores: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  savings: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    marginTop: 4,
  },
});
