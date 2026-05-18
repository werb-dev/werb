# Werb — Spec v0.1

## Vision

A homebrewing tool **driven by versionable JSON files**, sitting at the intersection of Brewfather (calculation power) and Docusaurus (file-based, generation philosophy). One recipe = one BeerJSON file. One brew = one session file. Everything is validated against a JSON Schema.

## Guiding principles

1. **Contract-first** — every artifact (recipe, session, equipment) AND every calculation tool (IBU, ABV, water, color) defines its JSON Schema before its implementation. Code consumes types generated from those schemas.
2. **File-based** — the user owns their files. No hidden DB. Git-friendly.
3. **Offline-first** — Tauri 2, works without network (kitchen, garage, cellar, mobile brewery).
4. **Standards-aligned** — BeerJSON in/out, interoperable with Brewfather, BeerSmith, etc.
5. **i18n native** — EN + FR, structure ready for additional languages.
6. **Git is the timeline** — Werb does not implement in-app trash, archive, or version history. Recipes are files; "I deleted it by mistake" is `git checkout`, "what did this look like before" is `git log`. If you find yourself building a soft-delete UI, you've drifted from this principle.
7. **Curated catalog, community-extended** — Werb ships a vetted ingredient catalog (malts, hops, cultures, miscs, styles). New entries land via PR to this repo, not via per-user in-app overrides. The catalog stays small, accurate, and shared by every install. A user is welcome to override a name in the recipe itself; the *catalog* is canonical and immutable from the app.

## Architecture

### Layers

```
┌────────────────────────────────────────┐
│  UI (Tauri webview) — i18n, wake lock  │
├────────────────────────────────────────┤
│  Calc engine (pure, typed, contract-first)│
│  ├─ IBU     (Tinseth, Rager)           │
│  ├─ Color   (Morey, Daniels)           │
│  ├─ ABV     (OG/FG)                    │
│  ├─ Water   (mash, sparge, total)      │
│  └─ Gravity (efficiency, target OG/FG) │
├────────────────────────────────────────┤
│  Persistence (JSON files on disk)      │
│  ├─ recipes/*.beerjson                 │
│  ├─ sessions/*.session.json            │
│  └─ equipment/*.equipment.json         │
└────────────────────────────────────────┘
```

### Data model

| File | Schema | Editing | Role |
|------|--------|---------|------|
| `recipes/<name>.beerjson` | Official BeerJSON 2.x | rare | immutable recipe spec |
| `sessions/<date>-<recipe>.session.json` | `werb-session.schema.json` | live (brew mode) | actual brew log |
| `equipment/<name>.equipment.json` | `werb-equipment.schema.json` | rare | kettle/equipment profile (efficiency, dead space, evaporation, losses) |

A session **references** a recipe + an equipment profile by relative path. All user files are validated on read (Ajv) and on write.

## Repo structure (contract-first)

```
werb/
├── schemas/                          ★ source of truth
│   ├── beerjson/                     # official spec (vendored)
│   │   └── beer.json                 # BeerJSON 2.x JSON Schema
│   ├── werb-session.schema.json
│   ├── werb-equipment.schema.json
│   └── tools/                        # calculation contracts
│       ├── ibu.input.schema.json
│       ├── ibu.output.schema.json
│       ├── color.input.schema.json
│       ├── color.output.schema.json
│       ├── abv.input.schema.json
│       ├── abv.output.schema.json
│       ├── water.input.schema.json
│       ├── water.output.schema.json
│       ├── gravity.input.schema.json
│       └── gravity.output.schema.json
│
├── packages/
│   ├── types/                        # TS types generated from schemas/
│   ├── calc/                         # calc engine (pure functions)
│   ├── validate/                     # Ajv wrappers
│   ├── i18n/                         # locales/{en,fr}.json + glossary
│   └── ui/                           # shared components
│
├── apps/
│   └── desktop/                      # Tauri 2 app
│       ├── src-tauri/                # Rust backend (FS, wake lock)
│       └── src/                      # frontend
│
├── examples/                         # demo recipes/sessions/equipment
└── package.json
```

### Contract-first pattern for calc tools

Each tool = **contract (input/output JSON Schema) + pure implementation**.

```json
// schemas/tools/ibu.input.schema.json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "IBU calculation input",
  "type": "object",
  "required": ["batch_size_l", "og", "hops"],
  "properties": {
    "batch_size_l": { "type": "number", "exclusiveMinimum": 0 },
    "og": { "type": "number", "minimum": 1, "maximum": 1.2 },
    "method": { "enum": ["tinseth", "rager"], "default": "tinseth" },
    "hops": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["amount_g", "alpha_acid_pct", "time_min"],
        "properties": {
          "amount_g": { "type": "number", "minimum": 0 },
          "alpha_acid_pct": { "type": "number", "minimum": 0, "maximum": 30 },
          "time_min": { "type": "number", "minimum": 0 }
        }
      }
    }
  }
}
```

```ts
// packages/calc/src/ibu.ts
import type { IbuInput, IbuOutput } from '@werb/types';

export function computeIbu(input: IbuInput): IbuOutput {
  // pure, tested against public BeerJSON fixtures
}
```

Benefits: swappable implementations (Tinseth ↔ Rager), unit-testable in isolation, auto-generated docs, runtime validation, derived types.

### Type generation

```
schemas/*.json  ──[json-schema-to-typescript]──▶  packages/types/
```

A single command (`pnpm gen:types`) regenerates every type. CI checks they're up to date.

## v1 screens

1. **Library** — list of recipes (scan of `recipes/`), filters by style/IBU/ABV.
2. **Recipe** — SwaggerUI-style view rendered from BeerJSON + a strip of computed values (IBU, SRM/EBC, target ABV, water volumes, expected efficiency) based on the selected equipment.
3. **Sessions** — brew history, link back to source recipe, target vs actual comparison.
4. **Brew mode** — tablet-friendly screen, **wake lock active**, step timeline (mash, sparge, boil, hop additions, chilling, transfer), timers, live entry (T°, gravity, notes). Auto-save on every change.
5. **Equipment** — edit/select default profile.
6. **Settings** — language, working directory, default equipment, calc method (Tinseth/Rager, Morey/Daniels).

## Tech stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Shell | **Tauri 2** | desktop + iOS/Android (iPad), small binary, native FS access |
| Frontend | **React + Vite + TypeScript** | mature ecosystem; Svelte alternative TBD |
| Validation | **Ajv** (JSON Schema 2020-12) | standard, fast |
| Type generation | **json-schema-to-typescript** | single source of types |
| i18n | **i18next** | mature, EN/FR |
| Wake lock | **Tauri plugin** + Web Wake Lock API fallback | native on iOS/Android |
| Calc tests | **Vitest** + public BeerJSON fixtures | validate against known recipes |
| Monorepo | **pnpm workspaces** | enough for v1, Turborepo later if needed |

## i18n — rules

- UI strings: `packages/i18n/locales/{en,fr}.json`.
- Process terms: translated (Mash → Empâtage, Sparge → Rinçage, Boil → Ébullition, Whirlpool → Whirlpool, Dry hop → Houblonnage à cru, etc.).
- Commercial names (malts, hops, yeasts): **kept verbatim** in BeerJSON files (e.g. "Cascade", "Maris Otter", "WLP001").
- Established translations: dictionary `packages/i18n/glossary.{en,fr}.json`, applied only to generic terms (e.g. "two-row" → "deux rangs" if we deem it established). Case-by-case, conservative by default.

## Scope

### Shipped (v0.2 / v0.3)

- Schemas + type generation (both TS and Rust via typify)
- Ajv validation for recipes/sessions/equipment in the PWA + boon validation in Rust tests + a `werb validate` CLI binary
- Calc engine: IBU (Tinseth + Rager), color (Morey + Daniels), ABV, FG from yeast attenuation, water volumes (classic + BIAB), gravity/efficiency, mash strike, carbonation (priming + force), yeast pitch rate, yeast starter sizing, water-salt additions
- Library + schema-driven recipe view + recipe editor
- Brew mode with wake lock + timeline + per-step measurement logging + sensory tasting form
- Cost tracking with a bundled price table
- Single **Import recipes** entry point that auto-detects BeerJSON 2.x, BeerXML 1.0, and joliebulle v4 exports
- BeerXML 1.0 import + BeerXML / BeerJSON / printable-HTML export
- Optional GitHub recipe sync (one `<slug>.beerjson` per recipe, manual Push / Pull)
- `werb` CLI for batch conversion + validation, distributed as prebuilt binaries
- EN + FR, light + Cassis-dark themes
- iPad PWA path validated against iOS 15 Safari
- Source-water profile presets (Pilsen, Munich, Dortmund, Vienna, Burton, London, Edinburgh, Dublin, RO) bundled in the catalog and filled in from the Recipe water-chemistry form
- BIAB equipment mode: all water in the kettle at once, no sparge step
- Alternative IBU (Rager) and color (Daniels) methods, switchable in Settings
- Yeast starter sizing using the Braukaiser growth model with stir-plate / shake / still aeration
- Build-time version + commit + date stamp in Settings footer

### Next — joliebulle parity

Pickup features for ex-joliebulle users. None of these are about *catching up* on output quality (Werb's brew + journal side already goes further than joliebulle did); they're about making the recipe-management side feel familiar.

- **Mash profile library** — reusable mash schedules picked from a list; not redefined per recipe.
- **Recipe history notes** — free-text timestamped notes field on each recipe ("scaled OG up 2 pts after the cold mash"). For longer-form change tracking, Git remains the timeline (principle #6).

### Next — universal brewing polish

Features useful to every brewer, not joliebulle-specific.

- **PDF brew sheet** — a real, paginated PDF export. The existing printable HTML works through the browser's Print dialog, but a one-click PDF is friendlier.
- **Inventory module** — malt/hop/yeast/misc stock list with expiry alerts. Recipe screen calls out missing or short ingredients.

### Out of scope (revisit only on a strong specific signal)

- **In-app trash / archive / soft-delete** — principle #6: Git is the timeline.
- **In-app user-editable ingredient catalog** — principle #7: catalog additions land via PR.
- Multi-user / cloud sync (GitHub sync covers the personal-multi-device case; full cloud is a separate product).
- Recipe marketplace, ingredient ordering integration.
- Hardware sensors (Bluetooth temp probes, smart hydrometers like Tilt/iSpindel).
- Live temperature chart in brew mode — measurement log is enough; a chart is dashboard creep.

## Open questions

The MVP-era open questions resolved themselves through delivery (React shipped; BeerJSON vendored as a submodule; wake lock works on iPad Safari; Git answers the recipe-versioning question per principle #6). One real one remains:

1. **Working directory** (desktop only): single user-chosen folder (`~/Werb/`) or multi-library support? Today the desktop app uses the platform's app-data dir + opt-in GitHub sync. A "this folder is my recipe library" experience would land before any multi-library design.
