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

import { getActiveDiscountViews, getProduct, recipes } from '../data';
import type { Allergen, Product, Recipe, UserProfile } from '../types';
import { priceForAmount } from '../utils/format';
import { allergenLabels } from '../utils/labels';
import { costRecipe, discountCoverage, type CostedIngredient, type RecipeCost } from './pricing';

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
  total: number;
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
export const suggestDishes = async (profile: UserProfile): Promise<DishSuggestion[]> => {
  await delay(MOCK_LATENCY_MS);

  const personalised = profile.onboardingStatus === 'completed';

  const candidates = recipes
    .filter((recipe) => (personalised ? matchesDiet(recipe, profile) : true))
    .filter((recipe) =>
      personalised ? conflictingAllergens(recipe, profile.allergies).length === 0 : true,
    )
    .map((recipe) => {
      const cost = costRecipe(recipe);
      const coverage = discountCoverage(recipe);
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
      `${Math.round(coverage * 100)} % der Zutaten sind gerade im Angebot`,
    ];
    if (highlight?.offer) {
      parts.push(
        `${highlight.product.name} −${highlight.offer.discountPercent} % bei ${highlight.offer.retailer.name}`,
      );
    }
    if (personalised && profile.budgetPerPortion !== null) {
      parts.push(`Budget ${profile.budgetPerPortion.toFixed(2).replace('.', ',')} € pro Portion beachtet`);
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

const findRecipeByName = (query: string): Recipe | undefined => {
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
  entries: { product: Product; grams: number }[],
): CostedIngredient[] =>
  entries.map(({ product, grams }) => {
    const offer = getActiveDiscountViews()
      .filter((view) => view.productId === product.id)
      .sort((a, b) => a.discountPrice - b.discountPrice)[0];
    const regularPrice = priceForAmount(product.basePrice, product.baseGrams, grams);
    const price = offer
      ? priceForAmount(offer.discountPrice, product.baseGrams, grams)
      : regularPrice;
    return { product, grams, price, regularPrice, offer };
  });

/**
 * "Ich möchte X kochen" — returns the exact ingredient amounts for a dish plus
 * the cheapest store per ingredient.
 */
export const buildShoppingList = async (
  query: string,
  profile: UserProfile,
): Promise<ShoppingList> => {
  await delay(MOCK_LATENCY_MS);

  const recipe = findRecipeByName(query);

  let title: string;
  let servings: number;
  let items: CostedIngredient[];
  let note: string;
  let matchedRecipeId: string | undefined;

  if (recipe) {
    const cost = costRecipe(recipe);
    title = recipe.title;
    servings = recipe.servings;
    items = cost.items;
    matchedRecipeId = recipe.id;
    note = `Aus unserem Rezeptkatalog · ${recipe.cookingTimeMin} Min · ${recipe.servings} Portionen`;
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
      ? (hit.productIds.map(getProduct).filter(Boolean) as Product[])
      : // no keyword hit: take the strongest current offers as a starting basket
        getActiveDiscountViews()
          .slice()
          .sort((a, b) => b.discountPercent - a.discountPercent)
          .map((view) => view.product)
          .filter((product, index, list) => list.findIndex((p) => p.id === product.id) === index)
          .filter(dietFilter)
          .slice(0, 6);

    title = query.trim() || 'Einkaufsliste';
    servings = hit?.servings ?? 4;
    items = buildItemsFromProducts(chosen.map((product) => ({ product, grams: guessAmount(product) })));
    note = hit
      ? `Geschätzte Mengen für ${servings} Portionen — die KI gleicht sie mit den aktuellen Aktionen ab.`
      : 'Kein passendes Rezept gefunden — hier ein Vorschlag aus den stärksten Aktionen dieser Woche.';
  }

  const total = items.reduce((sum, item) => sum + item.price, 0);
  const regularTotal = items.reduce((sum, item) => sum + item.regularPrice, 0);

  const warnings: string[] = [];
  if (profile.onboardingStatus === 'completed') {
    const hits = new Set<Allergen>();
    items.forEach((item) =>
      item.product.allergens.forEach((allergen) => {
        if (profile.allergies.includes(allergen)) hits.add(allergen);
      }),
    );
    hits.forEach((allergen) =>
      warnings.push(`Enthält ${allergenLabels[allergen]} — laut deinem Profil zu vermeiden.`),
    );
    if (profile.dietPreference !== 'omnivor') {
      const nonVegan = items.filter((item) => !item.product.vegan);
      const conflicting =
        profile.dietPreference === 'vegan'
          ? nonVegan
          : nonVegan.filter((item) => item.product.category === 'Fleisch & Fisch');
      if (conflicting.length > 0) {
        warnings.push(
          `Nicht ${profile.dietPreference}: ${conflicting.map((item) => item.product.name).join(', ')}.`,
        );
      }
    }
  }

  return {
    title,
    matchedRecipeId,
    servings,
    items,
    total,
    pricePerPortion: total / Math.max(1, servings),
    savings: Math.max(0, regularTotal - total),
    warnings,
    note,
  };
};

/** Small helper used by the UI to show how many offers feed the assistant. */
export const activeOfferCount = (): number => getActiveDiscountViews().length;
