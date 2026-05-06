use serde::Deserialize;

use crate::error::Error;
use crate::model::Recipe;

/// The `<RECIPES>` root element of a BeerXML 1.0 file.
#[derive(Debug, Deserialize)]
struct Recipes {
    #[serde(rename = "RECIPE", default)]
    items: Vec<Recipe>,
}

/// Parses a BeerXML 1.0 document and returns every `<RECIPE>` it contains.
///
/// BeerXML files routinely bundle several recipes (a brewing log, a style
/// pack, etc.) so this is the right entry point for "load whatever the
/// user picked." If you know there is exactly one recipe, see
/// [`parse_one`].
///
/// # Errors
///
/// Returns [`Error::Xml`] for malformed XML and [`Error::NoRecipes`] when
/// the document parses but contains no `<RECIPE>` elements.
///
/// # Example
///
/// ```no_run
/// let xml = std::fs::read_to_string("ipa.beerxml").unwrap();
/// let recipes = werb_beerxml::parse(&xml).unwrap();
/// for r in &recipes {
///     println!("{}: {} hop additions", r.name, r.hops.as_ref().map(|h| h.items.len()).unwrap_or(0));
/// }
/// ```
pub fn parse(xml: &str) -> Result<Vec<Recipe>, Error> {
    let recipes: Recipes = quick_xml::de::from_str(xml)?;
    if recipes.items.is_empty() {
        return Err(Error::NoRecipes);
    }
    Ok(recipes.items)
}

/// Convenience wrapper for the common "one recipe per file" case.
///
/// Returns the first `<RECIPE>` in the document, or [`Error::NoRecipes`]
/// if there is none. Additional recipes after the first are silently
/// ignored — call [`parse`] if that matters.
pub fn parse_one(xml: &str) -> Result<Recipe, Error> {
    parse(xml)?.into_iter().next().ok_or(Error::NoRecipes)
}
