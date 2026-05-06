//! Typed BeerXML 1.0 data model.
//!
//! Every public struct here mirrors a BeerXML element. Field names use
//! `snake_case` (the Rust idiom); serde renames them back to the
//! `SCREAMING_SNAKE_CASE` BeerXML form during (de)serialization.

use serde::{Deserialize, Serialize};

/// A single brewing recipe — the top-level `<RECIPE>` element.
///
/// Field semantics follow the [BeerXML 1.0 spec](https://beerxml.com/).
/// Volumes are in liters, masses in kilograms, times in minutes,
/// temperatures in degrees Celsius, and percentages as plain numbers
/// (e.g. `5.0` means 5%).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub struct Recipe {
    /// Recipe display name.
    pub name: String,
    /// Schema version. BeerXML 1.0 always writes `1`.
    #[serde(default = "default_version")]
    pub version: u32,
    /// Recipe construction style — extract, partial mash, or all-grain.
    /// Optional in practice: many exporters omit this even though the
    /// spec lists it as required.
    #[serde(default, rename = "TYPE")]
    pub recipe_type: Option<RecipeType>,
    /// Optional brewer name.
    #[serde(default)]
    pub brewer: Option<String>,
    /// Batch (post-boil, into-fermenter) volume, in liters.
    pub batch_size: f64,
    /// Boil-kettle starting volume, in liters. Optional — defaults to
    /// `batch_size * 1.25` in [`Recipe::effective_boil_size`] when absent.
    #[serde(default)]
    pub boil_size: Option<f64>,
    /// Boil duration, in minutes. Optional — defaults to 60 in
    /// [`Recipe::effective_boil_time`] when absent.
    #[serde(default)]
    pub boil_time: Option<f64>,
    /// Brewhouse efficiency, in percent (0–100).
    #[serde(default)]
    pub efficiency: Option<f64>,
    /// Style match for this recipe.
    #[serde(default)]
    pub style: Option<Style>,
    /// Hop additions, if any.
    #[serde(default)]
    pub hops: Option<Hops>,
    /// Fermentable (grain / sugar / extract) additions, if any.
    #[serde(default)]
    pub fermentables: Option<Fermentables>,
    /// Yeast / culture additions, if any.
    #[serde(default)]
    pub yeasts: Option<Yeasts>,
    /// Miscellaneous additions (spices, finings, water agents).
    #[serde(default)]
    pub miscs: Option<Miscs>,
    /// Mash schedule, if defined.
    #[serde(default)]
    pub mash: Option<Mash>,
    /// Estimated original gravity. BeerXML stores this as text like
    /// `"1.052 SG"` so it is exposed verbatim; use [`Recipe::est_og_value`]
    /// to extract the float.
    #[serde(default)]
    pub est_og: Option<String>,
    /// Estimated final gravity, raw BeerXML text — see [`Recipe::est_fg_value`].
    #[serde(default)]
    pub est_fg: Option<String>,
    /// Estimated color, raw BeerXML text (e.g. `"12.5 SRM"`).
    #[serde(default)]
    pub est_color: Option<String>,
    /// Estimated bitterness, in IBU.
    #[serde(default)]
    pub ibu: Option<f64>,
    /// Free-form recipe notes.
    #[serde(default)]
    pub notes: Option<String>,
}

fn default_version() -> u32 {
    1
}

impl Recipe {
    /// Returns [`recipe_type`](Self::recipe_type) or, when absent, falls
    /// back to [`RecipeType::AllGrain`] — the most common shape of
    /// recipe in BeerXML exports.
    pub fn effective_recipe_type(&self) -> RecipeType {
        self.recipe_type.clone().unwrap_or(RecipeType::AllGrain)
    }

    /// Returns [`boil_size`](Self::boil_size) or, when absent, falls
    /// back to `batch_size * 1.25` — a reasonable estimate for the
    /// pre-boil kettle volume.
    pub fn effective_boil_size(&self) -> f64 {
        self.boil_size.unwrap_or(self.batch_size * 1.25)
    }

    /// Returns [`boil_time`](Self::boil_time) or 60 minutes when absent.
    pub fn effective_boil_time(&self) -> f64 {
        self.boil_time.unwrap_or(60.0)
    }

    /// Parses [`est_og`](Self::est_og) as a float, dropping any unit suffix.
    pub fn est_og_value(&self) -> Option<f64> {
        parse_leading_f64(self.est_og.as_deref()?)
    }

    /// Parses [`est_fg`](Self::est_fg) as a float, dropping any unit suffix.
    pub fn est_fg_value(&self) -> Option<f64> {
        parse_leading_f64(self.est_fg.as_deref()?)
    }

    /// Parses [`est_color`](Self::est_color) as a float (SRM or whichever
    /// unit the source emitted), dropping any unit suffix.
    pub fn est_color_value(&self) -> Option<f64> {
        parse_leading_f64(self.est_color.as_deref()?)
    }
}

fn parse_leading_f64(s: &str) -> Option<f64> {
    let trimmed = s.trim();
    let end = trimmed
        .find(|c: char| !(c.is_ascii_digit() || c == '.' || c == '-' || c == '+'))
        .unwrap_or(trimmed.len());
    trimmed[..end].parse().ok()
}

/// How the recipe is brewed.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum RecipeType {
    /// Malt extract only.
    Extract,
    /// Mostly extract with a steeping or partial mash.
    #[serde(rename = "Partial Mash")]
    PartialMash,
    /// Full all-grain mash.
    #[serde(rename = "All Grain")]
    AllGrain,
}

// ─── Style ────────────────────────────────────────────────────────────────

/// A `<STYLE>` block describing the target style of a recipe.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub struct Style {
    /// Style name (e.g. `"American IPA"`).
    pub name: String,
    /// Schema version.
    #[serde(default = "default_version")]
    pub version: u32,
    /// Free-text category (e.g. `"India Pale Ale"`).
    #[serde(default)]
    pub category: Option<String>,
    /// Numeric category from the style guide (e.g. `"21"`).
    #[serde(default)]
    pub category_number: Option<String>,
    /// Letter sub-category from the style guide (e.g. `"A"`).
    #[serde(default)]
    pub style_letter: Option<String>,
    /// Style guide name (e.g. `"BJCP 2015"`).
    #[serde(default)]
    pub style_guide: Option<String>,
    /// Beer family — Ale / Lager / etc.
    #[serde(default, rename = "TYPE")]
    pub style_type: Option<String>,
    /// Minimum target original gravity.
    #[serde(default)]
    pub og_min: Option<f64>,
    /// Maximum target original gravity.
    #[serde(default)]
    pub og_max: Option<f64>,
    /// Minimum target final gravity.
    #[serde(default)]
    pub fg_min: Option<f64>,
    /// Maximum target final gravity.
    #[serde(default)]
    pub fg_max: Option<f64>,
    /// Minimum target IBU.
    #[serde(default)]
    pub ibu_min: Option<f64>,
    /// Maximum target IBU.
    #[serde(default)]
    pub ibu_max: Option<f64>,
    /// Minimum target color (SRM).
    #[serde(default)]
    pub color_min: Option<f64>,
    /// Maximum target color (SRM).
    #[serde(default)]
    pub color_max: Option<f64>,
}

// ─── Hops ─────────────────────────────────────────────────────────────────

/// Wrapper for a list of `<HOP>` elements inside `<HOPS>`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Hops {
    /// The hop additions themselves.
    #[serde(rename = "HOP", default)]
    pub items: Vec<Hop>,
}

/// A single `<HOP>` addition.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub struct Hop {
    /// Hop variety name (e.g. `"Cascade"`).
    pub name: String,
    /// Schema version.
    #[serde(default = "default_version")]
    pub version: u32,
    /// Alpha-acid percentage.
    pub alpha: f64,
    /// Amount, in kilograms.
    pub amount: f64,
    /// Where in the brew the hop is added.
    #[serde(default, rename = "USE")]
    pub hop_use: Option<HopUse>,
    /// Boil time (or dry-hop duration), in minutes.
    #[serde(default)]
    pub time: Option<f64>,
    /// Pellet / leaf / plug.
    #[serde(default)]
    pub form: Option<HopForm>,
    /// Bittering / aroma / both.
    #[serde(default, rename = "TYPE")]
    pub hop_type: Option<String>,
    /// Free-text notes (e.g. flavor descriptors).
    #[serde(default)]
    pub notes: Option<String>,
}

/// When the hop is added during brewing.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum HopUse {
    /// Added to the boil kettle.
    Boil,
    /// Dry-hopped during fermentation or conditioning.
    #[serde(rename = "Dry Hop")]
    DryHop,
    /// Added to the mash.
    Mash,
    /// First wort hopping.
    #[serde(rename = "First Wort")]
    FirstWort,
    /// Aroma / whirlpool addition (post-boil).
    Aroma,
}

/// Physical form of the hop.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum HopForm {
    /// Compressed pellets — the most common modern form.
    Pellet,
    /// Plug-pressed whole hops.
    Plug,
    /// Whole-leaf hops.
    Leaf,
}

// ─── Fermentables ─────────────────────────────────────────────────────────

/// Wrapper for a list of `<FERMENTABLE>` elements inside `<FERMENTABLES>`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Fermentables {
    /// The fermentable additions.
    #[serde(rename = "FERMENTABLE", default)]
    pub items: Vec<Fermentable>,
}

/// A single `<FERMENTABLE>` — grain, sugar, or extract.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub struct Fermentable {
    /// Display name (e.g. `"Pilsner Malt"`).
    pub name: String,
    /// Schema version.
    #[serde(default = "default_version")]
    pub version: u32,
    /// Grain / sugar / extract / dry extract / adjunct.
    #[serde(rename = "TYPE")]
    pub fermentable_type: FermentableType,
    /// Amount, in kilograms.
    pub amount: f64,
    /// Yield percentage — sugar potential as a fraction of dry weight.
    #[serde(default, rename = "YIELD")]
    pub yield_pct: Option<f64>,
    /// Color, in degrees Lovibond (BeerXML uses Lovibond, not SRM).
    #[serde(default)]
    pub color: Option<f64>,
    /// Country / region of origin.
    #[serde(default)]
    pub origin: Option<String>,
    /// Maltster / supplier name.
    #[serde(default)]
    pub supplier: Option<String>,
    /// Free-text notes.
    #[serde(default)]
    pub notes: Option<String>,
}

/// Kind of fermentable.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum FermentableType {
    /// Whole grain malt.
    Grain,
    /// Refined sugar (table, candi, dextrose…).
    Sugar,
    /// Liquid malt extract.
    Extract,
    /// Dry malt extract.
    #[serde(rename = "Dry Extract")]
    DryExtract,
    /// Non-grain adjunct (oats, rye, corn).
    Adjunct,
}

// ─── Yeasts ───────────────────────────────────────────────────────────────

/// Wrapper for a list of `<YEAST>` elements inside `<YEASTS>`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Yeasts {
    /// The yeast / culture additions.
    #[serde(rename = "YEAST", default)]
    pub items: Vec<Yeast>,
}

/// A single `<YEAST>` (or other fermentation culture).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub struct Yeast {
    /// Display name (e.g. `"Safale US-05"`).
    pub name: String,
    /// Schema version.
    #[serde(default = "default_version")]
    pub version: u32,
    /// Yeast family — Ale, Lager, Wheat, Wine, Champagne.
    #[serde(rename = "TYPE")]
    pub yeast_type: YeastType,
    /// Liquid, dry, slant, or culture.
    pub form: YeastForm,
    /// Amount in liters (for liquid) or kilograms (for dry, when
    /// `amount_is_weight` is true).
    pub amount: f64,
    /// `true` when [`amount`](Self::amount) is in kg rather than L.
    #[serde(default)]
    pub amount_is_weight: Option<bool>,
    /// Producer / lab name (e.g. `"Wyeast"`, `"Fermentis"`).
    #[serde(default)]
    pub laboratory: Option<String>,
    /// Producer's product code (e.g. `"US-05"`, `"WLP001"`).
    #[serde(default)]
    pub product_id: Option<String>,
    /// Apparent attenuation, in percent.
    #[serde(default)]
    pub attenuation: Option<f64>,
}

/// Yeast family.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum YeastType {
    /// Top-fermenting ale yeast.
    Ale,
    /// Bottom-fermenting lager yeast.
    Lager,
    /// Wheat / hefeweizen yeast.
    Wheat,
    /// Wine yeast.
    Wine,
    /// Champagne yeast.
    Champagne,
}

/// Physical form of the culture.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum YeastForm {
    /// Liquid culture (smack-pack, vial).
    Liquid,
    /// Dry sachet.
    Dry,
    /// Agar slant.
    Slant,
    /// Maintained culture / starter.
    Culture,
}

// ─── Miscs ────────────────────────────────────────────────────────────────

/// Wrapper for a list of `<MISC>` elements inside `<MISCS>`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Miscs {
    /// The miscellaneous additions.
    #[serde(rename = "MISC", default)]
    pub items: Vec<Misc>,
}

/// A miscellaneous addition (spice, fining, water agent, herb, flavor).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub struct Misc {
    /// Display name (e.g. `"Irish Moss"`).
    pub name: String,
    /// Schema version.
    #[serde(default = "default_version")]
    pub version: u32,
    /// Spice / fining / water agent / herb / flavor / other.
    #[serde(rename = "TYPE")]
    pub misc_type: Option<String>,
    /// Where it is added — boil, mash, primary, secondary, bottling.
    #[serde(default, rename = "USE")]
    pub misc_use: Option<MiscUse>,
    /// Time at addition, in minutes.
    #[serde(default)]
    pub time: Option<f64>,
    /// Amount in liters or kilograms (see [`amount_is_weight`](Self::amount_is_weight)).
    pub amount: f64,
    /// `true` when [`amount`](Self::amount) is in kg rather than L.
    #[serde(default)]
    pub amount_is_weight: Option<bool>,
}

/// Where a miscellaneous ingredient is added.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum MiscUse {
    /// Boil kettle.
    Boil,
    /// Mash tun.
    Mash,
    /// Primary fermenter.
    Primary,
    /// Secondary fermenter.
    Secondary,
    /// Bottling / packaging.
    Bottling,
}

// ─── Mash ─────────────────────────────────────────────────────────────────

/// A `<MASH>` profile.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub struct Mash {
    /// Profile name.
    pub name: String,
    /// Schema version.
    #[serde(default = "default_version")]
    pub version: u32,
    /// Initial grain temperature, in °C.
    #[serde(default)]
    pub grain_temp: Option<f64>,
    /// Steps that make up the mash schedule.
    #[serde(default)]
    pub mash_steps: Option<MashSteps>,
}

/// Wrapper for a list of `<MASH_STEP>` elements.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MashSteps {
    /// The mash steps.
    #[serde(rename = "MASH_STEP", default)]
    pub items: Vec<MashStep>,
}

/// A single mash rest.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub struct MashStep {
    /// Step name (e.g. `"Saccharification"`).
    pub name: String,
    /// Schema version.
    #[serde(default = "default_version")]
    pub version: u32,
    /// Infusion / temperature / decoction.
    #[serde(rename = "TYPE")]
    pub step_type: MashStepType,
    /// Volume of water added at this step, in liters (for infusion steps).
    #[serde(default)]
    pub infuse_amount: Option<f64>,
    /// Target rest temperature, in °C.
    pub step_temp: f64,
    /// Rest duration, in minutes.
    pub step_time: f64,
    /// Time spent ramping to [`step_temp`](Self::step_temp), in minutes.
    #[serde(default)]
    pub ramp_time: Option<f64>,
    /// End temperature for ramped steps, in °C.
    #[serde(default)]
    pub end_temp: Option<f64>,
}

/// Kind of mash step.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum MashStepType {
    /// Hot-water infusion.
    Infusion,
    /// External heat applied to the existing mash.
    Temperature,
    /// Decoction — pull part of the mash, boil it, return it.
    Decoction,
}
