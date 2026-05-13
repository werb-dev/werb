# The `werb` CLI

`werb` is a standalone command-line tool for working with recipe files outside the GUI. It currently exposes two subcommands:

- **[`werb convert`](#werb-convert)** — bulk-convert a mix of BeerXML and BeerJSON inputs into the canonical "one recipe per `.beerjson` file" layout.
- **[`werb validate`](#werb-validate)** — schema-validate one or more recipe files against the [BeerJSON 2.x schema](https://github.com/beerjson/beerjson).

Both commands take the same input shapes (single files, multiple files, or directories) and share the same parser that the desktop app uses, so anything `werb convert` accepts will import cleanly in the GUI too.

## Install

### Prebuilt binaries

Every release attaches CLI archives. Download the one for your platform from [the latest release](https://github.com/werb-dev/werb/releases/latest):

| Platform | Asset |
|---|---|
| macOS Apple Silicon | `werb-aarch64-apple-darwin.tar.gz` |
| macOS Intel | `werb-x86_64-apple-darwin.tar.gz` |
| Linux x86_64 | `werb-x86_64-unknown-linux-musl.tar.gz` (fully static, runs on any glibc/musl distro) |
| Windows x86_64 | `werb-x86_64-pc-windows-msvc.zip` |

Extract, drop `werb` somewhere on your `PATH`, done.

### From source

If you have a Rust toolchain:

```bash
cargo install --git https://github.com/werb-dev/werb werb-cli
```

This produces a binary named `werb` in `~/.cargo/bin/`.

### Verify the install

```text
$ werb --version
werb 0.2.0
$ werb --help
Werb's recipe toolbox

Usage: werb <COMMAND>

Commands:
  convert   Convert one or more BeerXML or BeerJSON files into per-recipe `.beerjson` files
  validate  Validate one or more recipe files against the BeerJSON 2.x schema
  help      Print this message or the help of the given subcommand(s)
```

## `werb convert`

Normalizes mixed recipe sources into a uniform per-recipe BeerJSON layout. Useful for:

- Bootstrapping a [GitHub recipes archive](./sync.md) from historical files.
- Translating BeerXML exports from BeerSmith / Brewfather / joliebulle into something Werb (and every other modern tool) reads.
- Splitting a multi-recipe BeerJSON document into one file per recipe.

### Usage

```text
werb convert [OPTIONS] <INPUTS>...
```

`<INPUTS>` is one or more files **or** directories. Directories are scanned non-recursively for `.xml`, `.beerxml`, and `.beerjson` files. Examples:

```bash
# Single file
werb convert ~/Downloads/Blanche.xml -o ./recipes

# A directory full of mixed XML and JSON exports
werb convert ~/old-recipes/ -o ./recipes

# Mix-and-match — file paths and directories side by side
werb convert ./fresh.beerxml ~/historical/ ./one-off.beerjson -o ./recipes
```

### Output

For each recipe found in the inputs, `werb convert` writes a `<slug>.beerjson` file into the output directory. The slug is a kebab-cased, ASCII-normalized version of the recipe's name — `"Bière de Garde"` becomes `biere-de-garde.beerjson`. The same slugify rules are used by the in-app GitHub sync, so a recipe round-trips between the CLI and the app under the same filename.

A typical run looks like:

```text
$ werb convert ~/Downloads -o ./recipes
wrote ./recipes/blanche.beerjson
wrote ./recipes/smash-amarillo.beerjson
2 written · 0 skipped
```

### Flags

| Flag | Purpose |
|---|---|
| `-o`, `--output <DIR>` | Output directory. Created if it doesn't exist. Defaults to the current working directory. |
| `--dry-run` | Print what would be written, touch no disk. Useful for previewing slug rules before committing. |
| `--force` | Overwrite output files that already exist. Without this flag, an on-disk collision gets a `-2`, `-3`, … suffix (`blanche-2.beerjson`). |

### Slug collisions

Two recipes with the same name slugify to the same filename. `werb convert` resolves this in two passes:

1. **Within a single invocation**, every recipe gets a unique slug — second-and-later collisions are suffixed `-2`, `-3`, … So a folder with two `Blanche` recipes produces `blanche.beerjson` and `blanche-2.beerjson`.
2. **Against the on-disk state**, the same suffixing applies unless `--force` is passed, in which case the existing file is overwritten.

## `werb validate`

Schema-validates recipe files against the vendored BeerJSON 2.x schemas. For `.beerjson` inputs, it parses to JSON and runs the schema. For `.beerxml` inputs, it parses via the BeerXML reader, runs the typed converter, then validates the output — answering "would Werb import this cleanly?".

The schemas are embedded into the `werb` binary at compile time, so the command works offline and on any machine without checking out the source tree.

### Usage

```text
werb validate [OPTIONS] <INPUTS>...
```

```bash
# One file
werb validate ./recipes/blanche.beerjson

# A folder full of mixed XML and JSON
werb validate ./recipes/ ./drafts/
```

### Output

One line per file with a clear ✓ / ✗ marker. Failures include the JSON pointer to the offending field and a human-readable reason:

```text
$ werb validate ./recipes
✓ ./recipes/blanche.beerjson
✓ ./recipes/smash-amarillo.beerjson
✗ ./recipes/typo.beerjson
    jsonschema validation failed with .../beer.json#
    - at '/beerjson/recipes/0' [recipe.json#/definitions/RecipeType]: validation failed
      - at '/beerjson/recipes/0/style/category_number' [style.json#/.../type]: want integer, but got string
3 valid · 1 invalid
```

Exit code is `0` when every file validated and `1` if any failed — pipeline-friendly.

### Flags

| Flag | Purpose |
|---|---|
| `--fail-fast` | Stop on the first invalid file instead of validating every input. Useful in CI when the goal is a fast green/red signal rather than a full report. |

## Use cases

### Bootstrap a recipe archive on GitHub

Werb sync is configured to read a folder of `.beerjson` files. The CLI is the fastest way to populate that folder from a pile of historical exports:

```bash
git clone git@github.com:you/beer-recipes.git
cd beer-recipes
mkdir -p recipes
werb convert ~/Downloads/*.xml ~/old-recipes/ -o recipes
git add recipes && git commit -m "import historical recipes" && git push
```

Then in Werb → Settings → GitHub, connect to your repo with `recipes` as the folder, and **Pull**. Every file shows up in the app.

### CI for a recipes-only repo

If the repo above is just a recipe collection (no source code), drop a tiny CI workflow that validates every recipe on every push:

```yaml
# .github/workflows/validate.yml
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - run: curl -L https://github.com/werb-dev/werb/releases/latest/download/werb-x86_64-unknown-linux-musl.tar.gz | tar xz
      - run: ./werb-x86_64-unknown-linux-musl/werb validate ./recipes --fail-fast
```

Any commit that breaks the schema fails the check before it reaches anyone's local copy.

### Sanity-check a BeerSmith export before importing

```bash
$ werb validate ~/Documents/BeerSmith\ Exports/*.xml --fail-fast
✓ ~/Documents/BeerSmith Exports/IPA-2025.xml
✗ ~/Documents/BeerSmith Exports/lager-draft.xml
    /beerjson/recipes/0/style/category_number: want integer, but got string
0 valid · 1 invalid
```

Knowing the file is broken before you import beats hunting down why the recipe came in with no style.
