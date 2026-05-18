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

  return { items: list, pendingFocusIdx, addRow, updateRow, removeRow };
}
