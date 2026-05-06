import { useCallback, useState } from "react";
import type { BeerJsonRecipe } from "@werb/adapters";
import {
  generateId,
  loadStore,
  saveStore,
  type StoredRecipe,
} from "../data/recipes.ts";

/**
 * Recipe state. Mirrors localStorage; every mutation persists.
 * Returned API: list of recipes plus CRUD actions. Imports (bundled samples,
 * .beerjson files, BeerXML) all go through `create`.
 */
export function useRecipes() {
  const [store, setStore] = useState(() => loadStore());

  const persist = useCallback((next: typeof store) => {
    saveStore(next);
    setStore(next);
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
      persist({ recipes: [...store.recipes, fresh] });
      return fresh;
    },
    [store, persist],
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
      persist({ recipes: [...store.recipes, ...fresh] });
      return fresh;
    },
    [store, persist],
  );

  const update = useCallback(
    (id: string, recipe: BeerJsonRecipe) => {
      const now = new Date().toISOString();
      persist({
        recipes: store.recipes.map((r) =>
          r.id === id ? { ...r, recipe, updatedAt: now } : r,
        ),
      });
    },
    [store, persist],
  );

  const remove = useCallback(
    (id: string) => {
      persist({ recipes: store.recipes.filter((r) => r.id !== id) });
    },
    [store, persist],
  );

  return {
    recipes: store.recipes,
    create,
    createMany,
    update,
    remove,
  };
}
