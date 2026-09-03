import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useCatalogStore } from '../data';
import { colors, radius, spacing } from '../theme';

const formatStamp = (iso: string): string => {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}., ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
};

const originLabels: Record<string, string> = {
  bundled: 'Demodaten aus der App',
  cache: 'zuletzt geladene Aktionen',
  remote: 'aktuelle Aktionen',
};

/**
 * One line telling the user how fresh the offer data is and letting them pull a
 * new snapshot manually. The daily refresh itself happens in the background —
 * see `useCatalogStore.bootstrap()`.
 */
export const DataStatusBar: React.FC = () => {
  const { index, status, fetchedAt, error, refresh } = useCatalogStore();

  const stamp = fetchedAt ?? index.catalog.generatedAt;
  const label = `${originLabels[index.origin] ?? index.origin} · Stand ${formatStamp(stamp)}`;

  return (
    <View style={styles.row}>
      <View style={styles.textWrap}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {error ? (
          <Text style={styles.error} numberOfLines={2}>
            {error}
          </Text>
        ) : null}
      </View>

      {status === 'loading' ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Pressable
          onPress={() => refresh({ force: true })}
          accessibilityRole="button"
          accessibilityLabel="Aktionen aktualisieren"
          hitSlop={8}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>Aktualisieren</Text>
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
