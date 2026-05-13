# BeerJSON schema notes

How Werb handles BeerJSON 2.x — what it reads, what it writes, where it diverges, and why.

## We vendor the schemas

The BeerJSON 2.x JSON Schema files live under `vendor/beerjson/` as a git submodule pinning [werb-dev/beerjson](https://github.com/werb-dev/beerjson) (a fork with two pending upstream PRs). Once the PRs land in `beerjson/beerjson`, we repoint at upstream.

The vendoring keeps validation reproducible — every layer (the ajv validator in the PWA, the boon validator in the Rust tests, the CLI's `werb validate`, the typify-generated `werb-beerjson` types) reads the same byte-for-byte schema set.

## Strongly-typed model from schema

The `werb-beerjson` crate's types are generated directly from the JSON Schema by [typify](https://github.com/oxidecomputer/typify). A schema bump becomes a Rust compile error at every site that constructs a now-invalid value — which is the whole point.

Regenerate after a schema update with `pnpm gen:beerjson`.

## What Werb reads today

The single **Import recipes** button (and the CLI's `werb convert` / `werb validate`) sniffs the file's content and dispatches to the right parser. Supported on the way in:

| Format | How it shows up | Notes |
|---|---|---|
| **BeerJSON 2.x** | `.beerjson` (or `.json` with `{"beerjson":{…}}`) | Full schema; written back round-trip clean. |
| **BeerXML 1.0** | `.beerxml` / `.xml` | Read-only via the WASM parser. Joliebulle v3 exports are BeerXML, so they land here. |
| **Joliebulle v4** | `.json` with `{"recipes":[…], "timestamp":…}` | Custom JSON shape the v4 desktop app emits when you export your library. Translated to BeerJSON 2.x via the same typed converter. |

On the way out, Werb writes **BeerJSON 2.x** (round-trip clean) and **BeerXML 1.0** (for sharing with tools that still need it).

## Lossy by design

A few BeerXML fields have no place in BeerJSON 2.x (the recipe-level `<IBU>` value, hop addition notes, yeast addition temperature ranges) and are dropped on conversion. Their values are reconstructable from the recipe's other content.

For joliebulle v4 specifically, the per-recipe `id` / `nameId` / pre-computed ratio fields are ignored — they're useful to joliebulle internally but don't translate.

## Tolerated quirks (BeerXML)

Real-world BeerXML files don't always follow the spec. Werb's parser is deliberately lenient about the most common offenses, all of which show up in joliebulle v3 exports:

- Empty self-closing enum elements (`<TYPE />`) on Recipe / Style / Yeast — treated as missing rather than as a parse error.
- Missing `<AMOUNT>` on yeast (one pack = one item, defaults to 0).
- `<OG>` / `<FG>` / `<COLOR>` at the recipe level instead of `<EST_OG>` / `<EST_FG>` / `<EST_COLOR>` — used as a fallback so the recipe's gravity estimates aren't silently lost.

## Tolerated quirks (joliebulle v4)

The v4 JSON shape has its own conventions the parser papers over:

- Numbers as strings (`"alpha": "4"`, `"step_temp": "67.0"`) — accepted either way.
- Empty strings, `"undefined"`, and `"FALSE"` as null markers — all collapse to `None`.
- Fermentable / hop / misc weights in **grams** instead of BeerXML's kilograms — divided by 1000 on the way in.
- "Flame Out" hop use — mapped to BeerXML's `Aroma` (post-boil late addition).

If you find a file Werb can't import, please [file an issue](https://github.com/werb-dev/werb/issues) with the file attached.
