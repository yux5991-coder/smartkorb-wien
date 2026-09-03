import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { categoryLabel, productName, useLanguage, useT } from '../i18n';
import { colors, radius, shadow, spacing } from '../theme';
import type { DiscountView } from '../types';
import { formatPrice, formatRemainingDays, formatValidTo } from '../utils/format';
import { PlaceholderImage } from './PlaceholderImage';
import { RetailerLogo } from './RetailerLogo';

interface Props {
  discount: DiscountView;
  onPress?: () => void;
  /** Hides the branch line when the card is already shown inside a store. */
  hideStore?: boolean;
}

export const DiscountCard: React.FC<Props> = ({ discount, onPress, hideStore = false }) => {
  const { product, retailer, store } = discount;
  const t = useT();
  const language = useLanguage();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <PlaceholderImage emoji={product.emoji} size={64} />

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.name} numberOfLines={2}>
            {productName(product, language)}
          </Text>
          <View style={[styles.percentPill, { backgroundColor: colors.danger }]}>
            <Text style={styles.percentText}>−{discount.discountPercent} %</Text>
          </View>
        </View>

        <Text style={styles.meta} numberOfLines={1}>
          {product.unit} · {categoryLabel(product.category, language)}
        </Text>

        <View style={styles.priceRow}>
          <Text style={styles.newPrice}>{formatPrice(discount.discountPrice)}</Text>
          <Text style={styles.oldPrice}>{formatPrice(discount.originalPrice)}</Text>
        </View>

        {discount.condition ? (
          <View style={styles.conditionPill}>
            <Text style={styles.conditionText} numberOfLines={1}>
              {discount.condition}
            </Text>
          </View>
        ) : null}

        <View style={styles.footerRow}>
          {store ? null : <Text style={styles.scope}>{t('discounts.chainWide')}</Text>}
          <View style={styles.retailerRow}>
            <RetailerLogo retailer={retailer} size={22} />
            <Text style={styles.retailerName} numberOfLines={1}>
              {hideStore || !store
                ? retailer.name
                : `${retailer.name} · ${store.district}`}
            </Text>
          </View>
          <Text style={styles.validity} numberOfLines={1}>
            {formatValidTo(discount.validTo)} ({formatRemainingDays(discount.validTo)})
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  pressed: {
    opacity: 0.85,
  },
  body: {
    flex: 1,
    marginLeft: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginRight: spacing.sm,
  },
  percentPill: {
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  percentText: {
    color: colors.textInverse,
    fontWeight: '800',
    fontSize: 12,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: spacing.xs,
  },
  newPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  oldPrice: {
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
    marginLeft: spacing.sm,
    marginBottom: 2,
  },
  footerRow: {
    marginTop: spacing.sm,
  },
  retailerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  retailerName: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  validity: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  scope: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  conditionPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: spacing.xs,
  },
  conditionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
});
