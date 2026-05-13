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
    assert!(matches!(parse(xml), Err(Error::Xml(_))));
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
