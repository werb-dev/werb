import { useState } from "react";
import type { BeerJsonRecipe } from "@werb/adapters";
import { DesignTokensShowcase } from "./design-tokens-showcase.tsx";
import { LibraryScreen } from "./screens/Library.tsx";
import { RecipeScreen } from "./screens/Recipe.tsx";
import { RecipeEditor } from "./screens/RecipeEditor.tsx";
import { BrewScreen } from "./screens/Brew.tsx";
import { EquipmentScreen } from "./screens/Equipment.tsx";
import { useRecipes } from "./hooks/useRecipes.ts";
import { useEquipment } from "./hooks/useEquipment.ts";
import { BUNDLED_SAMPLES, importBeerJsonFromDisk, importBeerXmlFromDisk } from "./data/recipes.ts";
import type { StoredRecipe } from "./data/recipes.ts";

/**
 * Detect duplicates by recipe name (case-insensitive, trimmed) against
 * the existing library. When duplicates are found, ask the user
 * whether to import them anyway as duplicates or skip them. New
 * recipes (not yet in the library) always import.
 */
function partitionForImport(
  incoming: BeerJsonRecipe[],
  existing: StoredRecipe[],
): BeerJsonRecipe[] {
  if (incoming.length === 0) return [];
  const existingKeys = new Set(
    existing.map((s) => s.recipe.name.trim().toLowerCase()),
  );
  const fresh: BeerJsonRecipe[] = [];
  const dups: BeerJsonRecipe[] = [];
  for (const r of incoming) {
    if (existingKeys.has(r.name.trim().toLowerCase())) dups.push(r);
    else fresh.push(r);
  }
  if (dups.length === 0) return incoming;
  const names = dups.map((r) => `"${r.name}"`).join("\n  • ");
  const proceed = window.confirm(
    `${dups.length} recipe${dups.length === 1 ? "" : "s"} already in your library:\n  • ${names}\n\n` +
      `OK = import them anyway as duplicates.\n` +
      `Cancel = skip them, only import the new ones.`,
  );
  return proceed ? incoming : fresh;
}

type AppState =
  | { view: "library" }
  | { view: "recipe"; recipeId: string }
  | { view: "edit_recipe"; recipeId: string }
  | { view: "brew"; recipeId: string }
  | { view: "equipment" }
  | { view: "tokens" };

const SESSION_STORAGE_PREFIX = "werb.session.";

function hasSessionFor(recipeId: string): boolean {
  try {
    return localStorage.getItem(`${SESSION_STORAGE_PREFIX}${recipeId}`) !== null;
  } catch {
    return false;
  }
}

export function App() {
  const [state, setState] = useState<AppState>({ view: "library" });
  const recipesApi = useRecipes();
  const equipmentApi = useEquipment();

  const goLibrary = () => setState({ view: "library" });
  const goRecipe = (recipeId: string) => setState({ view: "recipe", recipeId });
  const goEditRecipe = (recipeId: string) => setState({ view: "edit_recipe", recipeId });
  const goBrew = (recipeId: string) => setState({ view: "brew", recipeId });
  const goEquipment = () => setState({ view: "equipment" });
  const goTokens = () => setState({ view: "tokens" });

  let screen: React.ReactNode;
  if (state.view === "recipe") {
    const loaded = recipesApi.recipes.find((r) => r.id === state.recipeId);
    if (!loaded) {
      screen = <Missing recipeId={state.recipeId} onBack={goLibrary} />;
    } else {
      const profile = equipmentApi.activeProfile;
      screen = (
        <RecipeScreen
          recipe={loaded.recipe}
          activeProfile={profile}
          onBack={goLibrary}
          onStartBrewing={() => goBrew(state.recipeId)}
          onEdit={() => goEditRecipe(state.recipeId)}
          onApplyScaled={
            profile
              ? (scaled) => recipesApi.update(state.recipeId, scaled)
              : undefined
          }
          hasActiveSession={hasSessionFor(state.recipeId)}
        />
      );
    }
  } else if (state.view === "edit_recipe") {
    const loaded = recipesApi.recipes.find((r) => r.id === state.recipeId);
    if (!loaded) {
      screen = <Missing recipeId={state.recipeId} onBack={goLibrary} />;
    } else {
      screen = (
        <RecipeEditor
          recipe={loaded.recipe}
          onClose={() => goRecipe(state.recipeId)}
          onSave={(updated) => recipesApi.update(state.recipeId, updated)}
        />
      );
    }
  } else if (state.view === "brew") {
    const loaded = recipesApi.recipes.find((r) => r.id === state.recipeId);
    if (!loaded) {
      screen = <Missing recipeId={state.recipeId} onBack={goLibrary} />;
    } else {
      screen = (
        <BrewScreen
          recipeId={state.recipeId}
          recipe={loaded.recipe}
          activeProfile={equipmentApi.activeProfile}
          onBack={() => goRecipe(state.recipeId)}
        />
      );
    }
  } else if (state.view === "equipment") {
    screen = <EquipmentScreen api={equipmentApi} />;
  } else if (state.view === "tokens") {
    screen = <DesignTokensShowcase />;
  } else {
    screen = (
      <LibraryScreen
        recipes={recipesApi.recipes}
        onSelect={goRecipe}
        onDelete={recipesApi.remove}
        onDuplicate={(id) => {
          const stored = recipesApi.recipes.find((r) => r.id === id);
          if (!stored) return;
          recipesApi.create({
            ...stored.recipe,
            name: `${stored.recipe.name} (copy)`,
          });
        }}
        onImportSamples={() => {
          const toImport = partitionForImport(BUNDLED_SAMPLES, recipesApi.recipes);
          return recipesApi.createMany(toImport).length;
        }}
        onImportBeerJsonFile={async () => {
          const { recipes, error } = await importBeerJsonFromDisk();
          const toImport = partitionForImport(recipes, recipesApi.recipes);
          if (toImport.length > 0) recipesApi.createMany(toImport);
          return { count: toImport.length, error };
        }}
        onImportBeerXmlFile={async () => {
          const { recipes, error } = await importBeerXmlFromDisk();
          const toImport = partitionForImport(recipes, recipesApi.recipes);
          if (toImport.length > 0) recipesApi.createMany(toImport);
          return { count: toImport.length, error };
        }}
        activeProfile={equipmentApi.activeProfile}
        onGoEquipment={goEquipment}
      />
    );
  }

  return (
    <>
      <DevNav state={state} goLibrary={goLibrary} goEquipment={goEquipment} goTokens={goTokens} />
      {screen}
    </>
  );
}

function DevNav({
  state,
  goLibrary,
  goEquipment,
  goTokens,
}: {
  state: AppState;
  goLibrary: () => void;
  goEquipment: () => void;
  goTokens: () => void;
}) {
  // Hide nav on the brew screen — fewer distractions during a brew.
  if (state.view === "brew") return null;

  return (
    <nav className="no-print fixed top-3 right-3 z-50 flex gap-1 rounded-pill bg-surface-raised border border-border p-1 shadow-lg">
      <NavButton
        active={state.view === "library" || state.view === "recipe"}
        onClick={goLibrary}
      >
        Library
      </NavButton>
      <NavButton active={state.view === "equipment"} onClick={goEquipment}>
        Equipment
      </NavButton>
      <NavButton active={state.view === "tokens"} onClick={goTokens}>
        Tokens
      </NavButton>
    </nav>
  );
}

function NavButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-pill text-caption font-medium transition-colors ${
        active ? "bg-accent text-bg" : "text-text-muted hover:text-text hover:bg-surface"
      }`}
    >
      {children}
    </button>
  );
}

function Missing({ recipeId, onBack }: { recipeId: string; onBack: () => void }) {
  return (
    <div className="min-h-dvh bg-bg text-text flex items-center justify-center">
      <div className="text-center">
        <p className="text-body text-text-muted">
          Recipe <code className="font-mono text-mono">{recipeId}</code> not found.
        </p>
        <button
          onClick={onBack}
          className="mt-4 px-5 py-2 rounded-lg bg-accent text-bg text-body font-medium"
        >
          Back to library
        </button>
      </div>
    </div>
  );
}
