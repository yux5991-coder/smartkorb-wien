import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import type { Allergen, DietPreference } from '../types';
import { allergenLabel, dietLabel, useLanguage, useT } from '../i18n';
import { formatPrice } from '../utils/format';
import { allAllergens, allDiets } from '../utils/labels';
import { Chip } from './Chip';

export const BUDGET_VALUES: (number | null)[] = [2, 3.5, 5, 8, null];

/** "bis 3,50 €" / "up to €3.50" / "Kein Limit" */
export const budgetLabel = (
  value: number | null,
  t: (key: 'budget.none' | 'budget.upTo', params?: Record<string, string | number>) => string,
): string => (value === null ? t('budget.none') : t('budget.upTo', { amount: formatPrice(value) }));

interface Props {
  visible: boolean;
  initialDiet: DietPreference;
  initialAllergies: Allergen[];
  initialBudget: number | null;
  onSave: (input: {
    dietPreference: DietPreference;
    allergies: Allergen[];
    budgetPerPortion: number | null;
  }) => void;
  /** When omitted the "skip" button is hidden (profile edit mode). */
  onSkip?: () => void;
  onClose?: () => void;
  title?: string;
  intro?: string;
}

/**
 * The taste questionnaire. Shown once when the user first opens the Kulinarik
 * assistant and reachable again from the profile screen.
 */
export const OnboardingForm: React.FC<Props> = ({
  visible,
  initialDiet,
  initialAllergies,
  initialBudget,
  onSave,
  onSkip,
  onClose,
  title,
  intro,
}) => {
  const t = useT();
  const language = useLanguage();
  const [diet, setDiet] = useState<DietPreference>(initialDiet);
  const [allergies, setAllergies] = useState<Allergen[]>(initialAllergies);
  const [budget, setBudget] = useState<number | null>(initialBudget);

  // re-seed the form whenever it is re-opened with different stored values
  useEffect(() => {
    if (visible) {
      setDiet(initialDiet);
      setAllergies(initialAllergies);
      setBudget(initialBudget);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const toggleAllergy = (allergen: Allergen) =>
    setAllergies((current) =>
      current.includes(allergen)
        ? current.filter((item) => item !== allergen)
        : [...current, allergen],
    );

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{title ?? t('onboarding.title')}</Text>
        <Text style={styles.intro}>{intro ?? t('onboarding.intro')}</Text>

        <Text style={styles.sectionTitle}>{t('onboarding.diet')}</Text>
        <View style={styles.chipRow}>
          {allDiets.map((option) => (
            <Chip
              key={option}
              label={dietLabel(option, language)}
              selected={diet === option}
              onPress={() => setDiet(option)}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('onboarding.allergies')}</Text>
        <Text style={styles.hint}>{t('onboarding.multiHint')}</Text>
        <View style={styles.chipRow}>
          {allAllergens.map((allergen) => (
            <Chip
              key={allergen}
              label={allergenLabel(allergen, language)}
              selected={allergies.includes(allergen)}
              onPress={() => toggleAllergy(allergen)}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('onboarding.budget')}</Text>
        <View style={styles.chipRow}>
          {BUDGET_VALUES.map((value) => (
            <Chip
              key={String(value)}
              label={budgetLabel(value, t)}
              selected={budget === value}
              onPress={() => setBudget(value)}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onSave({ dietPreference: diet, allergies, budgetPerPortion: budget })}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryButtonText}>{t('onboarding.save')}</Text>
        </Pressable>

        {onSkip ? (
          <Pressable
            accessibilityRole="button"
            onPress={onSkip}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>{t('onboarding.skip')}</Text>
          </Pressable>
        ) : null}

        {onClose && !onSkip ? (
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>{t('common.cancel')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  intro: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: -spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  actions: {
    paddingTop: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.textInverse,
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 14,
  },
  pressed: {
    opacity: 0.8,
  },
});
