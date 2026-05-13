//! BeerXML 1.0 parser, with optional BeerJSON 2.x conversion.
//!
//! BeerXML is the lingua franca of homebrew recipes — almost every brewing
//! tool (BeerSmith, Brewer's Friend, BrewFather…) can export it. This crate
//! parses it into typed Rust structs so you can read, transform, or
//! re-emit recipes without writing your own XML walker.
//!
//! It also ships a one-call conversion to BeerJSON 2.x (the modern
//! JSON-shaped successor) so apps that have moved on from XML can pull
//! BeerXML files in without dropping their typed pipeline.
//!
//! # Quick start
//!
//! ```no_run
//! use werb_beerxml::parse;
//!
//! let xml = std::fs::read_to_string("my_recipe.beerxml").unwrap();
//! let recipes = parse(&xml).unwrap();
//! for recipe in &recipes {
//!     println!("{}: {} L batch", recipe.name, recipe.batch_size);
//! }
//! ```
//!
//! # Convert to BeerJSON 2.x
//!
//! ```no_run
//! use werb_beerxml::parse;
//!
//! let xml = std::fs::read_to_string("my_recipe.beerxml").unwrap();
//! let recipes = parse(&xml).unwrap();
//! let beerjson = recipes[0].to_beerjson();
//! println!("{}", serde_json::to_string_pretty(&beerjson).unwrap());
//! ```
//!
//! # Scope
//!
//! BeerXML 1.0 has dozens of optional fields; this crate covers the ones
//! that recipe-sharing tools actually emit and that downstream calculators
//! consume:
//!
//! - **Recipe metadata** — name, type, brewer, batch / boil sizes, boil
//!   time, efficiency, OG/FG/IBU/color estimates, notes
//! - **Style** — name, category, BJCP letter, type, OG/FG/IBU/color ranges
//! - **Fermentables** — name, type, amount (kg), yield, color
//! - **Hops** — name, alpha %, amount (kg), use, time, form
//! - **Yeasts (cultures)** — name, type, form, amount, attenuation
//! - **Miscs** — name, type, use, time, amount
//! - **Mash** — grain temp, mash steps with type, infuse amount, step
//!   temp, step time
//!
//! Sparge / boil schedules / packaging / waters / equipment are parsed
//! pass-through if present but not currently mapped to BeerJSON.
//!
//! # Why not the old `beerxml` crate?
//!
//! [`beerxml`](https://crates.io/crates/beerxml) on crates.io was last
//! published in 2017 and pulls in `clap 2`, `error-chain`, `log 0.3`,
//! `quick-xml 0.7`, and `serde_yaml 0.7` — all severely out of date and
//! unmaintained. This crate keeps the dependency surface lean
//! (`quick-xml`, `serde`, `serde_json`, `thiserror`) and tracks the
//! modern Rust ecosystem.

#![warn(missing_docs)]
#![warn(rustdoc::broken_intra_doc_links)]

mod beerjson;
mod error;
mod joliebulle;
mod model;
mod parse;

pub use error::Error;
pub use joliebulle::{looks_like_joliebulle, parse_joliebulle};
pub use model::{
    Fermentable, FermentableType, Hop, HopForm, HopUse, MashStep, MashStepType, Misc, MiscUse,
    Recipe, RecipeType, Style, Yeast, YeastForm, YeastType,
};
pub use parse::{parse, parse_one};
