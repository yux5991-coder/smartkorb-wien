/**
 * The week planner.
 *
 * Given the people eating at home, a budget, how much time there is to cook and
 * how often the user is willing to go shopping, this builds a seven-day plan and
 * the shopping list that goes with it — and it really computes it: recipes are
 * filtered against the combined restrictions of everyone selected, chosen under
 * the budget, and the purchases are spread over at most N stores by a greedy
 * search that only opens another store when the saving is worth the trip.
 *
 * Pure module — no data imports and no React Native — so it runs in tests.
 */
import type {
  Allergen,
  DietPreference,
  FamilyMember,
  PlanDay,
  PlanSettings,
  PlanWarning,
  Product,
  Recipe,
  ShoppingItem,
  Store,
  StoreBasket,
  WeekPlan,
} from '../types';
import { packsFor } from './packMath';

/** Everything the planner needs to know about the catalogue. */
export interface PlannerCatalog {
  recipes: Recipe[];
  productById: Map<string, Product>;
  /** Candidate branches to shop in — one per chain is enough for a week plan. */
  stores: Store[];
  /** Pack price of a product in a branch, plus the discount it carries there. */
  priceAt: (storeId: string, productId: string) => { price: number; discountPercent?: number };
}

/** Opening another store has to save at least this much to be worth the trip. */
export const TRIP_SAVINGS_THRESHOLD = 3;

const MAX_COOKING_MINUTES: Record<PlanSettings['cookingTime'], number> = {
  fast: 30,
  medium: 50,
  long: Number.POSITIVE_INFINITY,
};

/** A repeat is allowed only after this many days. */
const MIN_REPEAT_GAP = 3;

const DAYS = 7;

/** Deterministic PRNG: the same settings always produce the same plan. */
const seededRandom = (seed: number) => {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const DIET_STRICTNESS: Record<DietPreference, number> = { omnivor: 0, vegetarisch: 1, vegan: 2 };

/** The plan has to work for everyone, so the strictest diet and every allergy win. */
export const combineRestrictions = (
  members: FamilyMember[],
): { diet: DietPreference; allergies: Allergen[] } => {
  let diet: DietPreference = 'omnivor';
  const allergies = new Set<Allergen>();

  members.forEach((member) => {
    member.dietaryPreferences.forEach((preference) => {
      if (DIET_STRICTNESS[preference] > DIET_STRICTNESS[diet]) diet = preference;
    });
    member.allergies.forEach((allergen) => allergies.add(allergen));
  });

  return { diet, allergies: Array.from(allergies) };
};

export const eligibleRecipes = (
  recipes: Recipe[],
  members: FamilyMember[],
  cookingTime: PlanSettings['cookingTime'],
): Recipe[] => {
  const { diet, allergies } = combineRestrictions(members);
  const maxMinutes = MAX_COOKING_MINUTES[cookingTime];

  return recipes.filter(
    (recipe) =>
      recipe.dietTags.includes(diet) &&
      allergies.every((allergen) => recipe.allergenFree.includes(allergen)) &&
      recipe.cookingTimeMin <= maxMinutes,
  );
};

/** Grams of every product the week needs, scaled to the number of eaters. */
const aggregateIngredients = (
  days: PlanDay[],
  recipeById: Map<string, Recipe>,
): Map<string, number> => {
  const totals = new Map<string, number>();

  days.forEach((day) => {
    const recipe = recipeById.get(day.recipeId);
    if (!recipe) return;
    const factor = day.servings / Math.max(1, recipe.servings);
    recipe.ingredients.forEach((ingredient) => {
      const grams = ingredient.grams * factor;
      totals.set(ingredient.productId, (totals.get(ingredient.productId) ?? 0) + grams);
    });
  });

  return totals;
};

/** Proportional cost of one recipe at the cheapest price we can find anywhere. */
const recipeCost = (
  recipe: Recipe,
  servings: number,
  catalog: PlannerCatalog,
  cheapestUnitPrice: Map<string, number>,
): number => {
  const factor = servings / Math.max(1, recipe.servings);
  return recipe.ingredients.reduce((sum, ingredient) => {
    const product = catalog.productById.get(ingredient.productId);
    if (!product) return sum;
    const unit = cheapestUnitPrice.get(product.id) ?? product.basePrice / Math.max(1, product.baseGrams);
    return sum + unit * ingredient.grams * factor;
  }, 0);
};

/** Cheapest price per gram of every product across the candidate branches. */
const buildCheapestUnitPrices = (catalog: PlannerCatalog): Map<string, number> => {
  const cheapest = new Map<string, number>();

  catalog.productById.forEach((product) => {
    let best = product.basePrice;
    catalog.stores.forEach((store) => {
      const { price } = catalog.priceAt(store.id, product.id);
      if (price < best) best = price;
    });
    cheapest.set(product.id, best / Math.max(1, product.baseGrams));
  });

  return cheapest;
};

/**
 * Spreads the shopping list over at most `maxTrips` branches.
 *
 * Greedy: start in the branch where the whole list is cheapest, then keep adding
 * the branch that saves the most — but only while that saving is worth another
 * trip. Every item then goes to the cheapest of the opened branches.
 */
export const assignToStores = (
  totals: Map<string, number>,
  catalog: PlannerCatalog,
  maxTrips: number,
): { baskets: StoreBasket[]; singleStoreTotal: number } => {
  const items = Array.from(totals.entries())
    .map(([productId, grams]) => ({ productId, grams, product: catalog.productById.get(productId) }))
    .filter((entry): entry is { productId: string; grams: number; product: Product } =>
      Boolean(entry.product),
    );

  const packsOf = new Map(
    items.map((item) => [item.productId, packsFor(item.grams, item.product.baseGrams)]),
  );

  const costAt = (storeId: string, productId: string): number =>
    (packsOf.get(productId) ?? 1) * catalog.priceAt(storeId, productId).price;

  const storeTotal = (storeId: string): number =>
    items.reduce((sum, item) => sum + costAt(storeId, item.productId), 0);

  const candidates = catalog.stores.map((store) => ({ store, total: storeTotal(store.id) }));
  if (candidates.length === 0) return { baskets: [], singleStoreTotal: 0 };

  candidates.sort((a, b) => a.total - b.total);
  const singleStoreTotal = candidates[0].total;

  const opened: Store[] = [candidates[0].store];
  const bestSoFar = new Map(
    items.map((item) => [item.productId, costAt(candidates[0].store.id, item.productId)]),
  );

  while (opened.length < Math.max(1, maxTrips)) {
    let bestCandidate: { store: Store; savings: number } | null = null;

    candidates.forEach(({ store }) => {
      if (opened.some((open) => open.id === store.id)) return;
      const savings = items.reduce((sum, item) => {
        const current = bestSoFar.get(item.productId) ?? 0;
        const here = costAt(store.id, item.productId);
        return sum + Math.max(0, current - here);
      }, 0);
      if (!bestCandidate || savings > bestCandidate.savings) bestCandidate = { store, savings };
    });

    const choice = bestCandidate as { store: Store; savings: number } | null;
    if (!choice || choice.savings < TRIP_SAVINGS_THRESHOLD) break;

    opened.push(choice.store);
    items.forEach((item) => {
      const here = costAt(choice.store.id, item.productId);
      if (here < (bestSoFar.get(item.productId) ?? Number.POSITIVE_INFINITY)) {
        bestSoFar.set(item.productId, here);
      }
    });
  }

  const byStore = new Map<string, ShoppingItem[]>();
  items.forEach((item) => {
    let chosen = opened[0];
    let chosenCost = costAt(chosen.id, item.productId);
    opened.slice(1).forEach((store) => {
      const cost = costAt(store.id, item.productId);
      if (cost < chosenCost) {
        chosen = store;
        chosenCost = cost;
      }
    });

    const packs = packsOf.get(item.productId) ?? 1;
    const { price, discountPercent } = catalog.priceAt(chosen.id, item.productId);
    const entry: ShoppingItem = {
      productId: item.productId,
      grams: Math.round(item.grams),
      packs,
      packPrice: price,
      lineTotal: packs * price,
      leftoverGrams: Math.max(0, Math.round(packs * item.product.baseGrams - item.grams)),
      ...(discountPercent ? { discountPercent } : {}),
    };

    const list = byStore.get(chosen.id);
    if (list) list.push(entry);
    else byStore.set(chosen.id, [entry]);
  });

  const baskets: StoreBasket[] = opened
    .filter((store) => (byStore.get(store.id) ?? []).length > 0)
    .map((store) => {
      const basketItems = byStore.get(store.id) ?? [];
      return {
        storeId: store.id,
        retailerId: store.retailerId,
        items: basketItems.sort((a, b) => b.lineTotal - a.lineTotal),
        total: basketItems.reduce((sum, item) => sum + item.lineTotal, 0),
      };
    });

  return { baskets, singleStoreTotal };
};

/**
 * Leftovers: a pack bought for 200 g of a 1 kg bag leaves 800 g. Look for
 * another eligible recipe that uses them up; if there is none, say so — knowing
 * about the leftover is worth something on its own.
 */
const MAX_LEFTOVER_WARNINGS = 6;

const leftoverWarnings = (
  baskets: StoreBasket[],
  catalog: PlannerCatalog,
  eligible: Recipe[],
  usedRecipeIds: Set<string>,
  servings: number,
): PlanWarning[] => {
  const warnings: (PlanWarning & { wastedValue: number })[] = [];

  baskets.forEach((basket) => {
    basket.items.forEach((item) => {
      const product = catalog.productById.get(item.productId);
      if (!product) return;
      const significant = Math.max(100, product.baseGrams * 0.4);
      if (item.leftoverGrams < significant) return;

      const bonus = eligible.find((recipe) => {
        if (usedRecipeIds.has(recipe.id)) return false;
        const ingredient = recipe.ingredients.find((entry) => entry.productId === item.productId);
        if (!ingredient) return false;
        const factor = servings / Math.max(1, recipe.servings);
        return ingredient.grams * factor <= item.leftoverGrams;
      });

      // rank by the money sitting in the leftover, not by grams: 800 g of flour
      // matters less than 200 g of cheese
      const wastedValue = (item.packPrice / Math.max(1, product.baseGrams)) * item.leftoverGrams;

      warnings.push(
        bonus
          ? {
              kind: 'leftover-used',
              productId: item.productId,
              recipeId: bonus.id,
              grams: item.leftoverGrams,
              wastedValue,
            }
          : {
              kind: 'leftover',
              productId: item.productId,
              grams: item.leftoverGrams,
              wastedValue,
            },
      );
    });
  });

  return warnings
    .sort((a, b) => b.wastedValue - a.wastedValue)
    .slice(0, MAX_LEFTOVER_WARNINGS)
    .map(({ wastedValue: _ignored, ...warning }) => warning);
};

export interface PlanInput {
  catalog: PlannerCatalog;
  members: FamilyMember[];
  settings: PlanSettings;
}

export const generateWeekPlan = ({ catalog, members, settings }: PlanInput): WeekPlan => {
  const selected = members.filter((member) => settings.memberIds.includes(member.id));
  const servings = Math.max(1, selected.length);
  const random = seededRandom(
    settings.seed + settings.memberIds.length * 7919 + Math.round(settings.weeklyBudget) * 31 +
      settings.maxShoppingTrips * 101 + settings.cookingTime.length,
  );

  const eligible = eligibleRecipes(catalog.recipes, selected, settings.cookingTime);
  const recipeById = new Map(catalog.recipes.map((recipe) => [recipe.id, recipe]));
  const warnings: PlanWarning[] = [];

  if (eligible.length === 0) {
    return {
      id: `plan-${settings.seed}`,
      createdAt: new Date().toISOString(),
      settings,
      memberIds: settings.memberIds,
      days: [],
      baskets: [],
      total: 0,
      singleStoreTotal: 0,
      savings: 0,
      withinBudget: true,
      warnings: [{ kind: 'no-recipes' }],
    };
  }
  if (eligible.length < DAYS) warnings.push({ kind: 'few-recipes', amount: eligible.length });

  const cheapestUnitPrice = buildCheapestUnitPrices(catalog);
  const costOf = new Map(
    eligible.map((recipe) => [
      recipe.id,
      recipeCost(recipe, servings, catalog, cheapestUnitPrice),
    ]),
  );

  // cheap first, but shuffled enough that two different weeks do not look identical
  const ranked = eligible
    .map((recipe) => ({
      recipe,
      score: (costOf.get(recipe.id) ?? 0) * (0.75 + random() * 0.5),
    }))
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.recipe);

  const pickDay = (dayIndex: number, chosen: Recipe[]): Recipe => {
    const recent = chosen.slice(Math.max(0, dayIndex - MIN_REPEAT_GAP));
    const fresh = ranked.find(
      (recipe) =>
        !chosen.some((used) => used.id === recipe.id) &&
        !recent.some((used) => used.id === recipe.id),
    );
    if (fresh) return fresh;
    const notRecent = ranked.find((recipe) => !recent.some((used) => used.id === recipe.id));
    return notRecent ?? ranked[0];
  };

  const chosen: Recipe[] = [];
  for (let dayIndex = 0; dayIndex < DAYS; dayIndex++) {
    chosen.push(pickDay(dayIndex, chosen));
  }

  const buildDays = (recipes: Recipe[]): PlanDay[] =>
    recipes.map((recipe, dayIndex) => ({
      dayIndex,
      recipeId: recipe.id,
      servings,
      cost: recipeCost(recipe, servings, catalog, cheapestUnitPrice),
    }));

  let days = buildDays(chosen);
  let assignment = assignToStores(
    aggregateIngredients(days, recipeById),
    catalog,
    settings.maxShoppingTrips,
  );
  let total = assignment.baskets.reduce((sum, basket) => sum + basket.total, 0);

  // Over budget: swap the most expensive day for the cheapest recipe not in the
  // plan yet, until it fits or nothing is left to swap.
  const cheapestFirst = [...eligible].sort(
    (a, b) => (costOf.get(a.id) ?? 0) - (costOf.get(b.id) ?? 0),
  );
  for (let attempt = 0; attempt < DAYS && total > settings.weeklyBudget; attempt++) {
    const current = [...chosen];
    const worstIndex = current.reduce(
      (worst, recipe, index) =>
        (costOf.get(recipe.id) ?? 0) > (costOf.get(current[worst].id) ?? 0) ? index : worst,
      0,
    );
    const replacement = cheapestFirst.find(
      (recipe) =>
        !current.some((used) => used.id === recipe.id) &&
        (costOf.get(recipe.id) ?? 0) < (costOf.get(current[worstIndex].id) ?? 0),
    );
    if (!replacement) break;

    current[worstIndex] = replacement;
    chosen.splice(0, chosen.length, ...current);
    days = buildDays(current);
    assignment = assignToStores(
      aggregateIngredients(days, recipeById),
      catalog,
      settings.maxShoppingTrips,
    );
    total = assignment.baskets.reduce((sum, basket) => sum + basket.total, 0);
  }

  const withinBudget = total <= settings.weeklyBudget;
  if (!withinBudget) {
    warnings.push({ kind: 'over-budget', amount: Number((total - settings.weeklyBudget).toFixed(2)) });
  }

  warnings.push(
    ...leftoverWarnings(
      assignment.baskets,
      catalog,
      eligible,
      new Set(chosen.map((recipe) => recipe.id)),
      servings,
    ),
  );

  return {
    id: `plan-${settings.seed}-${settings.memberIds.join('.')}`,
    createdAt: new Date().toISOString(),
    settings,
    memberIds: settings.memberIds,
    days,
    baskets: assignment.baskets,
    total: Number(total.toFixed(2)),
    singleStoreTotal: Number(assignment.singleStoreTotal.toFixed(2)),
    savings: Number(Math.max(0, assignment.singleStoreTotal - total).toFixed(2)),
    withinBudget,
    warnings,
  };
};
