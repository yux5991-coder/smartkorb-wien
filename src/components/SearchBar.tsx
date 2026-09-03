import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useT } from '../i18n';
import { colors, radius, spacing } from '../theme';

interface Props {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<Props> = ({ value, onChangeText, placeholder }) => {
  const t = useT();

  return (
  <View style={styles.wrapper}>
    <Text style={styles.icon}>🔍</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder ?? t('discounts.searchPlaceholder')}
      placeholderTextColor={colors.textMuted}
      autoCorrect={false}
      returnKeyType="search"
      clearButtonMode="while-editing"
      accessibilityLabel={t('discounts.searchPlaceholder')}
    />
    {value.length > 0 ? (
      <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityRole="button">
        <Text style={styles.clear}>✕</Text>
      </Pressable>
    ) : null}
  </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 42,
  },
  icon: {
    fontSize: 14,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 0,
  },
  clear: {
    fontSize: 14,
    color: colors.textMuted,
    paddingLeft: spacing.sm,
  },
});
