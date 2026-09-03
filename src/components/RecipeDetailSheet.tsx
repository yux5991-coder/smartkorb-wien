import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useCatalog } from '../data';
import { cuisineLabel, recipeTitle, tagLabel, unitLabel, useLanguage, useT } from '../i18n';
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
  const t = useT();
  const language = useLanguage();
  const cost = useMemo(() => (recipe ? costRecipe(catalog, recipe) : null), [catalog, recipe]);

  if (!recipe || !cost) {
    return <BottomSheet visible={false} onClose={onClose}>{null}</BottomSheet>;
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={recipeTitle(recipe, language)}
      subtitle={[
        cuisineLabel(recipe.cuisine, language),
        ...recipe.tags.map((tag) => tagLabel(tag, language)),
        t('kitchen.minutes', { count: recipe.cookingTimeMin }),
        t('kitchen.servings', { count: recipe.servings }),
      ].join(' · ')}
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
            <Text style={styles.summaryLabel}>{t('common.perPortion')}</Text>
          </View>
          <View>
            <Text style={styles.summaryValue}>{formatPrice(cost.basketTotal)}</Text>
            <Text style={styles.summaryLabel}>{t('kitchen.basket')}</Text>
          </View>
          <View>
            <Text style={[styles.summaryValue, { color: colors.accent }]}>
              {formatPrice(cost.savings)}
            </Text>
            <Text style={styles.summaryLabel}>{t('kitchen.saved.short')}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('kitchen.ingredients')}</Text>
        {cost.items.map((item) => (
          <View key={item.product.id} style={styles.ingredientRow}>
            <Text style={styles.ingredientEmoji}>{item.product.emoji}</Text>
            <View style={styles.ingredientBody}>
              <Text style={styles.ingredientName}>{item.product.name}</Text>
              <Text style={styles.ingredientMeta}>
                {t('kitchen.needed', { amount: formatAmount(item.grams, item.product) })}
              </Text>
              <Text style={styles.ingredientMeta}>
                {t('kitchen.packLine', {
                  packs: item.packs,
                  unit: unitLabel(item.product.unit, language),
                  price: formatPrice(item.packPrice),
                })}
              </Text>
            </View>
            <View style={styles.ingredientRight}>
              <Text style={styles.ingredientPrice}>{formatPrice(item.packTotal)}</Text>
              {item.offer ? (
                <View style={styles.offerRow}>
                  <RetailerLogo retailer={item.offer.retailer} size={18} />
                  <Text style={styles.offerText} numberOfLines={1}>
                    −{item.offer.discountPercent} %
                  </Text>
                </View>
              ) : (
                <Text style={styles.noOffer}>{t('common.regularPrice')}</Text>
              )}
            </View>
          </View>
        ))}

        <Text style={styles.costNote}>
          {t('kitchen.costNote', {
            basket: formatPrice(cost.basketTotal),
            used: formatPrice(cost.usedTotal),
            servings: recipe.servings,
          })}
        </Text>

        <Text style={styles.sectionTitle}>{t('kitchen.preparation')}</Text>
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
            {saved ? `❤️  ${t('kitchen.saved')}` : `🤍  ${t('kitchen.saveRecipe')}`}
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
  costNote: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
    marginTop: spacing.xs,
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
