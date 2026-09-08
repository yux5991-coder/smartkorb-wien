import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type {
  ActivityLogEntry,
  Allergen,
  DietPreference,
  FamilyMember,
  OnboardingStatus,
  PlanSettings,
  UserProfile,
  WeekPlan,
} from '../types';

type Language = UserProfile['language'];

const ACTIVITY_LOG_LIMIT = 40;

/** Key of the AsyncStorage record that holds the whole user profile. */
export const PROFILE_STORAGE_KEY = 'smartkorb.profile.v1';

interface ProfileState extends UserProfile {
  /** True once the persisted profile has been read from AsyncStorage. */
  hydrated: boolean;
  /** Everyone the plan has to work for. */
  members: FamilyMember[];
  /** Last settings used in the planner, so the screen opens where it was left. */
  planSettings: Omit<PlanSettings, 'seed'> | null;
  savedPlans: WeekPlan[];
  setLanguage: (language: Language) => void;
  addMember: (member: Omit<FamilyMember, 'id' | 'isDefault'>) => void;
  updateMember: (id: string, patch: Partial<Omit<FamilyMember, 'id'>>) => void;
  removeMember: (id: string) => void;
  setPlanSettings: (settings: Omit<PlanSettings, 'seed'>) => void;
  savePlan: (plan: WeekPlan) => void;
  removePlan: (planId: string) => void;
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

const newId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const initialProfile: UserProfile = {
  language: 'de',
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
      members: [],
      planSettings: null,
      savedPlans: [],

      addMember: ({ name, dietaryPreferences, allergies }) =>
        set((state) => ({
          members: [
            ...state.members,
            {
              id: newId(),
              name: name.trim() || `Person ${state.members.length + 1}`,
              dietaryPreferences,
              allergies,
              isDefault: state.members.length === 0,
            },
          ],
        })),

      updateMember: (id, patch) =>
        set((state) => ({
          members: state.members.map((member) =>
            member.id === id ? { ...member, ...patch } : member,
          ),
        })),

      removeMember: (id) =>
        set((state) => {
          const remaining = state.members.filter((member) => member.id !== id);
          // there is always exactly one default member
          if (remaining.length > 0 && !remaining.some((member) => member.isDefault)) {
            remaining[0] = { ...remaining[0], isDefault: true };
          }
          return { members: remaining };
        }),

      setPlanSettings: (planSettings) => set({ planSettings }),

      savePlan: (plan) =>
        set((state) => ({
          savedPlans: [plan, ...state.savedPlans.filter((saved) => saved.id !== plan.id)].slice(0, 10),
        })),

      removePlan: (planId) =>
        set((state) => ({ savedPlans: state.savedPlans.filter((plan) => plan.id !== planId) })),

      setLanguage: (language) => set({ language }),

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
        set((state) => {
          // the questionnaire describes the first family member
          const members =
            state.members.length === 0
              ? [
                  {
                    id: newId(),
                    name: state.language === 'en' ? 'Me' : 'Ich',
                    dietaryPreferences: dietPreference === 'omnivor' ? [] : [dietPreference],
                    allergies,
                    isDefault: true,
                  },
                ]
              : state.members.map((member) =>
                  member.isDefault
                    ? {
                        ...member,
                        dietaryPreferences: dietPreference === 'omnivor' ? [] : [dietPreference],
                        allergies,
                      }
                    : member,
                );

          return {
            members,
            dietPreference,
            allergies,
            budgetPerPortion,
            onboardingStatus: 'completed' as OnboardingStatus,
          };
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
        language: state.language,
        members: state.members,
        planSettings: state.planSettings,
        savedPlans: state.savedPlans,
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
