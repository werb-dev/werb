# werb-beerxml

[![docs.rs](https://img.shields.io/badge/docs.rs-werb--beerxml-blue)](https://docs.rs/werb-beerxml)
[![License: MIT OR Apache-2.0](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-blue.svg)](#license)

A modern, lightweight **BeerXML 1.0 parser** in Rust, with optional one-call
conversion to [BeerJSON 2.x](https://github.com/beerjson/beerjson).

Built because the existing [`beerxml`](https://crates.io/crates/beerxml)
crate has been unmaintained since 2017 and pulls in a stack of long-dead
dependencies (`error-chain`, `clap 2`, `log 0.3`, `quick-xml 0.7`,
`serde_yaml 0.7`). This crate keeps the dependency surface lean — just
`quick-xml`, `serde`, `serde_json`, and `thiserror` — so you can drop it
into a brewing app, a CLI, or a Tauri backend without dragging the past
along with you.

## Why?

BeerXML is the de-facto recipe-exchange format for the homebrew world.
Almost every brewing tool (BeerSmith, Brewer's Friend, BrewFather, GrainFather,
Tilt) can export it, so any app that wants to import "the recipes people
already have" needs to read BeerXML. BeerJSON 2.x is the modern
JSON-shaped successor, and tools are gradually adopting it — but BeerXML
will be in circulation for years yet. This crate lets you parse the old
format and emit the new one in a single call.

## Install

```toml
[dependencies]
werb-beerxml = "0.1"
```

## Usage

### Parsing BeerXML

```rust
use werb_beerxml::parse;

let xml = std::fs::read_to_string("my_recipe.beerxml")?;
for recipe in parse(&xml)? {
    println!(
        "{} ({}): {:.1} L batch, {} hop additions",
        recipe.name,
        recipe.style.as_ref().map(|s| s.name.as_str()).unwrap_or("—"),
        recipe.batch_size,
        recipe.hops.as_ref().map(|h| h.items.len()).unwrap_or(0),
    );
}
# Ok::<(), werb_beerxml::Error>(())
```

If you know there is exactly one recipe in the file:

```rust
use werb_beerxml::parse_one;

let xml = std::fs::read_to_string("my_recipe.beerxml")?;
let recipe = parse_one(&xml)?;
println!("{}", recipe.name);
# Ok::<(), werb_beerxml::Error>(())
```

### Converting to BeerJSON 2.x

```rust
use werb_beerxml::parse_one;

let xml = std::fs::read_to_string("my_recipe.beerxml")?;
let recipe = parse_one(&xml)?;
let beerjson = recipe.to_beerjson();
println!("{}", serde_json::to_string_pretty(&beerjson)?);
# Ok::<(), Box<dyn std::error::Error>>(())
```

The output is a `serde_json::Value` matching the BeerJSON 2.x `recipe`
schema, ready to be embedded under a `beerjson.recipes[]` array or
written to disk.

## Coverage

The crate covers the BeerXML elements that recipe-sharing tools actually
emit and that downstream calculators consume:

| Block               | Fields                                                                                   |
|---------------------|------------------------------------------------------------------------------------------|
| `<RECIPE>`          | name, type, brewer, batch_size, boil_size, boil_time, efficiency, ibu, est_og/fg/color, notes |
| `<STYLE>`           | name, category, category_number, style_letter, style_guide, type, og/fg/ibu/color min+max |
| `<FERMENTABLES>`    | name, type, amount (kg), yield, color, origin, supplier, notes                          |
| `<HOPS>`            | name, alpha, amount, use, time, form, type, notes                                       |
| `<YEASTS>`          | name, type, form, amount, amount_is_weight, laboratory, product_id, attenuation         |
| `<MISCS>`           | name, type, use, time, amount, amount_is_weight                                         |
| `<MASH>`            | name, grain_temp, plus mash_steps (name, type, infuse_amount, step_temp, step_time, ramp_time, end_temp) |

Sparge / equipment / waters / boil schedule / packaging are out of
scope for v0.1; PRs welcome if you need them.

## Error handling

Every entry point returns a [`Result<T, Error>`](Error). Variants:

- **`Error::Xml`** — the input is not well-formed XML, or the structure
  does not match what BeerXML expects.
- **`Error::NoRecipes`** — the document parsed but contained zero
  `<RECIPE>` elements.
- **`Error::InvalidNumber`** — a numeric field could not be parsed.
  (Currently only emitted via helpers; the main parser delegates number
  parsing to serde, which surfaces as `Error::Xml`.)

## Compatibility

- Rust **1.74+** (anything that can build modern `quick-xml` + `serde`
  derive).
- BeerXML **1.0** (the only published version of the spec — there is no
  2.0).
- BeerJSON output targets **2.x**.

## License

Licensed under either of:

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or
  https://www.apache.org/licenses/LICENSE-2.0)
- MIT license ([LICENSE-MIT](LICENSE-MIT) or
  https://opensource.org/licenses/MIT)

at your option.

### Contribution

Unless you explicitly state otherwise, any contribution intentionally
submitted for inclusion in the work by you, as defined in the Apache-2.0
license, shall be dual-licensed as above, without any additional terms
or conditions.
