# Changelog

All notable changes to Werb are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
