import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

import { ShoppingListSheet } from '../components/AiResultSheets';
import { BottomSheet } from '../components/BottomSheet';
import { Chip } from '../components/Chip';
import { FamilyMemberSheet } from '../components/FamilyMemberSheet';
import { OnboardingForm } from '../components/OnboardingModal';
import { PremiumBadge } from '../components/PremiumBadge';
import { RecipeCard } from '../components/RecipeCard';
import { RecipeDetailSheet } from '../components/RecipeDetailSheet';
import { RetailerLogo } from '../components/RetailerLogo';
import { ScreenHeader } from '../components/ScreenHeader';
import { getProduct, getRetailer, getStore, useCatalog } from '../data';
import {
  allergenLabel,
  dietLabel,
  productName,
  recipeTitle,
  useLanguage,
  useT,
} from '../i18n';
import { buildShoppingList, type ShoppingList } from '../services/ai';
import { generateWeekPlan } from '../services/planner';
import { buildPlannerCatalog, currentWeekSeed } from '../services/plannerCatalog';
import { useProfileStore } from '../store/useProfileStore';
import { colors, radius, shadow, spacing } from '../theme';
import type { CookingTimeBudget, FamilyMember, PlanWarning, Recipe, WeekPlan } from '../types';
import { formatAmount, formatGrams, formatPrice } from '../utils/format';

const TIME_OPTIONS: { value: CookingTimeBudget; key: 'time.fast' | 'time.medium' | 'time.long' }[] = [
  { value: 'fast', key: 'time.fast' },
  { value: 'medium', key: 'time.medium' },
  { value: 'long', key: 'time.long' },
];

const WEEKDAY_KEYS = [
  'weekday.0',
  'weekday.1',
  'weekday.2',
  'weekday.3',
  'weekday.4',
  'weekday.5',
  'weekday.6',
] as const;

export const PlannerScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const t = useT();
  const language = useLanguage();

  const {
    hydrated,
    onboardingStatus,
    dietPreference,
    allergies,
    budgetPerPortion,
    members,
    planSettings,
    savedRecipeIds,
    completeOnboarding,
    skipOnboarding,
    addMember,
    updateMember,
    removeMember,
    setPlanSettings,
    savePlan,
    toggleSavedRecipe,
    logActivity,
  } = useProfileStore();

  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(planSettings?.memberIds ?? []);
  const [budget, setBudget] = useState(String(planSettings?.weeklyBudget ?? 80));
  const [cookingTime, setCookingTime] = useState<CookingTimeBudget>(
    planSettings?.cookingTime ?? 'medium',
  );
  const [trips, setTrips] = useState(planSettings?.maxShoppingTrips ?? 2);

  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [planStored, setPlanStored] = useState(false);

  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [memberSheetVisible, setMemberSheetVisible] = useState(false);
  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null);
  const [recipesVisible, setRecipesVisible] = useState(false);

  const [dishQuery, setDishQuery] = useState('');
  const [listVisible, setListVisible] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [shoppingList, setShoppingList] = useState<ShoppingList | null>(null);

  // The questionnaire describes the first family member; it appears once.
  useEffect(() => {
    if (hydrated && onboardingStatus === 'pending') setOnboardingVisible(true);
  }, [hydrated, onboardingStatus]);

  // Everyone is in by default; a member who is away is unchecked by the user.
  useEffect(() => {
    if (members.length > 0 && selectedIds.length === 0) {
      setSelectedIds(members.map((member) => member.id));
    }
  }, [members, selectedIds.length]);

  const plannerCatalog = useMemo(() => buildPlannerCatalog(catalog), [catalog]);
  const recipeById = useMemo(
    () => new Map(catalog.recipes.map((recipe) => [recipe.id, recipe])),
    [catalog.recipes],
  );

  const toggleMember = (id: string) =>
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  const runPlanner = useCallback(() => {
    if (selectedIds.length === 0) return;
    const settings = {
      memberIds: selectedIds,
      weeklyBudget: Number(budget.replace(',', '.')) || 80,
      cookingTime,
      maxShoppingTrips: trips,
    };
    setPlanSettings(settings);
    setGenerating(true);
    setPlanStored(false);
    logActivity('ai_request', t('planner.generate'));

    // let the button paint its pressed state before the synchronous work
    setTimeout(() => {
      const result = generateWeekPlan({
        catalog: plannerCatalog,
        members,
        settings: { ...settings, seed: currentWeekSeed() + (plan ? Date.now() % 1000 : 0) },
      });
      setPlan(result);
      setGenerating(false);
    }, 30);
  }, [
    budget,
    cookingTime,
    logActivity,
    members,
    plan,
    plannerCatalog,
    selectedIds,
    setPlanSettings,
    t,
    trips,
  ]);

  const runShoppingList = async () => {
    const query = dishQuery.trim();
    if (query.length === 0) return;
    setListVisible(true);
    setListLoading(true);
    logActivity('ai_request', query);
    const result = await buildShoppingList(catalog, query, useProfileStore.getState());
    setShoppingList(result);
    setListLoading(false);
  };

  const warningText = (warning: PlanWarning): string => {
    const product = warning.productId ? getProduct(catalog, warning.productId) : undefined;
    const recipe = warning.recipeId ? recipeById.get(warning.recipeId) : undefined;
    switch (warning.kind) {
      case 'no-recipes':
        return t('warning.noRecipes');
      case 'few-recipes':
        return t('warning.fewRecipes', { amount: warning.amount ?? 0 });
      case 'over-budget':
        return t('warning.overBudget', { amount: formatPrice(warning.amount ?? 0) });
      case 'leftover-used':
        return t('warning.leftoverUsed', {
          grams: formatGrams(warning.grams ?? 0),
          product: product ? productName(product, language) : '',
          recipe: recipe ? recipeTitle(recipe, language) : '',
        });
      default:
        return t('warning.leftover', {
          grams: formatGrams(warning.grams ?? 0),
          product: product ? productName(product, language) : '',
        });
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader title={t('planner.title')} subtitle={t('planner.subtitle')} />

        {/* --- who is eating ------------------------------------------------ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('planner.whoEats')}</Text>

          {members.length === 0 ? (
            <Text style={styles.hint}>{t('planner.noMembers')}</Text>
          ) : (
            members.map((member) => {
              const selected = selectedIds.includes(member.id);
              const restrictions = [
                ...member.dietaryPreferences.map((diet) => dietLabel(diet, language)),
                ...member.allergies.map((allergen) => allergenLabel(allergen, language)),
              ];
              return (
                <View key={member.id} style={styles.memberRow}>
                  <Pressable
                    onPress={() => toggleMember(member.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    style={styles.memberSelect}
                  >
                    <View style={[styles.checkbox, selected && styles.checkboxOn]}>
                      {selected ? <Text style={styles.checkboxMark}>✓</Text> : null}
                    </View>
                    <View style={styles.memberText}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.memberMeta} numberOfLines={1}>
                        {restrictions.length > 0 ? restrictions.join(' · ') : '—'}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setEditingMember(member);
                      setMemberSheetVisible(true);
                    }}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t('planner.editMember')}
                  >
                    <Text style={styles.editIcon}>✎</Text>
                  </Pressable>
                </View>
              );
            })
          )}

          <Pressable
            onPress={() => {
              setEditingMember(null);
              setMemberSheetVisible(true);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>+ {t('planner.addMember')}</Text>
          </Pressable>
        </View>

        {/* --- settings ----------------------------------------------------- */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('planner.budget')}</Text>
          <View style={styles.budgetRow}>
            <TextInput
              style={styles.budgetInput}
              value={budget}
              onChangeText={setBudget}
              keyboardType="numeric"
              accessibilityLabel={t('planner.budget')}
            />
            <Text style={styles.budgetCurrency}>€</Text>
          </View>

          <Text style={[styles.cardTitle, styles.sectionSpacing]}>{t('planner.time')}</Text>
          <View style={styles.chipRow}>
            {TIME_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={t(option.key)}
                selected={cookingTime === option.value}
                onPress={() => setCookingTime(option.value)}
              />
            ))}
          </View>

          <Text style={[styles.cardTitle, styles.sectionSpacing]}>{t('planner.trips')}</Text>
          <View style={styles.chipRow}>
            {[1, 2, 3].map((count) => (
              <Chip
                key={count}
                label={t('planner.tripsValue', { count })}
                selected={trips === count}
                onPress={() => setTrips(count)}
              />
            ))}
          </View>

          <Pressable
            onPress={runPlanner}
            disabled={selectedIds.length === 0 || generating}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.primaryButton,
              (selectedIds.length === 0 || generating) && styles.buttonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {generating
                ? t('planner.generating')
                : plan
                  ? t('planner.regenerate')
                  : t('planner.generate')}
            </Text>
          </Pressable>
          {selectedIds.length === 0 ? (
            <Text style={styles.hint}>{t('planner.selectAtLeastOne')}</Text>
          ) : null}
        </View>

        {/* --- result ------------------------------------------------------- */}
        {plan && plan.days.length > 0 ? (
          <>
            <View style={styles.card}>
              <View style={styles.summaryRow}>
                <View>
                  <Text style={styles.summaryValue}>{formatPrice(plan.total)}</Text>
                  <Text style={styles.summaryLabel}>{t('planner.total')}</Text>
                </View>
                <View>
                  <Text style={styles.summaryValue}>{formatPrice(plan.singleStoreTotal)}</Text>
                  <Text style={styles.summaryLabel}>{t('planner.singleStore')}</Text>
                </View>
                <View>
                  <Text style={[styles.summaryValue, { color: colors.accent }]}>
                    {formatPrice(plan.savings)}
                  </Text>
                  <Text style={styles.summaryLabel}>{t('planner.savings')}</Text>
                </View>
              </View>

              <View
                style={[styles.budgetBadge, plan.withinBudget ? styles.badgeOk : styles.badgeOver]}
              >
                <Text style={[styles.badgeText, !plan.withinBudget && styles.badgeTextOver]}>
                  {plan.withinBudget
                    ? t('planner.budgetOk')
                    : t('planner.budgetOver', {
                        amount: formatPrice(plan.total - plan.settings.weeklyBudget),
                      })}
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  savePlan(plan);
                  setPlanStored(true);
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryButtonText}>
                  {planStored ? t('planner.planSaved') : t('planner.savePlan')}
                </Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('planner.week')}</Text>
              {plan.days.map((day) => {
                const recipe = recipeById.get(day.recipeId);
                if (!recipe) return null;
                return (
                  <Pressable
                    key={`${day.dayIndex}-${day.recipeId}`}
                    onPress={() => setDetailRecipe(recipe)}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.dayRow, pressed && styles.pressed]}
                  >
                    <Text style={styles.dayEmoji}>{recipe.emoji}</Text>
                    <View style={styles.dayBody}>
                      <Text style={styles.dayName}>{t(WEEKDAY_KEYS[day.dayIndex])}</Text>
                      <Text style={styles.dayRecipe} numberOfLines={2}>
                        {recipeTitle(recipe, language)}
                      </Text>
                      <Text style={styles.dayMeta}>
                        {t('kitchen.minutes', { count: recipe.cookingTimeMin })} ·{' '}
                        {t('kitchen.servings', { count: day.servings })}
                      </Text>
                    </View>
                    <Text style={styles.dayCost}>{formatPrice(day.cost)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('planner.shoppingList')}</Text>
              {plan.baskets.map((basket, index) => {
                const store = getStore(catalog, basket.storeId);
                const retailer = getRetailer(catalog, basket.retailerId);
                return (
                  <View key={basket.storeId} style={styles.basket}>
                    <View style={styles.basketHeader}>
                      {retailer ? <RetailerLogo retailer={retailer} size={28} /> : null}
                      <View style={styles.basketHeaderText}>
                        <Text style={styles.basketTitle}>
                          {t('planner.tripLabel', {
                            index: index + 1,
                            retailer: retailer?.name ?? '',
                          })}
                        </Text>
                        <Text style={styles.basketMeta} numberOfLines={1}>
                          {store ? `${store.name} · ${store.district}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.basketTotal}>{formatPrice(basket.total)}</Text>
                    </View>

                    {basket.items.map((item) => {
                      const product = getProduct(catalog, item.productId);
                      if (!product) return null;
                      return (
                        <View key={item.productId} style={styles.itemRow}>
                          <Text style={styles.itemEmoji}>{product.emoji}</Text>
                          <View style={styles.itemBody}>
                            <Text style={styles.itemName}>{productName(product, language)}</Text>
                            <Text style={styles.itemMeta}>
                              {t('kitchen.needed', {
                                amount: formatAmount(item.grams, product),
                              })}{' '}
                              · {item.packs} × {product.unit}
                            </Text>
                          </View>
                          <View style={styles.itemRight}>
                            <Text style={styles.itemPrice}>{formatPrice(item.lineTotal)}</Text>
                            {item.discountPercent ? (
                              <Text style={styles.itemDiscount}>−{item.discountPercent} %</Text>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>

            {plan.warnings.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('planner.warnings')}</Text>
                {plan.warnings.map((warning, index) => (
                  <View key={`${warning.kind}-${warning.productId ?? index}`} style={styles.warningRow}>
                    <Text style={styles.warningIcon}>
                      {warning.kind === 'leftover-used' ? '♻︎' : '⚠︎'}
                    </Text>
                    <Text style={styles.warningText}>{warningText(warning)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        {plan && plan.days.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.warningText}>{t('warning.noRecipes')}</Text>
          </View>
        ) : null}

        {/* --- one specific dish -------------------------------------------- */}
        <View style={styles.card}>
          <View style={styles.aiHeader}>
            <Text style={styles.cardTitle}>{t('planner.reverse')}</Text>
            <PremiumBadge label={t('common.premium')} />
          </View>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={dishQuery}
              onChangeText={setDishQuery}
              placeholder={t('kitchen.dishPlaceholder')}
              placeholderTextColor={colors.textMuted}
              returnKeyType="send"
              onSubmitEditing={runShoppingList}
              accessibilityLabel={t('kitchen.dishPlaceholder')}
            />
            <Pressable
              onPress={runShoppingList}
              accessibilityRole="button"
              accessibilityLabel={t('kitchen.calcIngredients')}
              style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}
            >
              <Text style={styles.sendButtonText}>→</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => setRecipesVisible(true)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>{t('planner.browseRecipes')}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <FamilyMemberSheet
        visible={memberSheetVisible}
        member={editingMember}
        onClose={() => setMemberSheetVisible(false)}
        onSave={(input) => {
          if (editingMember) {
            updateMember(editingMember.id, input);
          } else {
            addMember(input);
            // a newly added person eats with the family unless unchecked
            const known = new Set(members.map((member) => member.id));
            setTimeout(() => {
              const added = useProfileStore
                .getState()
                .members.filter((member) => !known.has(member.id));
              if (added.length > 0) {
                setSelectedIds((current) => [...current, ...added.map((member) => member.id)]);
              }
            }, 0);
          }
          setMemberSheetVisible(false);
        }}
        onDelete={
          editingMember
            ? () => {
                removeMember(editingMember.id);
                setSelectedIds((current) => current.filter((id) => id !== editingMember.id));
                setMemberSheetVisible(false);
              }
            : undefined
        }
      />

      <RecipeDetailSheet
        recipe={detailRecipe}
        visible={detailRecipe !== null}
        saved={detailRecipe ? savedRecipeIds.includes(detailRecipe.id) : false}
        onClose={() => setDetailRecipe(null)}
        onToggleSave={() => detailRecipe && toggleSavedRecipe(detailRecipe.id)}
      />

      <ShoppingListSheet
        visible={listVisible}
        loading={listLoading}
        list={shoppingList}
        onClose={() => setListVisible(false)}
      />

      <BottomSheet
        visible={recipesVisible}
        onClose={() => setRecipesVisible(false)}
        title={t('planner.browseRecipes')}
        subtitle={t('kitchen.recipes', { count: catalog.recipes.length })}
      >
        <FlatList
          data={catalog.recipes}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.recipeColumn}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <RecipeCard
              recipe={item}
              saved={savedRecipeIds.includes(item.id)}
              onPress={() => {
                setRecipesVisible(false);
                setDetailRecipe(item);
              }}
              onToggleSave={() => toggleSavedRecipe(item.id)}
            />
          )}
        />
      </BottomSheet>

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
  screen: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  sectionSpacing: { marginTop: spacing.md },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginTop: spacing.sm },

  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  memberSelect: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxMark: { color: colors.textInverse, fontSize: 13, fontWeight: '800' },
  memberText: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: '700', color: colors.text },
  memberMeta: { fontSize: 12, color: colors.textMuted },
  editIcon: { fontSize: 16, color: colors.primary, paddingHorizontal: spacing.sm },

  budgetRow: { flexDirection: 'row', alignItems: 'center' },
  budgetInput: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  budgetCurrency: { fontSize: 16, fontWeight: '800', color: colors.text, marginLeft: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },

  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  primaryButtonText: { color: colors.textInverse, fontWeight: '800', fontSize: 15 },
  buttonDisabled: { opacity: 0.5 },
  secondaryButton: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryValue: { fontSize: 16, fontWeight: '800', color: colors.primaryDark },
  summaryLabel: { fontSize: 11, color: colors.textMuted, maxWidth: 110 },
  budgetBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    marginTop: spacing.md,
  },
  badgeOk: { backgroundColor: colors.primarySoft },
  badgeOver: { backgroundColor: '#FDEDEF' },
  badgeText: { fontSize: 12, fontWeight: '800', color: colors.primaryDark },
  badgeTextOver: { color: colors.danger },

  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  dayEmoji: { fontSize: 22, marginRight: spacing.md },
  dayBody: { flex: 1 },
  dayName: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dayRecipe: { fontSize: 14, fontWeight: '700', color: colors.text },
  dayMeta: { fontSize: 11, color: colors.textMuted },
  dayCost: { fontSize: 14, fontWeight: '800', color: colors.text, marginLeft: spacing.sm },

  basket: { marginBottom: spacing.lg },
  basketHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  basketHeaderText: { flex: 1, marginLeft: spacing.md },
  basketTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  basketMeta: { fontSize: 11, color: colors.textMuted },
  basketTotal: { fontSize: 15, fontWeight: '800', color: colors.primaryDark },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  itemEmoji: { fontSize: 16, marginRight: spacing.sm },
  itemBody: { flex: 1 },
  itemName: { fontSize: 13, fontWeight: '600', color: colors.text },
  itemMeta: { fontSize: 11, color: colors.textMuted },
  itemRight: { alignItems: 'flex-end' },
  itemPrice: { fontSize: 13, fontWeight: '700', color: colors.text },
  itemDiscount: { fontSize: 10, fontWeight: '800', color: colors.danger },

  warningRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 5 },
  warningIcon: { fontSize: 13, marginRight: spacing.sm, color: colors.accent },
  warningText: { flex: 1, fontSize: 12, color: colors.textMuted, lineHeight: 17 },

  aiHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
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
  sendButtonText: { color: colors.textInverse, fontSize: 20, fontWeight: '800' },
  recipeColumn: { justifyContent: 'space-between' },

  pressed: { opacity: 0.85 },
  modalRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(9, 22, 30, 0.5)' },
  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    maxHeight: '90%',
  },
});
