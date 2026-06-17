import { useState } from "react";

/**
 * State + handlers for a list-of-rows editor section (fermentables,
 * hops, cultures, miscellaneous additions). Each section drives a
 * table that lets the brewer add / edit / remove rows; the only
 * thing that differs between them is the row shape and the persist
 * callback.
 *
 * `pendingFocusIdx` is the index of a row that should auto-focus
 * its picker on mount — set by `addRow` so the brewer can pick the
 * new ingredient from the catalog dropdown immediately.
 *
 * Pure UI helper — the source of truth still lives in the editor's
 * `draft` BeerJsonRecipe; this hook just owns the focus flag and the
 * three update helpers so the four sections stop duplicating them.
 */
export function useIngredientRows<T>(
  items: readonly T[] | undefined,
  setItems: (next: T[]) => void,
) {
  const list: readonly T[] = items ?? [];
  const [pendingFocusIdx, setPendingFocusIdx] = useState<number | null>(null);

  const addRow = (fresh: T) => {
    setPendingFocusIdx(list.length);
    setItems([...list, fresh]);
  };

  const updateRow = (i: number, next: T) => {
    const copy = list.slice();
    copy[i] = next;
    setItems(copy);
  };

  const removeRow = (i: number) => {
    setItems(list.filter((_, j) => j !== i));
  };

  // Swap a row with its neighbour in `dir` (-1 up, +1 down). Lets the brewer
  // reorder additions (e.g. hops by time) without deleting and re-adding.
  // Out-of-range moves (first row up / last row down) are no-ops.
  const moveRow = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const copy = list.slice();
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
    setItems(copy);
  };

  return { items: list, pendingFocusIdx, addRow, updateRow, removeRow, moveRow };
}
