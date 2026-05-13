//! Typed BeerXML 1.0 data model.
//!
//! Every public struct here mirrors a BeerXML element. Field names use
//! `snake_case` (the Rust idiom); serde renames them back to the
//! `SCREAMING_SNAKE_CASE` BeerXML form during (de)serialization.

use serde::{de, Deserialize, Deserializer, Serialize};

/// Serde helper: treat an empty / whitespace-only XML element value
/// as `None` rather than failing the parse. Many BeerXML files in the
/// wild contain placeholder fields like `<COLOR></COLOR>` or
/// `<MIN_TEMPERATURE/>` that are technically illegal numbers but
/// should not derail an entire import.
fn empty_str_to_none_f64<'de, D>(de: D) -> Result<Option<f64>, D::Error>
where
    D: Deserializer<'de>,
{
    match Option::<String>::deserialize(de)? {
        Some(s) if !s.trim().is_empty() => {
            s.trim().parse::<f64>().map(Some).map_err(de::Error::custom)
        }
        _ => Ok(None),
    }
}

/// Serde helper for required `f64` fields: empty string falls back to
/// `0.0` instead of failing. Used for fields the BeerXML spec calls
/// required but real exports occasionally leave blank.
fn empty_str_to_zero_f64<'de, D>(de: D) -> Result<f64, D::Error>
where
    D: Deserializer<'de>,
{
    let s = String::deserialize(de)?;
    if s.trim().is_empty() {
        Ok(0.0)
    } else {
        s.trim().parse::<f64>().map_err(de::Error::custom)
    }
}

/// Serde helper for `Option<T>` fields where `T` is normally a
/// string-tagged enum. joliebulle (and probably others) export empty
/// self-closing elements (`<TYPE />`) instead of omitting the tag
/// entirely — quick-xml hands those to serde as the literal token
/// `$text`, which fails enum deserialization with `unknown variant`.
///
/// This helper intercepts that case: deserialize to `Option<String>`
/// first, treat empty / whitespace / `$text` as `None`, and only on
/// a real value drive the inner deserializer via the captured string.
fn empty_str_to_none_enum<'de, T, D>(de: D) -> Result<Option<T>, D::Error>
where
    D: Deserializer<'de>,
    T: serde::de::DeserializeOwned,
{
    let raw: Option<String> = Option::deserialize(de)?;
    let Some(s) = raw else { return Ok(None) };
    let trimmed = s.trim();
    if trimmed.is_empty() || trimmed == "$text" {
        return Ok(None);
    }
    T::deserialize(serde::de::value::StringDeserializer::<D::Error>::new(
        trimmed.to_string(),
    ))
    .map(Some)
}

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
    /// spec lists it as required. joliebulle writes `<TYPE />` when
    /// unset, which the empty-str helper folds back to `None`.
    #[serde(default, rename = "TYPE", deserialize_with = "empty_str_to_none_enum")]
    pub recipe_type: Option<RecipeType>,
    /// Optional brewer name.
    #[serde(default)]
    pub brewer: Option<String>,
    /// Batch (post-boil, into-fermenter) volume, in liters.
    #[serde(deserialize_with = "empty_str_to_zero_f64")]
    pub batch_size: f64,
    /// Boil-kettle starting volume, in liters. Optional — defaults to
    /// `batch_size * 1.25` in [`Recipe::effective_boil_size`] when absent.
    #[serde(default, deserialize_with = "empty_str_to_none_f64")]
    pub boil_size: Option<f64>,
    /// Boil duration, in minutes. Optional — defaults to 60 in
    /// [`Recipe::effective_boil_time`] when absent.
    #[serde(default, deserialize_with = "empty_str_to_none_f64")]
    pub boil_time: Option<f64>,
    /// Brewhouse efficiency, in percent (0–100).
    #[serde(default, deserialize_with = "empty_str_to_none_f64")]
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
    /// Measured original gravity (post-brew). BeerXML 1.0 separates
    /// the recipe-time estimate ([`est_og`](Self::est_og)) from the
    /// actual value at the end of the brew, but joliebulle and a few
    /// other tools collapse the two — they emit `<OG>` even for an
    /// unbrewed template. [`Recipe::est_og_value`] falls back to this
    /// field when [`est_og`](Self::est_og) is empty.
    #[serde(default)]
    pub og: Option<String>,
    /// Measured final gravity; see [`og`](Self::og).
    #[serde(default)]
    pub fg: Option<String>,
    /// Measured color; same template-vs-actual story as gravity.
    /// [`Recipe::est_color_value`] falls back to this field.
    #[serde(default)]
    pub color: Option<String>,
    /// Estimated bitterness, in IBU.
    #[serde(default, deserialize_with = "empty_str_to_none_f64")]
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

    /// Parses [`est_og`](Self::est_og) as a float, dropping any unit
    /// suffix. Falls back to the [`og`](Self::og) field when the
    /// estimate is missing (joliebulle and similar tools collapse
    /// "estimate" and "actual" into a single `<OG>` element).
    pub fn est_og_value(&self) -> Option<f64> {
        self.est_og
            .as_deref()
            .and_then(parse_leading_f64)
            .or_else(|| self.og.as_deref().and_then(parse_leading_f64))
    }

    /// Parses [`est_fg`](Self::est_fg) as a float, dropping any unit
    /// suffix. Falls back to [`fg`](Self::fg) — see [`est_og_value`].
    pub fn est_fg_value(&self) -> Option<f64> {
        self.est_fg
            .as_deref()
            .and_then(parse_leading_f64)
            .or_else(|| self.fg.as_deref().and_then(parse_leading_f64))
    }

    /// Parses [`est_color`](Self::est_color) as a float (SRM or
    /// whichever unit the source emitted), dropping any unit suffix.
    /// Falls back to [`color`](Self::color) when the estimate is
    /// missing — see [`est_og_value`].
    pub fn est_color_value(&self) -> Option<f64> {
        self.est_color
            .as_deref()
            .and_then(parse_leading_f64)
            .or_else(|| self.color.as_deref().and_then(parse_leading_f64))
    }

    /// Best-effort guess at the color unit the source tool used,
    /// derived from [`est_color`](Self::est_color)'s suffix. Returns
    /// one of `"EBC"`, `"SRM"`, or `"Lovi"` (matching BeerJSON's
    /// `ColorUnitType` enum) when the suffix matches; falls back to
    /// `"EBC"` otherwise — the modern default for European tools that
    /// produce most BeerXML files in circulation today.
    ///
    /// This unit applies both to the recipe's overall color estimate
    /// and (more importantly) to every fermentable's `COLOR` field —
    /// the BeerXML 1.0 spec says fermentable color is degrees Lovibond,
    /// but most tools store EBC there in practice. Using the same
    /// signal everywhere produces a coherent file.
    pub fn effective_color_unit(&self) -> &'static str {
        let Some(s) = self.est_color.as_deref().or(self.color.as_deref()) else {
            return "EBC";
        };
        let upper = s.to_uppercase();
        if upper.contains("EBC") {
            "EBC"
        } else if upper.contains("SRM") {
            "SRM"
        } else if upper.contains("LOVI") || upper.contains("°L") {
            "Lovi"
        } else {
            "EBC"
        }
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
    #[serde(default, deserialize_with = "empty_str_to_none_f64")]
    pub og_min: Option<f64>,
    /// Maximum target original gravity.
    #[serde(default, deserialize_with = "empty_str_to_none_f64")]
    pub og_max: Option<f64>,
    /// Minimum target final gravity.
    #[serde(default, deserialize_with = "empty_str_to_none_f64")]
    pub fg_min: Option<f64>,
    /// Maximum target final gravity.
    #[serde(default, deserialize_with = "empty_str_to_none_f64")]
    pub fg_max: Option<f64>,
    /// Minimum target IBU.
    #[serde(default, deserialize_with = "empty_str_to_none_f64")]
    pub ibu_min: Option<f64>,
    /// Maximum target IBU.
    #[serde(default, deserialize_with = "empty_str_to_none_f64")]
    pub ibu_max: Option<f64>,
    /// Minimum target color (SRM).
    #[serde(default, deserialize_with = "empty_str_to_none_f64")]
    pub color_min: Option<f64>,
    /// Maximum target color (SRM).
    #[serde(default, deserialize_with = "empty_str_to_none_f64")]
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
    #[serde(deserialize_with = "empty_str_to_zero_f64")]
    pub alpha: f64,
    /// Amount, in kilograms.
    #[serde(deserialize_with = "empty_str_to_zero_f64")]
    pub amount: f64,
    /// Where in the brew the hop is added.
    #[serde(default, rename = "USE", deserialize_with = "empty_str_to_none_enum")]
    pub hop_use: Option<HopUse>,
    /// Boil time (or dry-hop duration), in minutes.
    #[serde(default, deserialize_with = "empty_str_to_none_f64")]
    pub time: Option<f64>,
    /// Pellet / leaf / plug.
    #[serde(default, deserialize_with = "empty_str_to_none_enum")]
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
    /// Grain / sugar / extract / dry extract / adjunct. Optional in
    /// practice — falls back to [`FermentableType::Adjunct`] via
    /// [`Fermentable::effective_type`] when missing.
    #[serde(default, rename = "TYPE", deserialize_with = "empty_str_to_none_enum")]
    pub fermentable_type: Option<FermentableType>,
    /// Amount, in kilograms.
    #[serde(deserialize_with = "empty_str_to_zero_f64")]
    pub amount: f64,
    /// Yield percentage — sugar potential as a fraction of dry weight.
    #[serde(default, rename = "YIELD", deserialize_with = "empty_str_to_none_f64")]
    pub yield_pct: Option<f64>,
    /// Color, in degrees Lovibond (BeerXML uses Lovibond, not SRM).
    #[serde(default, deserialize_with = "empty_str_to_none_f64")]
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

impl Fermentable {
    /// Returns [`fermentable_type`](Self::fermentable_type) or, when
    /// absent, falls back to [`FermentableType::Adjunct`].
    pub fn effective_type(&self) -> FermentableType {
        self.fermentable_type.clone().unwrap_or(FermentableType::Adjunct)
    }
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
    /// Yeast family — Ale, Lager, Wheat, Wine, Champagne. Optional —
    /// falls back to [`YeastType::Ale`] via [`Yeast::effective_type`].
    #[serde(default, rename = "TYPE", deserialize_with = "empty_str_to_none_enum")]
    pub yeast_type: Option<YeastType>,
    /// Liquid, dry, slant, or culture. Optional — falls back to
    /// [`YeastForm::Dry`] via [`Yeast::effective_form`].
    #[serde(default, deserialize_with = "empty_str_to_none_enum")]
    pub form: Option<YeastForm>,
    /// Amount in liters (for liquid) or kilograms (for dry, when
    /// `amount_is_weight` is true). joliebulle omits the element
    /// entirely on yeast (one pack = one item), so we default to 0.0
    /// when missing rather than fail the import.
    #[serde(default, deserialize_with = "empty_str_to_zero_f64")]
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
    #[serde(default, deserialize_with = "empty_str_to_none_f64")]
    pub attenuation: Option<f64>,
    /// Minimum recommended fermentation temperature, in °C.
    #[serde(default, deserialize_with = "empty_str_to_none_f64")]
    pub min_temperature: Option<f64>,
    /// Maximum recommended fermentation temperature, in °C.
    #[serde(default, deserialize_with = "empty_str_to_none_f64")]
    pub max_temperature: Option<f64>,
}

impl Yeast {
    /// Returns [`yeast_type`](Self::yeast_type) or, when absent, falls
    /// back to [`YeastType::Ale`] — by far the most common case.
    pub fn effective_type(&self) -> YeastType {
        self.yeast_type.clone().unwrap_or(YeastType::Ale)
    }

    /// Returns [`form`](Self::form) or, when absent, falls back to
    /// [`YeastForm::Dry`].
    pub fn effective_form(&self) -> YeastForm {
        self.form.clone().unwrap_or(YeastForm::Dry)
    }
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
    #[serde(default, rename = "USE", deserialize_with = "empty_str_to_none_enum")]
    pub misc_use: Option<MiscUse>,
    /// Time at addition, in minutes.
    #[serde(default, deserialize_with = "empty_str_to_none_f64")]
    pub time: Option<f64>,
    /// Amount in liters or kilograms (see [`amount_is_weight`](Self::amount_is_weight)).
    #[serde(deserialize_with = "empty_str_to_zero_f64")]
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
    #[serde(default, deserialize_with = "empty_str_to_none_f64")]
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
    /// Infusion / temperature / decoction. Optional — falls back to
    /// [`MashStepType::Infusion`] via [`MashStep::effective_type`].
    #[serde(default, rename = "TYPE", deserialize_with = "empty_str_to_none_enum")]
    pub step_type: Option<MashStepType>,
    /// Volume of water added at this step, in liters (for infusion steps).
    #[serde(default, deserialize_with = "empty_str_to_none_f64")]
    pub infuse_amount: Option<f64>,
    /// Target rest temperature, in °C.
    #[serde(deserialize_with = "empty_str_to_zero_f64")]
    pub step_temp: f64,
    /// Rest duration, in minutes.
    #[serde(deserialize_with = "empty_str_to_zero_f64")]
    pub step_time: f64,
    /// Time spent ramping to [`step_temp`](Self::step_temp), in minutes.
    #[serde(default, deserialize_with = "empty_str_to_none_f64")]
    pub ramp_time: Option<f64>,
    /// End temperature for ramped steps, in °C.
    #[serde(default, deserialize_with = "empty_str_to_none_f64")]
    pub end_temp: Option<f64>,
}

impl MashStep {
    /// Returns [`step_type`](Self::step_type) or, when absent, falls
    /// back to [`MashStepType::Infusion`].
    pub fn effective_type(&self) -> MashStepType {
        self.step_type.clone().unwrap_or(MashStepType::Infusion)
    }
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
