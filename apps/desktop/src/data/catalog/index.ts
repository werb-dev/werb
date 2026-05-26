/**
 * Bundled ingredient catalog. Plain typed arrays — no I/O, no fetch.
 * The recipe editor's typeahead consumes these via {@link searchCatalog}
 * to surface matching entries as the brewer types.
 */

import { FERMENTABLES } from "./fermentables.ts";
import { HOPS } from "./hops.ts";
import { CULTURES } from "./cultures.ts";
import { MISCS } from "./miscs.ts";
import { STYLES } from "./styles.ts";
import { SOURCE_WATER_PROFILES } from "./water-profiles.ts";
import type {
  FermentableEntry,
  HopEntry,
  CultureEntry,
  MiscEntry,
  StyleEntry,
} from "./types.ts";

export { FERMENTABLES, HOPS, CULTURES, MISCS, STYLES, SOURCE_WATER_PROFILES };
export type { SourceWaterProfile } from "./water-profiles.ts";
export type {
  FermentableEntry,
  HopEntry,
  CultureEntry,
  MiscEntry,
  StyleEntry,
} from "./types.ts";

/**
 * Tiered case-insensitive search. Filtering is supposed to *narrow*
 * the list as the brewer types, not surface a different 10 because
 * "casc" happens to live inside "Mt Cascadia" or in the producer
 * field of an unrelated yeast. The score function enforces clean
 * tiers so prefix matches on the displayed name always dominate.
 *
 *   Tier A (200+): name starts with the query  →  "casc" → "Cascade"
 *   Tier B (100+): name contains the query elsewhere
 *   Tier C    (1+): a secondary field (producer / origin / product_id
 *                   / type / category) contains the query — kept so
 *                   "fermentis" still finds Fermentis yeasts, but
 *                   ranked below every name-side match.
 *
 *  Within each tier, shorter haystacks score higher so "Cascade"
 *  beats "Cascade Cryo" when both prefix-match.
 */
function scoreTiered(
  query: string,
  name: string,
  ...secondary: (string | undefined)[]
): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const lowName = name.toLowerCase();
  const nameIdx = lowName.indexOf(q);
  if (nameIdx === 0) return 200 + (100 - Math.min(name.length, 100));
  if (nameIdx > 0) return 100 + (100 - Math.min(name.length, 100));
  for (const h of secondary) {
    if (h && h.toLowerCase().includes(q)) {
      return 1 + (100 - Math.min(h.length, 100));
    }
  }
  return -1;
}

export function searchFermentables(query: string): FermentableEntry[] {
  return rank(FERMENTABLES, (e) => scoreTiered(query, e.name, e.producer));
}

export function searchHops(query: string): HopEntry[] {
  return rank(HOPS, (e) => scoreTiered(query, e.name, e.origin));
}

export function searchCultures(query: string): CultureEntry[] {
  return rank(CULTURES, (e) =>
    scoreTiered(query, e.name, e.producer, e.product_id),
  );
}

export function searchMiscs(query: string): MiscEntry[] {
  return rank(MISCS, (e) => scoreTiered(query, e.name, e.type));
}

export function searchStyles(query: string): StyleEntry[] {
  return rank(STYLES, (e) =>
    scoreTiered(
      query,
      e.name,
      e.category,
      `${e.category_number}${e.style_letter}`,
    ),
  );
}

/**
 * No hard cap on results — the dropdown is scrollable. Returning the
 * full ranked list lets the brewer see the count is exhaustive (and
 * scroll past the top-10 if their target is further down).
 */
function rank<T>(items: readonly T[], scoreFn: (item: T) => number): T[] {
  return items
    .map((item) => ({ item, score: scoreFn(item) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}
