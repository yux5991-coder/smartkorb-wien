/**
 * Domain model of the SmartKorb Wien prototype.
 *
 * The shapes below intentionally mirror what a real backend would return, so
 * that swapping the local mock JSON for HTTP responses only touches
 * `src/data/index.ts` (see the TODO markers there).
 */

export type RetailerId = string;
export type StoreId = string;
export type ProductId = string;
export type DiscountId = string;
export type RecipeId = string;

/** Supermarket chain, e.g. Spar or Billa. */
export interface Retailer {
  id: RetailerId;
  name: string;
  /** Brand colour — used for the marker outline and as the logo fallback. */
  logoColor: string;
  /** Foreground colour for the initials drawn on `logoColor`. */
  logoTextColor: string;
  /** 1-2 characters shown when no logo image is available. */
  logoInitials: string;
}

/** A single branch of a retailer. */
export interface Store {
  id: StoreId;
  retailerId: RetailerId;
  name: string;
  address: string;
  /** Vienna district name, e.g. "Leopoldstadt". */
  district: string;
  lat: number;
  lng: number;
  openingHours: string;
}

export type ProductCategory =
  | 'Obst & Gemüse'
  | 'Fleisch & Fisch'
  | 'Milchprodukte'
  | 'Brot & Gebäck'
  | 'Fertig & Convenience'
  | 'Vorratskammer'
  | 'Getränke'
  | 'Tiefkühl'
  | 'Süßes & Snacks';

export type Allergen = 'gluten' | 'laktose' | 'nuesse' | 'ei' | 'fisch' | 'soja';

export interface Product {
  id: ProductId;
  name: string;
  category: ProductCategory;
  /** Human readable pack size, e.g. "1 kg" or "6 Stk". */
  unit: string;
  /** Pack size normalised to grams (or millilitres) for price calculations. */
  baseGrams: number;
  /** Weight of one piece in grams — only for products sold by the piece. */
  pieceGrams?: number;
  /** Regular shelf price of one pack in EUR. */
  basePrice: number;
  /** Emoji stand-in for the product photo (see `PlaceholderImage`). */
  emoji: string;
  allergens: Allergen[];
  vegan: boolean;
  /** Contains no meat or fish (dairy and eggs are allowed). */
  vegetarian: boolean;
  /**
   * Ready meals, chilled convenience and frozen dishes — the things people
   * actually buy on offer next to raw ingredients.
   */
  convenience?: boolean;
}

/**
 * One offer.
 *
 * Austrian chains publish most of their offers chain-wide (the weekly
 * "Flugblatt"), so `storeId` is null for those and the offer applies to every
 * branch of `retailerId`. Branch-specific offers carry a concrete `storeId`.
 */
export interface Discount {
  id: DiscountId;
  retailerId: RetailerId;
  /** `null` = valid in every branch of the retailer. */
  storeId: StoreId | null;
  productId: ProductId;
  originalPrice: number;
  discountPrice: number;
  discountPercent: number;
  /** ISO date (YYYY-MM-DD). */
  validFrom: string;
  /** ISO date (YYYY-MM-DD), inclusive. */
  validTo: string;
  /**
   * Strings the flyers print next to the price: "nur mit Jö Bonus Club",
   * "ab 2 Stück", "nur Samstag". Shown on the offer card.
   */
  condition?: string;
  /** Where this row came from — e.g. "billa-api", "partner-csv", "mock". */
  source?: string;
  /** Deep link to the offer at the retailer, when the source provides one. */
  sourceUrl?: string;
}

export type DietPreference = 'omnivor' | 'vegetarisch' | 'vegan';

export interface RecipeIngredient {
  productId: ProductId;
  /** Amount in grams / millilitres for the whole recipe (all servings). */
  grams: number;
}

export interface Recipe {
  id: RecipeId;
  /** German title — the app's default language. */
  title: string;
  /** English title, used when the profile language is 'en'. */
  titleEn?: string;
  /**
   * Kitchen the dish comes from: "Österreichisch", "Türkisch", "Kaukasisch",
   * "Polnisch", "Ukrainisch", "Balkan", "Chinesisch", "Japanisch",
   * "Koreanisch", "Thailändisch", "Vietnamesisch", "Italienisch",
   * "Amerikanisch" or "International". Drives the Kulinarik filter.
   */
  cuisine: string;
  /** Free-form usage tags: "Schnell", "Ofen", "Budget", "Meal Prep" … */
  tags: string[];
  /** Derived from the ingredients by the recipe build step, never by hand. */
  dietTags: DietPreference[];
  /** Allergens this recipe is free of — also derived from the ingredients. */
  allergenFree: Allergen[];
  ingredients: RecipeIngredient[];
  instructions: string[];
  cookingTimeMin: number;
  servings: number;
  /** Reserved for real photos; the prototype renders `emoji` instead. */
  imageUrl: string;
  emoji: string;
}

export type OnboardingStatus = 'pending' | 'completed' | 'skipped';

export interface ActivityLogEntry {
  id: string;
  type: 'discount_viewed' | 'search' | 'filter' | 'recipe_saved' | 'ai_request' | 'store_viewed';
  label: string;
  /** ISO timestamp. */
  at: string;
}

export interface UserProfile {
  /** UI language — 'de' (default) or 'en'. */
  language: 'de' | 'en';
  dietPreference: DietPreference;
  allergies: Allergen[];
  /** Budget per portion in EUR; `null` means "no limit". */
  budgetPerPortion: number | null;
  savedRecipeIds: RecipeId[];
  activityLog: ActivityLogEntry[];
  onboardingStatus: OnboardingStatus;
}

/** A discount enriched with its product / store / retailer for rendering. */
export interface DiscountView extends Discount {
  product: Product;
  retailer: Retailer;
  /** `null` for chain-wide offers that are not tied to one branch. */
  store: Store | null;
}

/**
 * Everything the app renders, in one object. Either the JSON bundled with the
 * build, the last snapshot cached on the device, or a fresh snapshot from the
 * data pipeline (see `pipeline/` and `src/data/catalog.ts`).
 */
export interface Catalog {
  /** ISO timestamp of when the data was assembled. */
  generatedAt: string;
  retailers: Retailer[];
  stores: Store[];
  products: Product[];
  discounts: Discount[];
  recipes: Recipe[];
  /** Names of the sources that contributed to this snapshot. */
  sources: string[];
}

export type CatalogOrigin = 'bundled' | 'cache' | 'remote';
