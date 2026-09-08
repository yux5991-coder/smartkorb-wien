import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { allergenLabel, dietLabel, useLanguage, useT } from '../i18n';
import { colors, radius, spacing } from '../theme';
import type { Allergen, DietPreference, FamilyMember } from '../types';
import { allAllergens, allDiets } from '../utils/labels';
import { BottomSheet } from './BottomSheet';
import { Chip } from './Chip';

interface Props {
  visible: boolean;
  /** null = creating a new member. */
  member: FamilyMember | null;
  onClose: () => void;
  onSave: (input: { name: string; dietaryPreferences: DietPreference[]; allergies: Allergen[] }) => void;
  onDelete?: () => void;
}

/** Create or edit one person the plan has to work for. */
export const FamilyMemberSheet: React.FC<Props> = ({
  visible,
  member,
  onClose,
  onSave,
  onDelete,
}) => {
  const t = useT();
  const language = useLanguage();

  const [name, setName] = useState('');
  const [diet, setDiet] = useState<DietPreference>('omnivor');
  const [allergies, setAllergies] = useState<Allergen[]>([]);

  useEffect(() => {
    if (!visible) return;
    setName(member?.name ?? '');
    setDiet(member?.dietaryPreferences[0] ?? 'omnivor');
    setAllergies(member?.allergies ?? []);
  }, [visible, member]);

  const toggleAllergy = (allergen: Allergen) =>
    setAllergies((current) =>
      current.includes(allergen)
        ? current.filter((item) => item !== allergen)
        : [...current, allergen],
    );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={member ? t('planner.editMember') : t('planner.addMember')}
      maxHeightRatio={0.8}
    >
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>{t('planner.memberName')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('planner.memberNamePlaceholder')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('planner.memberName')}
        />

        <Text style={styles.label}>{t('onboarding.diet')}</Text>
        <View style={styles.row}>
          {allDiets.map((option) => (
            <Chip
              key={option}
              label={dietLabel(option, language)}
              selected={diet === option}
              onPress={() => setDiet(option)}
            />
          ))}
        </View>

        <Text style={styles.label}>{t('onboarding.allergies')}</Text>
        <View style={styles.row}>
          {allAllergens.map((allergen) => (
            <Chip
              key={allergen}
              label={allergenLabel(allergen, language)}
              selected={allergies.includes(allergen)}
              onPress={() => toggleAllergy(allergen)}
            />
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() =>
            onSave({
              name,
              dietaryPreferences: diet === 'omnivor' ? [] : [diet],
              allergies,
            })
          }
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryButtonText}>{t('onboarding.save')}</Text>
        </Pressable>

        {member && onDelete ? (
          <Pressable
            accessibilityRole="button"
            onPress={onDelete}
            style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
          >
            <Text style={styles.deleteText}>{t('planner.deleteMember')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  input: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  primaryButtonText: {
    color: colors.textInverse,
    fontWeight: '800',
    fontSize: 15,
  },
  deleteButton: {
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  deleteText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 14,
  },
  pressed: {
    opacity: 0.85,
  },
});
