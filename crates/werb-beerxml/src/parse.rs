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
/// Returns [`Error::Invalid`] (or [`Error::Xml`] at the document root) for
/// XML that doesn't fit BeerXML, and [`Error::NoRecipes`] when the document
/// parses but contains no `<RECIPE>` elements.
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
    let mut de = quick_xml::de::Deserializer::from_str(xml);
    let recipes: Recipes = serde_path_to_error::deserialize(&mut de).map_err(|e| {
        let location = xpath(e.path());
        let source = e.into_inner();
        if location == ROOT {
            Error::Xml(source)
        } else {
            Error::Invalid { location, source }
        }
    })?;
    if recipes.items.is_empty() {
        return Err(Error::NoRecipes);
    }
    Ok(recipes.items)
}

const ROOT: &str = "/RECIPES";

/// The serde path as an XPath with 1-based indices, the form someone
/// opening the file in an editor can follow.
fn xpath(path: &serde_path_to_error::Path) -> String {
    use serde_path_to_error::Segment;
    let mut out = String::from(ROOT);
    for segment in path.iter() {
        match segment {
            Segment::Map { key } => {
                out.push('/');
                out.push_str(key);
            }
            Segment::Seq { index } => out.push_str(&format!("[{}]", index + 1)),
            Segment::Enum { .. } | Segment::Unknown => {}
        }
    }
    out
}

/// Convenience wrapper for the common "one recipe per file" case.
///
/// Returns the first `<RECIPE>` in the document, or [`Error::NoRecipes`]
/// if there is none. Additional recipes after the first are silently
/// ignored — call [`parse`] if that matters.
pub fn parse_one(xml: &str) -> Result<Recipe, Error> {
    parse(xml)?.into_iter().next().ok_or(Error::NoRecipes)
}
