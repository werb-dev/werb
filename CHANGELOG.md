# Changelog

All notable changes to Werb are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Reorder hop additions** ([#42](https://github.com/werb-dev/werb/issues/42)).
  Hop rows in the editor now have up/down controls, so you can reorder additions
  (e.g. by time — 60 → 15 → flameout → dry hop) without deleting and re-adding.

### Fixed

- **Yeast nutrient DAP / Fermaid-K no longer defaults into the boil**
  ([#45](https://github.com/werb-dev/werb/issues/45)). It now defaults to *add at
  pitching* (fermentation), which is where DAP / Fermaid-K actually go.
  Servomyces stays a boil addition — that one really is added in the last ~10 min
  of the boil per the maker's instructions.
- **Leaving the editor via the top nav no longer discards unsaved edits silently**
  ([#51](https://github.com/werb-dev/werb/issues/51)). The unsaved-changes guard
  covered the back/cancel button and tab/window close, but the global nav pill
  was still shown on the editor — clicking Library/Stock/etc. mid-edit navigated
  away without prompting. The editor is now a focused mode (like the brew screen):
  the nav pill is hidden, so every exit runs through the guard or Save.
- **Changing a fermentable's category no longer leaves a corrupted row**
  ([#50](https://github.com/werb-dev/werb/issues/50)). Switching a row's type
  (e.g. a malt to "honey") kept the old name and the grain's EBC/yield, and the
  category-scoped picker could no longer re-find the original ingredient. A real
  category change now resets the row to a clean entry for the new type (keeping
  the amount), so the spec and the picker stay coherent.
- **Numeric fields no longer snap back to "0" while you clear them.** Boxed
  number inputs (water ions + salts, carbonation, equipment sizing, brew-day
  measurements) re-rendered an emptied field as "0" mid-edit, so you couldn't
  cleanly retype — you had to delete the leading 0 every time. They now buffer
  the text locally and sit empty while you retype, reformatting on blur (the
  same behaviour the inline editor fields already had). Measurement fields keep
  their "blank = no reading" meaning instead of logging a 0.

### Added

- **Load source-water profiles instead of typing six numbers** ([#9](https://github.com/werb-dev/werb/issues/9)).
  The water-chemistry section can now fill the source ions two ways: **Use
  recipe's water** pulls them from the recipe's own BeerJSON `water_additions`
  profile, and **Load from moneaudebrassage.fr** fetches the latest official
  tap-water analysis for a French commune by INSEE code (picking a network when
  a commune has several). The last lookup is cached so your home commune stays
  one click away and works offline; the commune fetch is desktop-only (the API
  is cross-origin and Origin-gated, which a browser can't do) and the source is
  attributed. Feeds straight into the existing salt-suggestion solver.
- **One-click PDF brew sheet** ([#12](https://github.com/werb-dev/werb/issues/12)).
  Journal → a session's ⋯ menu now exports a real, paginated PDF (not a
  Print-dialog HTML) that tells the whole story of one brew: header with
  recipe/style/batch/brewer/date, **targets vs. the gravities and ABV actually
  measured**, the full recipe, mash schedule and brew-day timeline, the
  fermentation/measurement log, incidents, and the post-brew tasting — 7-axis
  sensory radar, rating, and tags. The printable HTML stays as a web fallback.
- **Inventory / personal stock** ([#1](https://github.com/werb-dev/werb/issues/1)).
  A new **Stock** screen tracks the malts, hops, yeast, and miscs you actually
  own, with the per-item numbers that matter — hop alpha % (+ year, form), malt
  EBC and yield, yeast attenuation (+ form, best-by). When a recipe references
  an ingredient by name, the recipe screen uses your stock values to compute
  OG/FG/IBU/SRM and the style-fit gauges, and shows a banner saying exactly
  which values it swapped (e.g. *Cascade · alpha 5.5 → 7.2*). The shared catalog
  stays immutable (SPEC principle #7) and the BeerJSON file is never rewritten —
  overrides are per-install and display-only, so recipes stay portable.
- **Live strike-water temperature in the recipe editor.** The mash schedule
  now shows the temperature to heat the strike water to so the mash-in lands on
  the first step's target — computed with Palmer's formula (step target + grain
  temp + thickness) and updated live as you change the target or the water
  volume, with an **Apply** button to write it into the step's infusion temp.
  It's the same calc the brew session uses, so the editor and brew day agree.
  Previously the infusion temperature was a static manual field and the
  computed strike temp only appeared once brewing started (forum feedback).

## [0.5.0] — 2026-06-09

Second feedback-driven release. A third batch of forum testers (Eric974,
Stanovitch, and a returning Arwen) pushed on editor ergonomics, ingredient
search, and water chemistry; their notes were triaged into issues
[#31–#38](https://github.com/werb-dev/werb/issues) plus a reopened
[#7](https://github.com/werb-dev/werb/issues/7) and worked through together.

Headline: the recipe editor gains BeerSmith-style retargeting (scale to a
volume, solve to an OG or IBU, ±  steppers), every recipe now shows grain-bill
percentages and a BU:GU balance gauge, and water chemistry can finally work
**backwards** — pick a target profile and let Werb suggest the salts.

### Added

- **BU:GU gauge + grain-bill percentages.** Every fermentable row shows its
  share of the bill by mass (read view + editor); the targets strip gains a
  sixth tile, BU:GU (IBU ÷ gravity units), with a soft in-style range derived
  from the style's IBU and OG ranges. Closes
  [#32](https://github.com/werb-dev/werb/issues/32).
- **Editor retargeting tools.** A toolbar under the live banner: **Scale to…**
  a new batch volume (proportional, opt-in — not a side effect of editing the
  volume field), **Solve to OG…** (scales the whole grain bill), and **Solve
  to IBU…** (scales the hops). Plus ±  steppers on fermentable and hop amounts.
  Closes [#33](https://github.com/werb-dev/werb/issues/33).
- **Water salt suggestion (inverse calc).** Pick a target profile and hit
  **Suggest additions**: a non-negative least-squares solver over the salt→ion
  matrix proposes gypsum / CaCl₂ / Epsom / table salt / baking soda, fills the
  editable salt fields, and the existing forward strip shows how close the
  match lands. Shares the `FRAC` model with the forward calc so the two never
  disagree. Closes [#10](https://github.com/werb-dev/werb/issues/10).
- **Personal per-ingredient prices.** Click any price in the cost panel to set
  what you actually paid (€/kg grain, €/g hop, €/pack yeast). Overrides bypass
  the global inflation coefficient and are flagged "your price"; stored
  per-install, never written into the recipe (BeerJSON stays standard). Seeds
  the future inventory module. Closes
  [#2](https://github.com/werb-dev/werb/issues/2).
- **Unsaved-changes guard.** Leaving the editor — back button, or closing the
  tab/window — now warns when the draft has unsaved edits.
  Closes [#35](https://github.com/werb-dev/werb/issues/35).
- **Out-of-sequence brew-step guard.** Starting a step while earlier ones are
  still pending asks for confirmation (soft — real brew days skip and reorder).
  Closes [#37](https://github.com/werb-dev/werb/issues/37).

### Changed

- **Ingredient picker ordering** ([#7](https://github.com/werb-dev/werb/issues/7),
  reopened from v0.4). An empty query now lists alphabetically instead of in
  catalog order (no more surprise "Pilsner malt" default); a prefix on the
  visible name outranks a prefix on a hidden alias; and when an alias drove the
  match the picker shows it (e.g. "Honey — miel") so the ordering reads sensibly.
- **Category-scoped fermentable search** — setting a row's type to "sugar"
  lists only sugars, etc. Closes
  [#34](https://github.com/werb-dev/werb/issues/34).
- **Richer bundled examples + refreshed README screenshots.** Added a flagship
  "West Coast IPA" sample that exercises most of the app end-to-end (stepped
  mash, full boil + dry-hop schedule, salt + fining miscellaneous additions, a
  sugar adjunct, and the complete BJCP envelope) and an "Oatmeal Stout" for
  dark-colour contrast; backfilled full BJCP style ranges onto the existing
  four so every sample now renders the in-style gauges. Regenerated the README
  screenshots against the flagship so they show BU:GU, the in-style gauges, and
  grain-bill percentages. A new test asserts every bundled example is valid
  BeerJSON (the app silently skips invalid samples, so this guards the "Import
  samples" path).

### Fixed

- **Style-fit gauges agree between the recipe view and the editor banner.**
  Both judge fit on the *computed* recipe (grain bill + hops), so the level
  bars sit at the same spot whether you're viewing or editing. The read view
  used to feed the gauge the file's *claimed* OG/FG/IBU/etc. while the editor
  used the live compute, so the needles jumped when you toggled edit mode. The
  big numbers still show the claimed values with the ≈computed sanity line +
  divergence warning; only the fit gauge follows the computed reality.
  Regression-guarded by an e2e that asserts the gauges are identical across
  both screens.
- **macOS "Werb is damaged" on Apple Silicon**
  ([#31](https://github.com/werb-dev/werb/issues/31)). Documented the
  quarantine workaround (`xattr` / right-click → Open) and the no-install PWA
  in the README and release notes. Proper Developer ID signing + notarization
  is tracked for a future release.

### Deferred

- Inline-editable recipe view ([#36](https://github.com/werb-dev/werb/issues/36))
  — kept the v0.4 view/edit split + the new unsaved guard; full inline editing
  is its own design effort.
- Recipe layout density ([#38](https://github.com/werb-dev/werb/issues/38)) —
  awaiting reproduction details (device / resolution) from the reporter.

## [0.4.0] — 2026-05-26

Feedback-driven release. Two batches of forum tester feedback (issues
[#1–#19](https://github.com/werb-dev/werb/issues?q=is%3Aissue+milestone%3Av0.4.0))
got triaged into the [ROADMAP](docs/ROADMAP.md) and worked through in
order. Twelve issues closed; Phases 1, 2, and 3 of the roadmap are done.

Headline: the recipe editor is no longer a write-only screen. Targets
update live, hopstand finally bitters something sensible, sub-boil
hops have a real kinetic model behind them, and ingredient pickers
work in French.

### Added

- **Live targets banner in the recipe editor.** Sticky strip at the
  top of edit mode showing OG / FG / IBU / ABV / Color, recomputed on
  every draft change. Shares the calc engine + unit formatters with
  the read-only Recipe screen so the numbers don't drift across
  views. Tester confirmation that direction A (banner) is enough was
  what closed [#6](https://github.com/werb-dev/werb/issues/6) — the
  bigger "merge edit + view into one screen" rework stays open in
  case the banner doesn't go far enough.
- **Whirlpool / hopstand hop additions.** `add_to_whirlpool` joins
  the hop USE picker (a Werb extension of BeerJSON's enum). Picking
  it surfaces a °C input next to the time field, defaulting to 80 °C.
  The IBU calc routes sub-boil additions to a **Malowicki kinetic
  path** — two-step Arrhenius with the published constants
  (`k1 = 7.9·10¹¹ · exp(-11858/T_K)`,
  `k2 = 4.1·10¹² · exp(-12994/T_K)`), scaled to finished-beer yield
  by a single calibration constant anchored on Tinseth at 100 °C ×
  60 min. Closes [#16](https://github.com/werb-dev/werb/issues/16);
  the full SMPH model (oAAs + pH + clarity + krausen + age + …) is
  tracked under [#27](https://github.com/werb-dev/werb/issues/27)
  with a hard prerequisite: upstream the new fields to BeerJSON
  first.
- **Mash thickness ratio on equipment profiles.** New
  `mash_tun.mash_thickness_l_per_kg` field with a 3 L/kg default —
  the brewer's per-rig default when a recipe doesn't carry its own
  mash schedule. Recipe-level mash-step amounts still win. Closes
  [#15](https://github.com/werb-dev/werb/issues/15).
- **French aliases on ingredient picker.** Each catalog entry gains
  an optional `aliases: string[]` field the search treats as
  primary — prefix-on-alias beats contains-on-name. Populated FR
  aliases for the grain types tester feedback called out (blé,
  avoine, orge, seigle, maïs, riz, miel) plus brewing salts
  (gypse, chlorure de calcium, bicarbonate), spices (coriandre,
  cannelle, vanille), and oak (chêne). Canonical names stay
  verbatim per SPEC §i18n. Closes
  [#14](https://github.com/werb-dev/werb/issues/14).
- **Discoverability sweep.** Three "feature exists, brewer can't
  find it" affordance tweaks (closes
  [#13](https://github.com/werb-dev/werb/issues/13),
  [#17](https://github.com/werb-dev/werb/issues/17),
  [#18](https://github.com/werb-dev/werb/issues/18)):
  - Completing a brew session now offers a **View in Journal →**
    CTA where the quiet "session completed" label used to sit.
  - Library onboarding gains a 4th step: *"Your recipes stay local.
    Open Settings → Sync to push them to a private GitHub repo if
    you want them across devices — your token never leaves the
    browser."*
  - Recipe screen's Export button now reads
    **"Export · BeerJSON · BeerXML · HTML ▾"** on desktop widths,
    with a `title=` tooltip on every width.
- **Behavioral e2e smoke suite.** New
  `apps/desktop/test/e2e/smoke.spec.ts` (19 cases, Playwright +
  Chromium against `vite preview`) layered on top of the existing
  screenshot capture step. Catches the bug class unit tests can't
  reach — stale-closure persistence, cross-section state coupling,
  message-text gating. The `Section` + `Tile` shared components
  gained an opt-in `testId` prop; key screens were sprinkled with
  `data-testid` attributes so smokes don't drown in selector noise.
  CI uploads the Playwright HTML report as an artifact on failure.

### Changed

- **BIAB mash mode persists across navigation, and Quick start
  layouts auto-set it.** The Equipment editor's `<select>` was
  reading stale closure state — flipping to BIAB silently reverted
  on the next render. `update()` now supports immediate-commit for
  onChange handlers that don't get a follow-up `onBlur`. Picking
  BIAB in the Quick start wizard also auto-flips `mash_mode = biab`
  (symmetric for the three / two-vessel buttons). Closes
  [#4](https://github.com/werb-dev/werb/issues/4) +
  [#5](https://github.com/werb-dev/werb/issues/5). Equipment
  editor's HLT and mash-tun sections also **hide when
  `mash_mode === "biab"`** — closes
  [#3](https://github.com/werb-dev/werb/issues/3).
- **Editor ingredient pickers no longer cap at 10 results, no
  longer surface contains-matches above name prefixes, no longer
  get clipped on small screens.** Score function rewritten into
  three explicit tiers (name prefix > name contains > secondary
  fields like producer / origin); cap removed (the dropdown is
  already scrollable); popup portals to `document.body` with fixed
  positioning so ancestor `overflow-hidden` can't clip it. Closes
  [#7](https://github.com/werb-dev/werb/issues/7).
- **Yeast-pitch placeholder names the real missing input.** When
  the section can't compute a pitch rate, it now reads "Can't
  compute pitch rate yet — add fermentables to the recipe" (or
  batch size, or both) instead of pointing at a phantom OG field.
  Section also derives OG from the grain bill when the recipe
  doesn't carry one, so the placeholder fires far less often.
  Closes [#8](https://github.com/werb-dev/werb/issues/8).
- **Water-chemistry city targets pull from the source-water
  catalog.** Burton-source vs. Burton-target used to disagree by
  hand-rolled ppm — picking the same name on both sides now reports
  a true match for every bundled preset. Closes
  [#11](https://github.com/werb-dev/werb/issues/11).

### Fixed

- **i18n leaks in the brew session + recipe enums.** Step titles,
  mash step type, recipe type, and BeerJSON enum values
  (fermentable / hop / culture / misc / form / type) were rendering
  English under the French locale. Now translated end-to-end.

### Internal

- New `docs/ROADMAP.md` capturing the implementation sequence for
  the v0.3-feedback issues — refreshed twice during the cycle as
  the picture clarified.
- `happy-dom` bumped to ^20. Earlier versions collided with Node
  22+'s experimental built-in `localStorage` and broke the test
  environment.
- README quick-start now spells out the `rustup` + `wasm32-unknown
  -unknown` + `wasm-pack` chain — Homebrew's `rust` formula omits
  the WASM target and a fresh clone was failing on
  `pnpm -F @werb/desktop build:wasm` without the missing setup.
- Two BeerJSON extensions (Werb-internal): `timing.use` accepts
  `"add_to_whirlpool"`, and `timing.temperature` carries the
  hopstand setpoint. Round-trip behaviour is documented in
  [packages/adapters/src/beerjson.ts](packages/adapters/src/beerjson.ts).
  Issue [#27](https://github.com/werb-dev/werb/issues/27) tracks
  upstreaming these (and the rest of the SMPH inputs) to the
  BeerJSON spec.

## [0.3.0] — 2026-05-18

Brewing-math + brew-day polish, plus a focused refactor pass that
broke the two biggest screens into readable per-section files.
This is the release where Werb starts feeling complete for the
recipe → brew → tasting loop a homebrewer actually runs.

### Added

- **FG estimation from yeast attenuation.** `computeFg(og, atten)`
  in `@werb/calc` plus a recipe-level `recipeApparentAttenuationPct`
  helper. ABV now cascades through claimed → computed values, so a
  bare BeerXML import without an explicit `final_gravity` field
  shows a real number instead of "—".
- **Alternative IBU and color methods.** Rager IBU (hyperbolic-
  tangent utilisation with a gravity-adjustment divisor) and
  Daniels color (linear fit for amber-and-darker beers). Switchable
  in Settings → Units; both fall back to the prior defaults
  (Tinseth / Morey) when not picked.
- **Yeast starter sizing.** `computeYeastStarter` using Kai
  Troester's Braukaiser stir-plate regression, scaled down for
  shake / no-aeration setups. Renders under the yeast-pitch
  verdict on the Recipe screen when the brewer is under-pitched —
  starter volume, DME mass at 100 g/L, predicted final cell count,
  and a `needs_step_up` flag when a single 4 L step can't bridge
  the gap.
- **BIAB mash mode.** New `mash_mode: "classic" | "biab"` on the
  equipment schema, new `biab` boolean on the water-calc input.
  In BIAB mode the water calc collapses mash + sparge into a single
  full-volume kettle mash, the brew session plan omits the sparge
  step, and the Recipe water section gets a "BIAB equipment" hint
  subtitle. Toggle lives in the Equipment editor.
- **Source-water profile presets.** Nine canonical brewing-city
  profiles (Pilsen, Munich, Dortmund, Vienna, Burton, London,
  Edinburgh, Dublin, RO) bundled in the catalog. Picker above the
  ppm fields in Recipe → Water chemistry fills the six ions when
  selected; "Custom" tag appears after manual tweaks.
- **Next-hop callout in the active boil step.** "Add now / in X
  min" banner above the per-hop checklist. Highlights more
  prominently when the addition becomes due.
- **Recipe metric BJCP-range coloring.** Each OG / FG / IBU / ABV /
  Color tile now shows the actual BJCP range (e.g. `1.046–1.054`)
  and colours the recipe value green / orange / red by fit (in
  range / within 10 % of bounds / further out). Replaces the old
  text-only "In range" line and tooltip-only range.
- **Settings build-stamp footer.** Vite injects `__APP_VERSION__` /
  `__APP_COMMIT__` / `__APP_BUILD_DATE__` at build time and the
  Settings screen renders them as a centered footer. Local builds
  with uncommitted changes get a `-dirty` suffix so a tester's
  AppImage is visibly distinct from a CI release.

### Changed

- **Recipe screen falls back to the computed value as the main tile
  number when the file omits the claim.** OG / FG / IBU / ABV /
  Color all use the same rule: claimed in the main slot when
  present, otherwise the computed estimate. The "≈x" subtitle only
  appears when both differ — no more "—" hiding the real answer.
- **Dry-hop time canonicalised on import + display.** BeerXML
  stores hop times in minutes; a 3-day dry hop landed as
  `4320 min`. The importer now writes days for dry-hop /
  packaging additions, and the editor enforces the canonical unit
  on display so legacy files still render correctly.
- **Yeast amount is grams everywhere.** Importer always emits
  `MassType` in grams (BeerXML kg ×1000 ≈ slurry density 1
  approximation); editor reads any historical Volume/UnitCount
  back as grams. Joliebulle path divides by 1000 first so its
  source-side grams round-trip without inflation.
- **Combobox auto-opens on row-add.** New ingredient rows
  (fermentable / hop / culture / misc) start with an empty name
  and the picker is auto-focused so the brewer goes straight to
  catalog selection instead of dismissing a meaningless "New hop"
  placeholder.
- **Number inputs right-align.** The numbers now butt against
  their unit labels — easier to scan a column of figures.

### Fixed

- **Division-by-zero in calc when `batch_size_l ≤ 0`.** The Ajv
  schema rejects 0 at load/save time, but the editor lets a brewer
  type it directly in the field and renders the screen
  immediately. `computeGravity` / `computeColor` / `computeIbu`
  now return neutral values (OG 1.000, SRM 0, IBU 0) instead of
  letting `Infinity` / `NaN` propagate through BJCP coloring, tile
  formatting, and the cost calc.
- **Hops section subtitle on the Recipe screen** was hardcoded
  English; now properly translated.

### Internal — quality + maintainability

- Extracted `useIngredientRows<T>` from RecipeEditor, replacing
  four near-identical state blocks across the Fermentables / Hops
  / Cultures / Miscs sections.
- Lifted RecipeEditor's inline form primitives (~400 lines —
  `InlineNumber`, `InlineSelect`, `Combobox`, unit-aware mass /
  volume / temperature / color inputs, number-typing helpers) to
  `components/editor/Fields.tsx`.
- Split `Recipe.tsx` (1984 → 674 lines) into `screens/Recipe/`:
  `Section`, `Tile`, `CarbFields`, `YeastPitchSection`,
  `WaterChemistrySection`, `CarbonationSection`, `CostSection`,
  `TastingCard`. RecipeScreen is now an orchestrator.
- Split `Brew.tsx` (1557 → 878 lines) into `screens/Brew/`:
  `Section`, `HopSchedule`, `MeasurementsSection`, `TastingSection`,
  and `format.ts` (`formatDuration` / `formatTimeOfDay`).
- Added Settings to the CI screenshot smoke walk so the build-
  footer can't silently break.
- New test coverage: round-trip value assertions for OG / FG / IBU
  / color / ABV / style; equipment-profile → `computeWater`
  integration covering override flow, BIAB mode, transfer-loss
  propagation; water-profile catalog round-trip + sanity. 290
  desktop tests, 92 calc tests, 59 adapter tests, 38 Rust tests.
- README / install.md / docs/src/beerjson.md caught up with what
  actually shipped (alternative IBU/color methods, yeast starter,
  test count, Intel-Mac policy, named upstream PR contributions).

## [0.2.0] — 2026-05-12

Language + theme pass. The app now ships English and French end-to-end,
defaulting to the browser locale. A warm-cream light variant joins the
signature Cassis dark — meant for outdoor brewing on sunny days where
the dark wash gets unreadable. Both pickers live in Settings → Units,
both default to Auto (browser locale / OS color-scheme preference).

### Added

- **Internationalisation.** French translation of every screen — Library
  (cards, sorts, onboarding, profile badge), Recipe (BJCP range badges,
  Adapt-to-my-rig flow with confirm dialog, export menu, water
  chemistry, carbonation, yeast pitch, cost), Brew (step kinds,
  fit-check banners, measurements form, tasting), Journal (status
  badges, row stats with proper pluralisation, export menu),
  Equipment (profile editor, four vessel sections, quick-start
  wizard), Settings (every option label, data card flow, GitHub
  Connect form), and the full Recipe editor (every column, every
  enum, every form field). Lightweight DIY i18n: flat key → en/fr
  dict, `t(key, vars?)` translator with `{var}` interpolation and a
  `{s}` plural helper. EN-only keys ship and fall back gracefully so
  the French side can catch up without breaking the app.
- **Locale-aware dates.** `useBcp47()` hook + `bcp47(locale)` helper.
  Every `toLocaleString` / `toLocaleDateString` / `toLocaleTimeString`
  in the brew, journal and tasting screens now passes the user's
  language tag rather than relying on the OS default.
- **Structured errors.** Pure data modules throw / return
  `WerbError(code, params)` instances; the UI catches and translates
  via `translateError(err, t)`. Covers every user-visible error
  path: BeerJSON / BeerXML import, recipe-export download / write
  failures, and every GitHub sync error (invalid token, repo not
  found, unreachable API, read-only token, HTTP failures inside the
  backend).
- **Light theme.** Warm-cream base (#faf6f0) with Cassis dark used
  as ink; saturated accents deepened to clear AA contrast (orange
  #ff5c34 → #e84a1f, success/info/data/warning/danger remapped).
  Auto follows `prefers-color-scheme`; manual Dark / Light overrides
  via `data-theme` on `<html>`. Tailwind utilities resolve the new
  `--color-*` values at runtime so every existing class flips with
  no rewrites. `color-scheme` and the `theme-color` meta tag follow
  the theme so native scrollbars / carets / mobile address bar
  match.

### Changed

- **Yeast pitch defaults.** Dry-pack cell count raised from 115 B
  to 200 B per 11.5 g sachet to match Fermentis' own fresh
  production numbers and the Brewer's Friend / BeerSmith /
  Brulosophy consensus (15–20 B viable cells per gram). The old
  figure was Fermentis' minimum *guarantee* and under-reported by
  ~2× — flagging a correct 2-sachet pitch for a 50 L 1.050 ale as
  severely under-pitched.
- **Recipe-editor decimal display.** `InlineNumber` and `NumberField`
  moved from `type="number"` (browsers strip trailing zeros and use
  OS locale) to a focus-aware controlled text buffer with
  `inputmode="decimal"`. Trailing zeros now preserved so an 8.30 kg
  fermentable doesn't render as "8,3" next to a neighbour's "1,76";
  both `.` and `,` accepted as the decimal separator. Settings →
  Cost adjustment adopts the same pattern.
- **Skipped-import notice.** `skippedMessage(string)` →
  `skippedSummary({count, names})`. The UI formats with `t()` so the
  "duplicates skipped" notice localises.

### Fixed

- **Dry-hop time unit.** The hop-time field was hardcoded to `min`
  regardless of the addition's use, so a dry hop carried in
  BeerJSON as `{value: 3, unit: "day"}` rendered as "3 min". Time
  now follows the data's unit and switches between min and day when
  the use selector flips between boil/mash and dry hop/package,
  with a sensible default value.

### Pipelines

- Dropped macOS Intel from the release matrix permanently. The
  `macos-13` runner pool is too queue-starved to reliably finish;
  Apple Silicon + Windows + Linux ship as before.

## [0.1.0] — 2026-05-12

First public alpha — the brewing lifecycle is end-to-end, the math is
well-tested, the UI works tablet-first and phone-usable. Web build ships
as an installable PWA, desktop builds via Tauri for macOS / Windows /
Linux.

### Added

#### Calculation engine
- IBU (Tinseth + Rager), color (Morey), ABV, gravity (efficiency,
  target OG/FG), water budget (mash + sparge + boil-off + losses),
  scale-to-equipment, mash strike temperature, carbonation (priming
  + force), yeast pitch rate, brewing-salt additions to a target
  water profile, equipment-sizing wizard from a target batch + setup
  type (3-vessel / 2-vessel / BIAB).
- Every tool is contract-first: JSON Schema → TS types → pure
  function → unit tests.

#### Library and recipes
- BeerJSON 2.x read + write, round-trip clean.
- BeerXML 1.0 read via a bundled Rust crate compiled to WebAssembly
  for the browser (single code path across web + desktop).
- "+ New recipe" creates a blank shell seeded from the active
  equipment profile (or prompts the brewer to set one up first).
- In-app recipe editor with autocomplete typeaheads (BJCP 2021 style
  picker, ingredient catalogs for fermentables / hops / yeasts /
  miscs) and mash-schedule editing.
- Numeric inputs in the editor honor the brewer's unit preferences
  (kg/lb, L/gal, °C/°F, SRM/EBC) — type values in your native units,
  storage stays canonical.

#### Brew mode
- Live timeline with per-step countdowns and start/done buttons.
- Per-context info inside the active step: strike water + thickness
  on mash-in, hop schedule with per-addition "mark added" toggles
  during the boil, yeast pitch reminder, etc.
- Measurement logging (gravity, pH, temperature, volume, ABV) with
  auto-attach to the active step.
- Screen wake-lock so the display stays on through the brew day.
- HLT and kettle fit checks warn before the boil-over.
- Multi-brew history per recipe: each session keyed by its own id,
  so a recipe accumulates a brewing log.

#### Journal and tasting
- Brew log view of every session, newest first, with per-row export
  (printable HTML / PDF, JSON).
- Post-brew sensory tasting form on completed sessions: 7-axis radar
  chart (bitterness, sweetness, sourness, hop character, malt
  character, body, carbonation), 1–5 star rating, free-form notes,
  lessons-learned tags. The most recent tasting surfaces on the
  recipe screen so future brews see what to adjust.

#### Cost estimator
- Per-batch cost from a bundled default-price table (EU-anchored
  homebrew supplier averages dispatched by ingredient category +
  name patterns). One global inflation coefficient in Settings to
  match local markets. Batch total, per-liter, per-330 mL bottle.

#### Equipment
- Per-profile vessels (HLT / mash tun / kettle / fermenter) with
  capacities, dead spaces, evaporation rate, post-boil shrinkage,
  grain absorption, transfer loss.
- Quick-start wizard sizes every field from a target batch + setup
  type; live preview of derived grain bill, mash water, sparge,
  pre-boil before applying.

#### Storage and sync
- `StorageBackend` port with three implementations: localStorage
  fallback, OPFS (browser default — survives reloads, no quota
  cap), and GitHub Contents API (opt-in cloud sync).
- Migration on boot copies any pre-OPFS keys forward without
  user action.
- Push / Pull buttons in Settings copy every `werb.*` key in either
  direction; the PAT lives outside the synced namespace so it never
  ends up in the synced repo.
- Backup / Restore / Clear with JSON snapshots in Settings → Data.

#### Preferences
- Unit pickers in Settings: temperature (°C/°F), volume (L/gal),
  mass (kg/lb), gravity (SG/Plato), color (SRM/EBC), currency
  (€/$/£), cost adjustment coefficient.

#### App shell
- Code-split bundle: lazy editor + equipment screens, dev-only
  tokens showcase fully tree-shaken from production builds.
- ErrorBoundary at the App root with Try again / Reload recovery.
- 3-step onboarding on the empty Library state.
- Data & privacy footer in Settings establishing the local-first
  contract.
- Responsive design — tablet-perfect at 768–1024 px, usable at
  360 px. Touch targets sized for mobile.
- PWA manifest + service worker (installable, offline-capable).

### Tested
- 381 tests passing across `calc` / `adapters` / `validate` /
  `desktop`: pure-function calc coverage, BeerJSON / BeerXML
  round-trip, hook behavior under React StrictMode double-mount,
  cross-runtime file-picker cancellation (modern browsers, pre-2023
  Safari, iPadOS 15 Safari, iPadOS standalone PWA).
- Tested manually against an iPad Air 2 (iOS 15.8.4) for the PWA
  install + file-picker path.

### Pipelines
- GitHub Actions CI on every push and PR: lint + typecheck + tests
  + build.
- Web build auto-deploys to GitHub Pages on every push to `main`.
- Tag-driven desktop release pipeline: push a `v*` tag and the
  workflow builds macOS Intel + Apple Silicon, Windows, and Linux
  artifacts and attaches them to a draft GitHub Release.

[Unreleased]: https://github.com/werb-dev/werb/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/werb-dev/werb/releases/tag/v0.2.0
[0.1.0]: https://github.com/werb-dev/werb/releases/tag/v0.1.0
