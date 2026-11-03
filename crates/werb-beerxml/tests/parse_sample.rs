//! BeerXML 1.0 model-level tests. The BeerXML → BeerJSON 2.x
//! conversion is covered separately in `beerjson_conversion.rs`.

use werb_beerxml::{parse, parse_one, Error, FermentableType, HopForm, HopUse, RecipeType, YeastForm, YeastType};

const SAMPLE: &str = include_str!("fixtures/sample_ipa.beerxml");

#[test]
fn parses_top_level_recipe_metadata() {
    let r = parse_one(SAMPLE).expect("parse");
    assert_eq!(r.name, "Cascade IPA");
    assert_eq!(r.effective_recipe_type(), RecipeType::AllGrain);
    assert_eq!(r.brewer.as_deref(), Some("Test Brewer"));
    assert!((r.batch_size - 20.0).abs() < 1e-9);
    assert!((r.effective_boil_size() - 26.0).abs() < 1e-9);
    assert_eq!(r.effective_boil_time(), 60.0);
    assert_eq!(r.efficiency, Some(75.0));
    assert_eq!(r.ibu, Some(52.5));
    assert_eq!(r.est_og_value(), Some(1.062));
    assert_eq!(r.est_fg_value(), Some(1.012));
    assert_eq!(r.est_color_value(), Some(9.5));
}

#[test]
fn missing_type_on_nested_elements_falls_back() {
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES>
  <RECIPE>
    <NAME>Type-less Recipe</NAME>
    <VERSION>1</VERSION>
    <BATCH_SIZE>20.0</BATCH_SIZE>
    <FERMENTABLES>
      <FERMENTABLE>
        <NAME>Mystery malt</NAME>
        <VERSION>1</VERSION>
        <AMOUNT>5.0</AMOUNT>
      </FERMENTABLE>
    </FERMENTABLES>
    <YEASTS>
      <YEAST>
        <NAME>Mystery yeast</NAME>
        <VERSION>1</VERSION>
        <AMOUNT>0.011</AMOUNT>
      </YEAST>
    </YEASTS>
    <MASH>
      <NAME>Single rest</NAME>
      <VERSION>1</VERSION>
      <MASH_STEPS>
        <MASH_STEP>
          <NAME>Sacc</NAME>
          <VERSION>1</VERSION>
          <STEP_TEMP>67.0</STEP_TEMP>
          <STEP_TIME>60.0</STEP_TIME>
        </MASH_STEP>
      </MASH_STEPS>
    </MASH>
  </RECIPE>
</RECIPES>"#;
    let r = parse_one(xml).expect("missing nested TYPE/FORM should not fail parse");
    let f = &r.fermentables.unwrap().items[0];
    assert_eq!(f.effective_type(), FermentableType::Adjunct);
    let y = &r.yeasts.unwrap().items[0];
    assert_eq!(y.effective_type(), YeastType::Ale);
    assert_eq!(y.effective_form(), YeastForm::Dry);
    let m = &r.mash.unwrap().mash_steps.unwrap().items[0];
    use werb_beerxml::MashStepType;
    assert_eq!(m.effective_type(), MashStepType::Infusion);
}

#[test]
fn parses_style_block() {
    let r = parse_one(SAMPLE).unwrap();
    let style = r.style.as_ref().expect("style");
    assert_eq!(style.name, "American IPA");
    assert_eq!(style.category_number.as_deref(), Some("21"));
    assert_eq!(style.style_letter.as_deref(), Some("A"));
    assert_eq!(style.og_min, Some(1.056));
    assert_eq!(style.color_max, Some(14.0));
}

#[test]
fn parses_fermentables() {
    let r = parse_one(SAMPLE).unwrap();
    let f = r.fermentables.as_ref().unwrap();
    assert_eq!(f.items.len(), 2);
    assert_eq!(f.items[0].name, "Pale 2-Row");
    assert_eq!(f.items[0].effective_type(), FermentableType::Grain);
    assert!((f.items[0].amount - 4.5).abs() < 1e-9);
    assert_eq!(f.items[1].color, Some(60.0));
}

#[test]
fn parses_hops() {
    let r = parse_one(SAMPLE).unwrap();
    let h = r.hops.as_ref().unwrap();
    assert_eq!(h.items.len(), 2);
    assert_eq!(h.items[0].name, "Cascade");
    assert_eq!(h.items[0].hop_use, Some(HopUse::Boil));
    assert_eq!(h.items[0].form, Some(HopForm::Pellet));
    assert_eq!(h.items[1].hop_use, Some(HopUse::DryHop));
}

#[test]
fn parses_yeasts() {
    let r = parse_one(SAMPLE).unwrap();
    let y = r.yeasts.as_ref().unwrap();
    assert_eq!(y.items.len(), 1);
    let yeast = &y.items[0];
    assert_eq!(yeast.name, "Safale US-05");
    assert_eq!(yeast.effective_type(), YeastType::Ale);
    assert_eq!(yeast.effective_form(), YeastForm::Dry);
    assert_eq!(yeast.amount_is_weight, Some(true));
    assert_eq!(yeast.product_id.as_deref(), Some("US-05"));
    assert_eq!(yeast.min_temperature, Some(15.0));
    assert_eq!(yeast.max_temperature, Some(22.0));
}

#[test]
fn parses_mash_schedule() {
    let r = parse_one(SAMPLE).unwrap();
    let mash = r.mash.as_ref().unwrap();
    assert_eq!(mash.name, "Single Infusion");
    assert_eq!(mash.grain_temp, Some(20.0));
    let steps = mash.mash_steps.as_ref().unwrap();
    assert_eq!(steps.items.len(), 1);
    assert_eq!(steps.items[0].step_temp, 67.0);
    assert_eq!(steps.items[0].step_time, 60.0);
    assert_eq!(steps.items[0].infuse_amount, Some(15.0));
}

#[test]
fn empty_input_errors() {
    let xml = "<RECIPES></RECIPES>";
    match parse(xml) {
        Err(Error::NoRecipes) => {}
        other => panic!("expected NoRecipes, got {other:?}"),
    }
}

#[test]
fn malformed_xml_errors() {
    let xml = "<RECIPES><RECIPE><NAME>oops"; // truncated
    match parse(xml) {
        Err(Error::Invalid { location, .. }) => assert_eq!(location, "/RECIPES/RECIPE[1]/NAME"),
        other => panic!("expected a located error, got {other:?}"),
    }
    assert!(matches!(parse("not xml at all <"), Err(Error::Xml(_))));
}

#[test]
fn empty_numeric_elements_do_not_break_the_parse() {
    // Real-world BeerXML exports sometimes leave numeric elements
    // empty (e.g. <COLOR></COLOR>, <MIN_TEMPERATURE/>) — that should
    // parse cleanly with None / 0.0 fallbacks, not blow up the import.
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES>
  <RECIPE>
    <NAME>Sparse</NAME>
    <VERSION>1</VERSION>
    <BATCH_SIZE>20.0</BATCH_SIZE>
    <BOIL_SIZE></BOIL_SIZE>
    <BOIL_TIME></BOIL_TIME>
    <EFFICIENCY></EFFICIENCY>
    <FERMENTABLES>
      <FERMENTABLE>
        <NAME>Mystery</NAME>
        <VERSION>1</VERSION>
        <TYPE>Grain</TYPE>
        <AMOUNT>5.0</AMOUNT>
        <YIELD></YIELD>
        <COLOR></COLOR>
      </FERMENTABLE>
    </FERMENTABLES>
    <HOPS>
      <HOP>
        <NAME>Mystery hop</NAME>
        <VERSION>1</VERSION>
        <ALPHA>5.0</ALPHA>
        <AMOUNT>0.028</AMOUNT>
        <TIME></TIME>
      </HOP>
    </HOPS>
    <YEASTS>
      <YEAST>
        <NAME>Mystery yeast</NAME>
        <VERSION>1</VERSION>
        <AMOUNT>0.011</AMOUNT>
        <ATTENUATION></ATTENUATION>
        <MIN_TEMPERATURE></MIN_TEMPERATURE>
        <MAX_TEMPERATURE/>
      </YEAST>
    </YEASTS>
    <IBU></IBU>
  </RECIPE>
</RECIPES>"#;
    let r = parse_one(xml).expect("empty numeric elements should not fail the parse");
    assert!(r.boil_size.is_none());
    assert!(r.boil_time.is_none());
    assert!(r.efficiency.is_none());
    assert!(r.ibu.is_none());
    let f = &r.fermentables.unwrap().items[0];
    assert!(f.color.is_none());
    assert!(f.yield_pct.is_none());
    let h = &r.hops.unwrap().items[0];
    assert!(h.time.is_none());
    let y = &r.yeasts.unwrap().items[0];
    assert!(y.attenuation.is_none());
    assert!(y.min_temperature.is_none());
    assert!(y.max_temperature.is_none());
}

// ─── Joliebulle v4 JSON ────────────────────────────────────────────────

const JOLIEBULLE_V4: &str = include_str!("fixtures/joliebulle_v4_sample.json");

#[test]
fn parses_joliebulle_v4_export() {
    let recipes = werb_beerxml::parse_joliebulle(JOLIEBULLE_V4).expect("must parse");
    assert!(!recipes.is_empty(), "fixture should contain recipes");
    let first = &recipes[0];
    assert_eq!(first.name, "BDA / JM 2");
    assert_eq!(first.brewer.as_deref(), Some("Test Brewer"));
    // joliebulle stores fermentable amounts in grams; we divide by
    // 1000 on the way in, so 4000g → 4kg.
    let ferms = first.fermentables.as_ref().unwrap();
    let pilsner = ferms.items.iter().find(|f| f.name == "Pilsner").unwrap();
    assert!((pilsner.amount - 4.0).abs() < 1e-9);
    // Hop amount: 40g → 0.04kg.
    let hop = &first.hops.as_ref().unwrap().items[0];
    assert!((hop.amount - 0.040).abs() < 1e-9);
    // Yeast amount is missing on joliebulle; defaults to 0.
    let yeast = &first.yeasts.as_ref().unwrap().items[0];
    assert_eq!(yeast.amount, 0.0);
    // The recipe-level OG and FG plant into est_og / est_fg.
    assert!(first.est_og_value().is_some());
    assert!(first.est_fg_value().is_some());
    // Mash sparge temperature carries through.
    assert_eq!(first.mash.as_ref().unwrap().sparge_temp, Some(78.0));
}

#[test]
fn joliebulle_v4_round_trips_through_to_beerjson() {
    let recipes = werb_beerxml::parse_joliebulle(JOLIEBULLE_V4).unwrap();
    for recipe in &recipes {
        let json = serde_json::to_value(recipe.to_beerjson()).unwrap();
        // The required-by-schema fields land in the output.
        assert!(json["name"].is_string());
        assert_eq!(json["type"], "all grain");
        assert!(json["batch_size"]["value"].is_number());
        assert!(json["ingredients"]["fermentable_additions"].is_array());
        assert!(json["efficiency"]["brewhouse"]["value"].is_number());
    }
}

#[test]
fn joliebulle_v4_sniff_matches_real_exports() {
    assert!(werb_beerxml::looks_like_joliebulle(JOLIEBULLE_V4));
    // BeerJSON 2.x documents should NOT sniff as joliebulle.
    assert!(!werb_beerxml::looks_like_joliebulle(
        r#"{"beerjson":{"version":2.06,"recipes":[]}}"#
    ));
    // Random JSON shouldn't either.
    assert!(!werb_beerxml::looks_like_joliebulle(r#"{"hello":"world"}"#));
}

// ─── Lenient values and located errors ────────────────────────────────────

fn one_hop(hop: &str) -> String {
    format!(
        r#"<?xml version="1.0"?><RECIPES><RECIPE><NAME>P</NAME><VERSION>1</VERSION>
<BATCH_SIZE>20</BATCH_SIZE><HOPS>{hop}</HOPS></RECIPE></RECIPES>"#
    )
}

#[test]
fn reads_a_decimal_comma() {
    let r = werb_beerxml::parse_one(&one_hop(
        "<HOP><NAME>C</NAME><ALPHA>5,5</ALPHA><AMOUNT>0,03</AMOUNT><USE>Boil</USE></HOP>",
    ))
    .unwrap();
    let hop = &r.hops.unwrap().items[0];
    assert!((hop.alpha - 5.5).abs() < 1e-9);
    assert!((hop.amount - 0.03).abs() < 1e-9);
}

#[test]
fn enums_ignore_case_and_read_common_synonyms() {
    use werb_beerxml::{FermentableType, HopForm, HopUse};
    let r = werb_beerxml::parse_one(&one_hop(
        "<HOP><NAME>A</NAME><ALPHA>5</ALPHA><AMOUNT>0.01</AMOUNT><USE>boil</USE><FORM>PELLETS</FORM></HOP>\
         <HOP><NAME>B</NAME><ALPHA>5</ALPHA><AMOUNT>0.01</AMOUNT><USE>Whirlpool</USE><FORM>Whole</FORM></HOP>\
         <HOP><NAME>C</NAME><ALPHA>5</ALPHA><AMOUNT>0.01</AMOUNT><USE>dry hop</USE></HOP>",
    ))
    .unwrap();
    let hops = r.hops.unwrap().items;
    assert_eq!(hops[0].hop_use, Some(HopUse::Boil));
    assert_eq!(hops[0].form, Some(HopForm::Pellet));
    assert_eq!(hops[1].hop_use, Some(HopUse::Aroma));
    assert_eq!(hops[1].form, Some(HopForm::Leaf));
    assert_eq!(hops[2].hop_use, Some(HopUse::DryHop));

    let malt = werb_beerxml::parse_one(
        r#"<RECIPES><RECIPE><NAME>P</NAME><BATCH_SIZE>20</BATCH_SIZE><FERMENTABLES>
<FERMENTABLE><NAME>Pale</NAME><TYPE>Malt</TYPE><AMOUNT>4</AMOUNT></FERMENTABLE>
</FERMENTABLES></RECIPE></RECIPES>"#,
    )
    .unwrap();
    assert_eq!(
        malt.fermentables.unwrap().items[0].fermentable_type,
        Some(FermentableType::Grain)
    );
}

#[test]
fn an_unknown_enum_value_reads_as_absent() {
    let r = werb_beerxml::parse_one(&one_hop(
        "<HOP><NAME>A</NAME><ALPHA>5</ALPHA><AMOUNT>0.01</AMOUNT><USE>Kettle soup</USE></HOP>",
    ))
    .unwrap();
    assert_eq!(r.hops.unwrap().items[0].hop_use, None);
}

#[test]
fn a_missing_alpha_reads_as_zero_like_an_empty_one() {
    let r = werb_beerxml::parse_one(&one_hop(
        "<HOP><NAME>A</NAME><AMOUNT>0.01</AMOUNT><USE>Boil</USE></HOP>",
    ))
    .unwrap();
    assert_eq!(r.hops.unwrap().items[0].alpha, 0.0);
}

#[test]
fn a_bad_value_names_its_element() {
    let err = werb_beerxml::parse(&one_hop(
        "<HOP><NAME>A</NAME><ALPHA>5</ALPHA><AMOUNT>0.01</AMOUNT></HOP>\
         <HOP><NAME>B</NAME><ALPHA>5</ALPHA><AMOUNT>lots</AMOUNT></HOP>",
    ))
    .unwrap_err();
    assert_eq!(
        err.to_string(),
        r#"/RECIPES/RECIPE[1]/HOPS/HOP[2]/AMOUNT: not a number: "lots""#
    );
}

#[test]
fn joliebulle_errors_name_their_field() {
    let err = werb_beerxml::parse_joliebulle(r#"{"recipes": [{"name": 3}]}"#).unwrap_err();
    assert!(err.to_string().contains("recipes[0].name"), "{err}");
}
