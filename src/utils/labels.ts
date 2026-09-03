import type { Allergen, DietPreference } from '../types';

export const allergenLabels: Record<Allergen, string> = {
  gluten: 'Gluten',
  laktose: 'Laktose',
  nuesse: 'Nüsse',
  ei: 'Ei',
  fisch: 'Fisch',
  soja: 'Soja',
};

export const allAllergens: Allergen[] = ['gluten', 'laktose', 'nuesse', 'ei', 'fisch', 'soja'];

export const dietLabels: Record<DietPreference, string> = {
  omnivor: 'Alles',
  vegetarisch: 'Vegetarisch',
  vegan: 'Vegan',
};

export const allDiets: DietPreference[] = ['omnivor', 'vegetarisch', 'vegan'];

export const activityLabels: Record<string, string> = {
  discount_viewed: 'Rabatt angesehen',
  search: 'Suche',
  filter: 'Filter',
  recipe_saved: 'Rezept gespeichert',
  ai_request: 'KI-Anfrage',
  store_viewed: 'Filiale angesehen',
};
