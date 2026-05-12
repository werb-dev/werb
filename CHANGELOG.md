# Changelog

All notable changes to Werb are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/werb-dev/werb/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/werb-dev/werb/releases/tag/v0.1.0
