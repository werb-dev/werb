# BeerJSON schema notes

> 🚧 This page is a stub. The detailed compatibility writeup is coming.

A few quick facts about how Werb handles BeerJSON 2.x:

## We vendor the schemas

The BeerJSON 2.x JSON Schema files live under `vendor/beerjson/` as a git submodule pinning [werb-dev/beerjson](https://github.com/werb-dev/beerjson) (a fork with two pending upstream PRs). Once the PRs land in `beerjson/beerjson`, we repoint at upstream.

The vendoring keeps validation reproducible — every layer (the ajv validator in the PWA, the boon validator in the Rust tests, the CLI's `werb validate`, the typify-generated `werb-beerjson` types) reads the same byte-for-byte schema set.

## Strongly-typed model from schema

The `werb-beerjson` crate's types are generated directly from the JSON Schema by [typify](https://github.com/oxidecomputer/typify). A schema bump becomes a Rust compile error at every site that constructs a now-invalid value — which is the whole point.

Regenerate after a schema update with `pnpm gen:beerjson`.

## What Werb supports today

- **Reads + writes**: BeerJSON 2.x (full schema), BeerXML 1.0 (read-only via the WASM parser).
- **Round-trips cleanly**: any recipe Werb writes parses back through ajv + the typed Rust model without loss.
- **Lossy on input only**: a few BeerXML fields have no place in BeerJSON 2.x (the recipe-level `<IBU>` value, hop addition notes, yeast addition temperature ranges) and are dropped on conversion. The values are reconstructable from the recipe's other content.

## Tolerated quirks

Real-world BeerXML files don't always follow the spec. Werb's parser is deliberately lenient about the most common offenses:

- Empty self-closing enum elements (`<TYPE />`) on Recipe / Style / Yeast — treated as missing rather than as a parse error.
- Missing `<AMOUNT>` on yeast (one pack = one item, defaults to 0).
- `<OG>` / `<FG>` / `<COLOR>` at the recipe level instead of `<EST_OG>` / `<EST_FG>` / `<EST_COLOR>` — used as a fallback so the recipe's gravity estimates aren't silently lost.

If you find a file Werb can't import, please [file an issue](https://github.com/werb-dev/werb/issues) with the file attached.
