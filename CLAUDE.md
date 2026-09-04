# Project invariants — read before changing anything

These rules come from the project owner. They are not suggestions and not
defaults to be re-derived: **do not remove, revert, replace or rename any of
them without her explicit permission.** If a task appears to require breaking
one, stop and ask first.

## 1. The chain logos are user assets

`assets/logos/*.png` may contain the owner's real, licensed artwork.

- Never overwrite them with the shipped placeholders.
- Never include them in a `git reset`, in seed generation, in the data pipeline
  or in any automatic update.
- Never delete or regenerate them.
- After **every** change, verify that these files are unmodified and still used
  by the app: `npm run logos:check`.

The file names are fixed, because `src/assets/retailerLogos.ts` requires exactly
these:

```
assets/logos/spar.png
assets/logos/billa.png
assets/logos/billaplus.png
assets/logos/hofer.png
assets/logos/lidl.png
assets/logos/penny.png
```

Enforcement: once the owner has run `npm run logos:lock`, the checksums live in
`assets/logos/expected.sha256.json` and `npm run logos:check` **fails** if a file
changed — with an explicit message when it was reverted to a placeholder. The
check runs in CI (`.github/workflows/verify.yml`) and as part of `npm run
verify`.

## 2. Branches

Work only in the branch that is currently checked out. Do not create branches,
do not switch branches, do not change the default branch without permission.

## 3. Never nest the project inside itself

There must be no `smartkorb-wien/smartkorb-wien`. Archives handed to the owner
carry the files at their root, not inside a wrapping folder.

## 4. No destructive git or file operations

No `git reset --hard`, no deleting local user assets, no regenerating files that
the owner maintains by hand.

## 5. Nothing already agreed may silently disappear

Before committing, compare against the previous state and be able to say exactly
what changed and what was left untouched.

## 6. Report after every change

State all of it, every time:

- branch;
- commit hash;
- files changed;
- whether `assets/logos/` was touched (and the result of `npm run logos:check`);
- app version (`app.json` → `expo.version`);
- number of stores / products / recipes.

`npm run project:status` prints the last four items.

## Data invariants that already exist in code

- **Store count**: Vienna has several hundred branches. `sources.config.json`
  carries `minStores` (300); a run below it refreshes from OpenStreetMap even
  when `--skip-stores` was passed, repairs the bundled seed, and refuses to
  publish a shorter list (`pipeline/src/build.ts`).
- **Never lose the branch list**: a run that skips the OSM query carries the
  branches over from the previous snapshot instead of falling back to the seed.
- **Recipes**: `dietTags` and `allergenFree` are derived from the ingredients,
  never hand-written; `pipeline/test/recipes.test.ts` enforces it, along with
  both language variants for every product and recipe.
- **Prices**: the basket pays for whole packs, the portion price counts only
  what is used (`src/services/packMath.ts`).
- **Cache**: a snapshot cached on a device is discarded when the build ships a
  different catalogue (`src/data/cachePolicy.ts`).

## Before you commit

```bash
npm run verify        # typecheck (app + pipeline), tests, logo guard
npm run project:status
```
