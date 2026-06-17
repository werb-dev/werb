# Werb — implementation sequence

Snapshot dated **2026-06-17**, derived from three feedback batches filed as
issues [#1–#19](https://github.com/werb-dev/werb/issues), #31–#38, and the
latest [#42–#51](https://github.com/werb-dev/werb/issues). Ordering is informed
by [SPEC.md](../SPEC.md): bugs in *Shipped* features come before new work;
*Next — universal brewing polish* roadmap items are sequenced by dependency.

This is a recommendation, not a binding plan. Re-check it whenever a new batch
of feedback lands or priorities shift.

## Done — shipped or in review

The original Phases 1–4 (below, kept for history) are essentially complete:

- **v0.4.0 (2026-05-26)** — Phases 1–3: #3, #4, #5, #6, #7, #8, #11, #13, #14,
  #15, #16, #17, #18.
- **v0.5.0 (2026-06-09)** — #2, #10, #32, #33, #34, #35, #37, the reopened #7,
  and the macOS workaround doc for #31. Plus the live strike-water temperature
  (Stanovitch's "heating temp doesn't update" feedback) in the Unreleased
  section.
- **In review now** —
  [PR #40](https://github.com/werb-dev/werb/pull/40): #9 (source-water profiles
  + moneaudebrassage.fr) and #12 (PDF brew sheet);
  [PR #41](https://github.com/werb-dev/werb/pull/41): #1 (inventory module —
  directly answers Arwen's 2026-06-15 "persistent custom-ingredient library"
  ask).

Remaining open after those merge: #19, #27, #31, #36, #38 and the third batch
#42–#51. Sequenced below as Phases 5–9.

## Phase 5 — Regressions & correctness bugs in shipped features

Do first — these are defects in features SPEC/CHANGELOG already claim as done, so
they're the cheapest credibility wins and mostly small editor changes.

1. [#51](https://github.com/werb-dev/werb/issues/51) — Unsaved-changes (#35) /
   out-of-sequence (#37) guards reported partly missing in 0.5.0. **Verify on
   `main` first** — if the guards still fire it's a misunderstanding to close
   out; if regressed, fix. Highest priority: a shipped feature may be broken.
2. [#50](https://github.com/werb-dev/werb/issues/50) — Ingredient category is
   freely mutable and corrupts the row (malt → honey keeps EBC/yield). Contained
   editor bug; pairs naturally with #51 (same screen).
3. [#45](https://github.com/werb-dev/werb/issues/45) — Yeast nutrients
   (DAP / Fermaid K) default into the boil; should dose at pitching. Catalog
   `default_use` fix (+ optional warn). Correctness, small surface.
4. [#42](https://github.com/werb-dev/werb/issues/42) — Hop additions can't be
   reordered without delete + re-add. Editor usability gap; same track as the
   bugs above.
5. [#7 follow-up](https://github.com/werb-dev/werb/issues/7) — Arwen still sees
   the picker mixing starts-with / contains. Re-check the v0.5.0 tiered ranking
   against her examples; small tweak.

## Phase 6 — Needs reproducer / clarification (unblock by asking)

No code until the reporter supplies detail. Action: reply on the forum thread
requesting it, the way #19 was handled.

6. [#43](https://github.com/werb-dev/werb/issues/43) — Sparge volume off
   (12 → 13.3 L). Needs the recipe + equipment profile.
7. [#44](https://github.com/werb-dev/werb/issues/44) — IBU reads too low. Needs
   one example recipe (hops/alpha/time/OG/batch) to separate calibration from a
   bug. Near-term, cheap counterpart to the #27 SMPH track.
8. [#49](https://github.com/werb-dev/werb/issues/49) — "Preview" missing
   OG/FG/ABV. Needs the reporter to point at the exact screen.
9. [#19](https://github.com/werb-dev/werb/issues/19) — Import errors on standard
   files. **Still blocked** on failing sample files (carried from Phase 1).

## Phase 7 — Equipment & water enhancements

10. [#46](https://github.com/werb-dev/werb/issues/46) — Post-boil / kettle loss
    as an absolute volume (L), not only %. Equipment profile + water-volume calc.
11. [#47](https://github.com/werb-dev/werb/issues/47) — Single-vessel all-in-one
    (Brewzilla / Grainfather) layout, distinct from BIAB. Builds on the BIAB
    work (#4/#5); group with #46 as one equipment pass.

## Phase 8 — Editor & mobile UX (chunkier, do together)

The inline-edit, density, and mobile-friction reports are the same surface seen
from three angles — scope them as one design effort, not three patches.

12. [#36](https://github.com/werb-dev/werb/issues/36) — Make the recipe view
    inline-editable (Arwen reinforced: surface only Save/Cancel). The anchor.
13. [#38](https://github.com/werb-dev/werb/issues/38) — Layout density / one-
    screen overview. Still wants device+resolution detail, but the mobile
    feedback corroborates it.
14. [#48](https://github.com/werb-dev/werb/issues/48) — Mobile entry friction
    (too many step selections). Overlaps #36/#38 directly.

## Phase 9 — SMPH IBU model (own lane, still blocked)

15. [#27](https://github.com/werb-dev/werb/issues/27) — Full SMPH calc engine.
    **Hard-blocked** on the upstream BeerJSON field extensions being accepted;
    does not start until then. #44 is the near-term answer to "IBU too low".

## Platform / packaging

- [#31](https://github.com/werb-dev/werb/issues/31) — macOS unsigned/unnotarized
  ".dmg" → "Werb est endommagé". Workaround documented in v0.5.0; proper
  Developer ID signing + notarization is a later release.

## Open judgment calls

- **#44 vs #27** — answer the concrete "IBU too low" report with a calibration
  check first (cheap, unblocked); SMPH is the long track and still gated on the
  upstream schema.
- **#36 / #38 / #48 as one effort** — recommended; an inline-edit rework is the
  natural moment to also tighten density and the mobile flow, rather than
  reworking the layout three times.
- **#42 (hop reorder)** — small and self-contained; can ship any time it's
  convenient, doesn't need to wait for the Phase 8 editor rework.

## History — original Phases 1–4 (2026-05-26 snapshot)

Kept for provenance. All of Phases 1–3 and most of Phase 4 are now shipped or in
review (see *Done* above).

- **Phase 1 — bugs in shipped v0.2/v0.3 features:** #5, #4, #15, #11, #8, #3, #19.
- **Phase 2 — discoverability & UX clarity:** #7, #14, #13, #17, #18.
- **Phase 3 — editor coherence:** #6, #16.
- **Phase 4 — roadmap features (*Next — universal brewing polish*):** #12, #1,
  #2, #9, #10.

## Changelog

- **2026-06-17** — third feedback batch (#42–#51) triaged in; recorded v0.4.0 /
  v0.5.0 completion and PR #40 / #41 in review; condensed the original Phases 1–4
  into *Done* + *History* and re-sequenced the remaining + new work into
  Phases 5–9 (regressions → needs-repro → equipment → editor/mobile → SMPH).
- **2026-05-26** — added #14, #15, #16, #17, #18, #19 from the second feedback
  batch. Restructured Phase 2 around discoverability as the dominant pattern.
- **2026-05-22** — initial snapshot covering #1–#13.
