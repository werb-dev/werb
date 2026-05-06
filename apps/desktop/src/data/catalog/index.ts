/**
 * Bundled ingredient catalog. Plain typed arrays — no I/O, no fetch.
 * The recipe editor's typeahead consumes these via {@link searchCatalog}
 * to surface matching entries as the brewer types.
 */

import { FERMENTABLES } from "./fermentables.ts";
import { HOPS } from "./hops.ts";
import { CULTURES } from "./cultures.ts";
import { MISCS } from "./miscs.ts";
import type {
  FermentableEntry,
  HopEntry,
  CultureEntry,
  MiscEntry,
} from "./types.ts";

export { FERMENTABLES, HOPS, CULTURES, MISCS };
export type {
  FermentableEntry,
  HopEntry,
  CultureEntry,
  MiscEntry,
} from "./types.ts";

/**
 * Case-insensitive substring search with light scoring: a prefix match
 * (e.g. "casc" → "Cascade") ranks above an internal match (e.g. "casc"
 * → "Mt Cascadia"). Producer / origin / product_id are also indexed so
 * "fermentis" or "1056" finds the right item.
 */
function score(query: string, ...haystacks: (string | undefined)[]): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  let best = -1;
  for (const h of haystacks) {
    if (!h) continue;
    const idx = h.toLowerCase().indexOf(q);
    if (idx < 0) continue;
    const s = idx === 0 ? 100 - h.length : 50 - idx;
    if (s > best) best = s;
  }
  return best;
}

const MAX_SUGGESTIONS = 10;

export function searchFermentables(query: string): FermentableEntry[] {
  return rank(FERMENTABLES, (e) => score(query, e.name, e.producer));
}

export function searchHops(query: string): HopEntry[] {
  return rank(HOPS, (e) => score(query, e.name, e.origin));
}

export function searchCultures(query: string): CultureEntry[] {
  return rank(CULTURES, (e) => score(query, e.name, e.producer, e.product_id));
}

export function searchMiscs(query: string): MiscEntry[] {
  return rank(MISCS, (e) => score(query, e.name, e.type));
}

function rank<T>(items: readonly T[], scoreFn: (item: T) => number): T[] {
  return items
    .map((item) => ({ item, score: scoreFn(item) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SUGGESTIONS)
    .map(({ item }) => item);
}
