import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { productName, recipeTitle, unitLabel, useLanguage, useT } from '../i18n';
import type { DishSuggestion, ShoppingList } from '../services/ai';
import { colors, radius, spacing } from '../theme';
import type { Recipe } from '../types';
import { formatAmount, formatPrice } from '../utils/format';
import { BottomSheet } from './BottomSheet';
import { PlaceholderImage } from './PlaceholderImage';
import { PremiumBadge } from './PremiumBadge';
import { RetailerLogo } from './RetailerLogo';

const Loading: React.FC<{ label: string }> = ({ label }) => (
  <View style={styles.loading}>
    <ActivityIndicator color={colors.primary} />
    <Text style={styles.loadingText}>{label}</Text>
  </View>
);

interface SuggestionsProps {
  visible: boolean;
  loading: boolean;
  suggestions: DishSuggestion[];
  personalised: boolean;
  onClose: () => void;
  onOpenRecipe: (recipe: Recipe) => void;
}

/** Result panel of "Was koche ich?". */
export const DishSuggestionsSheet: React.FC<SuggestionsProps> = ({
  visible,
  loading,
  suggestions,
  personalised,
  onClose,
  onOpenRecipe,
}) => {
  const t = useT();
  const language = useLanguage();

  return (
  <BottomSheet
    visible={visible}
    onClose={onClose}
    title={t('ai.suggestTitle')}
    subtitle={personalised ? t('ai.suggestSubtitlePersonal') : t('ai.suggestSubtitleGeneric')}
  >
    {loading ? (
      <Loading label={t('ai.loadingSuggestions')} />
    ) : (
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.badgeRow}>
          <PremiumBadge label={t('common.premium')} />
          <Text style={styles.badgeNote}>{t('common.demoNote')}</Text>
        </View>

        {suggestions.map(({ recipe, cost, reason }) => (
          <Pressable
            key={recipe.id}
            onPress={() => onOpenRecipe(recipe)}
            style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <PlaceholderImage emoji={recipe.emoji} size={54} tint={colors.primarySoft} />
            <View style={styles.suggestionBody}>
              <Text style={styles.suggestionTitle}>{recipeTitle(recipe, language)}</Text>
              <Text style={styles.suggestionReason} numberOfLines={2}>
                {reason}
              </Text>
              <View style={styles.storeRow}>
                {cost.bestOffers.slice(0, 4).map((view) => (
                  <View key={view.id} style={styles.storeChip}>
                    <RetailerLogo retailer={view.retailer} size={16} />
                    <Text style={styles.storeChipText}>
                      {view.store ? view.store.district : view.retailer.name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.suggestionPrice}>
              <Text style={styles.pricePerPortion}>{formatPrice(cost.pricePerPortion)}</Text>
              <Text style={styles.pricePerPortionLabel}>{t('common.perPortionShort')}</Text>
            </View>
          </Pressable>
        ))}

        {suggestions.length === 0 ? (
          <Text style={styles.empty}>{t('ai.noSuggestions')}</Text>
        ) : null}
      </ScrollView>
    )}
  </BottomSheet>
  );
};

interface ShoppingListProps {
  visible: boolean;
  loading: boolean;
  list: ShoppingList | null;
  onClose: () => void;
}

/** Result panel of "Ich möchte X kochen". */
export const ShoppingListSheet: React.FC<ShoppingListProps> = ({
  visible,
  loading,
  list,
  onClose,
}) => {
  const t = useT();
  const language = useLanguage();

  return (
  <BottomSheet
    visible={visible}
    onClose={onClose}
    title={list?.title ?? t('ai.listTitle')}
    subtitle={list?.note}
  >
    {loading || !list ? (
      <Loading label={t('ai.loadingList')} />
    ) : (
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.badgeRow}>
          <PremiumBadge label={t('common.premium')} />
          <Text style={styles.badgeNote}>{t('common.demoNote')}</Text>
        </View>

        {list.warnings.map((warning) => (
          <View key={warning} style={styles.warning}>
            <Text style={styles.warningText}>⚠︎ {warning}</Text>
          </View>
        ))}

        {list.items.map((item) => (
          <View key={item.product.id} style={styles.itemRow}>
            <Text style={styles.itemEmoji}>{item.product.emoji}</Text>
            <View style={styles.itemBody}>
              <Text style={styles.itemName}>{productName(item.product, language)}</Text>
              <Text style={styles.itemAmount}>
                {t('ai.neededPacks', {
                  amount: formatAmount(item.grams, item.product),
                  packs: item.packs,
                  unit: unitLabel(item.product.unit, language),
                })}
              </Text>
              {item.offer ? (
                <View style={styles.itemStore}>
                  <RetailerLogo retailer={item.offer.retailer} size={16} />
                  <Text style={styles.itemStoreText} numberOfLines={1}>
                    {item.offer.store ? item.offer.store.name : `${item.offer.retailer.name} · alle Filialen`} · −
                    {item.offer.discountPercent} %
                  </Text>
                </View>
              ) : (
                <Text style={styles.itemStoreText}>{t('ai.noOffer')}</Text>
              )}
              {item.offer?.condition ? (
                <Text style={styles.itemCondition}>{item.offer.condition}</Text>
              ) : null}
            </View>
            <Text style={styles.itemPrice}>{formatPrice(item.packTotal)}</Text>
          </View>
        ))}

        <View style={styles.totalBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('ai.basketWhole')}</Text>
            <Text style={styles.totalValue}>{formatPrice(list.basketTotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('ai.usedFor', { count: list.servings })}</Text>
            <Text style={styles.totalValue}>{formatPrice(list.usedTotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('common.perPortion')}</Text>
            <Text style={styles.totalValue}>{formatPrice(list.pricePerPortion)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('ai.savings')}</Text>
            <Text style={[styles.totalValue, { color: colors.accent }]}>
              {formatPrice(list.savings)}
            </Text>
          </View>
          <Text style={styles.totalNote}>{t('ai.leftoverNote')}</Text>
        </View>
      </ScrollView>
    )}
  </BottomSheet>
  );
};

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 13,
    color: colors.textMuted,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  badgeNote: {
    fontSize: 11,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  suggestionBody: {
    flex: 1,
    marginHorizontal: spacing.md,
  },
  suggestionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  suggestionReason: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  storeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  storeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginRight: 6,
    marginBottom: 4,
  },
  storeChipText: {
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: 4,
    fontWeight: '600',
  },
  suggestionPrice: {
    alignItems: 'flex-end',
  },
  pricePerPortion: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  pricePerPortionLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  empty: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
    paddingVertical: spacing.lg,
  },
  warning: {
    backgroundColor: '#FDEDEF',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  warningText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  itemEmoji: {
    fontSize: 20,
    marginRight: spacing.md,
  },
  itemBody: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  itemAmount: {
    fontSize: 12,
    color: colors.textMuted,
  },
  itemStore: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  itemStoreText: {
    fontSize: 11,
    color: colors.textMuted,
    marginLeft: 4,
    flexShrink: 1,
  },
  itemCondition: {
    fontSize: 10,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  totalBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 13,
    color: colors.primaryDark,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  totalNote: {
    fontSize: 11,
    color: colors.primaryDark,
    opacity: 0.8,
    lineHeight: 15,
    marginTop: 4,
  },
});
