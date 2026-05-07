import { useCallback, useEffect, useState } from "react";
import type { BeerJsonRecipe } from "@werb/adapters";
import {
  generateId,
  loadStore,
  loadStoreSync,
  saveStore,
  type StoredRecipe,
} from "../data/recipes.ts";
import { useStorage } from "../storage/index.ts";

interface RecipeStore {
  recipes: StoredRecipe[];
}

/**
 * Recipe state. Mirrors a StorageBackend (localStorage today, cloud in
 * the future); every mutation persists.
 *
 * Mutations are expressed as functional updates — callers can fire
 * several actions in the same React tick (e.g. two `create` calls in a
 * single event handler) without losing any of them to a stale closure.
 *
 * `loading` is true while the initial async load is in flight. Sync-
 * capable backends (localStorage, in-memory) hydrate immediately on the
 * first render and never set `loading` to true.
 */
export function useRecipes() {
  const backend = useStorage();
  const [store, setStore] = useState<RecipeStore>(() => loadStoreSync(backend));
  // Sync backends hydrate via lazy initial state above; only async ones
  // need the loading-flicker treatment.
  const [loading, setLoading] = useState(() => backend.readSync === undefined);

  useEffect(() => {
    if (backend.readSync !== undefined) return;
    let cancelled = false;
    void loadStore(backend).then((loaded) => {
      if (!cancelled) {
        setStore(loaded);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [backend]);

  const persist = useCallback(
    (updater: (prev: RecipeStore) => RecipeStore) => {
      setStore((prev) => {
        const next = updater(prev);
        // Fire-and-forget. localStorage is synchronous under the async
        // facade, so the write completes effectively in this tick. Cloud
        // backends will need a write queue to serialize concurrent saves.
        void saveStore(backend, next);
        return next;
      });
    },
    [backend],
  );

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
    loading,
    create,
    createMany,
    update,
    remove,
  };
}
