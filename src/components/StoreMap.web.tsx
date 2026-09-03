import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useT } from '../i18n';
import { colors, radius, spacing } from '../theme';
import { RetailerLogo } from './RetailerLogo';
import type { StoreMapProps } from './storeMapTypes';

/**
 * `react-native-maps` has no web implementation. The prototype is meant for
 * Expo Go on a phone; in the browser we degrade to a simple branch list so the
 * rest of the app stays usable.
 */
export const StoreMap: React.FC<StoreMapProps> = ({ items, selectedStoreId, onSelectStore }) => {
  const t = useT();

  return (
  <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    <Text style={styles.notice}>
      {t('map.webNotice', {
        extra: items.length > 150 ? ` (1–150 / ${items.length})` : '',
      })}
    </Text>
    {items.slice(0, 150).map(({ store, retailer, offerCount }) => (
      <Pressable
        key={store.id}
        onPress={() => onSelectStore(store.id)}
        style={[styles.row, selectedStoreId === store.id && styles.rowSelected]}
      >
        <RetailerLogo retailer={retailer} size={34} />
        <View style={styles.body}>
          <Text style={styles.name}>{store.name}</Text>
          <Text style={styles.address}>{store.address}</Text>
        </View>
        <Text style={styles.count}>{offerCount}</Text>
      </Pressable>
    ))}
  </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  notice: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowSelected: { borderColor: colors.primary },
  body: { flex: 1, marginLeft: spacing.md },
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  address: { fontSize: 12, color: colors.textMuted },
  count: { fontSize: 14, fontWeight: '800', color: colors.primaryDark },
});
