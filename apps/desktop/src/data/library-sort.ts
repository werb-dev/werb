import type { StoredRecipe } from "./recipes.ts";

/**
 * Search + sort applied to the library list. Search matches name /
 * style name / category / author (case-insensitive substring); sort
 * options match the visible select.
 */
export type SortKey = "updated" | "name" | "style";

export function filterAndSort(
  recipes: StoredRecipe[],
  query: string,
  sortKey: SortKey,
): StoredRecipe[] {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? recipes.filter(({ recipe }) => {
        const haystack = [
          recipe.name,
          recipe.style?.name,
          recipe.style?.category,
          recipe.author,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
    : recipes.slice();

  switch (sortKey) {
    case "name":
      return filtered.sort((a, b) => a.recipe.name.localeCompare(b.recipe.name));
    case "style":
      return filtered.sort((a, b) =>
        (a.recipe.style?.name ?? "").localeCompare(b.recipe.style?.name ?? ""),
      );
    case "updated":
    default:
      return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}
