/**
 * The week planner has to be real logic, not a stub: different inputs must
 * produce different, sensible plans, the shopping list must respect the number
 * of trips the user is willing to make, and every dish has to work for everyone
 * at the table.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import productsJson from '../../src/data/products.json';
import recipesJson from '../../src/data/recipes.json';
import {
  assignToStores,
  combineRestrictions,
  eligibleRecipes,
  generateWeekPlan,
  type PlannerCatalog,
} from '../../src/services/planner';
import type { FamilyMember, PlanSettings, Product, Recipe, Store } from '../../src/types';

const products = productsJson as Product[];
const recipes = recipesJson as Recipe[];
const productById = new Map(products.map((product) => [product.id, product]));

const store = (id: string, retailerId: string): Store => ({
  id,
  retailerId,
  name: id,
  address: 'Wien',
  district: 'Wieden',
  lat: 48.19,
  lng: 16.36,
  openingHours: '',
});

/**
 * Four chains with different price levels: cheap staples in one, cheap fresh
 * produce in another, so splitting the basket actually pays off.
 */
const catalog = (stores = [store('s-billa', 'billa'), store('s-hofer', 'hofer'), store('s-spar', 'spar')]): PlannerCatalog => ({
  recipes,
  productById,
  stores,
  priceAt: (storeId, productId) => {
    const product = productById.get(productId);
    if (!product) return { price: 0 };
    if (storeId === 's-hofer' && product.category === 'Obst & Gemüse') {
      return { price: Number((product.basePrice * 0.6).toFixed(2)), discountPercent: 40 };
    }
    if (storeId === 's-spar' && product.category === 'Vorratskammer') {
      return { price: Number((product.basePrice * 0.7).toFixed(2)), discountPercent: 30 };
    }
    if (storeId === 's-billa') return { price: product.basePrice };
    return { price: Number((product.basePrice * 1.05).toFixed(2)) };
  },
});

const member = (id: string, overrides: Partial<FamilyMember> = {}): FamilyMember => ({
  id,
  name: id,
  dietaryPreferences: [],
  allergies: [],
  isDefault: false,
  ...overrides,
});

const settings = (overrides: Partial<PlanSettings> = {}): PlanSettings => ({
  memberIds: ['m1'],
  weeklyBudget: 80,
  cookingTime: 'medium',
  maxShoppingTrips: 2,
  seed: 2026_09_07,
  ...overrides,
});

test('the plan works for everyone at the table', () => {
  const members = [
    member('m1', { dietaryPreferences: ['vegetarisch'] }),
    member('m2', { allergies: ['nuesse'] }),
    member('m3', { dietaryPreferences: ['vegan'] }),
  ];

  const combined = combineRestrictions(members);
  assert.equal(combined.diet, 'vegan', 'the strictest diet wins');
  assert.deepEqual(combined.allergies, ['nuesse']);

  const eligible = eligibleRecipes(recipes, members, 'long');
  assert.ok(eligible.length > 0);
  eligible.forEach((recipe) => {
    assert.ok(recipe.dietTags.includes('vegan'), `${recipe.title} is not vegan`);
    assert.ok(recipe.allergenFree.includes('nuesse'), `${recipe.title} may contain nuts`);
  });

  const plan = generateWeekPlan({
    catalog: catalog(),
    members,
    settings: settings({ memberIds: ['m1', 'm2', 'm3'] }),
  });
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  plan.days.forEach((day) => {
    const recipe = byId.get(day.recipeId)!;
    assert.ok(recipe.dietTags.includes('vegan'));
    assert.ok(recipe.allergenFree.includes('nuesse'));
    assert.equal(day.servings, 3, 'cooked for everyone selected');
  });
});

test('the cooking-time budget is respected', () => {
  const fast = generateWeekPlan({
    catalog: catalog(),
    members: [member('m1')],
    settings: settings({ cookingTime: 'fast' }),
  });
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  fast.days.forEach((day) => {
    assert.ok(byId.get(day.recipeId)!.cookingTimeMin <= 30);
  });
});

test('a plan covers seven days without repeating a dish back to back', () => {
  const plan = generateWeekPlan({ catalog: catalog(), members: [member('m1')], settings: settings() });
  assert.equal(plan.days.length, 7);
  plan.days.forEach((day, index) => {
    const previous = plan.days.slice(Math.max(0, index - 3), index);
    assert.ok(
      !previous.some((earlier) => earlier.recipeId === day.recipeId),
      'the same dish must not come back within three days',
    );
  });
});

test('different inputs produce different plans, the same input the same plan', () => {
  const base = generateWeekPlan({ catalog: catalog(), members: [member('m1')], settings: settings() });
  const again = generateWeekPlan({ catalog: catalog(), members: [member('m1')], settings: settings() });
  assert.deepEqual(
    again.days.map((day) => day.recipeId),
    base.days.map((day) => day.recipeId),
    'the same settings must be reproducible',
  );

  const otherWeek = generateWeekPlan({
    catalog: catalog(),
    members: [member('m1')],
    settings: settings({ seed: 2026_09_14 }),
  });
  const vegan = generateWeekPlan({
    catalog: catalog(),
    members: [member('m1', { dietaryPreferences: ['vegan'] })],
    settings: settings(),
  });

  assert.notDeepEqual(
    otherWeek.days.map((day) => day.recipeId),
    base.days.map((day) => day.recipeId),
    'another week must not be the identical plan',
  );
  assert.notDeepEqual(
    vegan.days.map((day) => day.recipeId),
    base.days.map((day) => day.recipeId),
  );
});

test('the shopping list never exceeds the number of trips the user allows', () => {
  [1, 2, 3].forEach((trips) => {
    const plan = generateWeekPlan({
      catalog: catalog(),
      members: [member('m1'), member('m2')],
      settings: settings({ maxShoppingTrips: trips }),
    });
    assert.ok(
      plan.baskets.length <= trips,
      `asked for ${trips} trips, got ${plan.baskets.length} baskets`,
    );
    assert.ok(plan.baskets.length >= 1);
    // every item lands in exactly one basket
    const ids = plan.baskets.flatMap((basket) => basket.items.map((item) => item.productId));
    assert.equal(new Set(ids).size, ids.length);
  });
});

test('splitting the basket is only done when it pays off, and the saving is reported', () => {
  const plan = generateWeekPlan({
    catalog: catalog(),
    members: [member('m1'), member('m2')],
    settings: settings({ maxShoppingTrips: 3 }),
  });

  const summed = plan.baskets.reduce((sum, basket) => sum + basket.total, 0);
  assert.ok(Math.abs(summed - plan.total) < 0.01, 'the baskets add up to the total');
  assert.ok(plan.singleStoreTotal >= plan.total - 0.01, 'one store is never cheaper than the plan');
  assert.equal(plan.savings, Number(Math.max(0, plan.singleStoreTotal - plan.total).toFixed(2)));

  // with one trip allowed there is exactly one basket and no saving to show
  const single = generateWeekPlan({
    catalog: catalog(),
    members: [member('m1'), member('m2')],
    settings: settings({ maxShoppingTrips: 1 }),
  });
  assert.equal(single.baskets.length, 1);
  assert.equal(single.total, single.singleStoreTotal);
});

test('a leftover pack is reported, and a use for it is suggested when one exists', () => {
  const plan = generateWeekPlan({
    catalog: catalog(),
    members: [member('m1')],
    settings: settings({ maxShoppingTrips: 2 }),
  });

  const leftovers = plan.warnings.filter(
    (warning) => warning.kind === 'leftover' || warning.kind === 'leftover-used',
  );
  assert.ok(leftovers.length > 0, 'cooking for one always leaves something in the pack');
  leftovers.forEach((warning) => {
    const product = productById.get(warning.productId!)!;
    assert.ok(warning.grams! >= Math.max(100, product.baseGrams * 0.4));
    if (warning.kind === 'leftover-used') {
      const recipe = recipes.find((entry) => entry.id === warning.recipeId)!;
      assert.ok(
        recipe.ingredients.some((ingredient) => ingredient.productId === warning.productId),
        'the suggested recipe has to use the leftover product',
      );
      assert.ok(!plan.days.some((day) => day.recipeId === recipe.id), 'and must not be in the plan');
    }
  });
});

test('the budget pushes the plan towards cheaper dishes', () => {
  const rich = generateWeekPlan({
    catalog: catalog(),
    members: [member('m1'), member('m2')],
    settings: settings({ weeklyBudget: 200 }),
  });
  const tight = generateWeekPlan({
    catalog: catalog(),
    members: [member('m1'), member('m2')],
    settings: settings({ weeklyBudget: 25 }),
  });

  assert.ok(tight.total <= rich.total, 'a tight budget must not produce a more expensive plan');
  if (!tight.withinBudget) {
    assert.ok(
      tight.warnings.some((warning) => warning.kind === 'over-budget'),
      'if it does not fit, say so',
    );
  }
});

test('assignToStores splits the basket exactly when the detour pays for itself', () => {
  // Enough of each to make the price difference worth a second and third stop:
  // tomatoes are cheapest at Hofer in this fixture, flour at Spar.
  const worthIt = new Map([
    ['p-03', 6000],
    ['p-44', 12000],
  ]);
  const { baskets } = assignToStores(worthIt, catalog(), 3);
  const where = new Map(
    baskets.flatMap((basket) => basket.items.map((item) => [item.productId, basket.storeId])),
  );
  assert.equal(where.get('p-03'), 's-hofer');
  assert.equal(where.get('p-44'), 's-spar');

  // A couple of euros saved is not worth an extra trip: everything stays in one
  // basket even though three stops would be allowed.
  const notWorthIt = new Map([
    ['p-03', 1000],
    ['p-44', 1000],
  ]);
  const small = assignToStores(notWorthIt, catalog(), 3);
  assert.equal(small.baskets.length, 1);
});
