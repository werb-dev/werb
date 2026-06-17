import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIngredientRows } from "../src/hooks/useIngredientRows.ts";

// Drives a controlled list: the hook takes the current items + a setter,
// so we re-render with whatever the setter last produced.
function renderRows(initial: string[]) {
  let items = initial;
  const view = renderHook(
    ({ list }) =>
      useIngredientRows<string>(list, (next) => {
        items = next;
      }),
    { initialProps: { list: items } },
  );
  return {
    get items() {
      return items;
    },
    api: () => view.result.current,
    rerender: () => view.rerender({ list: items }),
  };
}

describe("useIngredientRows — moveRow (#42)", () => {
  it("swaps a row with the one below it", () => {
    const h = renderRows(["a", "b", "c"]);
    act(() => h.api().moveRow(0, 1));
    expect(h.items).toEqual(["b", "a", "c"]);
  });

  it("swaps a row with the one above it", () => {
    const h = renderRows(["a", "b", "c"]);
    act(() => h.api().moveRow(2, -1));
    expect(h.items).toEqual(["a", "c", "b"]);
  });

  it("is a no-op moving the first row up", () => {
    const h = renderRows(["a", "b", "c"]);
    act(() => h.api().moveRow(0, -1));
    expect(h.items).toEqual(["a", "b", "c"]);
  });

  it("is a no-op moving the last row down", () => {
    const h = renderRows(["a", "b", "c"]);
    act(() => h.api().moveRow(2, 1));
    expect(h.items).toEqual(["a", "b", "c"]);
  });
});
