# Werb — Spec v0.1

## Vision

A homebrewing tool **driven by versionable JSON files**, sitting at the intersection of Brewfather (calculation power) and Docusaurus (file-based, generation philosophy). One recipe = one BeerJSON file. One brew = one session file. Everything is validated against a JSON Schema.

## Guiding principles

1. **Contract-first** — every artifact (recipe, session, equipment) AND every calculation tool (IBU, ABV, water, color) defines its JSON Schema before its implementation. Code consumes types generated from those schemas.
2. **File-based** — the user owns their files. No hidden DB. Git-friendly.
3. **Offline-first** — Tauri 2, works without network (kitchen, garage, cellar, mobile brewery).
4. **Standards-aligned** — BeerJSON in/out, interoperable with Brewfather, BeerSmith, etc.
5. **i18n native** — EN + FR, structure ready for additional languages.

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

## Scope: v1 vs roadmap

### v1 (MVP)
- Schemas + type generation
- Ajv validation for recipes/sessions/equipment
- Calculations: IBU (Tinseth), color (Morey), ABV, basic water volumes, gravity/efficiency
- Library + schema-driven recipe view
- Brew mode with wake lock + timeline + entry + auto-save
- Session persistence on disk
- EN + FR

### v1.x — nice-to-have
- PDF export / printable brew sheet
- Inventory module (malt/hop/yeast stock, dates, expiry alerts)
- Alternative methods: IBU Rager, color Daniels
- Water profile (Ca, Mg, SO4, Cl, HCO3) + brewing water calc
- Yeast starter calculator, predictive attenuation
- BeerXML import/export (legacy)
- Optional Git sync (auto-commit sessions)
- Live temperature chart in brew mode

### Out of scope (revisit later)
- Multi-user / cloud sync
- Recipe marketplace
- Ingredient ordering integration
- Hardware sensors (Bluetooth temp probes, smart hydrometers like Tilt/iSpindel)

## Open questions

1. **UI framework**: React (safe, large ecosystem) vs Svelte (lighter, nicer for desktop)?
2. **BeerJSON official schema**: vendored in `schemas/beerjson/` or pulled as an npm dependency?
3. **Working directory**: single user-chosen folder (`~/Werb/`) or multi-library support?
4. **Recipe versioning**: support variants (`saison-v1.beerjson`, `saison-v2.beerjson`) or rely on Git for history?
5. **Wake lock on iPad via Tauri 2**: needs an early POC — main technical risk.
6. **Tests**: a reference set of recipes with known IBU/SRM/ABV values to build as fixtures (BJCP styles, public BeerJSON recipes).
