//! WebAssembly bindings for `werb-beerxml`.
//!
//! Single export: `parseBeerXml(xml)` parses a BeerXML 1.0 document and
//! returns each contained recipe as a BeerJSON 2.x JSON value. The shape
//! is identical to what the Tauri command produced, so the JS caller
//! can route browser and desktop through the same code path.

use wasm_bindgen::prelude::*;

/// Parse a BeerXML document into an array of BeerJSON 2.x recipes.
///
/// Returns a JS array of plain objects on success; throws a JS string
/// (the underlying parse error) on failure.
#[wasm_bindgen(js_name = parseBeerXml)]
pub fn parse_beerxml(xml: &str) -> Result<JsValue, JsValue> {
    let recipes = werb_beerxml::parse(xml).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let json: Vec<serde_json::Value> = recipes.iter().map(|r| r.to_beerjson()).collect();
    serde_wasm_bindgen::to_value(&json).map_err(|e| JsValue::from_str(&e.to_string()))
}
