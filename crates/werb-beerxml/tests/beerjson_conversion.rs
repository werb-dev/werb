//! Schema-driven tests for the BeerXML → BeerJSON 2.x converter.
//!
//! The BeerJSON 2.x schemas in the `vendor/beerjson/` git submodule
//! are the source of truth. Every test serializes the typed
//! [`werb_beerjson::Recipe`] the converter produces back to JSON and
//! validates it against those schemas via [`boon`] — so a future
//! schema bump that breaks our output surfaces here as a test failure,
//! and the test descriptions stay valid as long as the schemas do.
//!
//! Coverage:
//!  - `validates_*`  — round-trip schema validation, the contract test.
//!  - `field_*`     — focused assertions on individual converter
//!                    decisions (defaulting, unit choice, enum
//!                    mapping). They live alongside the schema check
//!                    so a regression in a single field surfaces
//!                    independently of the broader validation.

use boon::{Compiler, SchemaIndex, Schemas};
use serde_json::Value;
use std::path::PathBuf;
use std::sync::OnceLock;
use werb_beerxml::parse_one;

const SAMPLE: &str = include_str!("fixtures/sample_ipa.beerxml");
const JOLIEBULLE: &str = include_str!("fixtures/joliebulle_blanche.xml");

// ─── Schema validator harness ─────────────────────────────────────────────

struct Validator {
    schemas: Schemas,
    recipe_idx: SchemaIndex,
    document_idx: SchemaIndex,
}

fn validator() -> &'static Validator {
    static CACHE: OnceLock<Validator> = OnceLock::new();
    CACHE.get_or_init(|| {
        let schemas_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .parent()
            .unwrap()
            .join("vendor")
            .join("beerjson")
            .join("json");

        // Each schema declares a canonical `$id` pointing at the
        // upstream GitHub URL. Cross-file `$ref` values (e.g.
        // `measureable_units.json#/...`) resolve against that `$id`,
        // so we register every schema under that same URL prefix —
        // matching the resolved-ref string boon hands back during
        // validation.
        const BASE: &str = "https://raw.githubusercontent.com/beerjson/beerjson/master/json/";

        let mut compiler = Compiler::new();
        for entry in std::fs::read_dir(&schemas_dir).expect("read schemas dir") {
            let path = entry.expect("dir entry").path();
            let Some(name) = path.file_name().and_then(|n| n.to_str()) else { continue };
            if !name.ends_with(".json") {
                continue;
            }
            let value: Value =
                serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
            let url = format!("{BASE}{name}");
            compiler
                .add_resource(&url, value)
                .unwrap_or_else(|e| panic!("loading {name}: {e:#}"));
        }

        let mut schemas = Schemas::new();
        let recipe_idx = compiler
            .compile(
                &format!("{BASE}recipe.json#/definitions/RecipeType"),
                &mut schemas,
            )
            .expect("compile RecipeType schema");
        let document_idx = compiler
            .compile(&format!("{BASE}beer.json#"), &mut schemas)
            .expect("compile root beer.json schema");

        Validator {
            schemas,
            recipe_idx,
            document_idx,
        }
    })
}

/// Assert the given JSON value validates as a `RecipeType`. On
/// failure, prints every schema error with its JSON pointer so the
/// test output points straight at the offending field.
fn assert_recipe_validates(recipe_json: &Value, label: &str) {
    let v = validator();
    if let Err(err) = v.schemas.validate(recipe_json, v.recipe_idx) {
        panic!("{label} failed schema validation:\n{err:#}");
    }
}

/// Assert a full document (`{beerjson: {version, recipes: [...]}}`)
/// validates against the root schema. This is the strongest contract —
/// the same shape a `.beerjson` file on disk has to satisfy.
fn assert_document_validates(doc_json: &Value, label: &str) {
    let v = validator();
    if let Err(err) = v.schemas.validate(doc_json, v.document_idx) {
        panic!("{label} failed document validation:\n{err:#}");
    }
}

/// Convert a BeerXML string to a fully serialized JSON value through
/// the typed path the production converter uses.
fn convert(xml: &str) -> Value {
    let recipe = parse_one(xml).expect("parse");
    let typed = recipe.to_beerjson();
    serde_json::to_value(typed).expect("typed recipe must serialize")
}

fn convert_to_document(xml: &str) -> Value {
    let recipe = parse_one(xml).expect("parse");
    let doc = werb_beerjson::Document::single(recipe.to_beerjson());
    serde_json::to_value(doc).expect("document must serialize")
}

// ─── Round-trip schema validation ─────────────────────────────────────────

#[test]
fn validates_full_sample_recipe() {
    let json = convert(SAMPLE);
    assert_recipe_validates(&json, "sample_ipa");
}

#[test]
fn validates_full_sample_as_document() {
    let doc = convert_to_document(SAMPLE);
    assert_document_validates(&doc, "sample_ipa document");
}

#[test]
fn validates_joliebulle_export() {
    // joliebulle (a French homebrew app) ships its BeerXML exports
    // with a few quirks that historically broke our import:
    //  - empty self-closing enum elements (`<TYPE />`) on Recipe,
    //    Style, Yeast — quick-xml hands those to serde as `$text`,
    //    which doesn't match any enum variant.
    //  - `<YEAST>` blocks with no `<AMOUNT>` element at all (one pack
    //    = one item, so the value is implicit).
    //  - `<OG>` and `<FG>` instead of `<EST_OG>` / `<EST_FG>` for
    //    recipe-level gravity estimates.
    //
    // This test guards every one of those against future regressions.
    let recipe = parse_one(JOLIEBULLE).expect("joliebulle file must parse");
    // OG/FG fallback works.
    assert!(
        (recipe.est_og_value().unwrap() - 1.0494719043).abs() < 1e-9,
        "OG fallback should yield the value from <OG>",
    );
    assert!(
        (recipe.est_fg_value().unwrap() - 1.011873257032).abs() < 1e-9,
        "FG fallback should yield the value from <FG>",
    );
    // Empty `<TYPE />` on Recipe is None (not a parse error).
    assert!(recipe.recipe_type.is_none());
    // Empty `<TYPE />` on Yeast is None.
    let yeast = &recipe.yeasts.as_ref().unwrap().items[0];
    assert!(yeast.yeast_type.is_none());

    let doc = convert_to_document(JOLIEBULLE);
    assert_document_validates(&doc, "joliebulle Blanche");

    // The converted recipe should also carry the OG/FG forward.
    let r = &doc["beerjson"]["recipes"][0];
    assert_eq!(r["original_gravity"]["value"], 1.0494719043);
    assert_eq!(r["final_gravity"]["value"], 1.011873257032);
}

#[test]
fn validates_bare_minimum_recipe() {
    // Everything optional in BeerXML is omitted — the converter has to
    // synthesize every required BeerJSON field to keep the output
    // schema-valid.
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES>
  <RECIPE>
    <NAME>Bare</NAME>
    <VERSION>1</VERSION>
    <BATCH_SIZE>20.0</BATCH_SIZE>
  </RECIPE>
</RECIPES>"#;
    assert_recipe_validates(&convert(xml), "bare minimum");
}

#[test]
fn validates_recipe_with_only_style_required_fields_missing() {
    // BeerXML <STYLE> only carries a name — category, style_guide,
    // and the StyleCategories enum are all schema-required but
    // routinely missing from real-world files.
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES>
  <RECIPE>
    <NAME>Bare style</NAME>
    <VERSION>1</VERSION>
    <BATCH_SIZE>20.0</BATCH_SIZE>
    <STYLE>
      <NAME>Custom Style</NAME>
      <VERSION>1</VERSION>
    </STYLE>
  </RECIPE>
</RECIPES>"#;
    assert_recipe_validates(&convert(xml), "style with only name");
}

#[test]
fn validates_recipe_with_mash_default_step_synthesis() {
    // <MASH> with no <MASH_STEPS> — the schema's `minItems: 1` means
    // the converter has to synthesize a step or omit `mash` entirely.
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES>
  <RECIPE>
    <NAME>No mash steps</NAME>
    <VERSION>1</VERSION>
    <BATCH_SIZE>20.0</BATCH_SIZE>
    <MASH>
      <NAME>Step-less</NAME>
      <VERSION>1</VERSION>
    </MASH>
  </RECIPE>
</RECIPES>"#;
    assert_recipe_validates(&convert(xml), "mash without steps");
}

#[test]
fn validates_christmas_brew_style_scenario() {
    // The exact failure mode from the bug report: <CATEGORY_NUMBER>
    // is text but BeerJSON requires integer, and <STYLE.TYPE> here
    // is "Mixed" which has no direct BeerJSON enum equivalent.
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES>
  <RECIPE>
    <NAME>Christmas Brew</NAME>
    <VERSION>1</VERSION>
    <BATCH_SIZE>30.0</BATCH_SIZE>
    <STYLE>
      <NAME>Winter Seasonal Beer</NAME>
      <VERSION>1</VERSION>
      <CATEGORY>Spiced Beer</CATEGORY>
      <CATEGORY_NUMBER>30</CATEGORY_NUMBER>
      <STYLE_LETTER>C</STYLE_LETTER>
      <STYLE_GUIDE>BJCP 2015</STYLE_GUIDE>
      <TYPE>Mixed</TYPE>
    </STYLE>
  </RECIPE>
</RECIPES>"#;
    assert_recipe_validates(&convert(xml), "christmas brew");
}

#[test]
fn validates_recipe_with_every_ingredient_kind() {
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES>
  <RECIPE>
    <NAME>Everything</NAME>
    <VERSION>1</VERSION>
    <BATCH_SIZE>20.0</BATCH_SIZE>
    <FERMENTABLES>
      <FERMENTABLE>
        <NAME>Pale</NAME><VERSION>1</VERSION><TYPE>Grain</TYPE>
        <AMOUNT>4.0</AMOUNT><YIELD>80.0</YIELD><COLOR>2.0</COLOR>
      </FERMENTABLE>
      <FERMENTABLE>
        <NAME>Sugar</NAME><VERSION>1</VERSION><TYPE>Sugar</TYPE>
        <AMOUNT>0.5</AMOUNT><YIELD>100.0</YIELD><COLOR>0.0</COLOR>
      </FERMENTABLE>
      <FERMENTABLE>
        <NAME>DME</NAME><VERSION>1</VERSION><TYPE>Dry Extract</TYPE>
        <AMOUNT>0.3</AMOUNT><YIELD>90.0</YIELD><COLOR>5.0</COLOR>
      </FERMENTABLE>
      <FERMENTABLE>
        <NAME>Adjunct</NAME><VERSION>1</VERSION><TYPE>Adjunct</TYPE>
        <AMOUNT>0.2</AMOUNT><YIELD>70.0</YIELD><COLOR>3.0</COLOR>
      </FERMENTABLE>
    </FERMENTABLES>
    <HOPS>
      <HOP><NAME>Boil</NAME><VERSION>1</VERSION><ALPHA>5.0</ALPHA>
        <AMOUNT>0.020</AMOUNT><USE>Boil</USE><TIME>60.0</TIME>
        <FORM>Pellet</FORM></HOP>
      <HOP><NAME>FirstWort</NAME><VERSION>1</VERSION><ALPHA>5.0</ALPHA>
        <AMOUNT>0.020</AMOUNT><USE>First Wort</USE><TIME>60.0</TIME>
        <FORM>Leaf</FORM></HOP>
      <HOP><NAME>Aroma</NAME><VERSION>1</VERSION><ALPHA>5.0</ALPHA>
        <AMOUNT>0.020</AMOUNT><USE>Aroma</USE><TIME>5.0</TIME>
        <FORM>Pellet</FORM></HOP>
      <HOP><NAME>DryHop</NAME><VERSION>1</VERSION><ALPHA>5.0</ALPHA>
        <AMOUNT>0.020</AMOUNT><USE>Dry Hop</USE><TIME>4320.0</TIME>
        <FORM>Pellet</FORM></HOP>
      <HOP><NAME>Mash</NAME><VERSION>1</VERSION><ALPHA>5.0</ALPHA>
        <AMOUNT>0.020</AMOUNT><USE>Mash</USE><TIME>60.0</TIME>
        <FORM>Plug</FORM></HOP>
    </HOPS>
    <YEASTS>
      <YEAST><NAME>Ale</NAME><VERSION>1</VERSION><TYPE>Ale</TYPE>
        <FORM>Dry</FORM><AMOUNT>0.011</AMOUNT>
        <AMOUNT_IS_WEIGHT>true</AMOUNT_IS_WEIGHT></YEAST>
      <YEAST><NAME>Lager</NAME><VERSION>1</VERSION><TYPE>Lager</TYPE>
        <FORM>Liquid</FORM><AMOUNT>0.1</AMOUNT></YEAST>
      <YEAST><NAME>Wheat</NAME><VERSION>1</VERSION><TYPE>Wheat</TYPE>
        <FORM>Slant</FORM><AMOUNT>0.1</AMOUNT></YEAST>
      <YEAST><NAME>Champ</NAME><VERSION>1</VERSION><TYPE>Champagne</TYPE>
        <FORM>Culture</FORM><AMOUNT>0.1</AMOUNT></YEAST>
    </YEASTS>
    <MISCS>
      <MISC><NAME>Spice</NAME><VERSION>1</VERSION><TYPE>Spice</TYPE>
        <USE>Boil</USE><TIME>5.0</TIME><AMOUNT>0.010</AMOUNT>
        <AMOUNT_IS_WEIGHT>true</AMOUNT_IS_WEIGHT></MISC>
      <MISC><NAME>Fining</NAME><VERSION>1</VERSION><TYPE>Fining</TYPE>
        <USE>Boil</USE><TIME>15.0</TIME><AMOUNT>0.010</AMOUNT>
        <AMOUNT_IS_WEIGHT>true</AMOUNT_IS_WEIGHT></MISC>
      <MISC><NAME>Water</NAME><VERSION>1</VERSION><TYPE>Water Agent</TYPE>
        <USE>Mash</USE><TIME>0.0</TIME><AMOUNT>0.005</AMOUNT>
        <AMOUNT_IS_WEIGHT>true</AMOUNT_IS_WEIGHT></MISC>
      <MISC><NAME>Herb</NAME><VERSION>1</VERSION><TYPE>Herb</TYPE>
        <USE>Secondary</USE><TIME>0.0</TIME><AMOUNT>0.005</AMOUNT>
        <AMOUNT_IS_WEIGHT>true</AMOUNT_IS_WEIGHT></MISC>
      <MISC><NAME>Flavor</NAME><VERSION>1</VERSION><TYPE>Flavor</TYPE>
        <USE>Bottling</USE><TIME>0.0</TIME><AMOUNT>0.005</AMOUNT>
        <AMOUNT_IS_WEIGHT>true</AMOUNT_IS_WEIGHT></MISC>
    </MISCS>
    <MASH>
      <NAME>Step mash</NAME><VERSION>1</VERSION><GRAIN_TEMP>20.0</GRAIN_TEMP>
      <MASH_STEPS>
        <MASH_STEP><NAME>Protein</NAME><VERSION>1</VERSION>
          <TYPE>Infusion</TYPE><STEP_TEMP>52.0</STEP_TEMP><STEP_TIME>15.0</STEP_TIME>
          <INFUSE_AMOUNT>10.0</INFUSE_AMOUNT></MASH_STEP>
        <MASH_STEP><NAME>Sacc</NAME><VERSION>1</VERSION>
          <TYPE>Temperature</TYPE><STEP_TEMP>67.0</STEP_TEMP><STEP_TIME>60.0</STEP_TIME>
          <RAMP_TIME>5.0</RAMP_TIME></MASH_STEP>
        <MASH_STEP><NAME>Mash-out</NAME><VERSION>1</VERSION>
          <TYPE>Decoction</TYPE><STEP_TEMP>77.0</STEP_TEMP><STEP_TIME>10.0</STEP_TIME>
          <END_TEMP>78.0</END_TEMP></MASH_STEP>
      </MASH_STEPS>
    </MASH>
  </RECIPE>
</RECIPES>"#;
    assert_recipe_validates(&convert(xml), "kitchen-sink recipe");
}

// ─── Field-level converter behavior ───────────────────────────────────────

#[test]
fn field_category_number_is_integer() {
    let r = parse_one(SAMPLE).unwrap();
    let json = serde_json::to_value(r.to_beerjson()).unwrap();
    // This was the original bug — the schema requires an integer and
    // the converter previously emitted the BeerXML text verbatim.
    assert_eq!(json["style"]["category_number"], serde_json::json!(21));
    assert!(json["style"]["category_number"].is_i64());
}

#[test]
fn field_style_type_maps_beer_family_to_category() {
    // BeerXML "Ale" is a beer family, not a beverage category. BeerJSON
    // collapses every beer-flavored family to the "beer" category.
    let r = parse_one(SAMPLE).unwrap();
    let json = serde_json::to_value(r.to_beerjson()).unwrap();
    assert_eq!(json["style"]["type"], "beer");
}

#[test]
fn field_required_style_fields_get_placeholders() {
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES><RECIPE>
  <NAME>X</NAME><VERSION>1</VERSION><BATCH_SIZE>20.0</BATCH_SIZE>
  <STYLE><NAME>NoMeta</NAME><VERSION>1</VERSION></STYLE>
</RECIPE></RECIPES>"#;
    let json = convert(xml);
    let style = &json["style"];
    assert!(style["category"].is_string(), "category must be present");
    assert!(style["style_guide"].is_string(), "style_guide must be present");
    assert_eq!(style["type"], "beer");
}

#[test]
fn field_style_letter_sanitized_to_single_uppercase_char() {
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES><RECIPE>
  <NAME>X</NAME><VERSION>1</VERSION><BATCH_SIZE>20.0</BATCH_SIZE>
  <STYLE><NAME>Test</NAME><VERSION>1</VERSION>
    <CATEGORY>X</CATEGORY><CATEGORY_NUMBER>21</CATEGORY_NUMBER>
    <STYLE_LETTER>a</STYLE_LETTER><STYLE_GUIDE>BJCP</STYLE_GUIDE><TYPE>Ale</TYPE>
  </STYLE>
</RECIPE></RECIPES>"#;
    let json = convert(xml);
    assert_eq!(json["style"]["style_letter"], "A");
    assert_recipe_validates(&json, "style_letter sanitization");
}

#[test]
fn field_fermentable_yield_and_color_emitted_when_missing() {
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES><RECIPE>
  <NAME>X</NAME><VERSION>1</VERSION><BATCH_SIZE>20.0</BATCH_SIZE>
  <FERMENTABLES><FERMENTABLE>
    <NAME>M</NAME><VERSION>1</VERSION><TYPE>Grain</TYPE><AMOUNT>5.0</AMOUNT>
  </FERMENTABLE></FERMENTABLES>
</RECIPE></RECIPES>"#;
    let json = convert(xml);
    let f = &json["ingredients"]["fermentable_additions"][0];
    assert!(f["yield"]["fine_grind"]["value"].is_number(), "yield default required");
    assert!(f["color"]["value"].is_number(), "color default required");
    assert_recipe_validates(&json, "fermentable defaults");
}

#[test]
fn field_hop_timing_always_present() {
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES><RECIPE>
  <NAME>X</NAME><VERSION>1</VERSION><BATCH_SIZE>20.0</BATCH_SIZE>
  <HOPS><HOP>
    <NAME>H</NAME><VERSION>1</VERSION><ALPHA>5.0</ALPHA><AMOUNT>0.010</AMOUNT>
  </HOP></HOPS>
</RECIPE></RECIPES>"#;
    let json = convert(xml);
    // HopAdditionType requires `timing`. Default to add_to_boil when
    // the source omits USE.
    assert_eq!(json["ingredients"]["hop_additions"][0]["timing"]["use"], "add_to_boil");
    assert_recipe_validates(&json, "hop timing default");
}

#[test]
fn field_yeast_wheat_maps_to_ale_culture_kind() {
    // BeerXML "Wheat" yeast family — no direct member in BeerJSON's
    // CultureType enum, so the converter folds it into "ale".
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES><RECIPE>
  <NAME>X</NAME><VERSION>1</VERSION><BATCH_SIZE>20.0</BATCH_SIZE>
  <YEASTS><YEAST>
    <NAME>WB-06</NAME><VERSION>1</VERSION><TYPE>Wheat</TYPE><FORM>Dry</FORM>
    <AMOUNT>0.011</AMOUNT><AMOUNT_IS_WEIGHT>true</AMOUNT_IS_WEIGHT>
  </YEAST></YEASTS>
</RECIPE></RECIPES>"#;
    let json = convert(xml);
    assert_eq!(json["ingredients"]["culture_additions"][0]["type"], "ale");
    assert_recipe_validates(&json, "wheat → ale mapping");
}

#[test]
fn field_misc_type_defaults_to_other_when_missing() {
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES><RECIPE>
  <NAME>X</NAME><VERSION>1</VERSION><BATCH_SIZE>20.0</BATCH_SIZE>
  <MISCS><MISC>
    <NAME>Mystery</NAME><VERSION>1</VERSION>
    <USE>Boil</USE><TIME>5.0</TIME><AMOUNT>0.005</AMOUNT>
    <AMOUNT_IS_WEIGHT>true</AMOUNT_IS_WEIGHT>
  </MISC></MISCS>
</RECIPE></RECIPES>"#;
    let json = convert(xml);
    assert_eq!(json["ingredients"]["miscellaneous_additions"][0]["type"], "other");
}

#[test]
fn field_misc_type_lowercased_and_mapped() {
    // BeerXML capitalizes MISC.TYPE ("Spice"), BeerJSON enum is
    // lowercase ("spice"). And "Water Agent" → "water agent".
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES><RECIPE>
  <NAME>X</NAME><VERSION>1</VERSION><BATCH_SIZE>20.0</BATCH_SIZE>
  <MISCS>
    <MISC><NAME>S</NAME><VERSION>1</VERSION><TYPE>Spice</TYPE>
      <USE>Boil</USE><TIME>5.0</TIME><AMOUNT>0.005</AMOUNT>
      <AMOUNT_IS_WEIGHT>true</AMOUNT_IS_WEIGHT></MISC>
    <MISC><NAME>W</NAME><VERSION>1</VERSION><TYPE>Water Agent</TYPE>
      <USE>Mash</USE><TIME>0.0</TIME><AMOUNT>0.005</AMOUNT>
      <AMOUNT_IS_WEIGHT>true</AMOUNT_IS_WEIGHT></MISC>
  </MISCS>
</RECIPE></RECIPES>"#;
    let json = convert(xml);
    let miscs = &json["ingredients"]["miscellaneous_additions"];
    assert_eq!(miscs[0]["type"], "spice");
    assert_eq!(miscs[1]["type"], "water agent");
}

#[test]
fn field_time_values_are_integers() {
    // BeerJSON's TimeType requires integer values — fractional minutes
    // get rounded.
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES><RECIPE>
  <NAME>X</NAME><VERSION>1</VERSION><BATCH_SIZE>20.0</BATCH_SIZE>
  <BOIL_TIME>45.5</BOIL_TIME>
  <HOPS><HOP><NAME>H</NAME><VERSION>1</VERSION><ALPHA>5.0</ALPHA>
    <AMOUNT>0.010</AMOUNT><USE>Boil</USE><TIME>14.7</TIME></HOP></HOPS>
</RECIPE></RECIPES>"#;
    let json = convert(xml);
    assert!(json["boil"]["boil_time"]["value"].is_i64());
    assert_eq!(json["boil"]["boil_time"]["value"], 46);
    assert!(
        json["ingredients"]["hop_additions"][0]["timing"]["time"]["value"].is_i64(),
        "hop timing time must be integer"
    );
    assert_eq!(json["ingredients"]["hop_additions"][0]["timing"]["time"]["value"], 15);
}

#[test]
fn field_mash_default_step_synthesized_when_empty() {
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES><RECIPE>
  <NAME>X</NAME><VERSION>1</VERSION><BATCH_SIZE>20.0</BATCH_SIZE>
  <MASH><NAME>Step-less</NAME><VERSION>1</VERSION></MASH>
</RECIPE></RECIPES>"#;
    let json = convert(xml);
    let steps = json["mash"]["mash_steps"].as_array().unwrap();
    assert_eq!(steps.len(), 1, "schema requires at least one mash step");
    assert_eq!(steps[0]["type"], "infusion");
    assert_eq!(steps[0]["step_temperature"]["value"], 67.0);
}

#[test]
fn field_mash_grain_temperature_defaults_when_missing() {
    // MashProcedureType requires grain_temperature — the converter
    // falls back to 20 °C when the source omits GRAIN_TEMP.
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES><RECIPE>
  <NAME>X</NAME><VERSION>1</VERSION><BATCH_SIZE>20.0</BATCH_SIZE>
  <MASH><NAME>M</NAME><VERSION>1</VERSION>
    <MASH_STEPS><MASH_STEP>
      <NAME>Sacc</NAME><VERSION>1</VERSION>
      <STEP_TEMP>67.0</STEP_TEMP><STEP_TIME>60.0</STEP_TIME>
    </MASH_STEP></MASH_STEPS>
  </MASH>
</RECIPE></RECIPES>"#;
    let json = convert(xml);
    assert_eq!(json["mash"]["grain_temperature"]["value"], 20.0);
}

#[test]
fn field_fermentable_color_unit_tracks_est_color() {
    // EST_COLOR carries the unit hint; fermentable colors and the
    // recipe color estimate share it.
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES><RECIPE>
  <NAME>X</NAME><VERSION>1</VERSION><BATCH_SIZE>20.0</BATCH_SIZE>
  <FERMENTABLES><FERMENTABLE>
    <NAME>P</NAME><VERSION>1</VERSION><TYPE>Grain</TYPE>
    <AMOUNT>5.0</AMOUNT><COLOR>4.0</COLOR>
  </FERMENTABLE></FERMENTABLES>
  <EST_COLOR>15 EBC</EST_COLOR>
</RECIPE></RECIPES>"#;
    let json = convert(xml);
    assert_eq!(
        json["ingredients"]["fermentable_additions"][0]["color"]["unit"],
        "EBC"
    );
    assert_eq!(json["color_estimate"]["unit"], "EBC");
}

#[test]
fn field_color_unit_falls_back_to_ebc_when_est_color_missing() {
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES><RECIPE>
  <NAME>X</NAME><VERSION>1</VERSION><BATCH_SIZE>20.0</BATCH_SIZE>
  <FERMENTABLES><FERMENTABLE>
    <NAME>P</NAME><VERSION>1</VERSION><TYPE>Grain</TYPE>
    <AMOUNT>5.0</AMOUNT><COLOR>8.0</COLOR>
  </FERMENTABLE></FERMENTABLES>
</RECIPE></RECIPES>"#;
    let json = convert(xml);
    assert_eq!(
        json["ingredients"]["fermentable_additions"][0]["color"]["unit"],
        "EBC"
    );
}

#[test]
fn field_color_unit_picks_up_lovi_from_est_color() {
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES><RECIPE>
  <NAME>X</NAME><VERSION>1</VERSION><BATCH_SIZE>20.0</BATCH_SIZE>
  <FERMENTABLES><FERMENTABLE>
    <NAME>2R</NAME><VERSION>1</VERSION><TYPE>Grain</TYPE>
    <AMOUNT>5.0</AMOUNT><COLOR>2.0</COLOR>
  </FERMENTABLE></FERMENTABLES>
  <EST_COLOR>5.5 °L</EST_COLOR>
</RECIPE></RECIPES>"#;
    let json = convert(xml);
    assert_eq!(
        json["ingredients"]["fermentable_additions"][0]["color"]["unit"],
        "Lovi"
    );
}

#[test]
fn field_required_top_level_fields_are_present() {
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES><RECIPE>
  <NAME>Bare</NAME><VERSION>1</VERSION><BATCH_SIZE>20.0</BATCH_SIZE>
</RECIPE></RECIPES>"#;
    let json = convert(xml);
    assert!(json["author"].is_string());
    assert!(json["efficiency"]["brewhouse"]["value"].is_number());
    assert!(json["ingredients"]["fermentable_additions"].is_array());
    assert_eq!(json["type"], "all grain");
}

#[test]
fn field_fermentable_supplier_maps_to_producer() {
    // BeerXML SUPPLIER → BeerJSON `producer`, since `producer` is the
    // only schema-defined producer-of-the-malt field on
    // FermentableBase.
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES><RECIPE>
  <NAME>X</NAME><VERSION>1</VERSION><BATCH_SIZE>20.0</BATCH_SIZE>
  <FERMENTABLES><FERMENTABLE>
    <NAME>Pilsner</NAME><VERSION>1</VERSION><TYPE>Grain</TYPE>
    <AMOUNT>5.0</AMOUNT><COLOR>2.0</COLOR>
    <SUPPLIER>Weyermann</SUPPLIER>
  </FERMENTABLE></FERMENTABLES>
</RECIPE></RECIPES>"#;
    let json = convert(xml);
    assert_eq!(
        json["ingredients"]["fermentable_additions"][0]["producer"],
        "Weyermann"
    );
}
