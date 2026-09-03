/**
 * The recipe catalogue is data, and the two fields the diet and allergy
 * features depend on — dietTags and allergenFree — are derived from the
 * ingredients. These tests make sure they stay that way: a hand-edited recipe
 * that claims to be vegan while containing butter fails here, not on a user's
 * phone.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import productsJson from '../../src/data/products.json';
import recipesJson from '../../src/data/recipes.json';
import type { Allergen, Product, Recipe } from '../../src/types';

const products = productsJson as Product[];
const recipes = recipesJson as Recipe[];
const byId = new Map(products.map((product) => [product.id, product]));

const ALL_ALLERGENS: Allergen[] = ['gluten', 'laktose', 'nuesse', 'ei', 'fisch', 'soja'];

test('every recipe references products that exist', () => {
  recipes.forEach((recipe) => {
    assert.ok(recipe.ingredients.length > 0, `${recipe.title} has no ingredients`);
    recipe.ingredients.forEach((ingredient) => {
      assert.ok(
        byId.has(ingredient.productId),
        `${recipe.title} references unknown product ${ingredient.productId}`,
      );
      assert.ok(ingredient.grams > 0, `${recipe.title}: amount must be positive`);
    });
  });
});

test('dietTags match the ingredients', () => {
  recipes.forEach((recipe) => {
    const items = recipe.ingredients.map((ingredient) => byId.get(ingredient.productId)!);
    const vegan = items.every((item) => item.vegan);
    const vegetarian = items.every((item) => item.vegetarian);

    assert.equal(
      recipe.dietTags.includes('vegan'),
      vegan,
      `${recipe.title}: vegan flag does not match its ingredients`,
    );
    assert.equal(
      recipe.dietTags.includes('vegetarisch'),
      vegetarian,
      `${recipe.title}: vegetarian flag does not match its ingredients`,
    );
    assert.ok(recipe.dietTags.includes('omnivor'), `${recipe.title}: must suit omnivores`);
  });
});

test('allergenFree never contradicts an ingredient', () => {
  recipes.forEach((recipe) => {
    const present = new Set(
      recipe.ingredients.flatMap((ingredient) => byId.get(ingredient.productId)!.allergens),
    );
    const expected = ALL_ALLERGENS.filter((allergen) => !present.has(allergen));
    assert.deepEqual(
      [...recipe.allergenFree].sort(),
      expected.sort(),
      `${recipe.title}: allergenFree is out of sync with its ingredients`,
    );
  });
});

test('each recipe is complete enough to render', () => {
  const seen = new Set<string>();
  recipes.forEach((recipe) => {
    assert.ok(!seen.has(recipe.id), `duplicate recipe id ${recipe.id}`);
    seen.add(recipe.id);
    assert.ok(recipe.title.trim().length > 3, `${recipe.id}: title too short`);
    assert.ok(recipe.cuisine.trim().length > 0, `${recipe.title}: cuisine missing`);
    assert.ok(recipe.instructions.length >= 3, `${recipe.title}: needs at least three steps`);
    assert.ok(recipe.cookingTimeMin > 0 && recipe.servings > 0, `${recipe.title}: bad time/servings`);
    assert.ok(recipe.emoji.length > 0, `${recipe.title}: emoji missing`);
  });

  // the catalogue should stay broad — that is the point of the section
  const cuisines = new Set(recipes.map((recipe) => recipe.cuisine));
  assert.ok(cuisines.size >= 10, `only ${cuisines.size} cuisines in the catalogue`);
  assert.ok(recipes.length >= 50, `only ${recipes.length} recipes in the catalogue`);
});

test('every catalogue entry exists in both languages', () => {
  products.forEach((product) => {
    assert.ok(
      product.nameEn && product.nameEn.trim().length > 1,
      `product "${product.name}" has no English name`,
    );
  });
  recipes.forEach((recipe) => {
    assert.ok(
      recipe.titleEn && recipe.titleEn.trim().length > 2,
      `recipe "${recipe.title}" has no English title`,
    );
    // dish names are German or English — no original-language spellings
    assert.ok(
      !/[()]/.test(recipe.title) && !/[()]/.test(recipe.titleEn ?? ''),
      `recipe "${recipe.title}" still carries a bracketed original name`,
    );
  });
});
