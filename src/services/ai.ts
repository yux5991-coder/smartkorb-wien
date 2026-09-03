/**
 * "KI-Küche" — the assistant features of SmartKorb.
 *
 * For the prototype every answer is computed locally from the mock offers and
 * the saved user profile. The algorithms below are deliberately simple but
 * deterministic, so the demo always produces sensible, explainable output.
 *
 * ---------------------------------------------------------------------------
 * REAL INTEGRATION POINT
 * ---------------------------------------------------------------------------
 * Both public functions of this module (`suggestDishes`, `buildShoppingList`)
 * are async and return plain data. To move from mock to a real LLM, keep the
 * signatures and implement `callAI()` below: send the current offers plus the
 * user profile as context and let the model answer in the same JSON shape.
 *
 * TODO(ai): implement and wire up:
 *
 * import { AI_API_KEY, AI_API_URL, AI_MODEL } from '../config';
 *
 * async function callAI<T>(systemPrompt: string, userPrompt: string): Promise<T> {
 *   const response = await fetch(AI_API_URL, {
 *     method: 'POST',
 *     headers: {
 *       'content-type': 'application/json',
 *       'x-api-key': AI_API_KEY,          // never ship the key in the app —
 *     },                                   // proxy the call through our backend
 *     body: JSON.stringify({
 *       model: AI_MODEL,
 *       max_tokens: 1024,
 *       system: systemPrompt,
 *       messages: [{ role: 'user', content: userPrompt }],
 *     }),
 *   });
 *   if (!response.ok) throw new Error(`AI request failed: ${response.status}`);
 *   const payload = await response.json();
 *   return JSON.parse(payload.content[0].text) as T;   // strict JSON contract
 * }
 *
 * The prompt context should contain: getActiveDiscountViews(), the user's
 * dietPreference / allergies / budgetPerPortion and the recipe catalogue.
 */

import { getActiveDiscountViews, getProduct, type CatalogIndex } from '../data';
import type { Allergen, Product, Recipe, UserProfile } from '../types';
import { formatPrice } from '../utils/format';
import { packsFor, usedCostFor } from './packMath';
import { allergenLabel, productName, recipeTitle, translate } from '../i18n';
import {
  costRecipe,
  discountCoverage,
  summariseCost,
  type CostedIngredient,
  type RecipeCost,
} from './pricing';

/** Simulated network latency so the UI shows its loading states. */
const MOCK_LATENCY_MS = 700;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface DishSuggestion {
  recipe: Recipe;
  cost: RecipeCost;
  /** Short German explanation of why this dish was suggested. */
  reason: string;
}

export interface ShoppingList {
  title: string;
  matchedRecipeId?: string;
  servings: number;
  items: CostedIngredient[];
  /** What the basket costs: whole packs. */
  basketTotal: number;
  /** Cost of the amounts the recipe actually uses. */
  usedTotal: number;
  pricePerPortion: number;
  savings: number;
  warnings: string[];
  note: string;
}

const matchesDiet = (recipe: Recipe, profile: UserProfile): boolean =>
  recipe.dietTags.includes(profile.dietPreference);

const conflictingAllergens = (recipe: Recipe, allergies: Allergen[]): Allergen[] =>
  allergies.filter((allergen) => !recipe.allergenFree.includes(allergen));

/**
 * "Was koche ich?" — ranks the recipe catalogue against today's offers and the
 * user's preferences and returns the 3-5 best matches.
 */
export const suggestDishes = async (
  index: CatalogIndex,
  profile: UserProfile,
): Promise<DishSuggestion[]> => {
  await delay(MOCK_LATENCY_MS);

  const lang = profile.language;
  const personalised = profile.onboardingStatus === 'completed';

  const candidates = index.recipes
    .filter((recipe) => (personalised ? matchesDiet(recipe, profile) : true))
    .filter((recipe) =>
      personalised ? conflictingAllergens(recipe, profile.allergies).length === 0 : true,
    )
    .map((recipe) => {
      const cost = costRecipe(index, recipe);
      const coverage = discountCoverage(index, recipe);
      const budget = personalised ? profile.budgetPerPortion : null;
      const withinBudget = budget === null || cost.pricePerPortion <= budget;
      const score =
        coverage * 100 +
        cost.savings * 6 -
        cost.pricePerPortion * 4 +
        (withinBudget ? 25 : -40) +
        (recipe.cookingTimeMin <= 30 ? 6 : 0);
      return { recipe, cost, coverage, withinBudget, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return candidates.map(({ recipe, cost, coverage }) => {
    const discounted = cost.items.filter((item) => item.offer);
    const highlight = discounted
      .slice()
      .sort((a, b) => (b.offer?.discountPercent ?? 0) - (a.offer?.discountPercent ?? 0))[0];

    const parts: string[] = [
      translate(lang, 'ai.reasonCoverage', { percent: Math.round(coverage * 100) }),
    ];
    if (highlight?.offer) {
      parts.push(
        translate(lang, 'ai.reasonHighlight', {
          product: productName(highlight.product, lang),
          percent: highlight.offer.discountPercent,
          retailer: highlight.offer.retailer.name,
        }),
      );
    }
    if (personalised && profile.budgetPerPortion !== null) {
      parts.push(
        translate(lang, 'ai.reasonBudget', {
          budget: formatPrice(profile.budgetPerPortion),
        }),
      );
    }

    return { recipe, cost, reason: parts.join(' · ') };
  });
};

/**
 * Keyword → product hints for dishes that are not in the recipe catalogue.
 * A real LLM would replace this table entirely.
 */
const DISH_KEYWORDS: { keywords: string[]; productIds: string[]; servings: number }[] = [
  { keywords: ['pizza'], productIds: ['p-44', 'p-40', 'p-32', 'p-41', 'p-12'], servings: 4 },
  { keywords: ['lasagne', 'lasagna'], productIds: ['p-17', 'p-40', 'p-24', 'p-27', 'p-06', 'p-44'], servings: 4 },
  { keywords: ['risotto'], productIds: ['p-39', 'p-10', 'p-06', 'p-28', 'p-26'], servings: 4 },
  { keywords: ['schnitzel'], productIds: ['p-18', 'p-44', 'p-31', 'p-35', 'p-05', 'p-13'], servings: 4 },
  { keywords: ['suppe', 'eintopf'], productIds: ['p-07', 'p-06', 'p-05', 'p-42', 'p-41'], servings: 4 },
  { keywords: ['salat', 'bowl'], productIds: ['p-03', 'p-04', 'p-14', 'p-43', 'p-41', 'p-13'], servings: 4 },
  { keywords: ['pfannkuchen', 'palatschinken', 'crepe'], productIds: ['p-44', 'p-24', 'p-31', 'p-26'], servings: 4 },
  { keywords: ['burger'], productIds: ['p-17', 'p-36', 'p-03', 'p-06', 'p-27'], servings: 4 },
  { keywords: ['curry'], productIds: ['p-50', 'p-46', 'p-08', 'p-09', 'p-39'], servings: 4 },
  { keywords: ['pasta', 'nudel', 'spaghetti'], productIds: ['p-38', 'p-40', 'p-06', 'p-12', 'p-41'], servings: 4 },
  { keywords: ['omelett', 'frühstück', 'fruehstueck'], productIds: ['p-31', 'p-24', 'p-27', 'p-35'], servings: 2 },
];

const normalise = (value: string): string =>
  value
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .trim();

const findRecipeByName = (recipes: Recipe[], query: string): Recipe | undefined => {
  const needle = normalise(query);
  if (needle.length < 3) return undefined;
  return (
    recipes.find((recipe) => normalise(recipe.title) === needle) ??
    recipes.find((recipe) => normalise(recipe.title).includes(needle)) ??
    recipes.find((recipe) => needle.includes(normalise(recipe.title))) ??
    recipes.find((recipe) => recipe.tags.some((tag) => normalise(tag) === needle))
  );
};

/** Fallback amounts (in grams) when a dish is not in the catalogue. */
const guessAmount = (product: Product): number => {
  switch (product.category) {
    case 'Fleisch & Fisch':
      return 500;
    case 'Milchprodukte':
      return product.unit.includes('l') ? 300 : 200;
    case 'Obst & Gemüse':
      return 300;
    case 'Vorratskammer':
      return product.name.includes('Öl') ? 30 : 400;
    default:
      return 250;
  }
};

const buildItemsFromProducts = (
  index: CatalogIndex,
  entries: { product: Product; grams: number }[],
): CostedIngredient[] =>
  entries.map(({ product, grams }) => {
    const offer = index.cheapestByProduct.get(product.id);
    const packPrice = offer ? offer.discountPrice : product.basePrice;
    const packs = packsFor(grams, product.baseGrams);
    return {
      product,
      grams,
      packs,
      packPrice,
      packTotal: packs * packPrice,
      regularPackTotal: packs * product.basePrice,
      usedCost: usedCostFor(grams, product.baseGrams, packPrice),
      offer,
    };
  });

/**
 * "Ich möchte X kochen" — returns the exact ingredient amounts for a dish plus
 * the cheapest store per ingredient.
 */
export const buildShoppingList = async (
  index: CatalogIndex,
  query: string,
  profile: UserProfile,
): Promise<ShoppingList> => {
  await delay(MOCK_LATENCY_MS);

  const lang = profile.language;
  const recipe = findRecipeByName(index.recipes, query);

  let title: string;
  let servings: number;
  let items: CostedIngredient[];
  let note: string;
  let matchedRecipeId: string | undefined;

  if (recipe) {
    const cost = costRecipe(index, recipe);
    title = recipeTitle(recipe, lang);
    servings = recipe.servings;
    items = cost.items;
    matchedRecipeId = recipe.id;
    note = translate(lang, 'ai.noteCatalogue', {
      minutes: recipe.cookingTimeMin,
      servings: recipe.servings,
    });
  } else {
    const needle = normalise(query);
    const hit = DISH_KEYWORDS.find((entry) =>
      entry.keywords.some((keyword) => needle.includes(keyword)),
    );
    // the fallback basket respects the diet the user configured
    const dietFilter = (product: Product): boolean => {
      if (profile.onboardingStatus !== 'completed') return true;
      if (profile.dietPreference === 'vegan') return product.vegan;
      if (profile.dietPreference === 'vegetarisch') return product.category !== 'Fleisch & Fisch';
      return true;
    };

    const chosen = hit
      ? (hit.productIds
          .map((productId) => getProduct(index, productId))
          .filter(Boolean) as Product[])
      : // no keyword hit: take the strongest current offers as a starting basket
        getActiveDiscountViews(index)
          .slice()
          .sort((a, b) => b.discountPercent - a.discountPercent)
          .map((view) => view.product)
          .filter((product, index, list) => list.findIndex((p) => p.id === product.id) === index)
          .filter(dietFilter)
          .slice(0, 6);

    title = query.trim() || translate(lang, 'ai.listTitle');
    servings = hit?.servings ?? 4;
    items = buildItemsFromProducts(
      index,
      chosen.map((product) => ({ product, grams: guessAmount(product) })),
    );
    note = hit
      ? translate(lang, 'ai.noteEstimated', { servings })
      : translate(lang, 'ai.noteFallback');
  }

  const cost = summariseCost(items, servings);

  const warnings: string[] = [];
  if (profile.onboardingStatus === 'completed') {
    const hits = new Set<Allergen>();
    items.forEach((item) =>
      item.product.allergens.forEach((allergen) => {
        if (profile.allergies.includes(allergen)) hits.add(allergen);
      }),
    );
    hits.forEach((allergen) =>
      warnings.push(
        translate(lang, 'ai.warnAllergen', { allergen: allergenLabel(allergen, lang) }),
      ),
    );
    if (profile.dietPreference !== 'omnivor') {
      const nonVegan = items.filter((item) => !item.product.vegan);
      const conflicting =
        profile.dietPreference === 'vegan'
          ? nonVegan
          : nonVegan.filter((item) => item.product.category === 'Fleisch & Fisch');
      if (conflicting.length > 0) {
        warnings.push(
          translate(lang, 'ai.warnDiet', {
            diet: profile.dietPreference,
            products: conflicting.map((item) => productName(item.product, lang)).join(', '),
          }),
        );
      }
    }
  }

  return {
    title,
    matchedRecipeId,
    servings,
    items,
    basketTotal: cost.basketTotal,
    usedTotal: cost.usedTotal,
    pricePerPortion: cost.pricePerPortion,
    savings: cost.savings,
    warnings,
    note,
  };
};

/** Small helper used by the UI to show how many offers feed the assistant. */
export const activeOfferCount = (index: CatalogIndex): number => getActiveDiscountViews(index).length;
