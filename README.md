# Werb

[![CI](https://img.shields.io/github/actions/workflow/status/werb-dev/werb/ci.yml?branch=main&label=CI)](https://github.com/werb-dev/werb/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/werb-dev/werb?color=e84a1f)](https://github.com/werb-dev/werb/releases/latest)
[![License: MIT](https://img.shields.io/github/license/werb-dev/werb)](./LICENSE)
[![PWA](https://img.shields.io/badge/PWA-werb--dev.github.io%2Fwerb-555?logo=pwa)](https://werb-dev.github.io/werb/)

**File-driven homebrewing tool.** Recipes in, brew sessions out — everything as plain JSON you can read, version, share, and round-trip with the tools you already use.

Werb sits at the intersection of [BeerSmith](https://beersmith.com/) (calculation depth) and [Docusaurus](https://docusaurus.io/) (file-first, your data is yours). One recipe is one BeerJSON file. One brew is one session file. Every calculation has a JSON Schema.

Runs as a [Tauri](https://tauri.app/) desktop app on macOS / Windows / Linux, and as a Progressive Web App in any modern browser.

> **macOS users — “Werb is damaged and can’t be opened”?** The desktop builds aren’t code-signed/notarized yet (Apple Developer ID pending), so Gatekeeper quarantines the download. It’s not actually damaged. Either:
> - right-click `Werb.app` → **Open** → **Open** (or System Settings → Privacy & Security → **Open Anyway**), or
> - clear the quarantine flag: `xattr -dr com.apple.quarantine /Applications/Werb.app`
>
> Or skip the install entirely and use the **[PWA](https://werb-dev.github.io/werb/)** — same app, nothing to sign, works offline once loaded.

| | |
|-|-|
| ![Library](./docs/screenshots/library.png) | ![Recipe](./docs/screenshots/recipe.png) |
| Library — every recipe at a glance. | Recipe — targets vs style (BU:GU + in-style gauges), grain-bill %, water, hops. |
| ![Brew](./docs/screenshots/brew.png) | ![Journal](./docs/screenshots/journal.png) |
| Brew — live timeline, hop schedule, measurements. | Journal — every past brew, exportable. |

## Why

Most brewing apps lock your recipes inside a proprietary cloud silo. Werb takes the opposite stance: your recipes are plain BeerJSON files on your disk, your brew sessions are plain JSON next to them, and the calc engine is a typed open library you can audit. If Werb disappears tomorrow, your data is still BeerJSON — readable in every other brewing tool.

## What you can do

- **Import** BeerJSON and BeerXML recipes from BeerSmith, Brewfather, etc.
- **Compute** IBU (Tinseth / Rager), color (Morey / Daniels), gravity, ABV, FG from yeast attenuation, water volumes (classic mash or BIAB), mash strike temperature, carbonation (priming + force), yeast pitch rate, yeast starter sizing, and brewing-salt additions to a target water profile.
- **Scale** a recipe to your equipment profile in one click.
- **Brew** with a live session screen: timeline with countdowns, per-hop addition reminders, measurement logging (gravity, pH, temperature, volume, ABV), screen wake-lock.
- **Reflect** with a post-brew sensory tasting form (7-axis radar chart, star rating, lessons-learned tags) that surfaces on the recipe screen so the next brew of the same recipe sees what to adjust.
- **Track** rough batch cost from a bundled price table with a single inflation coefficient for your local market.
- **Export** as BeerJSON, BeerXML, or a printable HTML (foldable into a PDF).
- **Sync** across devices via a private GitHub repo (optional, manual push/pull, your PAT never leaves the machine).

The app speaks **English and French** end-to-end (auto-detected, switchable in Settings) and ships **dark and light themes** — the signature Cassis dark for indoor brew days, a warm-cream light for outdoor sessions in the sun. Everything works offline. Web build is a full PWA — installable to your home screen on phones and tablets.

## Quick start

Requirements:

- **Node.js 20+** and [pnpm](https://pnpm.io/).
- **Rust toolchain via [rustup](https://rustup.rs/)**, with the WASM target installed (the BeerXML parser ships as a WASM crate). Homebrew's `rust` formula omits the `wasm32-unknown-unknown` target, so the desktop dev / test commands fail with `wasm32-unknown-unknown target not found in sysroot` if you install Rust that way — use rustup instead.
- **[wasm-pack](https://rustwasm.github.io/wasm-pack/)** to bundle the crate (`cargo install wasm-pack`).
- For desktop builds only: the [Tauri toolchain](https://tauri.app/v2/guides/getting-started/prerequisites/).

```bash
git clone --recurse-submodules <repo>   # vendor/beerjson/ is a submodule
# Already cloned? Run: git submodule update --init --recursive

# One-time Rust setup (skip if rustup is already configured):
rustup target add wasm32-unknown-unknown
cargo install wasm-pack

pnpm install
pnpm gen:types                      # generate TS types from JSON Schemas
pnpm -F @werb/desktop build:wasm    # build the BeerXML WASM crate (tests need it)
pnpm test                           # 430+ tests across calc / adapters / desktop hooks

# Web dev:
pnpm -F @werb/desktop dev

# Desktop dev (Tauri):
pnpm -F @werb/desktop tauri:dev

# Production web build:
pnpm -F @werb/desktop build
```

The BeerJSON 2.x schemas (used by the validator, the Rust type
generator, and the schema-driven tests) live under `vendor/beerjson/`
as a git submodule. It tracks the [werb-dev/beerjson](https://github.com/werb-dev/beerjson)
fork while [PR #222](https://github.com/beerjson/beerjson/pull/222) is
pending; once merged we'll repoint at upstream `beerjson/beerjson`.

## Architecture

```
schemas/                       JSON Schemas — single source of truth
  ├─ werb-equipment.schema.json
  ├─ werb-session.schema.json
  └─ tools/*.input.schema.json   one per calc tool

packages/
  ├─ types/                    schemas → TypeScript types (generated)
  ├─ calc/                     pure calc engine (IBU, water, gravity, …)
  ├─ adapters/                 BeerJSON ⇄ internal, unit helpers
  └─ validate/                 Ajv-based schema validation

crates/
  ├─ werb-beerxml/             Rust BeerXML parser
  └─ werb-beerxml-wasm/        WASM bindings for the browser

apps/
  └─ desktop/                  React + Tauri shell
      ├─ src/screens/          Library, Recipe, Brew, Journal, Settings, Equipment, Editor
      ├─ src/data/             Storage backends, units, recipes, cost, prices
      └─ src-tauri/            Rust shell + capabilities

scripts/
  └─ gen-types.mjs             schema → .d.ts compiler
```

Every calc tool is contract-first: define the JSON Schema, regenerate types, implement, test. The UI consumes those generated types.

## The `werb` CLI

A standalone Rust binary that converts and validates recipe files from the shell. Useful for bootstrapping a recipe archive on GitHub, scripting batch imports, or wiring schema validation into CI on a recipes-only repo.

```bash
# Bulk-convert mixed BeerXML/BeerJSON files into per-recipe .beerjson
werb convert ~/Downloads/*.xml ~/old-recipes/ -o ./recipes

# Validate every recipe in a folder against the BeerJSON 2.x schema
werb validate ./recipes
# ✓ ./recipes/blanche.beerjson
# ✗ ./recipes/typo.beerjson
#     /beerjson/recipes/0/style/category_number: want integer, but got string
# 1 valid · 1 invalid
```

Install: download the binary for your platform from the [latest release](https://github.com/werb-dev/werb/releases/latest), or `cargo install --git https://github.com/werb-dev/werb werb-cli`. The full reference lives in the [docs site](https://werb-dev.github.io/werb/docs/cli.html).

## Data & privacy

- **Everything stays on your device by default.** Web build uses [OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system); desktop build writes to the platform's app-data directory.
- **GitHub sync is opt-in.** Your Personal Access Token is stored in your browser's local storage and never leaves the device. Push / Pull is manual and explicit.
- **No telemetry, no analytics, no third-party scripts.**

## Status

v0.3 — public alpha. The brewing math is well-tested and matches reference tables (Tinseth + Rager IBU, Morey + Daniels color, classic + BIAB water, yeast pitch + starter sizing, FG from attenuation); UI is responsive (tablet-first, phone-usable), localised in English and French, and ships in both Cassis dark and warm-cream light. Cost estimator uses approximate EUR baseline prices — calibrate via Settings → Cost adjustment.

Tested against an iPad Air 2 (iOS 15.8.4) for the PWA path including the older Safari file-picker quirks.

## Standards & references

- **[BeerJSON 2.x](https://www.beerjson.com/)** — recipe interchange format. Werb reads and writes it round-trip.
- **[BeerXML 1.0](http://www.beerxml.com/)** — legacy interchange format. Read-only support via the bundled WASM parser.
- **[BJCP 2021 Style Guidelines](https://www.bjcp.org/style/2021/)** — embedded as the editor's style picker.

## License

MIT — see [LICENSE](./LICENSE).

## Contributing

Issues and PRs welcome. The contract-first workflow makes contributions easy to scope:

1. Pick or open an issue.
2. If your change touches a calculation, write the JSON Schema first.
3. Regenerate types (`pnpm gen:types`).
4. Implement + add tests.
5. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` should stay green.

Before tagging a release, walk through [docs/SMOKE_TEST.md](./docs/SMOKE_TEST.md) on a clean profile.

## Buy me a beer

Werb is built in the evenings between brew days. If it helped you ship a batch you're proud of, [sponsor me on GitHub](https://github.com/sponsors/ndreno) — every contribution lands as a few more hours per month on the roadmap (PDF brew sheet, inventory module, mash profile library …), the Apple developer + signing fees that keep the desktop builds landing without scary OS warnings, and the occasional sack of pale malt that becomes a regression-test brew.

Cheers, and good brewing. 🍺
