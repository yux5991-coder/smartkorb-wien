import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { DishSuggestionsSheet, ShoppingListSheet } from '../components/AiResultSheets';
import { Chip } from '../components/Chip';
import { OnboardingForm } from '../components/OnboardingModal';
import { PremiumBadge } from '../components/PremiumBadge';
import { RecipeCard } from '../components/RecipeCard';
import { RecipeDetailSheet } from '../components/RecipeDetailSheet';
import { ScreenHeader } from '../components/ScreenHeader';
import { useCatalog } from '../data';
import { buildShoppingList, suggestDishes, type DishSuggestion, type ShoppingList } from '../services/ai';
import { useProfileStore } from '../store/useProfileStore';
import { colors, radius, shadow, spacing } from '../theme';
import type { DietPreference, Recipe } from '../types';
import { allDiets, dietLabels } from '../utils/labels';

const TIME_FILTERS = [
  { label: 'Alle', value: 0 },
  { label: 'bis 20 Min', value: 20 },
  { label: 'bis 30 Min', value: 30 },
  { label: 'bis 45 Min', value: 45 },
];

export const KulinarikScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();

  const profile = useProfileStore();
  const {
    hydrated,
    onboardingStatus,
    dietPreference,
    allergies,
    budgetPerPortion,
    savedRecipeIds,
    completeOnboarding,
    skipOnboarding,
    toggleSavedRecipe,
    logActivity,
  } = profile;

  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState(0);
  const [dietFilter, setDietFilter] = useState<DietPreference | null>(null);

  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null);
  const [dishQuery, setDishQuery] = useState('');

  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<DishSuggestion[]>([]);

  const [listVisible, setListVisible] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [shoppingList, setShoppingList] = useState<ShoppingList | null>(null);

  const [onboardingVisible, setOnboardingVisible] = useState(false);

  // The questionnaire is shown exactly once — on the first visit to Kulinarik.
  // Afterwards the status lives in AsyncStorage and it can only be re-opened
  // from the profile screen.
  useEffect(() => {
    if (hydrated && onboardingStatus === 'pending') {
      setOnboardingVisible(true);
    }
  }, [hydrated, onboardingStatus]);

  const visibleRecipes = useMemo(
    () =>
      catalog.recipes.filter((recipe) => {
        if (tagFilter && !recipe.tags.includes(tagFilter)) return false;
        if (timeFilter > 0 && recipe.cookingTimeMin > timeFilter) return false;
        if (dietFilter && !recipe.dietTags.includes(dietFilter)) return false;
        return true;
      }),
    [catalog, tagFilter, timeFilter, dietFilter],
  );

  const runSuggestions = async () => {
    setSuggestionsVisible(true);
    setSuggestionsLoading(true);
    logActivity('ai_request', 'Was koche ich?');
    const result = await suggestDishes(catalog, useProfileStore.getState());
    setSuggestions(result);
    setSuggestionsLoading(false);
  };

  const runShoppingList = async () => {
    const query = dishQuery.trim();
    if (query.length === 0) return;
    setListVisible(true);
    setListLoading(true);
    logActivity('ai_request', `Ich möchte kochen: ${query}`);
    const result = await buildShoppingList(catalog, query, useProfileStore.getState());
    setShoppingList(result);
    setListLoading(false);
  };

  const handleToggleSave = (recipe: Recipe) => {
    toggleSavedRecipe(recipe.id);
    if (!savedRecipeIds.includes(recipe.id)) {
      logActivity('recipe_saved', recipe.title);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={visibleRecipes}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            saved={savedRecipeIds.includes(item.id)}
            onPress={() => setDetailRecipe(item)}
            onToggleSave={() => handleToggleSave(item)}
          />
        )}
        ListHeaderComponent={
          <View>
            <ScreenHeader
              title="Kulinarik"
              subtitle="Gerichte, die zu den aktuellen Aktionen passen"
            />

            <View style={styles.aiCard}>
              <View style={styles.aiHeader}>
                <Text style={styles.aiTitle}>KI-Küche</Text>
                <PremiumBadge />
              </View>
              <Text style={styles.aiSubtitle}>
                Vorschläge auf Basis der laufenden Rabatte
                {onboardingStatus === 'completed'
                  ? ' und deines Geschmacksprofils.'
                  : ' — Profil im Reiter „Profil“ einrichten für persönliche Tipps.'}
              </Text>

              <Pressable
                onPress={runSuggestions}
                accessibilityRole="button"
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>Was koche ich?</Text>
              </Pressable>

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={dishQuery}
                  onChangeText={setDishQuery}
                  placeholder="Ich möchte … kochen (z. B. Lasagne)"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="send"
                  onSubmitEditing={runShoppingList}
                  accessibilityLabel="Gericht eingeben"
                />
                <Pressable
                  onPress={runShoppingList}
                  accessibilityRole="button"
                  accessibilityLabel="Zutaten berechnen"
                  style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}
                >
                  <Text style={styles.sendButtonText}>→</Text>
                </Pressable>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Rezepte ({visibleRecipes.length})</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterRow}
            >
              <Chip label="Alle Küchen" selected={tagFilter === null} onPress={() => setTagFilter(null)} compact />
              {catalog.recipeTags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  selected={tagFilter === tag}
                  onPress={() => setTagFilter(tagFilter === tag ? null : tag)}
                  compact
                />
              ))}
            </ScrollView>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterRow}
            >
              {TIME_FILTERS.map((option) => (
                <Chip
                  key={option.label}
                  label={option.label}
                  selected={timeFilter === option.value}
                  onPress={() => setTimeFilter(option.value)}
                  compact
                />
              ))}
              {allDiets
                .filter((diet) => diet !== 'omnivor')
                .map((diet) => (
                  <Chip
                    key={diet}
                    label={dietLabels[diet]}
                    selected={dietFilter === diet}
                    onPress={() => setDietFilter(dietFilter === diet ? null : diet)}
                    compact
                  />
                ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>Keine Rezepte für diese Filterkombination.</Text>
        }
      />

      <RecipeDetailSheet
        recipe={detailRecipe}
        visible={detailRecipe !== null}
        saved={detailRecipe ? savedRecipeIds.includes(detailRecipe.id) : false}
        onClose={() => setDetailRecipe(null)}
        onToggleSave={() => detailRecipe && handleToggleSave(detailRecipe)}
      />

      <DishSuggestionsSheet
        visible={suggestionsVisible}
        loading={suggestionsLoading}
        suggestions={suggestions}
        personalised={onboardingStatus === 'completed'}
        onClose={() => setSuggestionsVisible(false)}
        onOpenRecipe={(recipe) => {
          setSuggestionsVisible(false);
          setDetailRecipe(recipe);
        }}
      />

      <ShoppingListSheet
        visible={listVisible}
        loading={listLoading}
        list={shoppingList}
        onClose={() => setListVisible(false)}
      />

      <Modal
        visible={onboardingVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          skipOnboarding();
          setOnboardingVisible(false);
        }}
      >
        <View style={styles.modalRoot}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + spacing.lg }]}>
            <OnboardingForm
              visible={onboardingVisible}
              initialDiet={dietPreference}
              initialAllergies={allergies}
              initialBudget={budgetPerPortion}
              onSave={(input) => {
                completeOnboarding(input);
                setOnboardingVisible(false);
              }}
              onSkip={() => {
                skipOnboarding();
                setOnboardingVisible(false);
              }}
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
  listContent: {
    paddingHorizontal: spacing.md,
  },
  column: {
    justifyContent: 'space-between',
  },
  aiCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.xs,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  aiSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    lineHeight: 17,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.textInverse,
    fontWeight: '800',
    fontSize: 15,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 14,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  sendButtonText: {
    color: colors.textInverse,
    fontSize: 20,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginLeft: spacing.xs,
    marginBottom: spacing.sm,
  },
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  filterRow: {
    paddingHorizontal: spacing.xs,
  },
  empty: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
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
