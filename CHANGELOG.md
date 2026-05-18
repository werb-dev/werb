# Changelog

All notable changes to Werb are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] — 2026-05-18

Brewing-math + brew-day polish, plus a focused refactor pass that
broke the two biggest screens into readable per-section files.
This is the release where Werb starts feeling complete for the
recipe → brew → tasting loop a homebrewer actually runs.

### Added

- **FG estimation from yeast attenuation.** `computeFg(og, atten)`
  in `@werb/calc` plus a recipe-level `recipeApparentAttenuationPct`
  helper. ABV now cascades through claimed → computed values, so a
  bare BeerXML import without an explicit `final_gravity` field
  shows a real number instead of "—".
- **Alternative IBU and color methods.** Rager IBU (hyperbolic-
  tangent utilisation with a gravity-adjustment divisor) and
  Daniels color (linear fit for amber-and-darker beers). Switchable
  in Settings → Units; both fall back to the prior defaults
  (Tinseth / Morey) when not picked.
- **Yeast starter sizing.** `computeYeastStarter` using Kai
  Troester's Braukaiser stir-plate regression, scaled down for
  shake / no-aeration setups. Renders under the yeast-pitch
  verdict on the Recipe screen when the brewer is under-pitched —
  starter volume, DME mass at 100 g/L, predicted final cell count,
  and a `needs_step_up` flag when a single 4 L step can't bridge
  the gap.
- **BIAB mash mode.** New `mash_mode: "classic" | "biab"` on the
  equipment schema, new `biab` boolean on the water-calc input.
  In BIAB mode the water calc collapses mash + sparge into a single
  full-volume kettle mash, the brew session plan omits the sparge
  step, and the Recipe water section gets a "BIAB equipment" hint
  subtitle. Toggle lives in the Equipment editor.
- **Source-water profile presets.** Nine canonical brewing-city
  profiles (Pilsen, Munich, Dortmund, Vienna, Burton, London,
  Edinburgh, Dublin, RO) bundled in the catalog. Picker above the
  ppm fields in Recipe → Water chemistry fills the six ions when
  selected; "Custom" tag appears after manual tweaks.
- **Next-hop callout in the active boil step.** "Add now / in X
  min" banner above the per-hop checklist. Highlights more
  prominently when the addition becomes due.
- **Recipe metric BJCP-range coloring.** Each OG / FG / IBU / ABV /
  Color tile now shows the actual BJCP range (e.g. `1.046–1.054`)
  and colours the recipe value green / orange / red by fit (in
  range / within 10 % of bounds / further out). Replaces the old
  text-only "In range" line and tooltip-only range.
- **Settings build-stamp footer.** Vite injects `__APP_VERSION__` /
  `__APP_COMMIT__` / `__APP_BUILD_DATE__` at build time and the
  Settings screen renders them as a centered footer. Local builds
  with uncommitted changes get a `-dirty` suffix so a tester's
  AppImage is visibly distinct from a CI release.

### Changed

- **Recipe screen falls back to the computed value as the main tile
  number when the file omits the claim.** OG / FG / IBU / ABV /
  Color all use the same rule: claimed in the main slot when
  present, otherwise the computed estimate. The "≈x" subtitle only
  appears when both differ — no more "—" hiding the real answer.
- **Dry-hop time canonicalised on import + display.** BeerXML
  stores hop times in minutes; a 3-day dry hop landed as
  `4320 min`. The importer now writes days for dry-hop /
  packaging additions, and the editor enforces the canonical unit
  on display so legacy files still render correctly.
- **Yeast amount is grams everywhere.** Importer always emits
  `MassType` in grams (BeerXML kg ×1000 ≈ slurry density 1
  approximation); editor reads any historical Volume/UnitCount
  back as grams. Joliebulle path divides by 1000 first so its
  source-side grams round-trip without inflation.
- **Combobox auto-opens on row-add.** New ingredient rows
  (fermentable / hop / culture / misc) start with an empty name
  and the picker is auto-focused so the brewer goes straight to
  catalog selection instead of dismissing a meaningless "New hop"
  placeholder.
- **Number inputs right-align.** The numbers now butt against
  their unit labels — easier to scan a column of figures.

### Fixed

- **Division-by-zero in calc when `batch_size_l ≤ 0`.** The Ajv
  schema rejects 0 at load/save time, but the editor lets a brewer
  type it directly in the field and renders the screen
  immediately. `computeGravity` / `computeColor` / `computeIbu`
  now return neutral values (OG 1.000, SRM 0, IBU 0) instead of
  letting `Infinity` / `NaN` propagate through BJCP coloring, tile
  formatting, and the cost calc.
- **Hops section subtitle on the Recipe screen** was hardcoded
  English; now properly translated.

### Internal — quality + maintainability

- Extracted `useIngredientRows<T>` from RecipeEditor, replacing
  four near-identical state blocks across the Fermentables / Hops
  / Cultures / Miscs sections.
- Lifted RecipeEditor's inline form primitives (~400 lines —
  `InlineNumber`, `InlineSelect`, `Combobox`, unit-aware mass /
  volume / temperature / color inputs, number-typing helpers) to
  `components/editor/Fields.tsx`.
- Split `Recipe.tsx` (1984 → 674 lines) into `screens/Recipe/`:
  `Section`, `Tile`, `CarbFields`, `YeastPitchSection`,
  `WaterChemistrySection`, `CarbonationSection`, `CostSection`,
  `TastingCard`. RecipeScreen is now an orchestrator.
- Split `Brew.tsx` (1557 → 878 lines) into `screens/Brew/`:
  `Section`, `HopSchedule`, `MeasurementsSection`, `TastingSection`,
  and `format.ts` (`formatDuration` / `formatTimeOfDay`).
- Added Settings to the CI screenshot smoke walk so the build-
  footer can't silently break.
- New test coverage: round-trip value assertions for OG / FG / IBU
  / color / ABV / style; equipment-profile → `computeWater`
  integration covering override flow, BIAB mode, transfer-loss
  propagation; water-profile catalog round-trip + sanity. 290
  desktop tests, 92 calc tests, 59 adapter tests, 38 Rust tests.
- README / install.md / docs/src/beerjson.md caught up with what
  actually shipped (alternative IBU/color methods, yeast starter,
  test count, Intel-Mac policy, named upstream PR contributions).

## [0.2.0] — 2026-05-12

Language + theme pass. The app now ships English and French end-to-end,
defaulting to the browser locale. A warm-cream light variant joins the
signature Cassis dark — meant for outdoor brewing on sunny days where
the dark wash gets unreadable. Both pickers live in Settings → Units,
both default to Auto (browser locale / OS color-scheme preference).

### Added

- **Internationalisation.** French translation of every screen — Library
  (cards, sorts, onboarding, profile badge), Recipe (BJCP range badges,
  Adapt-to-my-rig flow with confirm dialog, export menu, water
  chemistry, carbonation, yeast pitch, cost), Brew (step kinds,
  fit-check banners, measurements form, tasting), Journal (status
  badges, row stats with proper pluralisation, export menu),
  Equipment (profile editor, four vessel sections, quick-start
  wizard), Settings (every option label, data card flow, GitHub
  Connect form), and the full Recipe editor (every column, every
  enum, every form field). Lightweight DIY i18n: flat key → en/fr
  dict, `t(key, vars?)` translator with `{var}` interpolation and a
  `{s}` plural helper. EN-only keys ship and fall back gracefully so
  the French side can catch up without breaking the app.
- **Locale-aware dates.** `useBcp47()` hook + `bcp47(locale)` helper.
  Every `toLocaleString` / `toLocaleDateString` / `toLocaleTimeString`
  in the brew, journal and tasting screens now passes the user's
  language tag rather than relying on the OS default.
- **Structured errors.** Pure data modules throw / return
  `WerbError(code, params)` instances; the UI catches and translates
  via `translateError(err, t)`. Covers every user-visible error
  path: BeerJSON / BeerXML import, recipe-export download / write
  failures, and every GitHub sync error (invalid token, repo not
  found, unreachable API, read-only token, HTTP failures inside the
  backend).
- **Light theme.** Warm-cream base (#faf6f0) with Cassis dark used
  as ink; saturated accents deepened to clear AA contrast (orange
  #ff5c34 → #e84a1f, success/info/data/warning/danger remapped).
  Auto follows `prefers-color-scheme`; manual Dark / Light overrides
  via `data-theme` on `<html>`. Tailwind utilities resolve the new
  `--color-*` values at runtime so every existing class flips with
  no rewrites. `color-scheme` and the `theme-color` meta tag follow
  the theme so native scrollbars / carets / mobile address bar
  match.

### Changed

- **Yeast pitch defaults.** Dry-pack cell count raised from 115 B
  to 200 B per 11.5 g sachet to match Fermentis' own fresh
  production numbers and the Brewer's Friend / BeerSmith /
  Brulosophy consensus (15–20 B viable cells per gram). The old
  figure was Fermentis' minimum *guarantee* and under-reported by
  ~2× — flagging a correct 2-sachet pitch for a 50 L 1.050 ale as
  severely under-pitched.
- **Recipe-editor decimal display.** `InlineNumber` and `NumberField`
  moved from `type="number"` (browsers strip trailing zeros and use
  OS locale) to a focus-aware controlled text buffer with
  `inputmode="decimal"`. Trailing zeros now preserved so an 8.30 kg
  fermentable doesn't render as "8,3" next to a neighbour's "1,76";
  both `.` and `,` accepted as the decimal separator. Settings →
  Cost adjustment adopts the same pattern.
- **Skipped-import notice.** `skippedMessage(string)` →
  `skippedSummary({count, names})`. The UI formats with `t()` so the
  "duplicates skipped" notice localises.

### Fixed

- **Dry-hop time unit.** The hop-time field was hardcoded to `min`
  regardless of the addition's use, so a dry hop carried in
  BeerJSON as `{value: 3, unit: "day"}` rendered as "3 min". Time
  now follows the data's unit and switches between min and day when
  the use selector flips between boil/mash and dry hop/package,
  with a sensible default value.

### Pipelines

- Dropped macOS Intel from the release matrix permanently. The
  `macos-13` runner pool is too queue-starved to reliably finish;
  Apple Silicon + Windows + Linux ship as before.

## [0.1.0] — 2026-05-12

First public alpha — the brewing lifecycle is end-to-end, the math is
well-tested, the UI works tablet-first and phone-usable. Web build ships
as an installable PWA, desktop builds via Tauri for macOS / Windows /
Linux.

### Added

#### Calculation engine
- IBU (Tinseth + Rager), color (Morey), ABV, gravity (efficiency,
  target OG/FG), water budget (mash + sparge + boil-off + losses),
  scale-to-equipment, mash strike temperature, carbonation (priming
  + force), yeast pitch rate, brewing-salt additions to a target
  water profile, equipment-sizing wizard from a target batch + setup
  type (3-vessel / 2-vessel / BIAB).
- Every tool is contract-first: JSON Schema → TS types → pure
  function → unit tests.

#### Library and recipes
- BeerJSON 2.x read + write, round-trip clean.
- BeerXML 1.0 read via a bundled Rust crate compiled to WebAssembly
  for the browser (single code path across web + desktop).
- "+ New recipe" creates a blank shell seeded from the active
  equipment profile (or prompts the brewer to set one up first).
- In-app recipe editor with autocomplete typeaheads (BJCP 2021 style
  picker, ingredient catalogs for fermentables / hops / yeasts /
  miscs) and mash-schedule editing.
- Numeric inputs in the editor honor the brewer's unit preferences
  (kg/lb, L/gal, °C/°F, SRM/EBC) — type values in your native units,
  storage stays canonical.

#### Brew mode
- Live timeline with per-step countdowns and start/done buttons.
- Per-context info inside the active step: strike water + thickness
  on mash-in, hop schedule with per-addition "mark added" toggles
  during the boil, yeast pitch reminder, etc.
- Measurement logging (gravity, pH, temperature, volume, ABV) with
  auto-attach to the active step.
- Screen wake-lock so the display stays on through the brew day.
- HLT and kettle fit checks warn before the boil-over.
- Multi-brew history per recipe: each session keyed by its own id,
  so a recipe accumulates a brewing log.

#### Journal and tasting
- Brew log view of every session, newest first, with per-row export
  (printable HTML / PDF, JSON).
- Post-brew sensory tasting form on completed sessions: 7-axis radar
  chart (bitterness, sweetness, sourness, hop character, malt
  character, body, carbonation), 1–5 star rating, free-form notes,
  lessons-learned tags. The most recent tasting surfaces on the
  recipe screen so future brews see what to adjust.

#### Cost estimator
- Per-batch cost from a bundled default-price table (EU-anchored
  homebrew supplier averages dispatched by ingredient category +
  name patterns). One global inflation coefficient in Settings to
  match local markets. Batch total, per-liter, per-330 mL bottle.

#### Equipment
- Per-profile vessels (HLT / mash tun / kettle / fermenter) with
  capacities, dead spaces, evaporation rate, post-boil shrinkage,
  grain absorption, transfer loss.
- Quick-start wizard sizes every field from a target batch + setup
  type; live preview of derived grain bill, mash water, sparge,
  pre-boil before applying.

#### Storage and sync
- `StorageBackend` port with three implementations: localStorage
  fallback, OPFS (browser default — survives reloads, no quota
  cap), and GitHub Contents API (opt-in cloud sync).
- Migration on boot copies any pre-OPFS keys forward without
  user action.
- Push / Pull buttons in Settings copy every `werb.*` key in either
  direction; the PAT lives outside the synced namespace so it never
  ends up in the synced repo.
- Backup / Restore / Clear with JSON snapshots in Settings → Data.

#### Preferences
- Unit pickers in Settings: temperature (°C/°F), volume (L/gal),
  mass (kg/lb), gravity (SG/Plato), color (SRM/EBC), currency
  (€/$/£), cost adjustment coefficient.

#### App shell
- Code-split bundle: lazy editor + equipment screens, dev-only
  tokens showcase fully tree-shaken from production builds.
- ErrorBoundary at the App root with Try again / Reload recovery.
- 3-step onboarding on the empty Library state.
- Data & privacy footer in Settings establishing the local-first
  contract.
- Responsive design — tablet-perfect at 768–1024 px, usable at
  360 px. Touch targets sized for mobile.
- PWA manifest + service worker (installable, offline-capable).

### Tested
- 381 tests passing across `calc` / `adapters` / `validate` /
  `desktop`: pure-function calc coverage, BeerJSON / BeerXML
  round-trip, hook behavior under React StrictMode double-mount,
  cross-runtime file-picker cancellation (modern browsers, pre-2023
  Safari, iPadOS 15 Safari, iPadOS standalone PWA).
- Tested manually against an iPad Air 2 (iOS 15.8.4) for the PWA
  install + file-picker path.

### Pipelines
- GitHub Actions CI on every push and PR: lint + typecheck + tests
  + build.
- Web build auto-deploys to GitHub Pages on every push to `main`.
- Tag-driven desktop release pipeline: push a `v*` tag and the
  workflow builds macOS Intel + Apple Silicon, Windows, and Linux
  artifacts and attaches them to a draft GitHub Release.

[Unreleased]: https://github.com/werb-dev/werb/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/werb-dev/werb/releases/tag/v0.2.0
[0.1.0]: https://github.com/werb-dev/werb/releases/tag/v0.1.0
