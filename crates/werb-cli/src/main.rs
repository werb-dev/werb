//! Werb command-line tool.
//!
//! Right now there's a single subcommand — `werb convert` — which
//! normalizes a directory of mixed BeerXML / BeerJSON files into the
//! canonical "one recipe per `.beerjson` file" layout the Werb sync
//! feature consumes. Built as a multi-subcommand binary from the
//! start so future operations (`werb validate`, `werb push`) slot in
//! without renaming the entrypoint.

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use clap::{Parser, Subcommand};

#[derive(Parser, Debug)]
#[command(
    name = "werb",
    version,
    about = "Werb's recipe toolbox",
    long_about = None,
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Convert one or more BeerXML or BeerJSON files into per-recipe
    /// `.beerjson` files written under `--output`.
    Convert(ConvertArgs),
}

#[derive(Parser, Debug)]
struct ConvertArgs {
    /// Input files or directories. Directories are scanned for
    /// `.xml`, `.beerxml`, and `.beerjson` files (non-recursively).
    #[arg(required = true)]
    inputs: Vec<PathBuf>,

    /// Output directory. Created if it doesn't exist. Defaults to the
    /// current working directory.
    #[arg(short, long, default_value = ".")]
    output: PathBuf,

    /// Print what would be written without touching disk.
    #[arg(long)]
    dry_run: bool,

    /// Overwrite output files that already exist. Without this flag,
    /// the converter appends `-2`, `-3`, … to the slug instead.
    #[arg(long)]
    force: bool,
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    match cli.command {
        Command::Convert(args) => match run_convert(&args) {
            Ok(summary) => {
                eprintln!("{summary}");
                ExitCode::SUCCESS
            }
            Err(err) => {
                eprintln!("error: {err}");
                ExitCode::FAILURE
            }
        },
    }
}

// ─── convert ──────────────────────────────────────────────────────────────

struct Summary {
    written: usize,
    skipped: usize,
    failed: Vec<(PathBuf, String)>,
}

impl std::fmt::Display for Summary {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        writeln!(f, "{} written · {} skipped", self.written, self.skipped)?;
        for (path, err) in &self.failed {
            writeln!(f, "  ✗ {}: {err}", path.display())?;
        }
        Ok(())
    }
}

fn run_convert(args: &ConvertArgs) -> Result<Summary, String> {
    if !args.dry_run {
        fs::create_dir_all(&args.output)
            .map_err(|e| format!("creating output dir {}: {e}", args.output.display()))?;
    }

    let files = collect_input_files(&args.inputs)?;
    if files.is_empty() {
        return Err("no .xml / .beerxml / .beerjson files in any input".into());
    }

    // Track every slug we've written this run so collisions get a
    // -2 / -3 / … suffix instead of silently clobbering each other.
    let mut used_slugs: HashSet<String> = HashSet::new();
    let mut summary = Summary {
        written: 0,
        skipped: 0,
        failed: Vec::new(),
    };

    for file in &files {
        let raw = match fs::read_to_string(file) {
            Ok(s) => s,
            Err(e) => {
                summary.failed.push((file.clone(), format!("read failed: {e}")));
                continue;
            }
        };

        let recipes = match parse_any(file, &raw) {
            Ok(rs) => rs,
            Err(e) => {
                summary.failed.push((file.clone(), e));
                continue;
            }
        };

        for recipe in recipes {
            let slug = unique_slug(&slugify(&recipe.name), &mut used_slugs, args, &summary);
            let filename = format!("{slug}.beerjson");
            let target = args.output.join(&filename);

            if !args.force && !args.dry_run && target.exists() {
                summary.skipped += 1;
                continue;
            }

            let doc = werb_beerjson::Document::single(recipe);
            let json = match serde_json::to_string_pretty(&doc) {
                Ok(s) => s + "\n",
                Err(e) => {
                    summary.failed.push((file.clone(), format!("serialize: {e}")));
                    continue;
                }
            };

            if args.dry_run {
                println!("would write {} ({} bytes)", target.display(), json.len());
            } else if let Err(e) = fs::write(&target, &json) {
                summary
                    .failed
                    .push((file.clone(), format!("write {}: {e}", target.display())));
                continue;
            } else {
                println!("wrote {}", target.display());
            }
            summary.written += 1;
        }
    }
    Ok(summary)
}

/// Walk the user's positional inputs, expanding directories to the
/// recipe-shaped files inside (one level — recipe folders aren't
/// typically nested).
fn collect_input_files(inputs: &[PathBuf]) -> Result<Vec<PathBuf>, String> {
    let mut out = Vec::new();
    for path in inputs {
        if !path.exists() {
            return Err(format!("input not found: {}", path.display()));
        }
        if path.is_file() {
            if is_recipe_file(path) {
                out.push(path.clone());
            }
            continue;
        }
        let entries = fs::read_dir(path)
            .map_err(|e| format!("reading {}: {e}", path.display()))?;
        for entry in entries {
            let entry = entry.map_err(|e| format!("reading entry: {e}"))?;
            let p = entry.path();
            if p.is_file() && is_recipe_file(&p) {
                out.push(p);
            }
        }
    }
    out.sort();
    Ok(out)
}

fn is_recipe_file(p: &Path) -> bool {
    let Some(ext) = p.extension().and_then(|e| e.to_str()) else { return false };
    matches!(ext.to_ascii_lowercase().as_str(), "xml" | "beerxml" | "beerjson")
}

/// Parse a single input file. Tries BeerXML first when the extension
/// is `.xml`/`.beerxml`, BeerJSON otherwise. Returns the list of
/// typed BeerJSON recipes the file contained.
fn parse_any(path: &Path, raw: &str) -> Result<Vec<werb_beerjson::Recipe>, String> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase());
    match ext.as_deref() {
        Some("xml") | Some("beerxml") => werb_beerxml::parse(raw)
            .map(|recipes| recipes.iter().map(|r| r.to_beerjson()).collect())
            .map_err(|e| format!("BeerXML parse: {e}")),
        _ => parse_beerjson(raw),
    }
}

/// Parse a `.beerjson` file and pull out its recipes. Accepts both
/// the wrapped `{ "beerjson": { recipes: [...] } }` envelope and a
/// bare single-recipe document.
fn parse_beerjson(raw: &str) -> Result<Vec<werb_beerjson::Recipe>, String> {
    if let Ok(doc) = serde_json::from_str::<werb_beerjson::Document>(raw) {
        return Ok(doc.beerjson.recipes);
    }
    if let Ok(recipe) = serde_json::from_str::<werb_beerjson::Recipe>(raw) {
        return Ok(vec![recipe]);
    }
    Err("BeerJSON parse: not a recognized document shape".into())
}

/// Mirror of the slugifier in apps/desktop/src/data/recipe-export.ts.
/// Hand-rolled here so the CLI has no runtime dependency on the
/// desktop app, but produces byte-identical filenames: NFKD-normalize,
/// strip combining marks (so "é" → "e"), lowercase, then collapse any
/// non-alphanumeric run into a single hyphen.
fn slugify(name: &str) -> String {
    use unicode_normalization::UnicodeNormalization;

    let lower = name.to_lowercase();
    let normalized: String = lower
        .nfkd()
        .filter(|c| !matches!(*c as u32, 0x0300..=0x036F))
        .collect();

    let mut out = String::with_capacity(normalized.len());
    let mut last_dash = true;
    for c in normalized.chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c);
            last_dash = false;
        } else if !last_dash {
            out.push('-');
            last_dash = true;
        }
    }
    let trimmed = out.trim_matches('-');
    let truncated: String = trimmed.chars().take(60).collect();
    let final_trimmed = truncated.trim_end_matches('-').to_string();
    if final_trimmed.is_empty() {
        "recipe".to_string()
    } else {
        final_trimmed
    }
}

/// If we've already used `slug` in this run, suffix with `-2`, `-3`,
/// … until we find a free one. Also checks the output dir on disk
/// unless `--force` is set.
fn unique_slug(
    base: &str,
    used: &mut HashSet<String>,
    args: &ConvertArgs,
    _summary: &Summary,
) -> String {
    let mut candidate = base.to_string();
    let mut n = 2;
    loop {
        let on_disk_clash = !args.force
            && !args.dry_run
            && args.output.join(format!("{candidate}.beerjson")).exists();
        if !used.contains(&candidate) && !on_disk_clash {
            used.insert(candidate.clone());
            return candidate;
        }
        candidate = format!("{base}-{n}");
        n += 1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugify_handles_unicode_and_punctuation() {
        assert_eq!(slugify("Hazy IPA / Mosaic"), "hazy-ipa-mosaic");
        assert_eq!(slugify("  Saison  "), "saison");
        assert_eq!(slugify("---"), "recipe");
        assert_eq!(slugify("A"), "a");
    }

    #[test]
    fn slugify_matches_typescript_for_unicode() {
        // Same outputs the TS slugify in apps/desktop produces — any
        // drift here means CLI-produced filenames don't round-trip
        // cleanly through the in-app push.
        assert_eq!(slugify("Bière de Garde"), "biere-de-garde");
        assert_eq!(slugify("Pêche & Mandarine"), "peche-mandarine");
        assert_eq!(slugify("Käsekräcker"), "kasekracker");
    }

    #[test]
    fn slugify_truncates_long_names() {
        let long = "x".repeat(80);
        assert_eq!(slugify(&long).len(), 60);
    }
}
