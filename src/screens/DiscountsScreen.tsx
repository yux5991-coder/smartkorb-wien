import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet } from '../components/BottomSheet';
import { Chip } from '../components/Chip';
import { DiscountCard } from '../components/DiscountCard';
import {
  DiscountFilterSheet,
  defaultFilters,
  sortKeys,
  type DiscountFilters,
} from '../components/DiscountFilterSheet';
import { PlaceholderImage } from '../components/PlaceholderImage';
import { RetailerLogo } from '../components/RetailerLogo';
import { ScreenHeader } from '../components/ScreenHeader';
import { SearchBar } from '../components/SearchBar';
import { DataStatusBar } from '../components/DataStatusBar';
import { getActiveDiscountViews, useCatalog, useCatalogStore } from '../data';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { categoryLabel, productName, useLanguage, useT } from '../i18n';
import { useProfileStore } from '../store/useProfileStore';
import { colors, radius, shadow, spacing } from '../theme';
import type { DiscountView } from '../types';
import { formatPrice, formatValidTo } from '../utils/format';

const normalise = (value: string) => value.toLowerCase().trim();

export const DiscountsScreen: React.FC = () => {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<DiscountFilters>(defaultFilters);
  const [filterVisible, setFilterVisible] = useState(false);
  const [detail, setDetail] = useState<DiscountView | null>(null);

  const debouncedQuery = useDebouncedValue(query, 300);
  const logActivity = useProfileStore((state) => state.logActivity);

  const catalog = useCatalog();
  const t = useT();
  const language = useLanguage();
  const syncStatus = useCatalogStore((state) => state.status);
  const refresh = useCatalogStore((state) => state.refresh);

  // The whole feed: every running offer of every chain, mixed together.
  const allDiscounts = useMemo(() => getActiveDiscountViews(catalog), [catalog]);

  const visibleDiscounts = useMemo(() => {
    const needle = normalise(debouncedQuery);
    const result = allDiscounts.filter((view) => {
      // search matches both language variants, so "tomato" and "Tomaten" work
      if (
        needle &&
        !normalise(view.product.name).includes(needle) &&
        !normalise(view.product.nameEn ?? '').includes(needle)
      ) {
        return false;
      }
      if (filters.retailerIds.length > 0 && !filters.retailerIds.includes(view.retailer.id)) {
        return false;
      }
      if (filters.categories.length > 0 && !filters.categories.includes(view.product.category)) {
        return false;
      }
      if (view.discountPercent < filters.minPercent) return false;
      return true;
    });

    switch (filters.sort) {
      case 'priceAsc':
        return result.sort((a, b) => a.discountPrice - b.discountPrice);
      case 'alpha':
        return result.sort((a, b) =>
          productName(a.product, language).localeCompare(productName(b.product, language), language),
        );
      default:
        return result.sort((a, b) => b.discountPercent - a.discountPercent);
    }
  }, [allDiscounts, debouncedQuery, filters, language]);

  useEffect(() => {
    if (debouncedQuery.trim().length >= 3) {
      logActivity('search', `„${debouncedQuery.trim()}“`);
    }
  }, [debouncedQuery, logActivity]);

  const activeFilterCount =
    filters.retailerIds.length +
    filters.categories.length +
    (filters.minPercent > 0 ? 1 : 0) +
    (filters.sort !== 'percent' ? 1 : 0);

  const applyFilters = (next: DiscountFilters) => {
    setFilters(next);
    const changedRetailers = next.retailerIds
      .map((id) => catalog.retailers.find((retailer) => retailer.id === id)?.name)
      .filter(Boolean)
      .join(', ');
    const parts = [
      changedRetailers,
      next.categories.join(', '),
      next.minPercent > 0 ? `ab ${next.minPercent} %` : '',
      t(sortKeys[next.sort]),
    ].filter(Boolean);
    logActivity('filter', parts.join(' · ') || t('filter.reset'));
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader
        title={t('discounts.title')}
        subtitle={t('discounts.subtitle', {
          visible: visibleDiscounts.length,
          total: allDiscounts.length,
        })}
      />

      <DataStatusBar />

      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <SearchBar value={query} onChangeText={setQuery} />
        </View>
        <Pressable
          onPress={() => setFilterVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={t('filter.open')}
          style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
        >
          <Text style={styles.filterIcon}>⚙︎</Text>
          {activeFilterCount > 0 ? (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.quickFilters}
      >
        <Chip
          label={t('discounts.allChains')}
          selected={filters.retailerIds.length === 0}
          onPress={() => applyFilters({ ...filters, retailerIds: [] })}
          compact
        />
        {catalog.retailers.map((retailer) => (
          <Chip
            key={retailer.id}
            label={retailer.name}
            dotColor={retailer.logoColor}
            selected={filters.retailerIds.includes(retailer.id)}
            onPress={() =>
              applyFilters({
                ...filters,
                retailerIds: filters.retailerIds.includes(retailer.id)
                  ? filters.retailerIds.filter((id) => id !== retailer.id)
                  : [...filters.retailerIds, retailer.id],
              })
            }
            compact
          />
        ))}
      </ScrollView>

      <FlatList
        data={visibleDiscounts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        windowSize={11}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            refreshing={syncStatus === 'loading'}
            onRefresh={() => refresh({ force: true })}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <DiscountCard
            discount={item}
            onPress={() => {
              setDetail(item);
              logActivity('discount_viewed', `${productName(item.product, language)} (${item.retailer.name})`);
            }}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('discounts.emptyTitle')}</Text>
            <Text style={styles.emptyText}>{t('discounts.emptyText')}</Text>
          </View>
        }
      />

      <DiscountFilterSheet
        visible={filterVisible}
        filters={filters}
        onChange={applyFilters}
        onClose={() => setFilterVisible(false)}
        resultCount={visibleDiscounts.length}
      />

      <BottomSheet
        visible={detail !== null}
        onClose={() => setDetail(null)}
        title={detail ? productName(detail.product, language) : ''}
        subtitle={
          detail
            ? `${detail.product.unit} · ${categoryLabel(detail.product.category, language)}`
            : undefined
        }
        maxHeightRatio={0.7}
      >
        {detail ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <PlaceholderImage emoji={detail.product.emoji} fullWidth height={120} />

            <View style={styles.detailPriceRow}>
              <Text style={styles.detailNewPrice}>{formatPrice(detail.discountPrice)}</Text>
              <Text style={styles.detailOldPrice}>{formatPrice(detail.originalPrice)}</Text>
              <View style={styles.detailPercent}>
                <Text style={styles.detailPercentText}>−{detail.discountPercent} %</Text>
              </View>
            </View>

            <View style={styles.detailCard}>
              <RetailerLogo retailer={detail.retailer} size={40} />
              <View style={styles.detailStore}>
                <Text style={styles.detailStoreName}>
                  {detail.store ? detail.store.name : detail.retailer.name}
                </Text>
                {detail.store ? (
                  <>
                    <Text style={styles.detailStoreAddress}>{detail.store.address}</Text>
                    <Text style={styles.detailStoreAddress}>{detail.store.openingHours}</Text>
                  </>
                ) : (
                  <Text style={styles.detailStoreAddress}>
                    {t('discounts.allBranches', {
                      count: catalog.stores.filter(
                        (store) => store.retailerId === detail.retailerId,
                      ).length,
                    })}
                  </Text>
                )}
              </View>
            </View>

            {detail.condition ? (
              <View style={styles.detailCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailLabel}>{t('discounts.condition')}</Text>
                  <Text style={styles.detailValue}>{detail.condition}</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.detailCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>{t('discounts.period')}</Text>
                <Text style={styles.detailValue}>
                  {detail.validFrom.split('-').reverse().join('.')} – {formatValidTo(detail.validTo).replace('bis ', '')}
                </Text>
              </View>
            </View>

            <Text style={styles.detailNote}>{t('discounts.sourceNote')}</Text>
          </ScrollView>
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  searchBar: {
    flex: 1,
  },
  filterButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  filterIcon: {
    fontSize: 18,
    color: colors.text,
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: colors.textInverse,
    fontSize: 10,
    fontWeight: '800',
  },
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  quickFilters: {
    paddingHorizontal: spacing.lg,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  pressed: {
    opacity: 0.8,
  },
  detailPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  detailNewPrice: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  detailOldPrice: {
    fontSize: 15,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
    marginLeft: spacing.md,
  },
  detailPercent: {
    marginLeft: 'auto',
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  detailPercentText: {
    color: colors.textInverse,
    fontWeight: '800',
  },
  detailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  detailStore: {
    flex: 1,
    marginLeft: spacing.md,
  },
  detailStoreName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  detailStoreAddress: {
    fontSize: 12,
    color: colors.textMuted,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  detailNote: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
});
