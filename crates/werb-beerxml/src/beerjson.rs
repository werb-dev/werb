//! Conversion from the BeerXML model to a BeerJSON 2.x [`Recipe`].
//!
//! Every value we hand back is a typed struct from
//! [`werb_beerjson`], which itself is generated from the vendored
//! BeerJSON 2.x JSON Schema. Serde drives the eventual JSON shape, so
//! every required field is present at compile time and every enum
//! value is a valid schema enum member. A future schema bump becomes
//! a type-checker change-list rather than a runtime validation failure.
//!
//! ## Lossy by design
//!
//! Some BeerXML facts have no place in BeerJSON 2.x:
//!
//! - The recipe-level `<IBU>` value — `HopIbuEstimateType` only carries
//!   a `method`, not a value. The information is recoverable from the
//!   hop bill + boil time.
//! - `<HOP>` `<NOTES>` — the schema's `HopAdditionType` is a thin
//!   reference; only the catalog-level `VarietyInformation` has notes.
//! - `<YEAST>` temperature range on additions — only
//!   `CultureInformation` (the catalog type) carries it, not
//!   `CultureAdditionType`.
//!
//! These are silently dropped. If a future BeerJSON revision adds the
//! field, regenerating types lifts the limitation automatically.

use werb_beerjson::{
    generated::StyleStyleBaseStyleLetter, Boil, Color, ColorUnit, CultureAddition, CultureAmount,
    CultureForm, CultureKind, Efficiency, FermentableAddition, FermentableAmount, FermentableKind,
    Gravity, GravityUnit, HopAddition, HopAmount, HopForm, Ingredients, Mash, MashStep,
    MashStepKind, Mass, MassUnit, MiscAddition, MiscAmount, MiscKind, Percent, PercentUnit,
    Recipe, RecipeKind, Style, StyleBase, StyleCategory, Temperature, TemperatureUnit, Time,
    TimeUnit, Timing, TimingUse, Volume, VolumeUnit, Yield,
};

use crate::model::{
    Fermentable, FermentableType, Hop, HopForm as HopFormX, HopUse, MashStep as MashStepX,
    MashStepType as MashStepTypeX, Misc, MiscUse, Recipe as RecipeX, RecipeType as RecipeTypeX,
    Style as StyleX, Yeast, YeastForm, YeastType,
};

impl RecipeX {
    /// Render this recipe as a strongly-typed BeerJSON 2.x [`Recipe`].
    ///
    /// The result serializes (via serde) to a JSON tree that validates
    /// against the vendored BeerJSON 2.x schema — every required field
    /// is populated and every enum value is a schema member. Where
    /// BeerXML omits a value the schema marks required, this function
    /// emits a documented conservative default ("Unknown" author, 75 %
    /// brewhouse efficiency, 67 °C / 60 min default mash rest, …).
    pub fn to_beerjson(&self) -> Recipe {
        let color_unit = color_unit_from_label(self.effective_color_unit());

        Recipe {
            name: self.name.clone(),
            type_: recipe_kind(&self.effective_recipe_type()),
            author: self.brewer.clone().unwrap_or_else(|| "Unknown".to_string()),
            coauthor: None,
            created: None,
            batch_size: volume_l(self.batch_size),
            efficiency: Efficiency {
                // RecipeEfficiencyType requires `brewhouse`; default to
                // 75 % when the source leaves it blank.
                brewhouse: percent(self.efficiency.unwrap_or(75.0)),
                conversion: None,
                lauter: None,
                mash: None,
            },
            style: self.style.as_ref().map(style_to_beerjson),
            ingredients: build_ingredients(self, color_unit),
            mash: self.mash.as_ref().map(mash_to_beerjson),
            notes: self.notes.clone(),
            original_gravity: self.est_og_value().map(gravity),
            final_gravity: self.est_fg_value().map(gravity),
            alcohol_by_volume: None,
            // BeerXML's recipe-level IBU value has no place in
            // HopIbuEstimateType (schema-defined fields are only
            // `method`). Drop the value; it's recomputable.
            ibu_estimate: None,
            color_estimate: self.est_color_value().map(|v| Color {
                value: v,
                unit: color_unit,
            }),
            beer_p_h: None,
            carbonation: None,
            apparent_attenuation: None,
            fermentation: None,
            packaging: None,
            boil: Some(Boil {
                pre_boil_size: Some(volume_l(self.effective_boil_size())),
                boil_time: minutes(self.effective_boil_time()),
                boil_steps: Vec::new(),
                description: None,
                name: None,
                notes: None,
            }),
            taste: None,
            calories_per_pint: None,
        }
    }
}

// ─── Field-level helpers ──────────────────────────────────────────────────

fn recipe_kind(t: &RecipeTypeX) -> RecipeKind {
    match t {
        RecipeTypeX::Extract => RecipeKind::Extract,
        RecipeTypeX::PartialMash => RecipeKind::PartialMash,
        RecipeTypeX::AllGrain => RecipeKind::AllGrain,
    }
}

fn style_to_beerjson(s: &StyleX) -> Style {
    StyleBase {
        name: s.name.clone(),
        // StyleBase requires `category`, `style_guide`, and `type`.
        // Emit placeholders when the source omits them so the output
        // still validates.
        category: s.category.clone().unwrap_or_default(),
        style_guide: s.style_guide.clone().unwrap_or_default(),
        type_: style_category(s.style_type.as_deref()),
        // category_number is integer in the schema; parse the BeerXML
        // text representation and drop on parse failure.
        category_number: s
            .category_number
            .as_deref()
            .and_then(|n| n.trim().parse::<i64>().ok()),
        style_letter: sanitize_style_letter(s.style_letter.as_deref()),
    }
    .into()
}

/// BeerXML `STYLE.TYPE` (`Lager`, `Ale`, `Wheat`, `Mixed`, …) → BeerJSON
/// `StyleCategories` (`beer`, `cider`, `mead`, …). Beer-family values
/// collapse to `beer`; unknown / missing values fall back to `other`.
fn style_category(beerxml_type: Option<&str>) -> StyleCategory {
    match beerxml_type.map(str::trim).unwrap_or("").to_lowercase().as_str() {
        "cider" => StyleCategory::Cider,
        "mead" => StyleCategory::Mead,
        "wine" => StyleCategory::Wine,
        "" | "ale" | "lager" | "wheat" | "mixed" => StyleCategory::Beer,
        _ => StyleCategory::Other,
    }
}

/// Coerce a free-form style letter to the BeerJSON-schema-required
/// single character matching `[A-Z ]`. Returns `None` when no sensible
/// letter can be extracted.
fn sanitize_style_letter(s: Option<&str>) -> Option<StyleStyleBaseStyleLetter> {
    let ch = s?
        .trim()
        .chars()
        .find(|c| c.is_ascii_alphabetic())?
        .to_ascii_uppercase();
    StyleStyleBaseStyleLetter::try_from(ch.to_string()).ok()
}

fn build_ingredients(recipe: &RecipeX, color_unit: ColorUnit) -> Ingredients {
    let fermentable_additions = recipe
        .fermentables
        .as_ref()
        .map(|f| {
            f.items
                .iter()
                .map(|item| fermentable_to_beerjson(item, color_unit))
                .collect()
        })
        .unwrap_or_default();

    let hop_additions = recipe
        .hops
        .as_ref()
        .map(|h| h.items.iter().map(hop_to_beerjson).collect())
        .unwrap_or_default();

    let culture_additions = recipe
        .yeasts
        .as_ref()
        .map(|y| y.items.iter().map(yeast_to_beerjson).collect())
        .unwrap_or_default();

    let miscellaneous_additions = recipe
        .miscs
        .as_ref()
        .map(|m| m.items.iter().map(misc_to_beerjson).collect())
        .unwrap_or_default();

    Ingredients {
        fermentable_additions,
        hop_additions,
        culture_additions,
        miscellaneous_additions,
        water_additions: Vec::new(),
    }
}

fn fermentable_to_beerjson(f: &Fermentable, color_unit: ColorUnit) -> FermentableAddition {
    FermentableAddition {
        name: f.name.clone(),
        type_: fermentable_kind(&f.effective_type()),
        amount: FermentableAmount::MassType(mass_kg(f.amount)),
        // FermentableBase requires `yield` and `color` — emit zeroed
        // measurements when the source omits them.
        yield_: Yield {
            fine_grind: Some(percent(f.yield_pct.unwrap_or(0.0))),
            coarse_grind: None,
            fine_coarse_difference: None,
            potential: None,
        },
        color: Color {
            // BeerXML 1.0 spec says fermentable COLOR is degrees
            // Lovibond, but most modern tools store EBC there. Label
            // the value with whichever unit the recipe's EST_COLOR
            // suffix indicated (see RecipeX::effective_color_unit).
            value: f.color.unwrap_or(0.0),
            unit: color_unit,
        },
        grain_group: None,
        origin: f.origin.clone(),
        producer: f.supplier.clone(),
        product_id: None,
        timing: None,
    }
}

fn fermentable_kind(t: &FermentableType) -> FermentableKind {
    match t {
        FermentableType::Grain => FermentableKind::Grain,
        FermentableType::Sugar => FermentableKind::Sugar,
        FermentableType::Extract => FermentableKind::Extract,
        FermentableType::DryExtract => FermentableKind::DryExtract,
        // BeerXML's "Adjunct" has no direct BeerJSON enum member; fold
        // it into "other" rather than misrepresent it as one of the
        // specific kinds.
        FermentableType::Adjunct => FermentableKind::Other,
    }
}

fn hop_to_beerjson(h: &Hop) -> HopAddition {
    // HopAdditionType requires `timing`. Default to a boil addition
    // when the source omits USE.
    let use_ = h.hop_use.as_ref().map(hop_use).unwrap_or(TimingUse::AddToBoil);
    // BeerXML stores hop time uniformly in minutes. For dry-hop and
    // packaging additions the user thinks in days; we rewrite the
    // unit so the editor and brew screens show "3 day" instead of
    // "4320 min" for a 3-day dry hop.
    let time = h.time.map(|min| time_for_use(min, use_));
    HopAddition {
        name: h.name.clone(),
        alpha_acid: percent(h.alpha),
        amount: HopAmount::MassType(mass_kg(h.amount)),
        beta_acid: None,
        form: h.form.as_ref().map(hop_form),
        origin: None,
        producer: None,
        product_id: None,
        year: None,
        timing: Timing {
            use_: Some(use_),
            time,
            duration: None,
            continuous: None,
            specific_gravity: None,
            p_h: None,
            step: None,
        },
    }
}

fn time_for_use(minutes_value: f64, use_: TimingUse) -> Time {
    match use_ {
        TimingUse::AddToFermentation | TimingUse::AddToPackage => Time {
            value: (minutes_value / 1440.0).round() as i64,
            unit: TimeUnit::Day,
        },
        _ => Time {
            value: minutes_value.round() as i64,
            unit: TimeUnit::Min,
        },
    }
}

fn hop_use(u: &HopUse) -> TimingUse {
    match u {
        HopUse::Boil | HopUse::FirstWort | HopUse::Aroma => TimingUse::AddToBoil,
        HopUse::DryHop => TimingUse::AddToFermentation,
        HopUse::Mash => TimingUse::AddToMash,
    }
}

fn hop_form(f: &HopFormX) -> HopForm {
    match f {
        HopFormX::Pellet => HopForm::Pellet,
        HopFormX::Plug => HopForm::Plug,
        HopFormX::Leaf => HopForm::Leaf,
    }
}

fn yeast_to_beerjson(y: &Yeast) -> CultureAddition {
    // Werb standardises culture amounts on grams: brewers weigh
    // pitches on a kitchen scale. BeerXML AMOUNT is kg (weight) or
    // L (volume) — both small decimals like 0.011. We multiply by
    // 1000 to land on grams, treating 1 L of slurry as ≈ 1000 g
    // (density ≈ 1, close enough for the vial mass a brewer sees).
    let amount = CultureAmount::MassType(Mass {
        value: y.amount * 1000.0,
        unit: MassUnit::G,
    });

    CultureAddition {
        name: y.name.clone(),
        type_: yeast_kind(&y.effective_type()),
        form: yeast_form(&y.effective_form()),
        amount,
        attenuation: y.attenuation.map(percent),
        cell_count_billions: None,
        producer: y.laboratory.clone(),
        product_id: y.product_id.clone(),
        times_cultured: None,
        // CultureAdditionType has no `temperature_range`; that field
        // only lives on CultureInformation (catalog) records. Drop it.
        timing: None,
    }
}

fn yeast_kind(t: &YeastType) -> CultureKind {
    // BeerJSON CultureType: ale, bacteria, brett, champagne, kveik,
    // lacto, lager, malolactic, mixed-culture, other, pedio,
    // spontaneous, wine. BeerXML "Wheat" has no direct equivalent —
    // wheat-beer yeasts are top-fermenting ales.
    match t {
        YeastType::Ale | YeastType::Wheat => CultureKind::Ale,
        YeastType::Lager => CultureKind::Lager,
        YeastType::Wine => CultureKind::Wine,
        YeastType::Champagne => CultureKind::Champagne,
    }
}

fn yeast_form(f: &YeastForm) -> CultureForm {
    match f {
        YeastForm::Liquid => CultureForm::Liquid,
        YeastForm::Dry => CultureForm::Dry,
        YeastForm::Slant => CultureForm::Slant,
        YeastForm::Culture => CultureForm::Culture,
    }
}

fn misc_to_beerjson(m: &Misc) -> MiscAddition {
    let amount = if m.amount_is_weight.unwrap_or(false) {
        MiscAmount::MassType(mass_kg(m.amount))
    } else {
        MiscAmount::VolumeType(volume_l(m.amount))
    };

    MiscAddition {
        name: m.name.clone(),
        type_: misc_kind(m.misc_type.as_deref()),
        amount,
        producer: None,
        product_id: None,
        timing: m.misc_use.as_ref().map(|u| Timing {
            use_: Some(misc_use(u)),
            time: m.time.map(minutes),
            duration: None,
            continuous: None,
            specific_gravity: None,
            p_h: None,
            step: None,
        }),
    }
}

fn misc_kind(beerxml_type: Option<&str>) -> MiscKind {
    match beerxml_type.map(str::trim).unwrap_or("").to_lowercase().as_str() {
        "spice" => MiscKind::Spice,
        "fining" => MiscKind::Fining,
        "water agent" => MiscKind::WaterAgent,
        "herb" => MiscKind::Herb,
        "flavor" => MiscKind::Flavor,
        "wood" => MiscKind::Wood,
        _ => MiscKind::Other,
    }
}

fn misc_use(u: &MiscUse) -> TimingUse {
    match u {
        MiscUse::Boil => TimingUse::AddToBoil,
        MiscUse::Mash => TimingUse::AddToMash,
        MiscUse::Primary | MiscUse::Secondary => TimingUse::AddToFermentation,
        MiscUse::Bottling => TimingUse::AddToPackage,
    }
}

fn mash_to_beerjson(mash: &crate::model::Mash) -> Mash {
    let mut steps: Vec<MashStep> = mash
        .mash_steps
        .as_ref()
        .map(|s| s.items.iter().map(mash_step_to_beerjson).collect())
        .unwrap_or_default();

    // MashProcedureType requires at least one step (`minItems: 1`).
    // Synthesize a single 60 min infusion at 67 °C when the source
    // didn't supply any, so the output validates rather than fails.
    if steps.is_empty() {
        steps.push(MashStep {
            name: "Saccharification".to_string(),
            type_: MashStepKind::Infusion,
            step_temperature: temperature_c(67.0),
            step_time: Time {
                value: 60,
                unit: TimeUnit::Min,
            },
            amount: None,
            description: None,
            end_ph: None,
            end_temperature: None,
            infuse_temperature: None,
            ramp_time: None,
            start_ph: None,
            water_grain_ratio: None,
        });
    }

    Mash {
        name: mash.name.clone(),
        grain_temperature: temperature_c(mash.grain_temp.unwrap_or(20.0)),
        mash_steps: steps,
        notes: None,
    }
}

fn mash_step_to_beerjson(s: &MashStepX) -> MashStep {
    MashStep {
        name: s.name.clone(),
        type_: mash_step_kind(&s.effective_type()),
        step_temperature: temperature_c(s.step_temp),
        step_time: minutes(s.step_time),
        amount: s.infuse_amount.map(volume_l),
        ramp_time: s.ramp_time.map(minutes),
        end_temperature: s.end_temp.map(temperature_c),
        description: None,
        end_ph: None,
        infuse_temperature: None,
        start_ph: None,
        water_grain_ratio: None,
    }
}

fn mash_step_kind(t: &MashStepTypeX) -> MashStepKind {
    match t {
        MashStepTypeX::Infusion => MashStepKind::Infusion,
        MashStepTypeX::Temperature => MashStepKind::Temperature,
        MashStepTypeX::Decoction => MashStepKind::Decoction,
    }
}

// ─── Unit-bearing value primitives ────────────────────────────────────────

fn volume_l(v: f64) -> Volume {
    Volume {
        value: v,
        unit: VolumeUnit::L,
    }
}

fn mass_kg(v: f64) -> Mass {
    Mass {
        value: v,
        unit: MassUnit::Kg,
    }
}

/// Build a [`Time`]. The schema requires the `value` to be an integer
/// (`TimeType.value: integer`), so we round to the nearest minute —
/// half-minute boil or mash-step times in BeerXML files do exist, but
/// the schema doesn't represent sub-minute granularity.
fn minutes(v: f64) -> Time {
    Time {
        value: v.round() as i64,
        unit: TimeUnit::Min,
    }
}

fn temperature_c(v: f64) -> Temperature {
    Temperature {
        value: v,
        unit: TemperatureUnit::C,
    }
}

fn percent(v: f64) -> Percent {
    Percent {
        value: v,
        // typify renames the schema's "%" enum member to `X` (it's the
        // sole variant, so the name doesn't appear in the JSON output).
        unit: PercentUnit::X,
    }
}

fn gravity(v: f64) -> Gravity {
    Gravity {
        value: v,
        unit: GravityUnit::Sg,
    }
}

fn color_unit_from_label(label: &str) -> ColorUnit {
    match label {
        "SRM" => ColorUnit::Srm,
        "Lovi" => ColorUnit::Lovi,
        _ => ColorUnit::Ebc,
    }
}
