//! Integration tests for `werb convert`. Build the binary, run it
//! against fixture files in a temporary output directory, and assert
//! the output is what the in-app sync path would consume.

use assert_cmd::Command;
use predicates::prelude::*;
use std::path::PathBuf;
use tempfile::tempdir;

fn fixtures() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests").join("fixtures")
}

#[test]
fn converts_beerxml_to_per_recipe_beerjson() {
    let out = tempdir().unwrap();
    Command::cargo_bin("werb")
        .unwrap()
        .arg("convert")
        .arg(fixtures().join("sample_ipa.beerxml"))
        .arg("-o")
        .arg(out.path())
        .assert()
        .success()
        .stderr(predicate::str::contains("1 written"));

    let written = out.path().join("cascade-ipa.beerjson");
    assert!(written.exists(), "expected {} to exist", written.display());

    // Output must round-trip back through serde as a valid Document.
    let raw = std::fs::read_to_string(&written).unwrap();
    let doc: werb_beerjson::Document = serde_json::from_str(&raw).expect("valid BeerJSON document");
    assert_eq!(doc.beerjson.recipes.len(), 1);
    assert_eq!(doc.beerjson.recipes[0].name, "Cascade IPA");
}

#[test]
fn converts_joliebulle_export() {
    let out = tempdir().unwrap();
    Command::cargo_bin("werb")
        .unwrap()
        .arg("convert")
        .arg(fixtures().join("joliebulle_blanche.xml"))
        .arg("-o")
        .arg(out.path())
        .assert()
        .success();
    let written = out.path().join("blanche.beerjson");
    assert!(written.exists());
    let doc: werb_beerjson::Document = serde_json::from_str(
        &std::fs::read_to_string(&written).unwrap(),
    )
    .unwrap();
    // The joliebulle quirks (empty <TYPE />, missing AMOUNT, <OG>
    // instead of <EST_OG>) all survive the round-trip.
    let recipe = &doc.beerjson.recipes[0];
    assert_eq!(recipe.name, "Blanche");
    let og = recipe
        .original_gravity
        .as_ref()
        .expect("OG should carry over from joliebulle's <OG>");
    assert!((og.value - 1.0494719043).abs() < 1e-9);
}

#[test]
fn directory_input_picks_up_every_recipe_file() {
    // Stage exactly the files we want walked into a private temp dir
    // so adding new fixtures elsewhere doesn't perturb the count.
    let input = tempdir().unwrap();
    std::fs::copy(
        fixtures().join("sample_ipa.beerxml"),
        input.path().join("sample.beerxml"),
    )
    .unwrap();
    std::fs::copy(
        fixtures().join("joliebulle_blanche.xml"),
        input.path().join("blanche.xml"),
    )
    .unwrap();

    let out = tempdir().unwrap();
    Command::cargo_bin("werb")
        .unwrap()
        .arg("convert")
        .arg(input.path())
        .arg("-o")
        .arg(out.path())
        .assert()
        .success()
        .stderr(predicate::str::contains("2 written"));
    assert!(out.path().join("cascade-ipa.beerjson").exists());
    assert!(out.path().join("blanche.beerjson").exists());
}

#[test]
fn collisions_get_numeric_suffixes() {
    let out = tempdir().unwrap();
    let dir = tempdir().unwrap();
    // Two BeerXML files, both named "Blanche".
    std::fs::copy(
        fixtures().join("joliebulle_blanche.xml"),
        dir.path().join("a.xml"),
    )
    .unwrap();
    std::fs::copy(
        fixtures().join("joliebulle_blanche.xml"),
        dir.path().join("b.xml"),
    )
    .unwrap();
    Command::cargo_bin("werb")
        .unwrap()
        .arg("convert")
        .arg(dir.path())
        .arg("-o")
        .arg(out.path())
        .assert()
        .success();
    assert!(out.path().join("blanche.beerjson").exists());
    assert!(
        out.path().join("blanche-2.beerjson").exists(),
        "expected a collision-suffixed filename"
    );
}

#[test]
fn dry_run_writes_nothing() {
    let out = tempdir().unwrap();
    Command::cargo_bin("werb")
        .unwrap()
        .arg("convert")
        .arg(fixtures().join("sample_ipa.beerxml"))
        .arg("-o")
        .arg(out.path())
        .arg("--dry-run")
        .assert()
        .success()
        .stdout(predicate::str::contains("would write"));
    assert!(
        std::fs::read_dir(out.path()).unwrap().next().is_none(),
        "--dry-run should not touch disk"
    );
}

#[test]
fn force_overwrites_existing_files() {
    let out = tempdir().unwrap();
    // First pass writes cascade-ipa.beerjson.
    Command::cargo_bin("werb")
        .unwrap()
        .arg("convert")
        .arg(fixtures().join("sample_ipa.beerxml"))
        .arg("-o")
        .arg(out.path())
        .assert()
        .success();
    let path = out.path().join("cascade-ipa.beerjson");
    let original_mtime = std::fs::metadata(&path).unwrap().modified().unwrap();
    // Sleep a hair so the second mtime is detectably newer.
    std::thread::sleep(std::time::Duration::from_millis(20));

    // Second pass without --force should leave the file alone.
    Command::cargo_bin("werb")
        .unwrap()
        .arg("convert")
        .arg(fixtures().join("sample_ipa.beerxml"))
        .arg("-o")
        .arg(out.path())
        .assert()
        .success();
    // It instead made a `-2` file because of the collision rule.
    assert!(out.path().join("cascade-ipa-2.beerjson").exists());
    let untouched_mtime = std::fs::metadata(&path).unwrap().modified().unwrap();
    assert_eq!(untouched_mtime, original_mtime, "original should be untouched");

    // Now with --force, it overwrites the original instead of suffixing.
    std::fs::remove_file(out.path().join("cascade-ipa-2.beerjson")).unwrap();
    Command::cargo_bin("werb")
        .unwrap()
        .arg("convert")
        .arg(fixtures().join("sample_ipa.beerxml"))
        .arg("-o")
        .arg(out.path())
        .arg("--force")
        .assert()
        .success();
    let forced_mtime = std::fs::metadata(&path).unwrap().modified().unwrap();
    assert!(forced_mtime > original_mtime, "--force should overwrite");
}

#[test]
fn errors_on_missing_input() {
    Command::cargo_bin("werb")
        .unwrap()
        .arg("convert")
        .arg("/tmp/werb-cli-definitely-does-not-exist")
        .assert()
        .failure()
        .stderr(predicate::str::contains("input not found"));
}

// ─── validate ──────────────────────────────────────────────────────────────

#[test]
fn validate_passes_a_real_beerjson_file() {
    Command::cargo_bin("werb")
        .unwrap()
        .arg("validate")
        .arg(fixtures().join("valid_recipe.beerjson"))
        .assert()
        .success()
        .stdout(predicate::str::contains("✓"))
        .stderr(predicate::str::contains("1 valid · 0 invalid"));
}

#[test]
fn validate_passes_beerxml_after_round_tripping_through_the_converter() {
    // BeerXML in, validation says yes — same path as `werb convert`
    // followed by reading the output. Tests our "would Werb import
    // this?" promise for free.
    Command::cargo_bin("werb")
        .unwrap()
        .arg("validate")
        .arg(fixtures().join("sample_ipa.beerxml"))
        .assert()
        .success()
        .stderr(predicate::str::contains("1 valid · 0 invalid"));
}

#[test]
fn validate_passes_joliebulle_quirks() {
    // The historical bug-reporter's file — empty <TYPE />, missing
    // <AMOUNT> on yeast, <OG> instead of <EST_OG>. All survive the
    // BeerXML→BeerJSON round-trip and validate against the schema.
    Command::cargo_bin("werb")
        .unwrap()
        .arg("validate")
        .arg(fixtures().join("joliebulle_blanche.xml"))
        .assert()
        .success();
}

#[test]
fn validate_surfaces_schema_errors_with_json_pointer() {
    Command::cargo_bin("werb")
        .unwrap()
        .arg("validate")
        .arg(fixtures().join("invalid_recipe.beerjson"))
        .assert()
        .failure()
        .stdout(predicate::str::contains("✗"))
        // The fixture violates two rules — both should appear.
        .stdout(predicate::str::contains("category_number"))
        .stdout(predicate::str::contains("fermentable_additions"))
        .stderr(predicate::str::contains("0 valid · 1 invalid"));
}

#[test]
fn validate_reports_all_files_then_summary() {
    Command::cargo_bin("werb")
        .unwrap()
        .arg("validate")
        .arg(fixtures().join("valid_recipe.beerjson"))
        .arg(fixtures().join("invalid_recipe.beerjson"))
        .arg(fixtures().join("sample_ipa.beerxml"))
        .assert()
        .failure()
        .stderr(predicate::str::contains("2 valid · 1 invalid"))
        .stdout(predicate::str::contains("valid_recipe.beerjson"));
}

#[test]
fn validate_fail_fast_stops_after_first_failure() {
    Command::cargo_bin("werb")
        .unwrap()
        .arg("validate")
        .arg("--fail-fast")
        .arg(fixtures().join("invalid_recipe.beerjson"))
        .arg(fixtures().join("valid_recipe.beerjson"))
        .assert()
        .failure()
        // 0 valid because we stopped before getting to the valid file.
        .stderr(predicate::str::contains("0 valid · 1 invalid"));
}

#[test]
fn converts_joliebulle_v4_json_export() {
    let out = tempdir().unwrap();
    Command::cargo_bin("werb")
        .unwrap()
        .arg("convert")
        .arg(fixtures().join("joliebulle_v4_sample.json"))
        .arg("-o")
        .arg(out.path())
        .assert()
        .success()
        .stderr(predicate::str::contains("2 written"));
    // First recipe in the fixture is "BDA / JM 2" → bda-jm-2.beerjson.
    assert!(out.path().join("bda-jm-2.beerjson").exists());
}

#[test]
fn validates_joliebulle_v4_json_export() {
    Command::cargo_bin("werb")
        .unwrap()
        .arg("validate")
        .arg(fixtures().join("joliebulle_v4_sample.json"))
        .assert()
        .success()
        .stderr(predicate::str::contains("1 valid · 0 invalid"));
}
