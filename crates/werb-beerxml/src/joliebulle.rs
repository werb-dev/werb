//! Joliebulle v4 JSON export importer.
//!
//! Joliebulle v4 (the French homebrew app) saves its recipe library
//! as a single JSON file with a custom shape — close to BeerXML
//! field-for-field, but JSON-flavoured and with subtle differences:
//!
//! - `amount` for fermentables / hops / miscs is in **grams**, not
//!   the kilograms BeerXML uses. We divide by 1000 on the way in.
//! - Numbers are sometimes strings (`"alpha": "4"`,
//!   `"step_temp": "67.0"`). A custom deserializer handles either.
//! - Missing values are emitted as empty strings, the literal
//!   `"undefined"`, or `"FALSE"`. We treat all three as absent.
//! - A top-level wrapper `{ recipes: [...], timestamp, archives,
//!   config, ... }` carries the whole library at once. Only the
//!   `recipes` array is consumed; the rest is ignored.
//!
//! The output is the same [`crate::model::Recipe`] the BeerXML
//! parser hands back, so callers can drive [`Recipe::to_beerjson`]
//! exactly the same way regardless of input format.

use serde::{de, Deserialize, Deserializer};

use crate::error::Error;
use crate::model::{
    Fermentable, FermentableType, Fermentables, Hop, HopForm, HopUse, Hops, Mash, MashStep,
    MashStepType, MashSteps, Misc, MiscUse, Miscs, Recipe, RecipeType, Style, Yeast, YeastForm,
    YeastType, Yeasts,
};

// ─── Public entry points ──────────────────────────────────────────────────

/// Parse a joliebulle v4 JSON document and return every recipe it
/// contains as a [`crate::model::Recipe`]. The empty-string /
/// `"undefined"` / `"FALSE"` patterns the format uses for missing
/// values are folded back to `None` so downstream code can rely on
/// the same Option semantics as the BeerXML parser.
pub fn parse_joliebulle(json: &str) -> Result<Vec<Recipe>, Error> {
    let doc: JoliebulleDocument =
        serde_json::from_str(json).map_err(|e| Error::Json(e.to_string()))?;
    Ok(doc.recipes.into_iter().map(Recipe::from).collect())
}

/// Best-effort sniff: does this JSON blob look like a joliebulle v4
/// export? True when the top-level object has a `recipes` array AND
/// lacks the BeerJSON `beerjson` wrapper key.
///
/// Cheap content-based dispatch — file extensions overlap (`.json`
/// for joliebulle, BeerJSON, or anything else) so peek at the bytes.
pub fn looks_like_joliebulle(json: &str) -> bool {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(json) else {
        return false;
    };
    let Some(obj) = value.as_object() else { return false };
    obj.contains_key("recipes") && !obj.contains_key("beerjson")
}

// ─── Wire shape ───────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct JoliebulleDocument {
    #[serde(default)]
    recipes: Vec<JbRecipe>,
}

#[derive(Debug, Deserialize)]
struct JbRecipe {
    name: String,
    #[serde(default)]
    brewer: Option<String>,
    #[serde(default, rename = "type")]
    recipe_type: Option<String>,
    #[serde(default, deserialize_with = "loose_f64_required")]
    batch_size: f64,
    #[serde(default, deserialize_with = "loose_f64")]
    boil_size: Option<f64>,
    #[serde(default, deserialize_with = "loose_f64")]
    boil_time: Option<f64>,
    #[serde(default, deserialize_with = "loose_f64")]
    efficiency: Option<f64>,
    #[serde(default)]
    style: Option<JbStyle>,
    #[serde(default)]
    fermentables: Vec<JbFermentable>,
    #[serde(default)]
    hops: Vec<JbHop>,
    #[serde(default)]
    yeasts: Vec<JbYeast>,
    #[serde(default)]
    miscs: Vec<JbMisc>,
    #[serde(default)]
    mash: Option<JbMash>,
    #[serde(default)]
    notes: Option<String>,
    /// Joliebulle stores its computed OG and FG at the top level —
    /// reuse them as the recipe's gravity estimate (BeerXML's
    /// EST_OG/EST_FG slot).
    #[serde(default, deserialize_with = "loose_f64")]
    og: Option<f64>,
    #[serde(default, deserialize_with = "loose_f64")]
    fg: Option<f64>,
    /// Color estimate in EBC.
    #[serde(default, deserialize_with = "loose_f64")]
    ebc: Option<f64>,
    /// Estimated IBU.
    #[serde(default, deserialize_with = "loose_f64")]
    ibu: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct JbStyle {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    category: Option<String>,
    #[serde(default)]
    category_number: Option<String>,
    #[serde(default)]
    style_letter: Option<String>,
    #[serde(default)]
    style_guide: Option<String>,
    #[serde(default, rename = "type")]
    style_type: Option<String>,
    #[serde(default, deserialize_with = "loose_f64")]
    og_min: Option<f64>,
    #[serde(default, deserialize_with = "loose_f64")]
    og_max: Option<f64>,
    #[serde(default, deserialize_with = "loose_f64")]
    fg_min: Option<f64>,
    #[serde(default, deserialize_with = "loose_f64")]
    fg_max: Option<f64>,
    #[serde(default, deserialize_with = "loose_f64")]
    ibu_min: Option<f64>,
    #[serde(default, deserialize_with = "loose_f64")]
    ibu_max: Option<f64>,
    #[serde(default, deserialize_with = "loose_f64")]
    color_min: Option<f64>,
    #[serde(default, deserialize_with = "loose_f64")]
    color_max: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct JbFermentable {
    name: String,
    #[serde(default, rename = "type")]
    type_: Option<String>,
    /// Joliebulle stores fermentable weights in GRAMS. Divide by
    /// 1000 to land on BeerXML's kilograms.
    #[serde(default, deserialize_with = "loose_f64_required")]
    amount: f64,
    // `yield` is a Rust keyword, so the field has to live under a
    // different name. serde renames it back to "yield" on the wire.
    #[serde(default, rename = "yield", deserialize_with = "loose_f64")]
    yield_: Option<f64>,
    #[serde(default, deserialize_with = "loose_f64")]
    color: Option<f64>,
    #[serde(default)]
    origin: Option<String>,
    #[serde(default)]
    supplier: Option<String>,
}

#[derive(Debug, Deserialize)]
struct JbHop {
    name: String,
    #[serde(default, deserialize_with = "loose_f64_required")]
    alpha: f64,
    /// Grams in joliebulle, kg downstream.
    #[serde(default, deserialize_with = "loose_f64_required")]
    amount: f64,
    #[serde(default, deserialize_with = "loose_f64")]
    time: Option<f64>,
    #[serde(default)]
    form: Option<String>,
    #[serde(default, rename = "use")]
    use_: Option<String>,
    #[serde(default, rename = "type")]
    hop_type: Option<String>,
    #[serde(default)]
    notes: Option<String>,
}

#[derive(Debug, Deserialize)]
struct JbYeast {
    name: String,
    #[serde(default, rename = "type")]
    type_: Option<String>,
    #[serde(default)]
    form: Option<String>,
    #[serde(default, deserialize_with = "loose_f64_or_zero")]
    amount: f64,
    #[serde(default)]
    laboratory: Option<String>,
    #[serde(default)]
    product_id: Option<String>,
    #[serde(default, deserialize_with = "loose_f64")]
    attenuation: Option<f64>,
    #[serde(default, deserialize_with = "loose_f64")]
    min_temperature: Option<f64>,
    #[serde(default, deserialize_with = "loose_f64")]
    max_temperature: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct JbMisc {
    name: String,
    #[serde(default, rename = "type")]
    type_: Option<String>,
    #[serde(default, rename = "use")]
    use_: Option<String>,
    #[serde(default, deserialize_with = "loose_f64")]
    time: Option<f64>,
    /// Grams in joliebulle, treated as a weight by default — most
    /// misc additions are dry-weight (spices, finings).
    #[serde(default, deserialize_with = "loose_f64_required")]
    amount: f64,
}

#[derive(Debug, Deserialize)]
struct JbMash {
    #[serde(default)]
    name: Option<String>,
    #[serde(default, deserialize_with = "loose_f64")]
    grain_temp: Option<f64>,
    #[serde(default)]
    mash_steps: Vec<JbMashStep>,
}

#[derive(Debug, Deserialize)]
struct JbMashStep {
    name: String,
    #[serde(default, rename = "type")]
    type_: Option<String>,
    #[serde(default, deserialize_with = "loose_f64")]
    infuse_amount: Option<f64>,
    #[serde(default, deserialize_with = "loose_f64_required")]
    step_temp: f64,
    #[serde(default, deserialize_with = "loose_f64_required")]
    step_time: f64,
    #[serde(default, deserialize_with = "loose_f64")]
    ramp_time: Option<f64>,
    #[serde(default, deserialize_with = "loose_f64")]
    end_temp: Option<f64>,
}

// ─── Lenient deserializers ────────────────────────────────────────────────

/// Accept either a JSON string or number for an `Option<f64>`. Empty
/// strings, the literal `"undefined"`, and `"FALSE"` all collapse to
/// `None`. Numeric strings parse normally.
fn loose_f64<'de, D>(de: D) -> Result<Option<f64>, D::Error>
where
    D: Deserializer<'de>,
{
    match serde_json::Value::deserialize(de)? {
        serde_json::Value::Null => Ok(None),
        serde_json::Value::String(s) => {
            let s = s.trim();
            if s.is_empty()
                || s.eq_ignore_ascii_case("undefined")
                || s.eq_ignore_ascii_case("null")
                || s.eq_ignore_ascii_case("false")
            {
                return Ok(None);
            }
            s.parse::<f64>().map(Some).map_err(de::Error::custom)
        }
        serde_json::Value::Number(n) => Ok(n.as_f64()),
        other => Err(de::Error::custom(format!("expected number, got {other:?}"))),
    }
}

/// Required `f64` variant of [`loose_f64`] — falls back to `0.0`
/// when the source omits or empties the field rather than failing
/// the whole import. Same tolerance level as `empty_str_to_zero_f64`
/// in the BeerXML parser.
fn loose_f64_required<'de, D>(de: D) -> Result<f64, D::Error>
where
    D: Deserializer<'de>,
{
    Ok(loose_f64(de)?.unwrap_or(0.0))
}

/// Default-zero variant used for yeast amounts (joliebulle omits the
/// field entirely — one pack = one item).
fn loose_f64_or_zero<'de, D>(de: D) -> Result<f64, D::Error>
where
    D: Deserializer<'de>,
{
    Ok(loose_f64(de)?.unwrap_or(0.0))
}

// ─── Mapping into the BeerXML-shaped model ────────────────────────────────

/// Helper: trim, drop empty, drop `"undefined"`.
fn nonempty(s: Option<String>) -> Option<String> {
    let s = s?;
    let trimmed = s.trim();
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("undefined") {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn recipe_type_from_str(s: &str) -> Option<RecipeType> {
    match s.trim() {
        "Extract" => Some(RecipeType::Extract),
        "Partial Mash" => Some(RecipeType::PartialMash),
        "All Grain" => Some(RecipeType::AllGrain),
        _ => None,
    }
}

fn fermentable_type_from_str(s: &str) -> Option<FermentableType> {
    match s.trim() {
        "Grain" => Some(FermentableType::Grain),
        "Sugar" => Some(FermentableType::Sugar),
        "Extract" => Some(FermentableType::Extract),
        "Dry Extract" => Some(FermentableType::DryExtract),
        "Adjunct" => Some(FermentableType::Adjunct),
        _ => None,
    }
}

fn hop_form_from_str(s: &str) -> Option<HopForm> {
    match s.trim() {
        "Pellet" => Some(HopForm::Pellet),
        "Plug" => Some(HopForm::Plug),
        "Leaf" => Some(HopForm::Leaf),
        _ => None,
    }
}

fn hop_use_from_str(s: &str) -> Option<HopUse> {
    // "Flame Out" is joliebulle's whirlpool addition — late kettle
    // addition with negligible utilization. Map to Aroma since
    // that's the closest BeerXML-side concept (post-boil aroma).
    match s.trim() {
        "Boil" => Some(HopUse::Boil),
        "Dry Hop" => Some(HopUse::DryHop),
        "Mash" => Some(HopUse::Mash),
        "First Wort" => Some(HopUse::FirstWort),
        "Aroma" | "Flame Out" => Some(HopUse::Aroma),
        _ => None,
    }
}

fn yeast_type_from_str(s: &str) -> Option<YeastType> {
    match s.trim() {
        "Ale" => Some(YeastType::Ale),
        "Lager" => Some(YeastType::Lager),
        "Wheat" => Some(YeastType::Wheat),
        "Wine" => Some(YeastType::Wine),
        "Champagne" => Some(YeastType::Champagne),
        _ => None,
    }
}

fn yeast_form_from_str(s: &str) -> Option<YeastForm> {
    match s.trim() {
        "Liquid" => Some(YeastForm::Liquid),
        "Dry" => Some(YeastForm::Dry),
        "Slant" => Some(YeastForm::Slant),
        "Culture" => Some(YeastForm::Culture),
        _ => None,
    }
}

fn misc_use_from_str(s: &str) -> Option<MiscUse> {
    match s.trim() {
        "Boil" => Some(MiscUse::Boil),
        "Mash" => Some(MiscUse::Mash),
        "Primary" => Some(MiscUse::Primary),
        "Secondary" => Some(MiscUse::Secondary),
        "Bottling" => Some(MiscUse::Bottling),
        _ => None,
    }
}

fn mash_step_type_from_str(s: &str) -> Option<MashStepType> {
    match s.trim() {
        "Infusion" => Some(MashStepType::Infusion),
        "Temperature" => Some(MashStepType::Temperature),
        "Decoction" => Some(MashStepType::Decoction),
        _ => None,
    }
}

impl From<JbRecipe> for Recipe {
    fn from(r: JbRecipe) -> Self {
        Recipe {
            name: r.name,
            version: 1,
            recipe_type: r.recipe_type.as_deref().and_then(recipe_type_from_str),
            brewer: nonempty(r.brewer),
            batch_size: r.batch_size,
            boil_size: r.boil_size,
            boil_time: r.boil_time,
            efficiency: r.efficiency,
            style: r.style.map(Style::from),
            hops: if r.hops.is_empty() {
                None
            } else {
                Some(Hops {
                    items: r.hops.into_iter().map(Hop::from).collect(),
                })
            },
            fermentables: if r.fermentables.is_empty() {
                None
            } else {
                Some(Fermentables {
                    items: r.fermentables.into_iter().map(Fermentable::from).collect(),
                })
            },
            yeasts: if r.yeasts.is_empty() {
                None
            } else {
                Some(Yeasts {
                    items: r.yeasts.into_iter().map(Yeast::from).collect(),
                })
            },
            miscs: if r.miscs.is_empty() {
                None
            } else {
                Some(Miscs {
                    items: r.miscs.into_iter().map(Misc::from).collect(),
                })
            },
            mash: r.mash.map(Mash::from),
            // Joliebulle puts the OG/FG/color/IBU estimates at the
            // recipe root. Plant them into the same slots BeerXML's
            // EST_* fields land in so the BeerJSON converter picks
            // them up unchanged.
            est_og: r.og.map(|v| format!("{v}")),
            est_fg: r.fg.map(|v| format!("{v}")),
            // Stamp EBC explicitly so `effective_color_unit` reads it.
            est_color: r.ebc.map(|v| format!("{v} EBC")),
            og: None,
            fg: None,
            color: None,
            ibu: r.ibu,
            notes: nonempty(r.notes),
        }
    }
}

impl From<JbStyle> for Style {
    fn from(s: JbStyle) -> Self {
        Style {
            name: s.name.unwrap_or_else(|| "Unknown".to_string()),
            version: 1,
            category: nonempty(s.category),
            category_number: nonempty(s.category_number),
            style_letter: nonempty(s.style_letter),
            style_guide: nonempty(s.style_guide),
            style_type: nonempty(s.style_type),
            og_min: s.og_min,
            og_max: s.og_max,
            fg_min: s.fg_min,
            fg_max: s.fg_max,
            ibu_min: s.ibu_min,
            ibu_max: s.ibu_max,
            color_min: s.color_min,
            color_max: s.color_max,
        }
    }
}

impl From<JbFermentable> for Fermentable {
    fn from(f: JbFermentable) -> Self {
        Fermentable {
            name: f.name,
            version: 1,
            fermentable_type: f.type_.as_deref().and_then(fermentable_type_from_str),
            amount: grams_to_kg(f.amount),
            yield_pct: f.yield_,
            color: f.color,
            origin: nonempty(f.origin),
            supplier: nonempty(f.supplier),
            notes: None,
        }
    }
}

impl From<JbHop> for Hop {
    fn from(h: JbHop) -> Self {
        Hop {
            name: h.name,
            version: 1,
            alpha: h.alpha,
            amount: grams_to_kg(h.amount),
            hop_use: h.use_.as_deref().and_then(hop_use_from_str),
            time: h.time,
            form: h.form.as_deref().and_then(hop_form_from_str),
            hop_type: nonempty(h.hop_type),
            notes: nonempty(h.notes),
        }
    }
}

impl From<JbYeast> for Yeast {
    fn from(y: JbYeast) -> Self {
        // Joliebulle stores yeast amount in grams (dry) or millilitres
        // (liquid). The internal Yeast model follows BeerXML's
        // convention — kg or L — so divide by 1000 here. The downstream
        // BeerJSON converter then multiplies back up to grams.
        let form = y.form.as_deref().and_then(yeast_form_from_str);
        Yeast {
            name: y.name,
            version: 1,
            yeast_type: y.type_.as_deref().and_then(yeast_type_from_str),
            form,
            amount: y.amount / 1000.0,
            amount_is_weight: None,
            laboratory: nonempty(y.laboratory),
            product_id: nonempty(y.product_id),
            attenuation: y.attenuation,
            min_temperature: y.min_temperature,
            max_temperature: y.max_temperature,
        }
    }
}

impl From<JbMisc> for Misc {
    fn from(m: JbMisc) -> Self {
        Misc {
            name: m.name,
            version: 1,
            misc_type: nonempty(m.type_),
            misc_use: m.use_.as_deref().and_then(misc_use_from_str),
            time: m.time,
            amount: grams_to_kg(m.amount),
            // Spice / herb / flavor are dry weights; fining could be
            // either. Mark as weight by default — false-positives
            // here are visually obvious (an ingredient labeled as kg
            // when the user knows they used ml).
            amount_is_weight: Some(true),
        }
    }
}

impl From<JbMash> for Mash {
    fn from(m: JbMash) -> Self {
        Mash {
            name: m.name.unwrap_or_else(|| "Mash".to_string()),
            version: 1,
            grain_temp: m.grain_temp,
            mash_steps: if m.mash_steps.is_empty() {
                None
            } else {
                Some(MashSteps {
                    items: m.mash_steps.into_iter().map(MashStep::from).collect(),
                })
            },
        }
    }
}

impl From<JbMashStep> for MashStep {
    fn from(s: JbMashStep) -> Self {
        MashStep {
            name: s.name,
            version: 1,
            step_type: s.type_.as_deref().and_then(mash_step_type_from_str),
            infuse_amount: s.infuse_amount.and_then(|v| if v == 0.0 { None } else { Some(v) }),
            step_temp: s.step_temp,
            step_time: s.step_time,
            ramp_time: s.ramp_time,
            end_temp: s.end_temp,
        }
    }
}

fn grams_to_kg(g: f64) -> f64 {
    g / 1000.0
}
