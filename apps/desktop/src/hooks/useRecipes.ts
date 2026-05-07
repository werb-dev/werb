import { useCallback, useState } from "react";
import type { BeerJsonRecipe } from "@werb/adapters";
import {
  generateId,
  loadStore,
  saveStore,
  type StoredRecipe,
} from "../data/recipes.ts";

interface RecipeStore {
  recipes: StoredRecipe[];
}

/**
 * Recipe state. Mirrors localStorage; every mutation persists.
 *
 * Mutations are expressed as functional updates — callers can fire several
 * actions in the same React tick (e.g. two `create` calls in a single event
 * handler) without losing any of them to a stale closure on `store`.
 *
 * Returned API: list of recipes plus CRUD actions. Imports (bundled samples,
 * .beerjson files, BeerXML) all go through `create` / `createMany`.
 */
export function useRecipes() {
  const [store, setStore] = useState<RecipeStore>(() => loadStore());

  const persist = useCallback((updater: (prev: RecipeStore) => RecipeStore) => {
    setStore((prev) => {
      const next = updater(prev);
      saveStore(next);
      return next;
    });
  }, []);

  const create = useCallback(
    (recipe: BeerJsonRecipe): StoredRecipe => {
      const now = new Date().toISOString();
      const fresh: StoredRecipe = {
        id: generateId(),
        recipe,
        createdAt: now,
        updatedAt: now,
      };
      persist((prev) => ({ recipes: [...prev.recipes, fresh] }));
      return fresh;
    },
    [persist],
  );

  const createMany = useCallback(
    (recipes: BeerJsonRecipe[]): StoredRecipe[] => {
      const now = new Date().toISOString();
      const fresh = recipes.map<StoredRecipe>((recipe) => ({
        id: generateId(),
        recipe,
        createdAt: now,
        updatedAt: now,
      }));
      persist((prev) => ({ recipes: [...prev.recipes, ...fresh] }));
      return fresh;
    },
    [persist],
  );

  const update = useCallback(
    (id: string, recipe: BeerJsonRecipe) => {
      const now = new Date().toISOString();
      persist((prev) => ({
        recipes: prev.recipes.map((r) =>
          r.id === id ? { ...r, recipe, updatedAt: now } : r,
        ),
      }));
    },
    [persist],
  );

  const remove = useCallback(
    (id: string) => {
      persist((prev) => ({ recipes: prev.recipes.filter((r) => r.id !== id) }));
    },
    [persist],
  );

  return {
    recipes: store.recipes,
    create,
    createMany,
    update,
    remove,
  };
}
