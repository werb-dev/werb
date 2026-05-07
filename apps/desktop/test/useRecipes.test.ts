import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRecipes } from "../src/hooks/useRecipes.ts";
import { RECIPES_STORAGE_KEY } from "../src/data/recipes.ts";
import { makeStorageWrapper } from "./helpers.tsx";
import type { BeerJsonRecipe } from "@werb/adapters";

const RECIPE: BeerJsonRecipe = {
  name: "Test IPA",
  type: "all grain",
  author: "Anonymous",
  batch_size: { value: 20, unit: "l" },
  efficiency: { brewhouse: { value: 75, unit: "%" } },
  ingredients: { fermentable_additions: [] },
};

describe("useRecipes", () => {
  it("starts with an empty list when the backend is empty", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useRecipes(), { wrapper });
    expect(result.current.recipes).toEqual([]);
  });

  it("create adds a recipe with id + timestamps and persists to the backend", async () => {
    const { wrapper, backend } = makeStorageWrapper();
    const { result } = renderHook(() => useRecipes(), { wrapper });

    let created: ReturnType<typeof result.current.create>;
    act(() => {
      created = result.current.create(RECIPE);
    });

    expect(result.current.recipes).toHaveLength(1);
    expect(created!.id).toBeTruthy();
    expect(created!.createdAt).toBeTruthy();
    expect(created!.updatedAt).toBe(created!.createdAt);

    const persisted = JSON.parse((await backend.read(RECIPES_STORAGE_KEY))!);
    expect(persisted.recipes).toHaveLength(1);
    expect(persisted.recipes[0].recipe.name).toBe("Test IPA");
  });

  it("createMany appends every recipe with unique ids", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useRecipes(), { wrapper });

    act(() => {
      result.current.createMany([
        { ...RECIPE, name: "First" },
        { ...RECIPE, name: "Second" },
        { ...RECIPE, name: "Third" },
      ]);
    });

    expect(result.current.recipes).toHaveLength(3);
    const ids = new Set(result.current.recipes.map((r) => r.id));
    expect(ids.size).toBe(3);
  });

  it("update changes the recipe and bumps updatedAt without rewriting createdAt", async () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useRecipes(), { wrapper });

    let firstId = "";
    act(() => {
      const created = result.current.create(RECIPE);
      firstId = created.id;
    });
    const original = result.current.recipes[0]!;

    // Tick the clock so updatedAt is strictly later than createdAt.
    await new Promise((r) => setTimeout(r, 5));

    act(() => {
      result.current.update(firstId, { ...RECIPE, name: "Renamed" });
    });

    const after = result.current.recipes[0]!;
    expect(after.id).toBe(firstId);
    expect(after.recipe.name).toBe("Renamed");
    expect(after.createdAt).toBe(original.createdAt);
    expect(new Date(after.updatedAt).getTime()).toBeGreaterThan(
      new Date(original.updatedAt).getTime(),
    );
  });

  it("update is a no-op when the id doesn't exist", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useRecipes(), { wrapper });

    act(() => {
      result.current.create(RECIPE);
    });
    const before = result.current.recipes;

    act(() => {
      result.current.update("nonexistent-id", { ...RECIPE, name: "ghost" });
    });

    expect(result.current.recipes.map((r) => r.recipe.name)).toEqual(
      before.map((r) => r.recipe.name),
    );
  });

  it("remove drops the matching recipe and persists the change", async () => {
    const { wrapper, backend } = makeStorageWrapper();
    const { result } = renderHook(() => useRecipes(), { wrapper });

    let id = "";
    act(() => {
      result.current.create({ ...RECIPE, name: "Keep" });
      id = result.current.create({ ...RECIPE, name: "Drop" }).id;
    });
    expect(result.current.recipes).toHaveLength(2);

    act(() => {
      result.current.remove(id);
    });

    expect(result.current.recipes).toHaveLength(1);
    expect(result.current.recipes[0]!.recipe.name).toBe("Keep");

    const persisted = JSON.parse((await backend.read(RECIPES_STORAGE_KEY))!);
    expect(persisted.recipes).toHaveLength(1);
  });

  it("rehydrates from the backend on a fresh mount", () => {
    const { wrapper } = makeStorageWrapper();
    const { result: first } = renderHook(() => useRecipes(), { wrapper });
    act(() => {
      first.current.create({ ...RECIPE, name: "Persisted" });
    });

    // Re-render the same hook under the same provider — simulates the
    // user reloading the app with localStorage already populated.
    const { result: second } = renderHook(() => useRecipes(), { wrapper });
    expect(second.current.recipes).toHaveLength(1);
    expect(second.current.recipes[0]!.recipe.name).toBe("Persisted");
  });

  it("falls back to an empty list when the backend holds invalid JSON", () => {
    const { wrapper } = makeStorageWrapper({
      [RECIPES_STORAGE_KEY]: "{not json",
    });
    const { result } = renderHook(() => useRecipes(), { wrapper });
    expect(result.current.recipes).toEqual([]);
  });

  it("recovers when persisted shape is missing the recipes array", () => {
    const { wrapper } = makeStorageWrapper({
      [RECIPES_STORAGE_KEY]: JSON.stringify({ stale: true }),
    });
    const { result } = renderHook(() => useRecipes(), { wrapper });
    expect(result.current.recipes).toEqual([]);
  });
});
