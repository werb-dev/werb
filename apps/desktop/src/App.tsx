import { useState } from "react";
import { DesignTokensShowcase } from "./design-tokens-showcase.tsx";
import { LibraryScreen } from "./screens/Library.tsx";
import { RecipeScreen } from "./screens/Recipe.tsx";
import { BrewScreen } from "./screens/Brew.tsx";
import { EquipmentScreen } from "./screens/Equipment.tsx";
import { useRecipes } from "./hooks/useRecipes.ts";
import { useEquipment } from "./hooks/useEquipment.ts";

type AppState =
  | { view: "library" }
  | { view: "recipe"; recipeId: string }
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
  const goBrew = (recipeId: string) => setState({ view: "brew", recipeId });
  const goEquipment = () => setState({ view: "equipment" });
  const goTokens = () => setState({ view: "tokens" });

  let screen: React.ReactNode;
  if (state.view === "recipe") {
    const loaded = recipesApi.recipes.find((r) => r.id === state.recipeId);
    if (!loaded) {
      screen = <Missing recipeId={state.recipeId} onBack={goLibrary} />;
    } else {
      screen = (
        <RecipeScreen
          recipe={loaded.recipe}
          activeProfile={equipmentApi.activeProfile}
          onBack={goLibrary}
          onStartBrewing={() => goBrew(state.recipeId)}
          hasActiveSession={hasSessionFor(state.recipeId)}
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
    screen = <EquipmentScreen />;
  } else if (state.view === "tokens") {
    screen = <DesignTokensShowcase />;
  } else {
    screen = (
      <LibraryScreen
        recipes={recipesApi.recipes}
        onSelect={goRecipe}
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
    <nav className="fixed top-3 right-3 z-50 flex gap-1 rounded-pill bg-surface-raised border border-border p-1 shadow-lg">
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
