import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet } from '../components/BottomSheet';
import { Chip } from '../components/Chip';
import { DiscountCard } from '../components/DiscountCard';
import { ScreenHeader } from '../components/ScreenHeader';
import { StoreMap } from '../components/StoreMap';
import type { MappedStore } from '../components/storeMapTypes';
import {
  countOffersForStore,
  getActiveDiscountViews,
  getDiscountsForStore,
  getRetailer,
  getStore,
  useCatalog,
} from '../data';
import { productName, useLanguage, useT } from '../i18n';
import { useProfileStore } from '../store/useProfileStore';
import { colors, radius, spacing } from '../theme';
import { formatPrice } from '../utils/format';

export const MapScreen: React.FC = () => {
  const catalog = useCatalog();
  const t = useT();
  const language = useLanguage();
  const [activeRetailers, setActiveRetailers] = useState<string[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const logActivity = useProfileStore((state) => state.logActivity);

  const items = useMemo<MappedStore[]>(
    () =>
      catalog.stores
        .filter((store) => activeRetailers.length === 0 || activeRetailers.includes(store.retailerId))
        .map((store) => ({
          store,
          retailer: getRetailer(catalog, store.retailerId)!,
          offerCount: countOffersForStore(catalog, store),
        }))
        .filter((item) => Boolean(item.retailer)),
    [catalog, activeRetailers],
  );

  const selectedStore = selectedStoreId ? getStore(catalog, selectedStoreId) : null;
  const selectedRetailer = selectedStore ? getRetailer(catalog, selectedStore.retailerId) : null;
  const selectedDiscounts = useMemo(
    () => (selectedStoreId ? getDiscountsForStore(catalog, selectedStoreId) : []),
    [catalog, selectedStoreId],
  );

  const toggleRetailer = (retailerId: string) =>
    setActiveRetailers((current) =>
      current.includes(retailerId)
        ? current.filter((id) => id !== retailerId)
        : [...current, retailerId],
    );

  const handleSelectStore = (storeId: string) => {
    setSelectedStoreId(storeId);
    const store = getStore(catalog, storeId);
    if (store) logActivity('store_viewed', store.name);
  };

  const bestOffer = selectedDiscounts[0];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader
        title={t('map.title')}
        subtitle={t('map.subtitle', {
          visible: items.length,
          total: catalog.stores.length,
          offers: getActiveDiscountViews(catalog).length,
        })}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        <Chip
          label={t('map.allChains')}
          selected={activeRetailers.length === 0}
          onPress={() => setActiveRetailers([])}
          compact
        />
        {catalog.retailers.map((retailer) => (
          <Chip
            key={retailer.id}
            label={retailer.name}
            dotColor={retailer.logoColor}
            selected={activeRetailers.includes(retailer.id)}
            onPress={() => toggleRetailer(retailer.id)}
            compact
          />
        ))}
      </ScrollView>

      <View style={styles.mapWrapper}>
        <StoreMap items={items} selectedStoreId={selectedStoreId} onSelectStore={handleSelectStore} />
        {Platform.OS === 'web' ? null : (
          <View style={styles.hint} pointerEvents="none">
            <Text style={styles.hintText}>{t('map.hint')}</Text>
          </View>
        )}
      </View>

      <BottomSheet
        visible={selectedStore !== null}
        onClose={() => setSelectedStoreId(null)}
        title={selectedStore?.name ?? ''}
        subtitle={selectedStore ? `${selectedStore.address} · ${selectedStore.openingHours}` : undefined}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryValue}>{selectedDiscounts.length}</Text>
              <Text style={styles.summaryLabel}>{t('map.offers')}</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryValue}>
                {bestOffer ? `−${bestOffer.discountPercent} %` : '–'}
              </Text>
              <Text style={styles.summaryLabel}>{t('map.bestDiscount')}</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryValue} numberOfLines={1}>
                {bestOffer ? formatPrice(bestOffer.discountPrice) : '–'}
              </Text>
              <Text style={styles.summaryLabel} numberOfLines={1}>
                {bestOffer ? productName(bestOffer.product, language) : t('map.noOffer')}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>
            {selectedRetailer
              ? t('map.currentOffersAt', { retailer: selectedRetailer.name })
              : t('map.currentOffers')}
          </Text>

          {selectedDiscounts.length === 0 ? (
            <Text style={styles.empty}>{t('map.empty')}</Text>
          ) : (
            selectedDiscounts.map((discount) => (
              <DiscountCard
                key={discount.id}
                discount={discount}
                hideStore
                onPress={() => logActivity('discount_viewed', productName(discount.product, language))}
              />
            ))
          )}
        </ScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  filterRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  mapWrapper: {
    flex: 1,
    overflow: 'hidden',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  hint: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  hintText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginRight: spacing.sm,
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
    marginBottom: spacing.md,
  },
  empty: {
    fontSize: 13,
    color: colors.textMuted,
    paddingVertical: spacing.lg,
  },
});
