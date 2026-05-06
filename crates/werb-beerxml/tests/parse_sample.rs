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
fn beerjson_output_satisfies_required_fields() {
    // Bare-minimum BeerXML — no brewer, no efficiency, no fermentables.
    // The BeerJSON output still has to satisfy the schema's required
    // fields (`author`, `efficiency`, `ingredients.fermentable_additions`)
    // or the downstream app blows up dereferencing them.
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES>
  <RECIPE>
    <NAME>Bare Recipe</NAME>
    <VERSION>1</VERSION>
    <BATCH_SIZE>20.0</BATCH_SIZE>
  </RECIPE>
</RECIPES>"#;
    let r = parse_one(xml).unwrap();
    let json = r.to_beerjson();
    assert!(json["author"].is_string(), "author must be present");
    assert!(json["efficiency"]["brewhouse"]["value"].is_number(), "efficiency.brewhouse required");
    assert!(json["ingredients"]["fermentable_additions"].is_array(), "fermentable_additions required");
    assert_eq!(json["ingredients"]["fermentable_additions"].as_array().unwrap().len(), 0);
}

#[test]
fn missing_optional_fields_use_sensible_defaults() {
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES>
  <RECIPE>
    <NAME>Sparse Recipe</NAME>
    <VERSION>1</VERSION>
    <BATCH_SIZE>19.0</BATCH_SIZE>
  </RECIPE>
</RECIPES>"#;
    let r = parse_one(xml).expect("missing TYPE/BOIL_SIZE/BOIL_TIME should still parse");
    assert!(r.recipe_type.is_none());
    assert_eq!(r.effective_recipe_type(), RecipeType::AllGrain);
    assert!(r.boil_size.is_none());
    assert!((r.effective_boil_size() - 19.0 * 1.25).abs() < 1e-9);
    assert_eq!(r.effective_boil_time(), 60.0);
    let json = r.to_beerjson();
    assert_eq!(json["type"], "all grain");
    assert_eq!(json["boil"]["boil_time"]["value"], 60.0);
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
fn beerjson_emits_yeast_temperature_range() {
    let r = parse_one(SAMPLE).unwrap();
    let json = r.to_beerjson();
    let yeast = &json["ingredients"]["culture_additions"][0];
    assert_eq!(yeast["temperature_range"]["minimum"]["value"], 15.0);
    assert_eq!(yeast["temperature_range"]["minimum"]["unit"], "C");
    assert_eq!(yeast["temperature_range"]["maximum"]["value"], 22.0);
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
    assert!(matches!(parse(xml), Err(Error::Xml(_))));
}

#[test]
fn beerjson_conversion_round_trip() {
    let r = parse_one(SAMPLE).unwrap();
    let json = r.to_beerjson();
    assert_eq!(json["name"], "Cascade IPA");
    assert_eq!(json["type"], "all grain");
    assert_eq!(json["batch_size"]["value"], 20.0);
    assert_eq!(json["batch_size"]["unit"], "l");
    assert_eq!(json["boil"]["boil_time"]["value"], 60.0);
    assert_eq!(json["boil"]["boil_time"]["unit"], "min");
    assert_eq!(json["original_gravity"]["value"], 1.062);
    assert_eq!(json["original_gravity"]["unit"], "sg");
    assert_eq!(json["style"]["name"], "American IPA");
    assert_eq!(json["style"]["type"], "ale");
    assert_eq!(json["ingredients"]["fermentable_additions"][0]["name"], "Pale 2-Row");
    assert_eq!(json["ingredients"]["fermentable_additions"][0]["amount"]["unit"], "kg");
    // Fixture's EST_COLOR is "9.5 SRM" → fermentables labeled SRM too,
    // since real BeerXML files use one display unit globally.
    assert_eq!(json["ingredients"]["fermentable_additions"][0]["color"]["unit"], "SRM");
    assert_eq!(json["color_estimate"]["unit"], "SRM");
    assert_eq!(json["ingredients"]["hop_additions"][1]["timing"]["use"], "add_to_fermentation");
    assert_eq!(json["ingredients"]["culture_additions"][0]["form"], "dry");
    assert_eq!(json["ingredients"]["culture_additions"][0]["amount"]["unit"], "kg");
    assert_eq!(json["mash"]["mash_steps"][0]["step_temperature"]["value"], 67.0);
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

#[test]
fn color_unit_falls_back_to_ebc_when_est_color_missing() {
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES>
  <RECIPE>
    <NAME>No-Estimate</NAME>
    <VERSION>1</VERSION>
    <BATCH_SIZE>20.0</BATCH_SIZE>
    <FERMENTABLES>
      <FERMENTABLE>
        <NAME>Mystery</NAME>
        <VERSION>1</VERSION>
        <TYPE>Grain</TYPE>
        <AMOUNT>5.0</AMOUNT>
        <COLOR>8.0</COLOR>
      </FERMENTABLE>
    </FERMENTABLES>
  </RECIPE>
</RECIPES>"#;
    let r = parse_one(xml).unwrap();
    let json = r.to_beerjson();
    assert_eq!(
        json["ingredients"]["fermentable_additions"][0]["color"]["unit"],
        "EBC"
    );
}

#[test]
fn color_unit_picks_up_ebc_from_est_color() {
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES>
  <RECIPE>
    <NAME>Euro</NAME>
    <VERSION>1</VERSION>
    <BATCH_SIZE>20.0</BATCH_SIZE>
    <FERMENTABLES>
      <FERMENTABLE>
        <NAME>Pilsner</NAME>
        <VERSION>1</VERSION>
        <TYPE>Grain</TYPE>
        <AMOUNT>5.0</AMOUNT>
        <COLOR>4.0</COLOR>
      </FERMENTABLE>
    </FERMENTABLES>
    <EST_COLOR>15 EBC</EST_COLOR>
  </RECIPE>
</RECIPES>"#;
    let r = parse_one(xml).unwrap();
    let json = r.to_beerjson();
    assert_eq!(
        json["ingredients"]["fermentable_additions"][0]["color"]["unit"],
        "EBC"
    );
    assert_eq!(json["color_estimate"]["unit"], "EBC");
}

#[test]
fn color_unit_picks_up_lovi_from_est_color() {
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<RECIPES>
  <RECIPE>
    <NAME>US Recipe</NAME>
    <VERSION>1</VERSION>
    <BATCH_SIZE>20.0</BATCH_SIZE>
    <FERMENTABLES>
      <FERMENTABLE>
        <NAME>2-Row</NAME>
        <VERSION>1</VERSION>
        <TYPE>Grain</TYPE>
        <AMOUNT>5.0</AMOUNT>
        <COLOR>2.0</COLOR>
      </FERMENTABLE>
    </FERMENTABLES>
    <EST_COLOR>5.5 °L</EST_COLOR>
  </RECIPE>
</RECIPES>"#;
    let r = parse_one(xml).unwrap();
    let json = r.to_beerjson();
    assert_eq!(
        json["ingredients"]["fermentable_additions"][0]["color"]["unit"],
        "Lovi"
    );
}
