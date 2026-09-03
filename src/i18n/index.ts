/**
 * Tiny translation layer — no dependency, no provider.
 *
 * `useT()` returns a `t(key, params)` function bound to the language stored in
 * the user profile; changing the language in the profile re-renders everything
 * that uses it. `translate(lang, key)` is the non-hook variant for services.
 */
import { useCallback } from 'react';

import { useProfileStore } from '../store/useProfileStore';
import type { Allergen, DietPreference, Recipe } from '../types';
import {
  categoryLabelsEn,
  cuisineLabelsEn,
  tagLabelsEn,
  translations,
  type Language,
  type TranslationKey,
} from './translations';

export { LANGUAGES, type Language, type TranslationKey } from './translations';

export type TranslateParams = Record<string, string | number>;

const fill = (template: string, params?: TranslateParams): string =>
  params
    ? template.replace(/\{(\w+)\}/g, (match, key) =>
        params[key] !== undefined ? String(params[key]) : match,
      )
    : template;

export const translate = (
  language: Language,
  key: TranslationKey,
  params?: TranslateParams,
): string => fill(translations[language][key] ?? translations.de[key] ?? key, params);

export const useLanguage = (): Language => useProfileStore((state) => state.language);

export const useT = () => {
  const language = useLanguage();
  return useCallback(
    (key: TranslationKey, params?: TranslateParams) => translate(language, key, params),
    [language],
  );
};

/** Recipe titles are our own content and exist in both languages. */
export const recipeTitle = (recipe: Recipe, language: Language): string =>
  language === 'en' && recipe.titleEn ? recipe.titleEn : recipe.title;

/** Catalogue values are German; fall back to the value itself when unmapped. */
export const cuisineLabel = (cuisine: string, language: Language): string =>
  language === 'en' ? (cuisineLabelsEn[cuisine] ?? cuisine) : cuisine;

export const categoryLabel = (category: string, language: Language): string =>
  language === 'en' ? (categoryLabelsEn[category] ?? category) : category;

export const tagLabel = (tag: string, language: Language): string =>
  language === 'en' ? (tagLabelsEn[tag] ?? tag) : tag;

/**
 * Pack sizes are catalogue data ("6 Stk", "1 Bund"). Sizes stay as printed, the
 * German unit words are swapped in the English UI.
 */
const UNIT_WORDS_EN: Record<string, string> = {
  Stk: 'pcs',
  Stück: 'pcs',
  Bund: 'bunch',
  Topf: 'pot',
};

export const unitLabel = (unit: string, language: Language): string =>
  language === 'en'
    ? unit.replace(/\b(Stück|Stk|Bund|Topf)\b/g, (word) => UNIT_WORDS_EN[word] ?? word)
    : unit;

export const dietLabel = (diet: DietPreference, language: Language): string =>
  translate(language, `diet.${diet}` as TranslationKey);

export const allergenLabel = (allergen: Allergen, language: Language): string =>
  translate(language, `allergen.${allergen}` as TranslationKey);

export const activityLabel = (type: string, language: Language): string =>
  translate(language, `activity.${type}` as TranslationKey);
