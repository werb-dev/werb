import { useState } from "react";
import { DesignTokensShowcase } from "./design-tokens-showcase.tsx";
import { RecipeScreen } from "./screens/Recipe.tsx";

type View = "recipe" | "tokens";

export function App() {
  const [view, setView] = useState<View>("recipe");

  return (
    <>
      <DevNav view={view} setView={setView} />
      {view === "recipe" ? <RecipeScreen /> : <DesignTokensShowcase />}
    </>
  );
}

/** Tiny dev-only view switcher — temporary until we have real navigation. */
function DevNav({ view, setView }: { view: View; setView: (v: View) => void }) {
  return (
    <nav className="fixed top-3 right-3 z-50 flex gap-1 rounded-pill bg-surface-raised border border-border p-1 shadow-lg">
      <NavButton active={view === "recipe"} onClick={() => setView("recipe")}>
        Recipe
      </NavButton>
      <NavButton active={view === "tokens"} onClick={() => setView("tokens")}>
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
        active
          ? "bg-accent text-bg"
          : "text-text-muted hover:text-text hover:bg-surface"
      }`}
    >
      {children}
    </button>
  );
}
