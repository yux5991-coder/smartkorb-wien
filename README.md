# SmartKorb Wien

Mobile app (React Native + Expo, TypeScript) that aggregates the daily grocery
discounts of Vienna's supermarket chains (Spar, Billa, Billa Plus, Hofer, Lidl,
Penny) in one place and helps to plan shopping and cooking around them.

The user interface is entirely in **German** (target audience: Vienna residents).
Code, comments and commit messages are in English.

## Quick start

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** (iOS / Android), or press `i` / `a` for a
simulator. `npx expo start --web` also works — with a branch list instead of the
map, because `react-native-maps` has no web implementation.

Requirements: Node.js 20+, Expo SDK 57.

| Command | Purpose |
| --- | --- |
| `npm start` | Metro dev server |
| `npm run android` / `npm run ios` / `npm run web` | start on a device, simulator or browser |
| `npm run typecheck` | TypeScript for the app *and* the pipeline |
| `npm test` | pipeline unit tests (matching, normalising, validation) |
| `npm run data:refresh` | build a new data snapshot (branches + offers) |
| `npm run data:refresh -- --skip-stores` | offers only (the daily case) |
| `npm run data:refresh -- --update-seed` | also rewrite the bundled fallback branch list |
| `npm run data:check` | run everything, write nothing |
| `npm run feed:check -- <file.csv>` | validate a partner delivery before using it |
| `npm run data:seed` | regenerate the offers bundled with the app |
| `npm run data:probe -- --url <url>` | inspect a candidate offer endpoint and propose an adapter config |
| `npm run logos:check` | show which chain logos are still placeholders |

## The four sections

1. **Karte** — every branch on a map of Vienna, drawn as a *custom* marker: the
   chain's logo on a white tile with a pointer in the chain colour, so the
   chains stay apart at a glance. Tapping a marker opens the branch with its
   address, opening hours and all offers valid there. With the full
   OpenStreetMap dataset the city has several hundred branches, so only the
   markers inside the current viewport are mounted.
2. **Rabatte** — one mixed feed of every running offer, with debounced live
   search, chain chips, a filter sheet (chains, category, minimum discount,
   sorting) and pull-to-refresh for a fresh snapshot. Cards show the flyer small
   print where there is any ("nur mit Jö Bonus Club", "ab 2 Stück", "nur am
   Samstag") and whether the offer runs chain-wide or in one branch. Ready meals
   and chilled convenience are in the feed next to raw produce — their own
   category, `Fertig & Convenience`.
3. **Kulinarik** — 73 recipes from 14 kitchens (see below), filterable by
   cuisine, dish type, cooking time and diet, plus two assistant features
   (`Premium` badge): **„Was koche ich?“** ranks recipes against today's offers
   and the saved profile, **„Ich möchte X kochen“** turns a dish name into exact
   amounts, the cheapest chain per ingredient and a total. On first use a
   questionnaire asks for diet, allergies and budget; it can be skipped and is
   stored in AsyncStorage.
4. **Profil** — saved recipes, activity log, the questionnaire as editable
   settings, and the current data source (branch count, offer count, origins).

## Where the data comes from

```
 OpenStreetMap (Overpass)          retailer / partner offer sources
   all Vienna branches                (CSV feed, JSON endpoint, mock)
            \                                  /
             \                                /
              +----------- pipeline/ --------+
                 match onto the product catalogue,
                 normalise pack sizes, prices, dates,
                 validate (refuses a broken feed)
                              |
                     data/snapshot.json          <- committed daily by CI
                              |
                   raw.githubusercontent.com
                              |
                          the app
             remote snapshot -> AsyncStorage cache -> bundled seed
```

Three layers, so the app always has something to show:

1. **Bundled seed** (`src/data/*.json`) — ships inside the build, works offline
   and on the first start. Its offers are clearly labelled as demo data.
2. **Cache** — the last snapshot the device downloaded (AsyncStorage).
3. **Remote snapshot** — the file the pipeline publishes once a day.

The app refreshes on start, when it returns to the foreground, on pull-to-refresh
and via the button in the status bar — but never more often than
`expo.extra.refreshAfterHours` (default 6 h). Every payload is validated
(`src/data/validateCatalog.ts`) before it is allowed on screen: rows with
dangling references or impossible prices are dropped, and a feed that loses more
than half of its rows is rejected as a whole, leaving the previous data in place.

### Configuring the source

`app.json`:

```json
"extra": {
  "snapshotUrl": "https://raw.githubusercontent.com/<owner>/<repo>/main/data/snapshot.json",
  "refreshAfterHours": 6
}
```

While the URL still contains the `<owner>/<repo>` placeholder the app stays on
the bundled data and says so in the UI. Any endpoint serving the same JSON shape
works — a raw GitHub file, S3, or a real API later on.

## Generated files — do not overwrite them by hand

Two files are *data*, not source, and are produced by the pipeline:

| File | What it holds | How to rebuild |
| --- | --- | --- |
| `src/data/stores.json` | the branch list bundled with the app (hundreds of branches once OSM has been queried) | `npm run data:refresh -- --update-seed` |
| `data/snapshot.json` | the published snapshot the app downloads | `npm run data:refresh` |

Never copy them over from another checkout or an archive — that silently replaces
a full branch list with whatever the other copy happened to contain. If it does
happen, the fix is one command: `npm run data:refresh -- --update-seed`.

The pipeline itself protects the branch list: a run that skips the OSM query
carries the branches over from the previous snapshot instead of falling back to
the small bundled seed, and a refresh that returns less than half of the previous
count is treated as a broken source and rejected (`--allow-store-drop` overrides
it when branches really did close).

## All branches in Vienna (OpenStreetMap)

```bash
npm run data:refresh -- --update-seed
```

queries the Overpass API for every `shop=supermarket` inside the Vienna city
boundary, keeps the branches whose brand maps to one of our chains
(`BILLA PLUS`/`MERKUR` → Billa Plus, `INTERSPAR`/`EUROSPAR`/`SPAR` → Spar, …),
derives the district from the postcode, deduplicates shops that OSM stores both
as a node and as a building outline, and writes them into the snapshot (and,
with `--update-seed`, into the bundled fallback).

OSM data is licensed under the **ODbL**: the app credits
"© OpenStreetMap contributors" in the profile tab, and published derived data has
to stay under the same licence. Overpass is a free shared service — the workflow
therefore queries it once a week, not on every run.

## Recipe catalogue

73 recipes across the kitchens people in Vienna actually cook from:
Österreichisch, Türkisch, Kaukasisch, Polnisch, Ukrainisch, Balkan,
Chinesisch, Japanisch, Koreanisch, Thailändisch, Vietnamesisch, Italienisch,
Amerikanisch and a small International set. Every recipe carries a `cuisine`,
usage tags ("Schnell", "Ofen", "Budget", "Meal Prep" …), exact amounts in grams
and its own instructions.

Two fields are **derived from the ingredients, never written by hand**:

- `dietTags` — a recipe counts as vegan / vegetarian only if every single
  product does (`Product.vegan` / `Product.vegetarian`);
- `allergenFree` — the allergens none of its products contain.

`pipeline/test/recipes.test.ts` enforces exactly that, so a hand-edited recipe
claiming to be vegan while containing butter fails in CI instead of on a user's
phone. The same tests check that no recipe references an unknown product and
that the catalogue stays broad (≥ 50 recipes, ≥ 10 cuisines).

Because every ingredient is a catalogue product, each recipe is priced from the
running offers: the cards show the price per portion and which chains the
cheapest basket points to.

## Chain logos

The app shows whatever PNG sits in `assets/logos/<retailerId>.png` — on the map
markers and on every offer card. The six files committed here are
**placeholders**: a coloured tile with the chain's initials, generated for this
repository. They are not the real logos, and no code in the app can turn them
into the real logos — the artwork has to be put in the folder.

**Replacing them (no code change, ~5 minutes):**

1. Get the official artwork. Every chain publishes it in the press / newsroom
   area of its own website (Spar, Billa and Billa Plus via REWE Group Austria,
   Hofer, Lidl, Penny) — look for "Presse", "Newsroom", "Media" or
   "Markenportal" and download the logo as PNG or SVG.
2. Export each one square with a transparent background, about 240 × 240 px
   (larger is fine — the app scales it down), and save it as PNG.
3. Put the files in `assets/logos/` using exactly these names:

   ```
   assets/logos/spar.png
   assets/logos/billa.png
   assets/logos/billaplus.png
   assets/logos/hofer.png
   assets/logos/lidl.png
   assets/logos/penny.png
   ```

4. Verify they were picked up:

   ```bash
   npm run logos:check
   ```

   Every line should read `custom`, not `PLACEHOLDER`, and report no format
   problems.
5. Restart the dev server with a clean cache — Metro caches bundled images, so
   without this you keep seeing the old ones:

   ```bash
   npx expo start -c
   ```

If a file is missing or unreadable, the UI falls back to the coloured initials
badge, so a wrong file can never break a screen.

**Trademarks.** Chain logos are protected marks. Showing them to identify which
shop an offer belongs to is the normal, referential use an offer aggregator
makes of them, but they must not be altered, recoloured, or presented as
SmartKorb's own branding. Whether the files may also be committed to a *public*
repository depends on each chain's brand guidelines — check that before pushing
them, and keep them out of the repository (load them at runtime instead) if a
chain does not allow redistribution.

## Demo offers

Until a retailer feed is connected, the pipeline generates the feed itself — and
"demo" is not allowed to mean "implausible", because the offer list is what the
whole app is judged on. `pipeline/src/sources/mockOffers.ts` models how the
chains actually promote:

- Billa / Billa Plus / Spar run a Thursday-to-Wednesday flyer with many items, a
  large share tied to the loyalty programme ("nur mit Jö Bonus Club", "nur mit
  SPAR Clubkarte"); Hofer / Lidl / Penny run Monday-to-Saturday with fewer but
  deeper cuts and the occasional single-day special ("Super Samstag").
- Discounts come from the ladder the flyers advertise (−20/−25/−30/−33/−40/−50 %),
  and both the shelf price and the promo price are searched so that they land on
  endings a price tag really shows (…,99 / …,49 / …,29) *and* still produce
  exactly that percentage — no "2,31 statt 2,89".
- Ready meals and convenience are promoted as heavily as raw produce.

That is roughly 270 offers per week across the six chains. `npm run data:seed`
regenerates the copy bundled with the app; the pipeline uses the same generator
for the snapshot, so there is only ever one set of numbers.

## Real offer data

**There is no public, documented API for Austrian grocery discounts.** The
pipeline is built so that the *system* is finished and only the source has to be
plugged in. Three ways to do that, in order of how defensible they are:

1. **Partner feed — enabled by default, and the point of the grant.** A chain
   exports its weekly offers as CSV; the `partner-csv` source reads
   `data/partner-feed.csv`. As long as that file is absent the source is simply
   skipped, so the pipeline keeps working until the first delivery arrives.

   - The format to hand to a retailer is documented in
     [`docs/partner-feed.md`](docs/partner-feed.md) (German, written to be sent
     as-is), with a working example in `data/partner-feed.example.csv`.
   - Columns: `retailerId,productName,unit,category,originalPrice,discountPrice,validFrom,validTo,storeExternalId,sourceUrl`;
     an empty `storeExternalId` means the offer runs chain-wide, which is how
     weekly flyers work. The parser accepts `,` or `;` and quoted fields.
   - Check a delivery before trusting it:

     ```bash
     npm run feed:check -- data/partner-feed.csv
     ```

     It reports accepted rows, how many matched a known product, and every
     rejection with its reason.
   - The real feed is **not** committed (`data/partner-feed.csv` is gitignored —
     a delivery can be confidential). For CI, set the repository secret
     `PARTNER_FEED_URL` to a location the workflow may download it from.

2. **A licensed aggregator.** Same shape, either as CSV or through the generic
   JSON adapter — one config entry, no code.

3. **A retailer's own JSON endpoint.** `sources.config.json` contains disabled
   **templates** (`billa-web`, `spar-web`) that show the shape: `url` with
   `{page}` / `{pageSize}`, `itemsPath` to the array, `map` with dot paths per
   field, `priceDivisor: 100` for cent-based APIs, `requestDelayMs` for polite
   pacing.

   You do not have to reverse-engineer that shape by hand. Open the chain's
   offer page, copy the request its own site makes (DevTools → Network →
   Fetch/XHR) and run:

   ```bash
   npm run data:probe -- --url "<the URL you copied>" --retailer billa
   ```

   The probe fetches it, finds the array of offers, guesses which fields hold
   the name, both prices, the pack size and the validity dates, and writes a
   ready-to-review config snippet to `.probe/`. The same thing runs as the
   **Probe offer source** workflow (manual trigger) if you would rather do it
   from the GitHub UI — it uploads the result as an artifact.

   The URLs in the templates are placeholders. Before enabling such a source you
   have to point it at the real endpoint **and** check that retailer's terms of
   use and robots policy. Scraping without permission is a legal risk, not a
   technical one, and an endpoint can change without notice; that is why the
   fallback chain above exists.

Whatever the source, offers are matched onto the product catalogue by name
(brand prefixes such as "SPAR Premium Hühnerbrustfilet" or "Zurück zum Ursprung
Bergkäse" still find the catalogue product, while lookalikes like
"Hafer-Vollkornkekse" vs. "Haferdrink" deliberately do not), so recipes get real
prices. Anything unknown becomes a new catalogue entry with a guessed category,
pack size, allergens and vegan flag. `npm test` locks this behaviour down.

## Repository setup

The daily workflow and the app's `snapshotUrl` both assume this project lives in
its own repository:

```bash
git init && git add -A && git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yux5991-coder/smartkorb-wien.git
git push -u origin main
```

Then the workflow under `.github/workflows/` runs on schedule automatically.

**Visibility matters for the snapshot:** `raw.githubusercontent.com` only serves
files from a *public* repository without a token. This project's repository is
public, which is what makes `expo.extra.snapshotUrl` work as configured. If it is
ever made private, the daily commit still happens but the app can no longer
download the file — publish `data/snapshot.json` somewhere else (S3, Netlify, any
static host) and point the URL there.

## Daily updates

**GitHub Actions** (`.github/workflows/daily-data-refresh.yml`) runs at 04:10 UTC
(06:10 Vienna in summer): install → `npm test` → `npm run data:refresh` →
commit `data/snapshot.json` if it changed. Branches are refreshed on Mondays or
on demand (`workflow_dispatch` with `refresh_stores`). A failing pipeline exits
non-zero, so a broken snapshot is never committed; the previous file stays live
and GitHub notifies the repository owner about the failed run.

The workflow needs nothing but the repository itself: it uses the built-in
`GITHUB_TOKEN` with `contents: write`.

**Windows alternative** (`scripts/refresh-data.ps1`), if you would rather run it
on a PC:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\refresh-data.ps1 -Push
```

Register it once with Task Scheduler (daily at 06:15):

```powershell
schtasks /create /tn "SmartKorb Datenupdate" /sc daily /st 06:15 ^
  /tr "powershell -ExecutionPolicy Bypass -File C:\Users\<user>\...\smartkorb-wien\scripts\refresh-data.ps1 -Push"
```

## Project structure

```
src/
  config.ts        snapshot URL and refresh interval (from app.json → expo.extra)
  data/            bundled seed, catalog index + selectors, remote loader,
                   validation, the zustand store the screens read from
  types/           domain model shared by app and pipeline
  store/           user profile (diet, allergies, saved recipes, activity log)
  services/        pricing calculations and the assistant (ai.ts)
  components/      cards, sheets, chips, map markers, data status bar
  screens/         the four tabs
pipeline/
  src/sources/     Overpass branches, CSV feed, generic JSON endpoint, mock
  src/normalize/   product matching, branch and offer normalisation
  src/build.ts     fetch → normalise → validate → snapshot
  test/            unit tests for all of the above
data/              snapshot.json (published) and the example partner feed
scripts/           Windows refresh script
```

### Data model

```ts
retailers   { id, name, logoColor, logoTextColor, logoInitials }
stores      { id, retailerId, name, address, district, lat, lng, openingHours }
products    { id, name, category, unit, baseGrams, basePrice, emoji, allergens, vegan,
              convenience? }
discounts   { id, retailerId, storeId | null, productId, originalPrice, discountPrice,
              discountPercent, validFrom, validTo, condition?, source?, sourceUrl? }
recipes     { id, title, tags[], dietTags[], allergenFree[], ingredients[{ productId, grams }],
              instructions[], cookingTimeMin, servings, imageUrl, emoji }
userProfile { dietPreference, allergies[], budgetPerPortion, savedRecipeIds[], activityLog[],
              onboardingStatus }
```

`storeId: null` means the offer runs in every branch of that chain — the normal
case for a weekly flyer. Branch-specific offers carry the branch id and are shown
with its district. `condition` is the small print the flyer prints next to the
price and `convenience` marks ready meals and chilled convenience, which get
their own category in the feed.

## AI features

`src/services/ai.ts` computes both assistant answers locally from the current
offers and the saved profile, but is written as an API boundary: both public
functions are `async` and return plain data. The file contains a commented
`callAI()` stub with a `TODO(ai)` describing the request shape, the JSON contract
and the requirement that the API key lives behind our own backend rather than in
the app bundle.

## Styling

Plain `StyleSheet.create` with design tokens in `src/theme/`. NativeWind was
considered but the token approach keeps the Expo Go setup free of extra
Babel/Metro configuration, which matters for an app that has to run from a QR
code on any reviewer's phone.

## Maps

`react-native-maps` renders through Apple Maps on iOS and Google Maps on Android
and works in Expo Go out of the box. A standalone Android build additionally
needs a Google Maps API key in `app.json` (`android.config.googleMaps.apiKey`).

## Product photos

Product and recipe images are emoji placeholders (`PlaceholderImage`). The
`imageUrl` field exists in the model for real photography. Chain logos are a
separate matter — see "Chain logos" above.

## Deliberately out of scope

- No authentication and no server-side database — AsyncStorage is enough.
- No payment flow; paid features are only marked with a `Premium` badge.
