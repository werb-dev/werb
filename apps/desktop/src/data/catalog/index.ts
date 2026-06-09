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
 *   Tier A (300+): the displayed `name` starts with the query.
 *   Tier B (200+): a per-locale alias starts with the query
 *                  (e.g. "blé" → Wheat malt). Ranked below name
 *                  prefixes so typing "m" surfaces names that visibly
 *                  start with M before alias-only hits.
 *   Tier C (100+): name or alias contains the query elsewhere.
 *   Tier D    (1+): a secondary field (producer / origin / product_id
 *                   / type / category) contains the query — kept so
 *                   "fermentis" still finds Fermentis yeasts, but
 *                   ranked below every primary-side match.
 *
 *  Within each tier, shorter haystacks score higher so "Cascade"
 *  beats "Cascade Cryo" when both prefix-match.
 */
function scoreTiered(
  query: string,
  primary: { name: string; aliases?: string[] | undefined },
  ...secondary: (string | undefined)[]
): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  let namePrefix = -1;
  let aliasPrefix = -1;
  let contain = -1;
  const consider = (p: string, isName: boolean) => {
    const idx = p.toLowerCase().indexOf(q);
    if (idx < 0) return;
    const lenScore = 100 - Math.min(p.length, 100);
    if (idx === 0) {
      if (isName) namePrefix = Math.max(namePrefix, lenScore);
      else aliasPrefix = Math.max(aliasPrefix, lenScore);
    } else {
      contain = Math.max(contain, lenScore);
    }
  };
  consider(primary.name, true);
  for (const al of primary.aliases ?? []) consider(al, false);
  if (namePrefix >= 0) return 300 + namePrefix;
  if (aliasPrefix >= 0) return 200 + aliasPrefix;
  if (contain >= 0) return 100 + contain;
  for (const h of secondary) {
    if (h && h.toLowerCase().includes(q)) {
      return 1 + (100 - Math.min(h.length, 100));
    }
  }
  return -1;
}

/**
 * The alias (if any) that a query prefix-matched, so the picker can show
 * *why* a result that doesn't visibly start with the query is there
 * (e.g. "Honey — miel" for a "mi" search). Returns null when the name
 * itself matched or nothing matched on an alias.
 */
export function matchedAlias(
  entry: { name: string; aliases?: string[] | undefined },
  query: string,
): string | null {
  const q = query.trim().toLowerCase();
  if (!q || entry.name.toLowerCase().includes(q)) return null;
  return entry.aliases?.find((a) => a.toLowerCase().includes(q)) ?? null;
}

export function searchFermentables(
  query: string,
  category?: string,
): FermentableEntry[] {
  // Scope to the selected fermentable category when one is given, so a
  // row typed as "sugar" lists only sugars (forum request). Empty/no
  // category keeps the full catalog.
  const pool = category
    ? FERMENTABLES.filter((e) => e.type === category)
    : FERMENTABLES;
  if (!query.trim()) return alpha(pool);
  return rank(pool, (e) =>
    scoreTiered(query, { name: e.name, aliases: e.aliases }, e.producer),
  );
}

export function searchHops(query: string): HopEntry[] {
  if (!query.trim()) return alpha(HOPS);
  return rank(HOPS, (e) =>
    scoreTiered(query, { name: e.name, aliases: e.aliases }, e.origin),
  );
}

export function searchCultures(query: string): CultureEntry[] {
  if (!query.trim()) return alpha(CULTURES);
  return rank(CULTURES, (e) =>
    scoreTiered(
      query,
      { name: e.name, aliases: e.aliases },
      e.producer,
      e.product_id,
    ),
  );
}

export function searchMiscs(query: string): MiscEntry[] {
  if (!query.trim()) return alpha(MISCS);
  return rank(MISCS, (e) =>
    scoreTiered(query, { name: e.name, aliases: e.aliases }, e.type),
  );
}

export function searchStyles(query: string): StyleEntry[] {
  if (!query.trim()) return alpha(STYLES);
  return rank(STYLES, (e) =>
    scoreTiered(
      query,
      { name: e.name },
      e.category,
      `${e.category_number}${e.style_letter}`,
    ),
  );
}

/**
 * Empty-query order: alphabetical by displayed name. An unfiltered list
 * should read predictably rather than echo the catalog's internal order
 * (which surprised users by always opening on "Pilsner malt").
 */
function alpha<T extends { name: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
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
