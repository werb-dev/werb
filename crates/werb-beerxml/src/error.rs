use thiserror::Error;

/// Errors that can occur while parsing BeerXML.
///
/// All variants are non-exhaustive in spirit — match `_` if you do not
/// want your code to break when a new variant is added.
#[derive(Debug, Error)]
pub enum Error {
    /// The input is not well-formed XML, or does not match the expected
    /// BeerXML structure, at the document root (e.g. missing `<RECIPES>`).
    #[error("BeerXML parse error: {0}")]
    Xml(#[from] quick_xml::DeError),

    /// An element's content does not fit BeerXML, at `location`: an XPath
    /// with 1-based indices, e.g. `/RECIPES/RECIPE[1]/HOPS/HOP[3]/AMOUNT`.
    #[error("{location}: {source}")]
    Invalid {
        /// Where in the document the problem is.
        location: String,
        /// What is wrong there.
        source: quick_xml::DeError,
    },

    /// A field that should be a number could not be parsed as one. The
    /// inner string is the offending raw text from the XML.
    #[error("invalid number in field {field}: {raw:?}")]
    InvalidNumber {
        /// Name of the field whose value failed to parse.
        field: &'static str,
        /// The raw text content from the XML.
        raw: String,
    },

    /// The input parsed as XML but contained no `<RECIPE>` elements.
    #[error("no <RECIPE> elements found in input")]
    NoRecipes,

    /// The input was passed to the joliebulle JSON parser and didn't
    /// match its expected shape.
    #[error("joliebulle JSON parse error: {0}")]
    Json(String),
}
