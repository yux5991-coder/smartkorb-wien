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
  /** Brand-ish background colour used for the placeholder logo. */
  logoColor: string;
  /** Foreground colour for the initials drawn on `logoColor`. */
  logoTextColor: string;
  /** 1-2 characters shown inside the round placeholder logo. */
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
}

/** One offer: a product on sale in one specific store. */
export interface Discount {
  id: DiscountId;
  storeId: StoreId;
  productId: ProductId;
  originalPrice: number;
  discountPrice: number;
  discountPercent: number;
  /** ISO date (YYYY-MM-DD). */
  validFrom: string;
  /** ISO date (YYYY-MM-DD), inclusive. */
  validTo: string;
}

export type DietPreference = 'omnivor' | 'vegetarisch' | 'vegan';

export interface RecipeIngredient {
  productId: ProductId;
  /** Amount in grams / millilitres for the whole recipe (all servings). */
  grams: number;
}

export interface Recipe {
  id: RecipeId;
  title: string;
  /** Free-form tags, first one is used as the cuisine label. */
  tags: string[];
  dietTags: DietPreference[];
  /** Allergens this recipe is free of. */
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
  store: Store;
  retailer: Retailer;
}
