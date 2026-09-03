/**
 * Turns a recipe into a shopping list with real prices, based on the offers
 * that are currently running in Vienna.
 */
import { getCheapestOfferForProduct, getProduct } from '../data';
import type { DiscountView, Product, Recipe, RecipeIngredient } from '../types';
import { priceForAmount } from '../utils/format';

export interface CostedIngredient {
  product: Product;
  grams: number;
  /** Price for exactly `grams` at the best price we found. */
  price: number;
  /** What the same amount would cost without any offer. */
  regularPrice: number;
  /** Best currently running offer for this product, if there is one. */
  offer?: DiscountView;
}

export interface RecipeCost {
  items: CostedIngredient[];
  total: number;
  pricePerPortion: number;
  savings: number;
  /** Stores that carry at least one of the discounted ingredients. */
  bestStores: DiscountView[];
}

const costIngredient = (ingredient: RecipeIngredient): CostedIngredient | null => {
  const product = getProduct(ingredient.productId);
  if (!product) return null;

  const offer = getCheapestOfferForProduct(product.id);
  const regularPrice = priceForAmount(product.basePrice, product.baseGrams, ingredient.grams);
  const price = offer
    ? priceForAmount(offer.discountPrice, product.baseGrams, ingredient.grams)
    : regularPrice;

  return { product, grams: ingredient.grams, price, regularPrice, offer };
};

export const costRecipe = (recipe: Recipe): RecipeCost => {
  const items = recipe.ingredients
    .map(costIngredient)
    .filter((item): item is CostedIngredient => item !== null);

  const total = items.reduce((sum, item) => sum + item.price, 0);
  const regularTotal = items.reduce((sum, item) => sum + item.regularPrice, 0);

  const bestStores: DiscountView[] = [];
  items.forEach((item) => {
    if (item.offer && !bestStores.some((view) => view.storeId === item.offer!.storeId)) {
      bestStores.push(item.offer);
    }
  });

  return {
    items,
    total,
    pricePerPortion: total / Math.max(1, recipe.servings),
    savings: Math.max(0, regularTotal - total),
    bestStores,
  };
};

/** Share of a recipe's ingredients that are currently on sale (0…1). */
export const discountCoverage = (recipe: Recipe): number => {
  const cost = costRecipe(recipe);
  if (cost.items.length === 0) return 0;
  return cost.items.filter((item) => item.offer).length / cost.items.length;
};
