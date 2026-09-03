import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingForm, BUDGET_OPTIONS } from '../components/OnboardingModal';
import { PlaceholderImage } from '../components/PlaceholderImage';
import { RecipeDetailSheet } from '../components/RecipeDetailSheet';
import { ScreenHeader } from '../components/ScreenHeader';
import { DataStatusBar } from '../components/DataStatusBar';
import { getActiveDiscountViews, getRecipe, useCatalog } from '../data';
import { costRecipe } from '../services/pricing';
import { useProfileStore } from '../store/useProfileStore';
import { colors, radius, shadow, spacing } from '../theme';
import type { Recipe } from '../types';
import { formatPrice } from '../utils/format';
import { activityLabels, allergenLabels, dietLabels } from '../utils/labels';

const formatTimestamp = (iso: string): string => {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}. ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const {
    dietPreference,
    allergies,
    budgetPerPortion,
    savedRecipeIds,
    activityLog,
    onboardingStatus,
    completeOnboarding,
    restartOnboarding,
    toggleSavedRecipe,
    clearActivityLog,
  } = useProfileStore();

  const [editVisible, setEditVisible] = useState(false);
  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null);

  const savedRecipes = useMemo(
    () =>
      savedRecipeIds
        .map((id) => getRecipe(catalog, id))
        .filter((recipe): recipe is Recipe => Boolean(recipe)),
    [catalog, savedRecipeIds],
  );

  const budgetLabel =
    BUDGET_OPTIONS.find((option) => option.value === budgetPerPortion)?.label ?? 'Kein Limit';

  const statusLabel: Record<string, string> = {
    pending: 'noch nicht ausgefüllt',
    completed: 'ausgefüllt',
    skipped: 'übersprungen',
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
      >
        <ScreenHeader title="Profil" subtitle="Deine Rezepte, Einstellungen und Aktivitäten" />

        <DataStatusBar />

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Datenquelle</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Filialen in Wien</Text>
            <Text style={styles.settingValue}>{catalog.stores.length}</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Aktionen heute</Text>
            <Text style={styles.settingValue}>{getActiveDiscountViews(catalog).length}</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Quellen</Text>
            <Text style={styles.settingValue} numberOfLines={2}>
              {catalog.catalog.sources.join(', ')}
            </Text>
          </View>
        </View>

        {/* --- Einstellungen ------------------------------------------------ */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Ernährung & Vorlieben</Text>
            <Pressable onPress={() => setEditVisible(true)} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.link}>Bearbeiten</Text>
            </Pressable>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Ernährung</Text>
            <Text style={styles.settingValue}>{dietLabels[dietPreference]}</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Allergien</Text>
            <Text style={styles.settingValue}>
              {allergies.length === 0
                ? 'keine angegeben'
                : allergies.map((allergen) => allergenLabels[allergen]).join(', ')}
            </Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Budget pro Portion</Text>
            <Text style={styles.settingValue}>{budgetLabel}</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Fragebogen</Text>
            <Text style={styles.settingValue}>{statusLabel[onboardingStatus]}</Text>
          </View>

          <Pressable
            onPress={restartOnboarding}
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>
              Fragebogen beim nächsten Besuch der Kulinarik erneut zeigen
            </Text>
          </Pressable>
        </View>

        {/* --- Gespeicherte Rezepte ----------------------------------------- */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Gespeicherte Rezepte</Text>
            <Text style={styles.counter}>{savedRecipes.length}</Text>
          </View>

          {savedRecipes.length === 0 ? (
            <Text style={styles.emptyText}>
              Noch nichts gespeichert. Tippe in der Kulinarik auf das Herz, um Rezepte hier zu
              sammeln.
            </Text>
          ) : (
            savedRecipes.map((recipe) => {
              const cost = costRecipe(catalog, recipe);
              return (
                <Pressable
                  key={recipe.id}
                  onPress={() => setDetailRecipe(recipe)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.savedRow, pressed && styles.pressed]}
                >
                  <PlaceholderImage emoji={recipe.emoji} size={44} tint={colors.primarySoft} />
                  <View style={styles.savedBody}>
                    <Text style={styles.savedTitle} numberOfLines={1}>
                      {recipe.title}
                    </Text>
                    <Text style={styles.savedMeta}>
                      {formatPrice(cost.pricePerPortion)} / Portion · {recipe.cookingTimeMin} Min
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => toggleSavedRecipe(recipe.id)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Rezept entfernen"
                  >
                    <Text style={styles.heart}>❤️</Text>
                  </Pressable>
                </Pressable>
              );
            })
          )}
        </View>

        {/* --- Aktivität ---------------------------------------------------- */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Aktivität</Text>
            {activityLog.length > 0 ? (
              <Pressable onPress={clearActivityLog} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.link}>Leeren</Text>
              </Pressable>
            ) : null}
          </View>

          {activityLog.length === 0 ? (
            <Text style={styles.emptyText}>
              Hier erscheinen deine letzten Suchen, Filter und angesehenen Rabatte.
            </Text>
          ) : (
            activityLog.slice(0, 20).map((entry) => (
              <View key={entry.id} style={styles.activityRow}>
                <View style={styles.activityDot} />
                <View style={styles.activityBody}>
                  <Text style={styles.activityLabel} numberOfLines={1}>
                    {entry.label}
                  </Text>
                  <Text style={styles.activityType}>
                    {activityLabels[entry.type] ?? entry.type} · {formatTimestamp(entry.at)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <Text style={styles.footnote}>
          SmartKorb Wien · Filialdaten aus OpenStreetMap (ODbL). Aktionen aus der täglichen
          Datenaktualisierung; ohne konfigurierte Quelle zeigt die App die mitgelieferten
          Demodaten.
        </Text>
      </ScrollView>

      <RecipeDetailSheet
        recipe={detailRecipe}
        visible={detailRecipe !== null}
        saved={detailRecipe ? savedRecipeIds.includes(detailRecipe.id) : false}
        onClose={() => setDetailRecipe(null)}
        onToggleSave={() => detailRecipe && toggleSavedRecipe(detailRecipe.id)}
      />

      <Modal
        visible={editVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditVisible(false)}
      >
        <View style={styles.modalRoot}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + spacing.lg }]}>
            <OnboardingForm
              visible={editVisible}
              initialDiet={dietPreference}
              initialAllergies={allergies}
              initialBudget={budgetPerPortion}
              title="Einstellungen"
              intro="Diese Angaben nutzt die KI-Küche für ihre Vorschläge."
              onSave={(input) => {
                completeOnboarding(input);
                setEditVisible(false);
              }}
              onClose={() => setEditVisible(false)}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  counter: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  link: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  settingLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  settingValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: spacing.md,
  },
  secondaryButton: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  savedBody: {
    flex: 1,
    marginHorizontal: spacing.md,
  },
  savedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  savedMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  heart: {
    fontSize: 18,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  activityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
    marginRight: spacing.md,
  },
  activityBody: {
    flex: 1,
  },
  activityLabel: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  activityType: {
    fontSize: 11,
    color: colors.textMuted,
  },
  footnote: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.85,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(9, 22, 30, 0.5)',
  },
  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    maxHeight: '90%',
  },
});
