//! WebAssembly bindings for `werb-beerxml`.
//!
//! Single export: `parseBeerXmlJson(xml)` parses a BeerXML 1.0 document
//! and returns each contained recipe as a BeerJSON 2.x value, encoded
//! as a JSON string. The caller does `JSON.parse(result)` to materialize
//! plain objects.
//!
//! Why a string and not a JsValue? `serde_wasm_bindgen` serializes a
//! `serde_json::Value::Object` to a JS `Map`, not a plain object — so
//! `recipe.name` would be undefined on the JS side. Round-tripping
//! through JSON sidesteps the issue entirely and keeps the wasm smaller
//! (no serde-wasm-bindgen dependency).

use wasm_bindgen::prelude::*;

/// Parse a BeerXML document into a JSON string of an array of BeerJSON
/// 2.x recipes. The JS caller does `JSON.parse(result)` to get plain
/// objects.
///
/// Throws a JS string (the underlying parse error) on failure.
#[wasm_bindgen(js_name = parseBeerXmlJson)]
pub fn parse_beerxml_json(xml: &str) -> Result<String, JsValue> {
    let recipes = werb_beerxml::parse(xml).map_err(|e| JsValue::from_str(&e.to_string()))?;
    // `to_beerjson()` returns a strongly-typed `werb_beerjson::Recipe`;
    // serde drives the wire format. Collect to a `Vec<Recipe>` and let
    // `serde_json::to_string` serialize the whole array in one pass.
    let recipes: Vec<werb_beerjson::Recipe> = recipes.iter().map(|r| r.to_beerjson()).collect();
    serde_json::to_string(&recipes).map_err(|e| JsValue::from_str(&e.to_string()))
}
