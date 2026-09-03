import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type {
  ActivityLogEntry,
  Allergen,
  DietPreference,
  OnboardingStatus,
  UserProfile,
} from '../types';

const ACTIVITY_LOG_LIMIT = 40;

/** Key of the AsyncStorage record that holds the whole user profile. */
export const PROFILE_STORAGE_KEY = 'smartkorb.profile.v1';

interface ProfileState extends UserProfile {
  /** True once the persisted profile has been read from AsyncStorage. */
  hydrated: boolean;
  setDietPreference: (diet: DietPreference) => void;
  toggleAllergy: (allergen: Allergen) => void;
  setAllergies: (allergens: Allergen[]) => void;
  setBudgetPerPortion: (budget: number | null) => void;
  completeOnboarding: (input: {
    dietPreference: DietPreference;
    allergies: Allergen[];
    budgetPerPortion: number | null;
  }) => void;
  skipOnboarding: () => void;
  /** Used by the profile screen to show the questionnaire again. */
  restartOnboarding: () => void;
  toggleSavedRecipe: (recipeId: string) => void;
  isRecipeSaved: (recipeId: string) => boolean;
  logActivity: (type: ActivityLogEntry['type'], label: string) => void;
  clearActivityLog: () => void;
}

const initialProfile: UserProfile = {
  dietPreference: 'omnivor',
  allergies: [],
  budgetPerPortion: null,
  savedRecipeIds: [],
  activityLog: [],
  onboardingStatus: 'pending',
};

const createEntry = (type: ActivityLogEntry['type'], label: string): ActivityLogEntry => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type,
  label,
  at: new Date().toISOString(),
});

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      ...initialProfile,
      hydrated: false,

      setDietPreference: (dietPreference) => set({ dietPreference }),

      toggleAllergy: (allergen) =>
        set((state) => ({
          allergies: state.allergies.includes(allergen)
            ? state.allergies.filter((item) => item !== allergen)
            : [...state.allergies, allergen],
        })),

      setAllergies: (allergies) => set({ allergies }),

      setBudgetPerPortion: (budgetPerPortion) => set({ budgetPerPortion }),

      completeOnboarding: ({ dietPreference, allergies, budgetPerPortion }) =>
        set({
          dietPreference,
          allergies,
          budgetPerPortion,
          onboardingStatus: 'completed' as OnboardingStatus,
        }),

      skipOnboarding: () => set({ onboardingStatus: 'skipped' as OnboardingStatus }),

      restartOnboarding: () => set({ onboardingStatus: 'pending' as OnboardingStatus }),

      toggleSavedRecipe: (recipeId) =>
        set((state) => ({
          savedRecipeIds: state.savedRecipeIds.includes(recipeId)
            ? state.savedRecipeIds.filter((id) => id !== recipeId)
            : [recipeId, ...state.savedRecipeIds],
        })),

      isRecipeSaved: (recipeId) => get().savedRecipeIds.includes(recipeId),

      logActivity: (type, label) =>
        set((state) => {
          const last = state.activityLog[0];
          // collapse identical consecutive entries (e.g. live search keystrokes)
          if (last && last.type === type && last.label === label) return state;
          return {
            activityLog: [createEntry(type, label), ...state.activityLog].slice(0, ACTIVITY_LOG_LIMIT),
          };
        }),

      clearActivityLog: () => set({ activityLog: [] }),
    }),
    {
      name: PROFILE_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        dietPreference: state.dietPreference,
        allergies: state.allergies,
        budgetPerPortion: state.budgetPerPortion,
        savedRecipeIds: state.savedRecipeIds,
        activityLog: state.activityLog,
        onboardingStatus: state.onboardingStatus,
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.warn('[SmartKorb] Profil konnte nicht geladen werden:', error);
        }
        // Flip the flag no matter what — a failed read simply means "fresh user".
        useProfileStore.setState({ hydrated: true });
      },
    },
  ),
);
