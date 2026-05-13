# Architecture

Werb runs three ways — web PWA, desktop (Tauri), CLI — from a single workspace. Most code lives in shared packages; only the thinnest shims at the edges differ between runtimes.

## Workspace layout

```
werb/
├─ apps/
│  └─ desktop/                  React + Vite PWA, also wrapped by Tauri
│     ├─ src/                   UI screens, state hooks, storage backends
│     └─ src-tauri/             Rust shim for the native desktop wrapper
│
├─ crates/                      Rust libraries + CLI
│  ├─ werb-beerxml/             BeerXML 1.0 parser + joliebulle v4 importer
│  │                            + BeerXML→BeerJSON converter
│  ├─ werb-beerxml-wasm/        wasm-bindgen shim exposing the parsers to JS
│  ├─ werb-beerjson/            BeerJSON 2.x types, generated from the schema
│  └─ werb-cli/                 The `werb` binary (convert, validate, …)
│
├─ packages/                    JS/TS workspace packages
│  ├─ calc/                     Brewing math — pure functions, schema I/O
│  ├─ adapters/                 BeerJSON ↔ calc input bridges
│  ├─ types/                    TS types generated from JSON Schemas
│  └─ validate/                 ajv-based BeerJSON 2.x validator
│
├─ schemas/                     Werb's own JSON Schemas (equipment, session, calc i/o)
├─ vendor/beerjson/             Git submodule — upstream BeerJSON 2.x schemas
│
└─ docs/                        This site, source for mdBook
```

## Data flow on import

```
   .beerxml ─┐
   .xml     ─┤
                  ┌─ parseBeerXmlJson ──┐
                  │                     │
   .json    ─┬─→  ├─ parseJoliebulleJson┤  ──→  BeerJsonRecipe[]  ──→  StorageBackend
   .beerjson┘    │                     │                                  │
                  └─ JSON.parse ────────┘                                  ↓
                                                                          OPFS / Tauri fs /
                                                                          localStorage
```

The single **Import recipes** button in the Library screen sniffs the file's content (XML by `<` prefix, joliebulle by `{recipes:[…]}` no envelope, BeerJSON by `{beerjson:{…}}`) and dispatches to the matching parser. Every parser hands back a typed `werb_beerjson::Recipe`; serde drives the JSON wire shape, so what hits storage validates against the BeerJSON 2.x schema at every layer.

## Storage layers

Storage is abstracted behind a `StorageBackend` interface so the brewing logic doesn't know whether it's reading from disk, IndexedDB, or a remote API:

| Backend | When it's used |
|---|---|
| `opfsBackend` | Default in the browser PWA. Files live in the [origin private file system](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system). |
| Tauri filesystem | Default in the desktop app. Files live in the platform's app-data directory. |
| `localStorageBackend` | Fallback when neither of the above is available (older browsers). |
| `gitHubBackend` | Opt-in [GitHub sync](./sync.md). Not the live backend — used only for push/pull buttons. |

## Schemas are the contract

Three places in the codebase validate against the same schemas:

- The **ajv validator** in `@werb/validate` — runs at import time in the PWA.
- The **boon validator** in Rust integration tests — runs on the `Recipe::to_beerjson()` output every time the test suite runs.
- The **`werb validate` CLI** — same schemas, embedded into the binary at compile time.

All three read the same byte-for-byte files from `vendor/beerjson/json/*.json` (a git submodule pinning the upstream repo). The typed Rust model in `werb-beerjson` is also generated from those files via [typify](https://github.com/oxidecomputer/typify) — a schema bump becomes a Rust compile error at every site that constructs an affected value.

Regenerate after a schema update:

```bash
git submodule update --remote vendor/beerjson
pnpm gen:beerjson           # Rust types
pnpm gen:types              # TS types for our own schemas
```

## Calc engine

`packages/calc/` is the brewing math: IBU (Tinseth), color (Morey), gravity, ABV, water volumes, mash strike, carbonation, yeast pitch, brewing-salt additions. Each module follows the same pattern:

1. JSON Schema defines the input and output shapes (under `schemas/tools/<name>.input.schema.json`).
2. `pnpm gen:types` produces TypeScript interfaces from the schemas.
3. The function takes the typed input, returns the typed output. No I/O, no side effects.
4. Tests cover both the happy path and reference-table values from brewing literature.

UI components consume the calc functions via adapters in `packages/adapters/` that translate a BeerJSON recipe into the right calc input.

## Why three runtimes from one codebase?

- The **web PWA** is the always-available path — iPad, Chromebook, any browser. Same code as desktop.
- The **desktop app** (Tauri) gets you a real native shell with proper file dialogs, system menus, and offline-first behaviour without a service worker.
- The **CLI** is for batch work the GUI can't reasonably do — convert 232 recipes at once, validate a folder in CI, script imports.

The shared layer makes this cheap: the calc engine is one set of pure functions, the BeerJSON shape is one set of generated types, and the parsers live in `crates/` so both the WASM shim and the CLI use the same code.
