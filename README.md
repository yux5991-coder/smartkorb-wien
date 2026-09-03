# SmartKorb Wien — Prototype

Mobile prototype (React Native + Expo, TypeScript) that aggregates the daily grocery discounts
of Vienna's supermarket chains (Spar, Billa, Billa Plus, Hofer, Lidl, Penny) in one place and
helps to plan shopping and cooking around them.

The app is a **clickable prototype running on local mock data** — there are no retailer
partnerships or official APIs yet. The data layer is shaped like a real backend response so the
mock source can be swapped for HTTP calls without touching the screens.

The user interface is entirely in **German** (target audience: Vienna residents). Code, comments
and commit messages are in English.

## Quick start

```bash
cd smartkorb-wien
npm install
npx expo start
```

Then scan the QR code with **Expo Go** (iOS / Android) or press `i` / `a` to open a simulator.
`npx expo start --web` runs a browser build too — with a list fallback instead of the map, see
"Maps" below.

Requirements: Node.js 20+ and the Expo Go app (Expo SDK 57).

Useful scripts:

| Command | Purpose |
| --- | --- |
| `npm start` | start the Metro dev server (same as `npx expo start`) |
| `npm run android` / `npm run ios` | start and open a simulator/emulator |
| `npm run web` | run the browser build |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |

## The four sections

1. **Karte** — Vienna map (`react-native-maps`) with 22 branches. Every branch is drawn as a
   *custom* marker (rounded logo badge with the chain's colour, initials and an offer counter),
   not as a default pin. Tapping a marker opens a bottom sheet with the address, opening hours
   and all offers running in that branch. Chips at the top filter the map by chain.
2. **Rabatte** — one mixed feed of every running offer (`FlatList`), with a debounced live
   product search, quick chain chips, a filter sheet (chains multi-select, category, minimum
   discount, sorting by discount / price / name) and a detail sheet per offer.
3. **Kulinarik** — recipe grid (2 columns) with cuisine, cooking-time and diet filters, plus the
   two assistant features, both marked with a `Premium` badge:
   - **„Was koche ich?“** ranks the recipe catalogue against today's offers and the saved
     profile and returns 3-5 dishes with price per portion and where to buy the ingredients.
   - **„Ich möchte X kochen“** takes a free-text dish name and answers with exact ingredient
     amounts, the cheapest store per ingredient and the total / per-portion price.
   On the **first visit** to this tab a questionnaire asks for diet, allergies and budget per
   portion. It can be dismissed with *„Überspringen, später einrichten“* — the assistant then
   works in generic mode. The answer is stored in AsyncStorage and the questionnaire never
   appears again unless it is re-armed from the profile.
4. **Profil** — saved recipes (the heart button), an activity log (viewed offers, searches,
   filters, assistant requests) and the questionnaire as editable settings.

## Project structure

```
src/
  data/          mock JSON + the data access layer (index.ts)
  types/         domain model shared by everything
  store/         Zustand store, persisted to AsyncStorage
  services/      pricing calculations and the assistant (ai.ts)
  components/    reusable UI (cards, sheets, chips, markers …)
  screens/       the four tabs
  navigation/    bottom tab navigator
  hooks/, utils/, theme/
```

## Mock data

`src/data/` contains 6 retailers, 22 branches across real Vienna districts, 62 products,
64 offers (≈56 of them valid today, the rest expired or starting next week so the validity
filter is exercised) and 15 recipes.

The entities follow the model that a backend would expose:

```ts
retailers   { id, name, logoColor, logoTextColor, logoInitials }
stores      { id, retailerId, name, address, district, lat, lng, openingHours }
products    { id, name, category, unit, baseGrams, basePrice, emoji, allergens, vegan }
discounts   { id, storeId, productId, originalPrice, discountPrice, discountPercent,
              validFrom, validTo }
recipes     { id, title, tags[], dietTags[], allergenFree[], ingredients[{ productId, grams }],
              instructions[], cookingTimeMin, servings, imageUrl, emoji }
userProfile { dietPreference, allergies[], budgetPerPortion, savedRecipeIds[], activityLog[],
              onboardingStatus }
```

**Demo mode:** the offers were authored for the week of `REFERENCE_DATE` (`src/data/index.ts`)
and the whole dataset is shifted so that it always looks current. Remove that shift together
with the mock import.

### Connecting a real backend

Everything goes through `src/data/index.ts`; see the `TODO(backend)` marker at the top of the
file. Replace the JSON imports with an API client (e.g. `GET /v1/discounts?city=vienna`) and
keep the exported function names — the screens depend only on those.

Product and recipe photos are placeholders (emoji tiles, `PlaceholderImage`); the `imageUrl`
field already exists in the recipe model for real images. The chain logos are neutral
placeholder badges (coloured circle + initials), deliberately not the real trademarks.

### Connecting a real LLM

`src/services/ai.ts` computes both assistant answers locally but is written as an API boundary:
both public functions are `async` and return plain data. The file contains a commented
`callAI()` stub with a `TODO(ai)` describing the request shape, the JSON contract and the note
that the key must live behind our own backend rather than in the app bundle.

## Styling

Plain `StyleSheet.create` with central design tokens in `src/theme/`. NativeWind was considered
but the token approach keeps the Expo Go setup free of extra Babel/Metro configuration, which
matters for a prototype that has to run from a QR code on any reviewer's phone.

## Maps

`react-native-maps` renders through Apple Maps on iOS and Google Maps on Android and works in
Expo Go out of the box. A standalone Android build would additionally need a Google Maps API key
in `app.json` (`android.config.googleMaps.apiKey`). The web build has no map implementation, so
`StoreMap.web.tsx` degrades to a branch list.

## Resetting the local state

The profile (questionnaire answers, saved recipes, activity log) lives under the AsyncStorage
key `smartkorb.profile.v1`. In Expo Go, reinstalling / clearing the app data resets it; inside
the app, *Profil → „Fragebogen beim nächsten Besuch der Kulinarik erneut zeigen“* re-arms the
onboarding.

## Deliberately out of scope

- No authentication and no server-side database — AsyncStorage is enough for the prototype.
- No payment flow; the paid features are only marked with a `Premium` badge.
- No live retailer integration; see the `TODO(backend)` marker above.
