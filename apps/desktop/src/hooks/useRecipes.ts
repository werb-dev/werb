import { useCallback, useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import {
  BUNDLED_RECIPES,
  loadRecipesFromDirectory,
  pickWorkingDirectory,
  type LoadedRecipe,
} from "../data/recipes.ts";

const STORAGE_KEY = "werb.workingDirectory";

export type RecipeSource =
  | { type: "bundled" }
  | { type: "disk"; path: string };

interface RecipesState {
  recipes: LoadedRecipe[];
  source: RecipeSource;
  loading: boolean;
  error: string | null;
  skipped: { path: string; reason: string }[];
}

const INITIAL: RecipesState = {
  recipes: BUNDLED_RECIPES,
  source: { type: "bundled" },
  loading: false,
  error: null,
  skipped: [],
};

export function useRecipes() {
  const [state, setState] = useState<RecipesState>(INITIAL);

  const loadFromDisk = useCallback(async (path: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { recipes, skipped } = await loadRecipesFromDirectory(path);
      setState({
        recipes,
        source: { type: "disk", path },
        loading: false,
        error: null,
        skipped,
      });
    } catch (err) {
      setState({
        ...INITIAL,
        error: `Failed to load from ${path}: ${(err as Error).message}`,
      });
      // Don't clobber localStorage — user might fix permissions and reload.
    }
  }, []);

  const pickFolder = useCallback(async () => {
    if (!isTauri()) {
      setState((s) => ({
        ...s,
        error: "Folder picking requires the desktop app (run pnpm tauri:dev).",
      }));
      return;
    }
    const path = await pickWorkingDirectory();
    if (!path) return; // User cancelled.
    localStorage.setItem(STORAGE_KEY, path);
    await loadFromDisk(path);
  }, [loadFromDisk]);

  const useBundled = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState(INITIAL);
  }, []);

  const refresh = useCallback(async () => {
    if (state.source.type === "disk") {
      await loadFromDisk(state.source.path);
    }
  }, [state.source, loadFromDisk]);

  // On mount: rehydrate from localStorage if a directory was previously picked.
  useEffect(() => {
    if (!isTauri()) return;
    const persisted = localStorage.getItem(STORAGE_KEY);
    if (persisted) {
      void loadFromDisk(persisted);
    }
  }, [loadFromDisk]);

  return {
    recipes: state.recipes,
    source: state.source,
    loading: state.loading,
    error: state.error,
    skipped: state.skipped,
    pickFolder,
    useBundled,
    refresh,
  };
}
