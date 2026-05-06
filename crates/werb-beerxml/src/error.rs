use thiserror::Error;

/// Errors that can occur while parsing BeerXML.
///
/// All variants are non-exhaustive in spirit — match `_` if you do not
/// want your code to break when a new variant is added.
#[derive(Debug, Error)]
pub enum Error {
    /// The input is not well-formed XML, or does not match the expected
    /// BeerXML structure (e.g. missing `<RECIPES>` root).
    #[error("BeerXML parse error: {0}")]
    Xml(#[from] quick_xml::DeError),

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
}
