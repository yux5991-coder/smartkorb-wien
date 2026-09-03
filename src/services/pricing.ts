/**
 * What a recipe actually costs.
 *
 * Two different numbers matter and they must not be mixed up:
 *
 * - **Einkauf (basket)** — what you pay at the till. Nobody sells 10 g of
 *   garlic, so every ingredient is charged as whole packs: `ceil(needed / pack)`
 *   packs at the pack price, discounted where an offer is running.
 * - **Pro Portion** — what the meal consumes. Here the leftover in the pack
 *   belongs to the next meal, so only the amount the recipe uses is counted,
 *   divided by the number of servings.
 */
import { getCheapestOfferForProduct, getProduct, type CatalogIndex } from '../data';
import type { DiscountView, Product, Recipe, RecipeIngredient } from '../types';
import { packsFor, usedCostFor } from './packMath';

export interface CostedIngredient {
  product: Product;
  /** Amount the recipe needs. */
  grams: number;
  /** Whole packs you have to buy for that amount. */
  packs: number;
  /** Price of one pack — the offer price when one is running. */
  packPrice: number;
  /** `packs × packPrice` — what this ingredient adds to the basket. */
  packTotal: number;
  /** The same at the regular shelf price, for the savings figure. */
  regularPackTotal: number;
  /** Cost of just the amount used — the basis for the price per portion. */
  usedCost: number;
  /** Best currently running offer for this product, if there is one. */
  offer?: DiscountView;
}

export interface RecipeCost {
  items: CostedIngredient[];
  /** What the shopping basket costs: whole packs. */
  basketTotal: number;
  /** What the basket would cost without any offer. */
  regularBasketTotal: number;
  /** Cost of the amounts actually used. */
  usedTotal: number;
  /** `usedTotal / servings`. */
  pricePerPortion: number;
  /** Saving on the basket, i.e. on whole packs. */
  savings: number;
  /** Offers behind the cheapest basket — one per retailer. */
  bestOffers: DiscountView[];
}

const costIngredient = (
  index: CatalogIndex,
  ingredient: RecipeIngredient,
): CostedIngredient | null => {
  const product = getProduct(index, ingredient.productId);
  if (!product) return null;

  const offer = getCheapestOfferForProduct(index, product.id);
  const packPrice = offer ? offer.discountPrice : product.basePrice;
  const packs = packsFor(ingredient.grams, product.baseGrams);

  return {
    product,
    grams: ingredient.grams,
    packs,
    packPrice,
    packTotal: packs * packPrice,
    regularPackTotal: packs * product.basePrice,
    usedCost: usedCostFor(ingredient.grams, product.baseGrams, packPrice),
    offer,
  };
};

export const costRecipe = (index: CatalogIndex, recipe: Recipe): RecipeCost => {
  const items = recipe.ingredients
    .map((ingredient) => costIngredient(index, ingredient))
    .filter((item): item is CostedIngredient => item !== null);

  return summariseCost(items, recipe.servings);
};

/** Shared by the recipe view and the assistant's shopping list. */
export const summariseCost = (items: CostedIngredient[], servings: number): RecipeCost => {
  const basketTotal = items.reduce((sum, item) => sum + item.packTotal, 0);
  const regularBasketTotal = items.reduce((sum, item) => sum + item.regularPackTotal, 0);
  const usedTotal = items.reduce((sum, item) => sum + item.usedCost, 0);

  const bestOffers: DiscountView[] = [];
  items.forEach((item) => {
    if (item.offer && !bestOffers.some((view) => view.retailerId === item.offer!.retailerId)) {
      bestOffers.push(item.offer);
    }
  });

  return {
    items,
    basketTotal,
    regularBasketTotal,
    usedTotal,
    pricePerPortion: usedTotal / Math.max(1, servings),
    savings: Math.max(0, regularBasketTotal - basketTotal),
    bestOffers,
  };
};

/** Share of a recipe's ingredients that are currently on sale (0…1). */
export const discountCoverage = (index: CatalogIndex, recipe: Recipe): number => {
  const cost = costRecipe(index, recipe);
  if (cost.items.length === 0) return 0;
  return cost.items.filter((item) => item.offer).length / cost.items.length;
};

/** "Spar, Hofer" — the chains a recipe's cheapest basket points to. */
export const retailerNames = (cost: RecipeCost, limit = 2): string =>
  Array.from(new Set(cost.bestOffers.map((view) => view.retailer.name)))
    .slice(0, limit)
    .join(', ');
