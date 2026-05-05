import { useState } from "react";
import { DesignTokensShowcase } from "./design-tokens-showcase.tsx";
import { LibraryScreen } from "./screens/Library.tsx";
import { RecipeScreen } from "./screens/Recipe.tsx";
import { useRecipes } from "./hooks/useRecipes.ts";

type AppState =
  | { view: "library" }
  | { view: "recipe"; recipeId: string }
  | { view: "tokens" };

export function App() {
  const [state, setState] = useState<AppState>({ view: "library" });
  const recipesApi = useRecipes();

  const goLibrary = () => setState({ view: "library" });
  const goRecipe = (recipeId: string) => setState({ view: "recipe", recipeId });
  const goTokens = () => setState({ view: "tokens" });

  let screen: React.ReactNode;
  if (state.view === "recipe") {
    const loaded = recipesApi.recipes.find((r) => r.id === state.recipeId);
    if (!loaded) {
      screen = <Missing recipeId={state.recipeId} onBack={goLibrary} />;
    } else {
      screen = <RecipeScreen recipe={loaded.recipe} onBack={goLibrary} />;
    }
  } else if (state.view === "tokens") {
    screen = <DesignTokensShowcase />;
  } else {
    screen = <LibraryScreen onSelect={goRecipe} {...recipesApi} />;
  }

  return (
    <>
      <DevNav state={state} goLibrary={goLibrary} goTokens={goTokens} />
      {screen}
    </>
  );
}

function DevNav({
  state,
  goLibrary,
  goTokens,
}: {
  state: AppState;
  goLibrary: () => void;
  goTokens: () => void;
}) {
  return (
    <nav className="fixed top-3 right-3 z-50 flex gap-1 rounded-pill bg-surface-raised border border-border p-1 shadow-lg">
      <NavButton
        active={state.view === "library" || state.view === "recipe"}
        onClick={goLibrary}
      >
        Library
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
