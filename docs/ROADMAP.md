# Werb — implementation sequence

Snapshot dated **2026-05-26**, derived from user feedback filed as issues [#1–#19](https://github.com/werb-dev/werb/issues). Ordering is informed by [SPEC.md](../SPEC.md): bugs in *Shipped* features come before new work; *Next — universal brewing polish* roadmap items are sequenced by dependency.

This is a recommendation, not a binding plan. Re-check it whenever a new batch of feedback lands or priorities shift.

## Phase 1 — Bugs in shipped v0.2/v0.3 features

Restore quality on features SPEC already lists as Shipped. Small surface, high credibility.

1. [#5](https://github.com/werb-dev/werb/issues/5) — Mash mode not persisted (BIAB is Shipped; the bug breaks it)
2. [#4](https://github.com/werb-dev/werb/issues/4) — Picking BIAB layout should auto-set `mash_mode = biab` (same file as #5, do together)
3. [#15](https://github.com/werb-dev/werb/issues/15) — Expose grain-to-water ratio (L/kg) — brewer can't tune mash thickness; the calc exists internally but isn't exposed
4. [#11](https://github.com/werb-dev/werb/issues/11) — Burton target=source doesn't report a match (water-salt calc is Shipped; trust bug)
5. [#8](https://github.com/werb-dev/werb/issues/8) — Yeast pitch "set OG" message is misleading (one i18n + condition tweak)
6. [#3](https://github.com/werb-dev/werb/issues/3) — Quick start: hide fields for unused vessels
7. [#19](https://github.com/werb-dev/werb/issues/19) — Import errors on standard files. **Blocked: needs reproducer files from the reporter** before any code work. Action: reply to the forum thread asking for one or two failing samples.

## Phase 2 — Discoverability & UX clarity

Existing features brewers can't find, plus the editor dropdowns that block real flows. No new calc work.

8. [#7](https://github.com/werb-dev/werb/issues/7) — Editor dropdowns (10-item cap, contains-match, mobile clipping)
9. [#14](https://github.com/werb-dev/werb/issues/14) — Search ingredients by French translation (wheat→blé, oat→avoine). Catalog-level alias data + a small picker tweak. Pairs naturally with #7.
10. [#13](https://github.com/werb-dev/werb/issues/13) — Past brew sessions hard to find. **Prereq for [#12](https://github.com/werb-dev/werb/issues/12)** — a per-session brew sheet is pointless if brewers can't locate sessions.
11. [#17](https://github.com/werb-dev/werb/issues/17) — GitHub sync discoverability — brewers ask for "personal space / profile"; the answer (GitHub sync) already exists, surface it.
12. [#18](https://github.com/werb-dev/werb/issues/18) — BeerXML export discoverability — shipped per SPEC, but a technical brewer didn't see it.

## Phase 3 — Editor coherence & expressiveness

Chunkier work on the recipe editor. Do before adding more editor surface in Phase 4.

13. [#6](https://github.com/werb-dev/werb/issues/6) — Show OG/FG/IBU/SRM live in edit mode (or merge edit + view). The second tester explicitly confirmed direction **A** (banner) as the minimum acceptable step.
14. [#16](https://github.com/werb-dev/werb/issues/16) — Support hopstand / whirlpool as a hop addition technique (editor enum + temperature-derated IBU contribution).

## Phase 4 — Roadmap features (SPEC: *Next — universal brewing polish*)

15. [#12](https://github.com/werb-dev/werb/issues/12) — PDF brew sheet. Pure new renderer, no calc dependency; benefits from #13 already done.
16. [#1](https://github.com/werb-dev/werb/issues/1) — Inventory module. The flagship feature for the Penn-Maen class of user.
17. [#2](https://github.com/werb-dev/werb/issues/2) — Per-ingredient personal price override (incl. conventional vs organic). Bolt-on to #1 in the same release.
18. [#9](https://github.com/werb-dev/werb/issues/9) — Source-water profile loading (BeerJSON + moneaudebrassage.fr API). Includes a "set as my home water" save action requested by the second tester.
19. [#10](https://github.com/werb-dev/werb/issues/10) — Salt-suggestion solver. New contract-first calc tool; ship last so #9 has been bedding in real source profiles by then.

## Open judgment calls

- **#12 vs #1/#2 in Phase 4** — listed in #12-first order because it's a pure renderer (lower risk, no schema changes) and SPEC gives both equal weight. Swap them if you'd rather lead with the bigger user-visible feature; Penn-Maen-class brewers will be louder on inventory than Arwen on PDF.
- **#9 before #10** — hard dependency in spirit, not in code. #9 alone removes typing friction; shipping it standalone surfaces feedback on the API integration before committing to the solver UI.
- **#16 (hopstand/whirlpool) in Phase 3 vs Phase 4** — sits in Phase 3 because it's editor surface work. If the IBU-derate calc grows beyond a small Tinseth tweak, it'd reasonably belong in Phase 4 next to #10. Decide once the calc literature check is done.

## Changelog

- **2026-05-26** — added #14, #15, #16, #17, #18, #19 from the second feedback batch. Restructured Phase 2 around discoverability as the dominant pattern (3 of the 5 new issues are existing-feature visibility problems).
- **2026-05-22** — initial snapshot covering #1–#13.
