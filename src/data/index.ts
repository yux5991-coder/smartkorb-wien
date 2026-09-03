/**
 * Public data API of the app.
 *
 * The screens import from here and never touch the JSON files or the network
 * directly. Where the rows come from — the bundled seed, the snapshot cached on
 * the device, or the freshly downloaded one — is decided in `useCatalogStore`.
 *
 * TODO(backend): the app side is already source-agnostic. Real offers are
 * produced by `pipeline/` (retailer adapters + OpenStreetMap branch data),
 * published once a day by `.github/workflows/daily-data-refresh.yml` and picked
 * up through `expo.extra.snapshotUrl`. To attach a different backend, point that
 * URL at any endpoint that serves the same JSON shape (see `validateCatalog`).
 */
export { bundledCatalog, bundledRecipes, todayIso } from './bundled';
export {
  countOffersForStore,
  getActiveDiscountViews,
  getCheapestOfferForProduct,
  getDiscountsForStore,
  getProduct,
  getRecipe,
  getRetailer,
  getStore,
  indexCatalog,
  isDiscountActive,
  type CatalogIndex,
} from './catalog';
export { clearCachedCatalog, fetchRemoteCatalog, readCachedCatalog } from './remote';
export { useCatalog, useCatalogStore } from './useCatalogStore';
export { CatalogValidationError, validateCatalog } from './validateCatalog';
