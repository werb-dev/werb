# Architecture

> 🚧 Detailed architecture writeup in progress. For now, the README's [architecture diagram](https://github.com/werb-dev/werb#architecture) covers the workspace layout.

Quick orientation:

- **`apps/desktop/`** — the React + Vite PWA, packaged as a Tauri app for desktop. UI lives here. Storage backend is selected at boot (OPFS in the browser, Tauri fs on desktop, localStorage as a fallback). The GitHub sync layer lives under `src/storage/`.
- **`crates/werb-beerxml/`** — BeerXML 1.0 parser and BeerXML → BeerJSON 2.x converter. Pure Rust.
- **`crates/werb-beerxml-wasm/`** — `wasm-bindgen` shim exposing the parser to the PWA.
- **`crates/werb-beerjson/`** — typed BeerJSON 2.x data model, generated from the vendored JSON Schema via [typify](https://github.com/oxidecomputer/typify). Source of truth for shape.
- **`crates/werb-cli/`** — the `werb` command-line tool (see [The CLI](./cli.md)).
- **`packages/calc/`** — the brewing math, pure functions, schema-validated I/O.
- **`packages/validate/`** — ajv-based BeerJSON 2.x validator for the JS side.
- **`vendor/beerjson/`** — git submodule pinning the BeerJSON schemas (currently the `werb-dev/beerjson` fork while pending PRs upstream).

The schemas are the contract. Both the JS and the Rust validation paths read from `vendor/beerjson/json/*.json`, and the typed Rust model is regenerated from them by `pnpm gen:beerjson`.
