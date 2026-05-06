//! Conversion from the BeerXML model to a BeerJSON 2.x JSON document.
//!
//! BeerJSON wraps every measurement in a `{value, unit}` object, so the
//! conversion is mostly mechanical: walk the parsed BeerXML tree and emit
//! the matching JSON shape. Field semantics are preserved when the
//! source provides them; missing optional fields are simply omitted from
//! the output rather than filled with defaults.

use serde_json::{json, Map, Value};

use crate::model::{
    Fermentable, FermentableType, Hop, HopForm, HopUse, MashStep, MashStepType, Misc, MiscUse,
    Recipe, RecipeType, Style, Yeast, YeastForm, YeastType,
};

impl Recipe {
    /// Renders this recipe as a BeerJSON 2.x `RecipeType` JSON object.
    ///
    /// The result is a [`serde_json::Value`] that matches the `recipe`
    /// shape from the [BeerJSON 2.x schema](https://github.com/beerjson/beerjson),
    /// ready to be embedded under `beerjson.recipes[]` or written to disk.
    /// Fields the BeerXML source does not provide are omitted rather than
    /// emitted as `null`, so the output validates cleanly against the
    /// BeerJSON schema.
    pub fn to_beerjson(&self) -> Value {
        let mut recipe = Map::new();
        recipe.insert("name".into(), Value::String(self.name.clone()));
        recipe.insert("type".into(), Value::String(recipe_type_to_beerjson(&self.effective_recipe_type())));
        // BeerJSON 2.x marks `author` as required, so emit a placeholder
        // when the source omits BREWER.
        recipe.insert(
            "author".into(),
            Value::String(self.brewer.clone().unwrap_or_else(|| "Unknown".to_string())),
        );
        recipe.insert("batch_size".into(), volume_l(self.batch_size));
        recipe.insert("boil".into(), json!({
            "pre_boil_size": volume_l(self.effective_boil_size()),
            "boil_time": minutes(self.effective_boil_time()),
        }));
        // `efficiency.brewhouse` is required in BeerJSON; default to 75%
        // (the typical homebrew assumption) when absent in the source.
        recipe.insert(
            "efficiency".into(),
            json!({ "brewhouse": percent(self.efficiency.unwrap_or(75.0)) }),
        );
        if let Some(style) = &self.style {
            recipe.insert("style".into(), style_to_beerjson(style));
        }
        if let Some(og) = self.est_og_value() {
            recipe.insert("original_gravity".into(), gravity(og));
        }
        if let Some(fg) = self.est_fg_value() {
            recipe.insert("final_gravity".into(), gravity(fg));
        }
        if let Some(ibu) = self.ibu {
            recipe.insert("ibu_estimate".into(), json!({ "ibu": json!({ "value": ibu, "unit": "IBUs" }) }));
        }
        if let Some(srm) = self.est_color_value() {
            recipe.insert("color_estimate".into(), json!({ "value": srm, "unit": "SRM" }));
        }
        if let Some(notes) = &self.notes {
            recipe.insert("notes".into(), Value::String(notes.clone()));
        }

        // Ingredients block. BeerJSON requires `ingredients` and
        // specifically `ingredients.fermentable_additions` (even if
        // empty), so always emit them.
        let mut ingredients = Map::new();
        ingredients.insert(
            "fermentable_additions".into(),
            Value::Array(
                self.fermentables
                    .as_ref()
                    .map(|f| f.items.iter().map(fermentable_to_beerjson).collect())
                    .unwrap_or_default(),
            ),
        );
        if let Some(h) = &self.hops {
            ingredients.insert(
                "hop_additions".into(),
                Value::Array(h.items.iter().map(hop_to_beerjson).collect()),
            );
        }
        if let Some(y) = &self.yeasts {
            ingredients.insert(
                "culture_additions".into(),
                Value::Array(y.items.iter().map(yeast_to_beerjson).collect()),
            );
        }
        if let Some(m) = &self.miscs {
            ingredients.insert(
                "miscellaneous_additions".into(),
                Value::Array(m.items.iter().map(misc_to_beerjson).collect()),
            );
        }
        recipe.insert("ingredients".into(), Value::Object(ingredients));

        if let Some(mash) = &self.mash {
            let mut mash_obj = Map::new();
            mash_obj.insert("name".into(), Value::String(mash.name.clone()));
            if let Some(temp) = mash.grain_temp {
                mash_obj.insert("grain_temperature".into(), temperature_c(temp));
            }
            if let Some(steps) = &mash.mash_steps {
                mash_obj.insert(
                    "mash_steps".into(),
                    Value::Array(steps.items.iter().map(mash_step_to_beerjson).collect()),
                );
            }
            recipe.insert("mash".into(), Value::Object(mash_obj));
        }

        Value::Object(recipe)
    }
}

// ─── Field-level helpers ──────────────────────────────────────────────────

fn recipe_type_to_beerjson(t: &RecipeType) -> String {
    match t {
        RecipeType::Extract => "extract",
        RecipeType::PartialMash => "partial mash",
        RecipeType::AllGrain => "all grain",
    }
    .to_string()
}

fn style_to_beerjson(s: &Style) -> Value {
    let mut style = Map::new();
    style.insert("name".into(), Value::String(s.name.clone()));
    if let Some(cat) = &s.category {
        style.insert("category".into(), Value::String(cat.clone()));
    }
    if let Some(num) = &s.category_number {
        style.insert("category_number".into(), Value::String(num.clone()));
    }
    if let Some(letter) = &s.style_letter {
        style.insert("style_letter".into(), Value::String(letter.clone()));
    }
    if let Some(guide) = &s.style_guide {
        style.insert("style_guide".into(), Value::String(guide.clone()));
    }
    if let Some(t) = &s.style_type {
        // BeerJSON expects a lowercase enum: ale / lager / mead / etc.
        style.insert("type".into(), Value::String(t.to_lowercase()));
    }
    if let (Some(min), Some(max)) = (s.og_min, s.og_max) {
        style.insert("original_gravity".into(), json!({
            "minimum": gravity(min),
            "maximum": gravity(max),
        }));
    }
    if let (Some(min), Some(max)) = (s.fg_min, s.fg_max) {
        style.insert("final_gravity".into(), json!({
            "minimum": gravity(min),
            "maximum": gravity(max),
        }));
    }
    if let (Some(min), Some(max)) = (s.ibu_min, s.ibu_max) {
        style.insert("international_bitterness_units".into(), json!({
            "minimum": json!({ "value": min, "unit": "IBUs" }),
            "maximum": json!({ "value": max, "unit": "IBUs" }),
        }));
    }
    if let (Some(min), Some(max)) = (s.color_min, s.color_max) {
        style.insert("color".into(), json!({
            "minimum": json!({ "value": min, "unit": "SRM" }),
            "maximum": json!({ "value": max, "unit": "SRM" }),
        }));
    }
    Value::Object(style)
}

fn fermentable_to_beerjson(f: &Fermentable) -> Value {
    let mut obj = Map::new();
    obj.insert("name".into(), Value::String(f.name.clone()));
    obj.insert("type".into(), Value::String(fermentable_type_to_beerjson(&f.effective_type())));
    obj.insert("amount".into(), mass_kg(f.amount));
    if let Some(y) = f.yield_pct {
        obj.insert("yield".into(), json!({ "fine_grind": percent(y) }));
    }
    if let Some(c) = f.color {
        // BeerJSON's ColorUnitType enum is {"EBC", "Lovi", "SRM"}; the
        // spec uses the abbreviation "Lovi", not "Lovibond".
        obj.insert("color".into(), json!({ "value": c, "unit": "Lovi" }));
    }
    if let Some(o) = &f.origin {
        obj.insert("origin".into(), Value::String(o.clone()));
    }
    if let Some(s) = &f.supplier {
        obj.insert("supplier".into(), Value::String(s.clone()));
    }
    Value::Object(obj)
}

fn fermentable_type_to_beerjson(t: &FermentableType) -> String {
    match t {
        FermentableType::Grain => "grain",
        FermentableType::Sugar => "sugar",
        FermentableType::Extract => "extract",
        FermentableType::DryExtract => "dry extract",
        FermentableType::Adjunct => "other",
    }
    .to_string()
}

fn hop_to_beerjson(h: &Hop) -> Value {
    let mut obj = Map::new();
    obj.insert("name".into(), Value::String(h.name.clone()));
    obj.insert("alpha_acid".into(), percent(h.alpha));
    obj.insert("amount".into(), mass_kg(h.amount));
    if let Some(form) = &h.form {
        obj.insert("form".into(), Value::String(hop_form_to_beerjson(form)));
    }
    if let Some(use_) = &h.hop_use {
        let mut timing = Map::new();
        timing.insert("use".into(), Value::String(hop_use_to_beerjson(use_)));
        if let Some(t) = h.time {
            timing.insert("time".into(), minutes(t));
        }
        obj.insert("timing".into(), Value::Object(timing));
    }
    if let Some(notes) = &h.notes {
        obj.insert("notes".into(), Value::String(notes.clone()));
    }
    Value::Object(obj)
}

fn hop_use_to_beerjson(u: &HopUse) -> String {
    match u {
        HopUse::Boil => "add_to_boil",
        HopUse::DryHop => "add_to_fermentation",
        HopUse::Mash => "add_to_mash",
        HopUse::FirstWort => "add_to_boil",
        HopUse::Aroma => "add_to_boil",
    }
    .to_string()
}

fn hop_form_to_beerjson(f: &HopForm) -> String {
    match f {
        HopForm::Pellet => "pellet",
        HopForm::Plug => "plug",
        HopForm::Leaf => "leaf",
    }
    .to_string()
}

fn yeast_to_beerjson(y: &Yeast) -> Value {
    let mut obj = Map::new();
    obj.insert("name".into(), Value::String(y.name.clone()));
    obj.insert("type".into(), Value::String(yeast_type_to_beerjson(&y.effective_type())));
    obj.insert("form".into(), Value::String(yeast_form_to_beerjson(&y.effective_form())));
    if y.amount_is_weight.unwrap_or(false) {
        obj.insert("amount".into(), mass_kg(y.amount));
    } else {
        obj.insert("amount".into(), volume_l(y.amount));
    }
    if let Some(p) = &y.laboratory {
        obj.insert("producer".into(), Value::String(p.clone()));
    }
    if let Some(p) = &y.product_id {
        obj.insert("product_id".into(), Value::String(p.clone()));
    }
    if let Some(att) = y.attenuation {
        obj.insert("attenuation".into(), percent(att));
    }
    Value::Object(obj)
}

fn yeast_type_to_beerjson(t: &YeastType) -> String {
    match t {
        YeastType::Ale => "ale",
        YeastType::Lager => "lager",
        YeastType::Wheat => "wheat",
        YeastType::Wine => "wine",
        YeastType::Champagne => "champagne",
    }
    .to_string()
}

fn yeast_form_to_beerjson(f: &YeastForm) -> String {
    match f {
        YeastForm::Liquid => "liquid",
        YeastForm::Dry => "dry",
        YeastForm::Slant => "slant",
        YeastForm::Culture => "culture",
    }
    .to_string()
}

fn misc_to_beerjson(m: &Misc) -> Value {
    let mut obj = Map::new();
    obj.insert("name".into(), Value::String(m.name.clone()));
    if let Some(t) = &m.misc_type {
        obj.insert("type".into(), Value::String(t.to_lowercase()));
    }
    if m.amount_is_weight.unwrap_or(false) {
        obj.insert("amount".into(), mass_kg(m.amount));
    } else {
        obj.insert("amount".into(), volume_l(m.amount));
    }
    if let Some(use_) = &m.misc_use {
        let mut timing = Map::new();
        timing.insert("use".into(), Value::String(misc_use_to_beerjson(use_)));
        if let Some(t) = m.time {
            timing.insert("time".into(), minutes(t));
        }
        obj.insert("timing".into(), Value::Object(timing));
    }
    Value::Object(obj)
}

fn misc_use_to_beerjson(u: &MiscUse) -> String {
    match u {
        MiscUse::Boil => "add_to_boil",
        MiscUse::Mash => "add_to_mash",
        MiscUse::Primary | MiscUse::Secondary => "add_to_fermentation",
        MiscUse::Bottling => "add_to_package",
    }
    .to_string()
}

fn mash_step_to_beerjson(s: &MashStep) -> Value {
    let mut obj = Map::new();
    obj.insert("name".into(), Value::String(s.name.clone()));
    obj.insert("type".into(), Value::String(mash_step_type_to_beerjson(&s.effective_type())));
    obj.insert("step_temperature".into(), temperature_c(s.step_temp));
    obj.insert("step_time".into(), minutes(s.step_time));
    if let Some(infuse) = s.infuse_amount {
        obj.insert("amount".into(), volume_l(infuse));
    }
    if let Some(ramp) = s.ramp_time {
        obj.insert("ramp_time".into(), minutes(ramp));
    }
    if let Some(end) = s.end_temp {
        obj.insert("end_temperature".into(), temperature_c(end));
    }
    Value::Object(obj)
}

fn mash_step_type_to_beerjson(t: &MashStepType) -> String {
    match t {
        MashStepType::Infusion => "infusion",
        MashStepType::Temperature => "temperature",
        MashStepType::Decoction => "decoction",
    }
    .to_string()
}

// ─── Unit-bearing value primitives ────────────────────────────────────────

fn volume_l(v: f64) -> Value {
    json!({ "value": v, "unit": "l" })
}

fn mass_kg(v: f64) -> Value {
    json!({ "value": v, "unit": "kg" })
}

fn minutes(v: f64) -> Value {
    json!({ "value": v, "unit": "min" })
}

fn temperature_c(v: f64) -> Value {
    json!({ "value": v, "unit": "C" })
}

fn percent(v: f64) -> Value {
    json!({ "value": v, "unit": "%" })
}

fn gravity(v: f64) -> Value {
    json!({ "value": v, "unit": "sg" })
}
