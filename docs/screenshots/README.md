# Screenshots

Drop the captured PNGs here, named exactly as listed below. The repo
README links to these paths, so naming + sizing matters.

## Required for v0.1

Capture from a 1280×800 desktop browser unless noted. Keep the OS
chrome out of the frame (use a screenshot tool that captures the
browser viewport directly, not the full window).

- `library.png` — Library screen with a few recipes loaded (use
  `Import samples` if you don't have your own). Show recipe cards in
  the grid, the active equipment badge if set.
- `recipe.png` — Recipe detail screen for a hop-forward beer with at
  least one tasting recorded. Scroll so the targets-strip + the
  tasting radar are both visible.
- `brew.png` — Brew screen mid-session: an active step with the
  countdown timer visible, the hop schedule populated, at least one
  measurement logged. The `1280` width is fine but the `768` (iPad
  portrait) width is more representative of how brewers actually use
  the screen — capture either.
- `journal.png` — Journal screen with 3–5 past sessions, ideally a
  mix of completed + abandoned for the status-badge variety.

## Optional / nice-to-have

- `equipment.png` — Equipment screen with the Quick-start wizard
  panel expanded.
- `editor.png` — Recipe editor with the ingredient autocomplete
  dropdown open over a fermentables row.
- `settings.png` — Settings showing Units + Cost adjustment +
  Data & privacy footer.
- `mobile-brew.png` — Brew screen at 390 px width (iPhone) showing
  the responsive layout — one-handed-brewing proof point.

## Style notes

- Pick a recipe with real numbers (a Pale Ale or IPA reads better
  than a partial sample). Avoid placeholder text like "New recipe".
- Use the bundled dark theme — don't change tokens. The Pinterest
  2026 / Cassis dark palette is the project's visual identity.
- For Brew screens, start a session, advance one or two steps, and
  let the timer count up so the countdown shows actual progress.
- Keep PNG file size reasonable (under ~400 KB per shot). If a
  capture comes out larger, run it through an optimizer like
  `pngquant` or `oxipng`.

## After capturing

Once the files land in this folder, the README references will
resolve automatically. No code changes needed.
