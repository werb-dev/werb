//! Strongly-typed BeerJSON 2.x data model.
//!
//! Every type in this crate is generated directly from the BeerJSON 2.x
//! JSON Schema files in the `vendor/beerjson/` git submodule (which
//! pins the upstream `beerjson/beerjson` repo, or a fork branch while
//! patches are awaiting upstream merge). The schemas are the source of
//! truth; a future schema bump is applied by `git submodule update
//! --remote` and re-running the generator (see
//! [`crates/werb-beerjson/tools/`]). Any field added, renamed, or made
//! required upstream becomes a Rust compile error at every site that
//! constructs the affected type — which is the whole point.
//!
//! ## Naming
//!
//! `typify` prefixes every generated type with its source file
//! (`StyleRecipeStyleType`, `MeasureableUnitsVolumeType`, …). The crate
//! re-exports the curated subset we use day-to-day under shorter
//! aliases ([`Recipe`], [`Style`], [`Volume`], …). The raw generated
//! identifiers remain reachable through the [`generated`] module for
//! anything not yet aliased.
//!
//! ## Round-tripping
//!
//! Every generated struct implements `Serialize`/`Deserialize`, so
//! `serde_json::to_value(recipe)` gives a schema-validating JSON tree
//! and `serde_json::from_value` rejects anything that violates the
//! schema. There is no path by which a malformed BeerJSON file leaves
//! this crate as a typed value, or vice versa.

#![doc(html_no_source)]

pub mod generated;

pub use generated::{
    // Top-level recipe shape
    RecipeEfficiencyType as Efficiency,
    RecipeIngredientsType as Ingredients,
    RecipeRecipeType as Recipe,
    RecipeRecipeTypeType as RecipeKind,
    RecipeTasteType as Taste,
    // Style
    StyleRecipeStyleType as Style,
    StyleStyleBase as StyleBase,
    StyleStyleCategories as StyleCategory,
    // Boil
    BoilBoilProcedureType as Boil,
    BoilStepBoilStepType as BoilStep,
    // Mash
    MashMashProcedureType as Mash,
    MashStepMashStepType as MashStep,
    MashStepMashStepTypeType as MashStepKind,
    // Fermentation
    FermentationFermentationProcedureType as Fermentation,
    FermentationStepFermentationStepType as FermentationStep,
    // Ingredients — additions
    CultureCultureAdditionType as CultureAddition,
    CultureCultureAdditionTypeAmount as CultureAmount,
    CultureCultureAdditionTypeForm as CultureForm,
    CultureCultureAdditionTypeType as CultureKind,
    FermentableFermentableAdditionType as FermentableAddition,
    FermentableFermentableAdditionTypeAmount as FermentableAmount,
    FermentableFermentableAdditionTypeGrainGroup as GrainGroup,
    FermentableFermentableAdditionTypeType as FermentableKind,
    FermentableYieldType as Yield,
    HopHopAdditionType as HopAddition,
    HopHopAdditionTypeAmount as HopAmount,
    HopHopAdditionTypeForm as HopForm,
    HopIbuEstimateType as IbuEstimate,
    HopIbuMethodType as IbuMethod,
    MiscMiscellaneousAdditionType as MiscAddition,
    MiscMiscellaneousAdditionTypeAmount as MiscAmount,
    MiscMiscellaneousAdditionTypeType as MiscKind,
    WaterWaterAdditionType as WaterAddition,
    // Timing
    TimingTimingType as Timing,
    TimingUseType as TimingUse,
    // Measurements — `{value, unit}` wrappers
    MeasureableUnitsAcidityType as Acidity,
    MeasureableUnitsAcidityUnitType as AcidityUnit,
    MeasureableUnitsBitternessType as Bitterness,
    MeasureableUnitsBitternessUnitType as BitternessUnit,
    MeasureableUnitsColorType as Color,
    MeasureableUnitsColorUnitType as ColorUnit,
    MeasureableUnitsDateType as Date,
    MeasureableUnitsGravityType as Gravity,
    MeasureableUnitsGravityUnitType as GravityUnit,
    MeasureableUnitsMassType as Mass,
    MeasureableUnitsMassUnitType as MassUnit,
    MeasureableUnitsPercentType as Percent,
    MeasureableUnitsPercentUnitType as PercentUnit,
    MeasureableUnitsTemperatureType as Temperature,
    MeasureableUnitsTemperatureUnitType as TemperatureUnit,
    MeasureableUnitsTimeType as Time,
    MeasureableUnitsTimeUnitType as TimeUnit,
    MeasureableUnitsUnitType as Count,
    MeasureableUnitsVolumeType as Volume,
    MeasureableUnitsVolumeUnitType as VolumeUnit,
};

/// Root container for a BeerJSON file: `{"beerjson": {"version": 2.06, "recipes": [...]}}`.
///
/// The vendored root schema (`beer.json`) only defines this object's
/// shape via its `properties.beerjson` block; `typify` can't lift that
/// shape into a top-level Rust type, so we hand-roll it here. The
/// nested types stay schema-driven.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct Document {
    pub beerjson: DocumentBody,
}

/// Body of a [`Document`]. Mirrors the `beerjson` object in the schema:
/// `version` is required, every collection (`recipes`, `fermentables`,
/// …) is optional.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct DocumentBody {
    pub version: f64,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub recipes: Vec<Recipe>,
}

impl Document {
    /// Build a single-recipe document at BeerJSON version `2.06`.
    pub fn single(recipe: Recipe) -> Self {
        Self {
            beerjson: DocumentBody {
                version: 2.06,
                recipes: vec![recipe],
            },
        }
    }
}
