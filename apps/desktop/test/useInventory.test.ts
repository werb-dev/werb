import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInventory } from "../src/hooks/useInventory.ts";
import { INVENTORY_STORAGE_KEY } from "../src/data/inventory.ts";
import { makeStorageWrapper } from "./helpers.tsx";

describe("useInventory", () => {
  it("starts empty", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useInventory(), { wrapper });
    expect(result.current.items).toEqual([]);
  });

  it("creates, updates, and removes items, persisting each change", () => {
    const { wrapper, backend } = makeStorageWrapper();
    const { result } = renderHook(() => useInventory(), { wrapper });

    let id = "";
    act(() => {
      id = result.current.create({ category: "hop", name: "Cascade", alpha_acid_pct: 6 }).id;
    });
    expect(result.current.items).toHaveLength(1);

    act(() => {
      result.current.update(id, { alpha_acid_pct: 7.4 });
    });
    expect(result.current.items[0].alpha_acid_pct).toBe(7.4);

    // Persisted to the backend.
    const persisted = JSON.parse(backend.readSync!(INVENTORY_STORAGE_KEY)!);
    expect(persisted.items[0].alpha_acid_pct).toBe(7.4);

    act(() => {
      result.current.remove(id);
    });
    expect(result.current.items).toEqual([]);
  });

  it("hydrates from pre-populated storage", () => {
    const { wrapper } = makeStorageWrapper({
      [INVENTORY_STORAGE_KEY]: JSON.stringify({
        items: [{ id: "x", category: "fermentable", name: "Maris Otter", color_ebc: 6 }],
      }),
    });
    const { result } = renderHook(() => useInventory(), { wrapper });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].name).toBe("Maris Otter");
  });
});
