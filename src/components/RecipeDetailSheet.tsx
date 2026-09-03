import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useCatalog } from '../data';
import { costRecipe } from '../services/pricing';
import { colors, radius, spacing } from '../theme';
import type { Recipe } from '../types';
import { formatAmount, formatPrice } from '../utils/format';
import { BottomSheet } from './BottomSheet';
import { PlaceholderImage } from './PlaceholderImage';
import { RetailerLogo } from './RetailerLogo';

interface Props {
  recipe: Recipe | null;
  visible: boolean;
  saved: boolean;
  onClose: () => void;
  onToggleSave: () => void;
}

export const RecipeDetailSheet: React.FC<Props> = ({
  recipe,
  visible,
  saved,
  onClose,
  onToggleSave,
}) => {
  const catalog = useCatalog();
  const cost = useMemo(() => (recipe ? costRecipe(catalog, recipe) : null), [catalog, recipe]);

  if (!recipe || !cost) {
    return <BottomSheet visible={false} onClose={onClose}>{null}</BottomSheet>;
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={recipe.title}
      subtitle={`${recipe.tags.join(' · ')} · ${recipe.cookingTimeMin} Min · ${recipe.servings} Portionen`}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <PlaceholderImage
          emoji={recipe.emoji}
          fullWidth
          height={110}
          tint={colors.primarySoft}
          style={{ marginBottom: spacing.md }}
        />

        <View style={styles.summary}>
          <View>
            <Text style={styles.summaryValue}>{formatPrice(cost.pricePerPortion)}</Text>
            <Text style={styles.summaryLabel}>pro Portion</Text>
          </View>
          <View>
            <Text style={styles.summaryValue}>{formatPrice(cost.total)}</Text>
            <Text style={styles.summaryLabel}>gesamt</Text>
          </View>
          <View>
            <Text style={[styles.summaryValue, { color: colors.accent }]}>
              {formatPrice(cost.savings)}
            </Text>
            <Text style={styles.summaryLabel}>gespart</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Zutaten & günstigster Einkauf</Text>
        {cost.items.map((item) => (
          <View key={item.product.id} style={styles.ingredientRow}>
            <Text style={styles.ingredientEmoji}>{item.product.emoji}</Text>
            <View style={styles.ingredientBody}>
              <Text style={styles.ingredientName}>{item.product.name}</Text>
              <Text style={styles.ingredientMeta}>{formatAmount(item.grams, item.product)}</Text>
            </View>
            <View style={styles.ingredientRight}>
              <Text style={styles.ingredientPrice}>{formatPrice(item.price)}</Text>
              {item.offer ? (
                <View style={styles.offerRow}>
                  <RetailerLogo retailer={item.offer.retailer} size={18} />
                  <Text style={styles.offerText} numberOfLines={1}>
                    −{item.offer.discountPercent} %
                  </Text>
                </View>
              ) : (
                <Text style={styles.noOffer}>Normalpreis</Text>
              )}
            </View>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Zubereitung</Text>
        {recipe.instructions.map((step, index) => (
          <View key={step} style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}

        <Pressable
          onPress={onToggleSave}
          accessibilityRole="button"
          style={({ pressed }) => [styles.saveButton, saved && styles.saveButtonActive, pressed && styles.pressed]}
        >
          <Text style={[styles.saveButtonText, saved && styles.saveButtonTextActive]}>
            {saved ? '❤️  Gespeichert' : '🤍  Rezept speichern'}
          </Text>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  ingredientEmoji: {
    fontSize: 20,
    marginRight: spacing.md,
  },
  ingredientBody: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  ingredientMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  ingredientRight: {
    alignItems: 'flex-end',
  },
  ingredientPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  offerText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.danger,
    marginLeft: 4,
  },
  noOffer: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  saveButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveButtonActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  saveButtonText: {
    fontWeight: '700',
    color: colors.text,
  },
  saveButtonTextActive: {
    color: colors.primaryDark,
  },
  pressed: {
    opacity: 0.85,
  },
});
