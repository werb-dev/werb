//! WebAssembly bindings for `werb-beerxml`.
//!
//! Exposes two parsers to the JS side:
//!
//! - [`parseBeerXmlJson`] — BeerXML 1.0 in, BeerJSON 2.x out.
//! - [`parseJoliebulleJson`] — joliebulle v4 library export in,
//!   BeerJSON 2.x out.
//!
//! Both return a JSON string the JS caller `JSON.parse`s. We avoid
//! `serde_wasm_bindgen` because it serializes
//! `serde_json::Value::Object` to a JS `Map`, not a plain object —
//! `recipe.name` would be `undefined` on the JS side. Round-tripping
//! through JSON sidesteps the issue and keeps the wasm smaller.

use wasm_bindgen::prelude::*;

/// Parse a BeerXML document into a JSON string of an array of BeerJSON
/// 2.x recipes. The JS caller does `JSON.parse(result)` to get plain
/// objects.
///
/// Throws a JS string (the underlying parse error) on failure.
#[wasm_bindgen(js_name = parseBeerXmlJson)]
pub fn parse_beerxml_json(xml: &str) -> Result<String, JsValue> {
    let recipes = werb_beerxml::parse(xml).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let recipes: Vec<werb_beerjson::Recipe> = recipes.iter().map(|r| r.to_beerjson()).collect();
    serde_json::to_string(&recipes).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Parse a joliebulle v4 library export (the JSON file the desktop
/// app's "Export library" produces) into the same BeerJSON 2.x
/// array shape as [`parseBeerXmlJson`]. Used by the in-app
/// "Import recipes" picker when the user hands it a `.json` file.
///
/// Throws a JS string on failure.
#[wasm_bindgen(js_name = parseJoliebulleJson)]
pub fn parse_joliebulle_json(json: &str) -> Result<String, JsValue> {
    let recipes =
        werb_beerxml::parse_joliebulle(json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let recipes: Vec<werb_beerjson::Recipe> = recipes.iter().map(|r| r.to_beerjson()).collect();
    serde_json::to_string(&recipes).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// JS-side sniff helper: returns `true` when the given text looks
/// like a joliebulle v4 export (top-level `recipes` array, no
/// `beerjson` wrapper). The import flow uses this to pick between
/// the BeerJSON parser and the joliebulle parser for `.json` inputs.
#[wasm_bindgen(js_name = looksLikeJoliebulle)]
pub fn looks_like_joliebulle(json: &str) -> bool {
    werb_beerxml::looks_like_joliebulle(json)
}
