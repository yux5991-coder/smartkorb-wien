import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useCatalogStore } from '../data';
import { useT } from '../i18n';
import { formatTimestamp } from '../utils/format';
import { colors, radius, spacing } from '../theme';

const ORIGIN_KEYS = {
  bundled: 'data.bundled',
  cache: 'data.cache',
  remote: 'data.remote',
} as const;

/**
 * One line telling the user how fresh the offer data is and letting them pull a
 * new snapshot manually. The daily refresh itself happens in the background —
 * see `useCatalogStore.bootstrap()`.
 */
export const DataStatusBar: React.FC = () => {
  const { index, status, fetchedAt, error, refresh } = useCatalogStore();
  const t = useT();

  const stamp = fetchedAt ?? index.catalog.generatedAt;
  const label = t('data.status', {
    origin: t(ORIGIN_KEYS[index.origin]),
    stamp: formatTimestamp(stamp),
  });

  return (
    <View style={styles.row}>
      <View style={styles.textWrap}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {error ? (
          <Text style={styles.error} numberOfLines={2}>
            {t(error)}
          </Text>
        ) : null}
      </View>

      {status === 'loading' ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Pressable
          onPress={() => refresh({ force: true })}
          accessibilityRole="button"
          accessibilityLabel={t('data.refreshA11y')}
          hitSlop={8}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>{t('data.refresh')}</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  textWrap: {
    flex: 1,
    marginRight: spacing.sm,
  },
  label: {
    fontSize: 11,
    color: colors.textMuted,
  },
  error: {
    fontSize: 11,
    color: colors.danger,
    marginTop: 2,
  },
  button: {
    paddingVertical: 2,
  },
  buttonText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  pressed: {
    opacity: 0.6,
  },
});
