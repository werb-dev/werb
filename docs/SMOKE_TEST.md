# Smoke test — pre-release checklist

Walk through this on a **clean profile** (incognito browser window
for web, fresh app data on desktop) before tagging a release. The
goal is to catch the things that survive automated tests but break
in a first-run flow: empty states, OPFS bootstrap, PWA install,
service-worker update, file-picker quirks.

Allow about 20 minutes end-to-end.

## Setup

- [ ] Open Werb in a browser you don't already have it pinned in
      (incognito works) **or** install the desktop build on a
      machine that hasn't run it before.
- [ ] Open dev tools, keep the Console tab visible — warnings or
      uncaught errors should be loud.

## Onboarding (empty state)

- [ ] Library screen renders the 3-step onboarding card, not a
      blank "No recipes" box.
- [ ] Settings → Data & privacy footer is present and links to the
      repo + LICENSE.
- [ ] Settings → Units shows defaults (°C, L, kg, SG, EBC, EUR,
      100 % cost adjustment).

## First recipe + first brew

- [ ] Library → **Import samples** loads ≥1 bundled recipe.
      Recipe cards render with style + ABV + IBU + color swatch.
- [ ] Open a sample → Recipe screen shows: targets strip, water
      volumes, fermentables, hops, mash schedule, yeast pitch,
      water chemistry, carbonation, cost section, sections.
- [ ] **Edit recipe** → editor opens (loads as a lazy chunk on
      first navigation — short "Loading…" flash is expected).
      Inline ingredient autocomplete opens on focus. Save returns
      to the recipe screen.
- [ ] **Start brewing** → Brew screen appears, wake-lock badge
      visible. Start a step, let the countdown tick, mark done,
      log one measurement.
- [ ] Complete the session → tasting form appears below
      Measurements with the 7-axis radar. Save a tasting with a
      few sliders moved and one tag.
- [ ] Back to the recipe → "Last tasting" card now renders the
      tasting radar above the water section.

## Equipment + new recipe from scratch

- [ ] Equipment → Quick-start wizard expands. Set "3-vessel" + a
      target batch volume + Apply → capacity fields fill, the
      profile saves on blur, set it as active.
- [ ] Back to Library → active profile badge appears under the
      title.
- [ ] **+ New recipe** → since equipment is set, skips the
      prompt and jumps into the editor. New recipe has the
      profile's batch size + efficiency.

## Import / export

- [ ] Library → **Import .beerjson** opens the file picker.
      Cancel without picking → button releases (no stuck
      "Importing…" state).
- [ ] Actually import a sample `.beerjson` file → recipe lands
      in the library. Same for `.beerxml`.
- [ ] Recipe screen → **Export** → JSON / XML / printable HTML
      all produce downloads.
- [ ] Journal → tap the ⋯ on a row → export the session as JSON
      and as HTML, both download cleanly.

## Settings + sync

- [ ] Settings → Cost adjustment field accepts a number, the
      Recipe Cost section updates live (try 110 then 90).
- [ ] Settings → switch Units (°C → °F, kg → lb): every numeric
      display across the app re-renders in the new unit.
- [ ] Settings → Data → **Export backup** downloads a JSON
      snapshot. **Restore from file** with the same file
      succeeds.
- [ ] (Optional) GitHub sync: paste a fine-grained PAT with
      Contents read/write on a private test repo, Connect →
      shows your login + repo. Push, verify files appear in the
      repo. Pull on a fresh profile, recipes re-appear.

## Web build extras (skip on desktop)

- [ ] PWA install prompt fires (or "Add to Home Screen" works on
      iOS). Installed PWA opens to the same state.
- [ ] Reload the installed PWA → all data persists (OPFS
      survives).
- [ ] Toggle airplane mode → app still loads from the service
      worker cache.

## Error recovery

- [ ] Open the Console, run
      `throw new Error("smoke-test fake crash")` from within a
      React handler — easier: visit a non-existent recipe id via
      the dev-only Tokens link first, then sabotage if needed.
      The ErrorBoundary should render its Try-again / Reload UI
      with the error message visible. Try-again recovers; Reload
      reloads.

## Mobile / responsive

- [ ] Dev tools → device toolbar → iPhone 12 / Pixel 5. Library,
      Recipe (scroll all sections), Brew (active step + hop
      schedule), Journal, Settings: every screen is usable.
      Touch targets feel right (no 20 px taps).
- [ ] iPad portrait (768 px): the Brew screen's active step
      timer, hop schedule, and timeline all read well one-
      handed.

## Sign-off

- [ ] No Console errors except the one you triggered.
- [ ] No "Cannot find module" or "Loading chunk failed" surfaced
      anywhere.
- [ ] At least one screenshot from `docs/screenshots/` looks like
      what you actually see on screen.
