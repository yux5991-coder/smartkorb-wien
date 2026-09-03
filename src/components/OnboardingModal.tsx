import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import type { Allergen, DietPreference } from '../types';
import { allAllergens, allDiets, allergenLabels, dietLabels } from '../utils/labels';
import { Chip } from './Chip';

export const BUDGET_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'bis 2,00 €', value: 2 },
  { label: 'bis 3,50 €', value: 3.5 },
  { label: 'bis 5,00 €', value: 5 },
  { label: 'bis 8,00 €', value: 8 },
  { label: 'Kein Limit', value: null },
];

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
  title = 'Dein Geschmacksprofil',
  intro = 'Damit wir dir passende Gerichte aus den aktuellen Aktionen vorschlagen können.',
}) => {
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
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.intro}>{intro}</Text>

        <Text style={styles.sectionTitle}>Ernährung</Text>
        <View style={styles.chipRow}>
          {allDiets.map((option) => (
            <Chip
              key={option}
              label={dietLabels[option]}
              selected={diet === option}
              onPress={() => setDiet(option)}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Allergien & Unverträglichkeiten</Text>
        <Text style={styles.hint}>Mehrfachauswahl möglich</Text>
        <View style={styles.chipRow}>
          {allAllergens.map((allergen) => (
            <Chip
              key={allergen}
              label={allergenLabels[allergen]}
              selected={allergies.includes(allergen)}
              onPress={() => toggleAllergy(allergen)}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Budget pro Portion</Text>
        <View style={styles.chipRow}>
          {BUDGET_OPTIONS.map((option) => (
            <Chip
              key={option.label}
              label={option.label}
              selected={budget === option.value}
              onPress={() => setBudget(option.value)}
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
          <Text style={styles.primaryButtonText}>Speichern & loslegen</Text>
        </Pressable>

        {onSkip ? (
          <Pressable
            accessibilityRole="button"
            onPress={onSkip}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Überspringen, später einrichten</Text>
          </Pressable>
        ) : null}

        {onClose && !onSkip ? (
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Abbrechen</Text>
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
