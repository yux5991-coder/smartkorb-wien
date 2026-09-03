import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useCatalog } from '../data';
import { categoryLabel, useLanguage, useT, type TranslationKey } from '../i18n';
import { colors, radius, spacing } from '../theme';
import type { ProductCategory } from '../types';
import { BottomSheet } from './BottomSheet';
import { Chip } from './Chip';

export type SortOption = 'percent' | 'priceAsc' | 'alpha';

export interface DiscountFilters {
  retailerIds: string[];
  categories: ProductCategory[];
  minPercent: number;
  sort: SortOption;
}

export const defaultFilters: DiscountFilters = {
  retailerIds: [],
  categories: [],
  minPercent: 0,
  sort: 'percent',
};

export const sortKeys: Record<SortOption, TranslationKey> = {
  percent: 'sort.percent',
  priceAsc: 'sort.priceAsc',
  alpha: 'sort.alpha',
};

const percentSteps = [0, 20, 30, 40];

interface Props {
  visible: boolean;
  filters: DiscountFilters;
  onChange: (filters: DiscountFilters) => void;
  onClose: () => void;
  resultCount: number;
}

export const DiscountFilterSheet: React.FC<Props> = ({
  visible,
  filters,
  onChange,
  onClose,
  resultCount,
}) => {
  const catalog = useCatalog();
  const t = useT();
  const language = useLanguage();

  const toggleRetailer = (retailerId: string) =>
    onChange({
      ...filters,
      retailerIds: filters.retailerIds.includes(retailerId)
        ? filters.retailerIds.filter((id) => id !== retailerId)
        : [...filters.retailerIds, retailerId],
    });

  const toggleCategory = (category: ProductCategory) =>
    onChange({
      ...filters,
      categories: filters.categories.includes(category)
        ? filters.categories.filter((item) => item !== category)
        : [...filters.categories, category],
    });

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('filter.title')}
      subtitle={t('filter.found', { count: resultCount })}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>{t('filter.chains')}</Text>
        <View style={styles.row}>
          {catalog.retailers.map((retailer) => (
            <Chip
              key={retailer.id}
              label={retailer.name}
              dotColor={retailer.logoColor}
              selected={filters.retailerIds.includes(retailer.id)}
              onPress={() => toggleRetailer(retailer.id)}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('filter.category')}</Text>
        <View style={styles.row}>
          {catalog.categories.map((category) => (
            <Chip
              key={category}
              label={categoryLabel(category, language)}
              selected={filters.categories.includes(category)}
              onPress={() => toggleCategory(category)}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('filter.minDiscount')}</Text>
        <View style={styles.row}>
          {percentSteps.map((step) => (
            <Chip
              key={step}
              label={step === 0 ? t('common.all') : t('filter.from', { percent: step })}
              selected={filters.minPercent === step}
              onPress={() => onChange({ ...filters, minPercent: step })}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('filter.sorting')}</Text>
        <View style={styles.row}>
          {(Object.keys(sortKeys) as SortOption[]).map((option) => (
            <Chip
              key={option}
              label={t(sortKeys[option])}
              selected={filters.sort === option}
              onPress={() => onChange({ ...filters, sort: option })}
            />
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => onChange(defaultFilters)}
            style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.resetText}>{t('filter.reset')}</Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.applyButton, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.applyText}>{t('filter.apply', { count: resultCount })}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  resetButton: {
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
  },
  resetText: {
    color: colors.textMuted,
    fontWeight: '700',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  applyText: {
    color: colors.textInverse,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.85,
  },
});
