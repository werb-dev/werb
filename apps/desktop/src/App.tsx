import { lazy, Suspense, useState } from "react";
import { LibraryScreen } from "./screens/Library.tsx";
import { RecipeScreen } from "./screens/Recipe.tsx";
import { BrewScreen } from "./screens/Brew.tsx";
import { JournalScreen } from "./screens/Journal.tsx";
import { SettingsScreen } from "./screens/Settings.tsx";
import { useRecipes } from "./hooks/useRecipes.ts";
import { useEquipment } from "./hooks/useEquipment.ts";
import { BUNDLED_SAMPLES, createBlankRecipe, importBeerJsonFromDisk, importBeerXmlFromDisk } from "./data/recipes.ts";
import { exportSessionHtml, exportSessionJson } from "./data/recipe-export.ts";
import { partitionForImport, skippedMessage } from "./data/import-dedup.ts";
import { useT, useUnits } from "./data/preferences.tsx";

// Lazy-loaded screens — the editor is the biggest screen by far
// (full form + autocomplete dropdowns + every BeerJSON field).
// Off the cold path for the normal browse-and-brew flow, so it ships
// as a separate bundle fetched on first navigation.
const RecipeEditor = lazy(() =>
  import("./screens/RecipeEditor.tsx").then((m) => ({ default: m.RecipeEditor })),
);
const EquipmentScreen = lazy(() =>
  import("./screens/Equipment.tsx").then((m) => ({ default: m.EquipmentScreen })),
);

/**
 * Dev-only design-tokens showcase. `import.meta.env.DEV` is statically
 * `false` in production builds, so Vite tree-shakes both the lazy
 * import and the route check out of the prod bundle.
 */
const IS_DEV = import.meta.env.DEV;

const DesignTokensShowcase = IS_DEV
  ? lazy(() =>
      import("./design-tokens-showcase.tsx").then((m) => ({
        default: m.DesignTokensShowcase,
      })),
    )
  : null;

type AppState =
  | { view: "library" }
  | { view: "recipe"; recipeId: string }
  | { view: "edit_recipe"; recipeId: string }
  // `sessionId` optional: when present, view that specific past or
  // active session (Journal flow). When absent, the brew screen
  // finds the live session for the recipe or offers to start one.
  | { view: "brew"; recipeId: string; sessionId?: string }
  | { view: "equipment" }
  | { view: "journal" }
  | { view: "settings" }
  | { view: "tokens" };

export function App() {
  const [state, setState] = useState<AppState>({ view: "library" });
  const recipesApi = useRecipes();
  const equipmentApi = useEquipment();
  const prefs = useUnits();

  const goLibrary = () => setState({ view: "library" });
  const goRecipe = (recipeId: string) => setState({ view: "recipe", recipeId });
  const goEditRecipe = (recipeId: string) => setState({ view: "edit_recipe", recipeId });
  const goBrew = (recipeId: string, sessionId?: string) =>
    setState(sessionId ? { view: "brew", recipeId, sessionId } : { view: "brew", recipeId });
  const goEquipment = () => setState({ view: "equipment" });
  const goJournal = () => setState({ view: "journal" });
  const goSettings = () => setState({ view: "settings" });
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
          recipeId={state.recipeId}
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
          sessionId={state.sessionId}
          activeProfile={equipmentApi.activeProfile}
          onBack={() => (state.sessionId ? goJournal() : goRecipe(state.recipeId))}
        />
      );
    }
  } else if (state.view === "equipment") {
    screen = <EquipmentScreen api={equipmentApi} />;
  } else if (state.view === "journal") {
    screen = (
      <JournalScreen
        onOpenSession={goBrew}
        onExportJson={exportSessionJson}
        onExportHtml={(session) => {
          // Pass the recipe through when it's still around so the
          // printout includes target gravities / IBU / etc. If the
          // recipe was deleted, exportSessionHtml falls back to the
          // session's own snapshot fields.
          const recipe = recipesApi.recipes.find(
            (r) => r.id === session.recipe_id,
          )?.recipe;
          return exportSessionHtml(session, recipe, prefs);
        }}
      />
    );
  } else if (state.view === "settings") {
    screen = <SettingsScreen />;
  } else if (state.view === "tokens" && DesignTokensShowcase) {
    screen = <DesignTokensShowcase />;
  } else {
    screen = (
      <LibraryScreen
        recipes={recipesApi.recipes}
        loading={recipesApi.loading}
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
          const { fresh, skipped } = partitionForImport(BUNDLED_SAMPLES, recipesApi.recipes);
          if (fresh.length > 0) recipesApi.createMany(fresh);
          return { count: fresh.length, info: skippedMessage(skipped) };
        }}
        onCreateBlank={() => {
          // Seed batch + efficiency from the active equipment profile
          // when one is set — saves a redundant edit for users who've
          // already told us what rig they brew on. When no profile
          // exists, offer to set one up first so the new recipe inherits
          // real values rather than the generic 20 L / 75 % fallback.
          const profile = equipmentApi.activeProfile;
          if (!profile) {
            const setUpFirst = confirm(
              "No equipment profile yet — the new recipe will use generic defaults (20 L, 75 % efficiency).\n\nSet up your equipment profile first? (Cancel to continue with defaults.)",
            );
            if (setUpFirst) {
              goEquipment();
              return;
            }
          }
          const fresh = recipesApi.create(
            createBlankRecipe(
              profile
                ? {
                    batch_size_l: profile.batch_size_l,
                    efficiency_pct: profile.efficiency_pct,
                  }
                : undefined,
            ),
          );
          // Jump straight into the editor — a blank shell isn't useful
          // to look at on the recipe screen; the brewer needs to fill
          // in ingredients before anything renders meaningfully.
          goEditRecipe(fresh.id);
        }}
        onImportBeerJsonFile={async () => {
          const { recipes, error } = await importBeerJsonFromDisk();
          const { fresh, skipped } = partitionForImport(recipes, recipesApi.recipes);
          if (fresh.length > 0) recipesApi.createMany(fresh);
          return { count: fresh.length, error, info: skippedMessage(skipped) };
        }}
        onImportBeerXmlFile={async () => {
          const { recipes, error } = await importBeerXmlFromDisk();
          const { fresh, skipped } = partitionForImport(recipes, recipesApi.recipes);
          if (fresh.length > 0) recipesApi.createMany(fresh);
          return { count: fresh.length, error, info: skippedMessage(skipped) };
        }}
        activeProfile={equipmentApi.activeProfile}
        onGoEquipment={goEquipment}
      />
    );
  }

  return (
    <>
      <DevNav
        state={state}
        goLibrary={goLibrary}
        goEquipment={goEquipment}
        goJournal={goJournal}
        goSettings={goSettings}
        goTokens={goTokens}
      />
      <Suspense fallback={<ScreenLoading />}>{screen}</Suspense>
    </>
  );
}

/**
 * Tiny skeleton while a code-split screen's chunk is being fetched.
 * Visible long enough to be noticed only on cold load over slow
 * connections — once the chunk is cached, navigation is instant.
 */
function ScreenLoading() {
  return (
    <div className="min-h-dvh bg-bg text-text flex items-center justify-center">
      <p className="text-caption uppercase tracking-widest text-text-muted animate-pulse">
        Loading…
      </p>
    </div>
  );
}

function DevNav({
  state,
  goLibrary,
  goEquipment,
  goJournal,
  goSettings,
  goTokens,
}: {
  state: AppState;
  goLibrary: () => void;
  goEquipment: () => void;
  goJournal: () => void;
  goSettings: () => void;
  goTokens: () => void;
}) {
  // Hide nav on the brew screen — fewer distractions during a brew.
  if (state.view === "brew") return null;

  return <NavPill state={state} goLibrary={goLibrary} goJournal={goJournal} goEquipment={goEquipment} goSettings={goSettings} goTokens={goTokens} />;
}

/**
 * Inner component so we can call useT — DevNav is conditionally
 * returned before hooks would otherwise be reached, which React's
 * rules-of-hooks doesn't like.
 */
function NavPill({
  state,
  goLibrary,
  goJournal,
  goEquipment,
  goSettings,
  goTokens,
}: {
  state: AppState;
  goLibrary: () => void;
  goJournal: () => void;
  goEquipment: () => void;
  goSettings: () => void;
  goTokens: () => void;
}) {
  const t = useT();
  return (
    <nav className="fixed top-2 right-2 sm:top-3 sm:right-3 z-50 flex gap-0.5 sm:gap-1 rounded-pill bg-surface-raised border border-border p-0.5 sm:p-1 shadow-lg">
      <NavButton
        active={state.view === "library" || state.view === "recipe"}
        onClick={goLibrary}
      >
        {t("nav.library")}
      </NavButton>
      <NavButton active={state.view === "journal"} onClick={goJournal}>
        {t("nav.journal")}
      </NavButton>
      <NavButton active={state.view === "equipment"} onClick={goEquipment}>
        {t("nav.equipment")}
      </NavButton>
      <NavButton active={state.view === "settings"} onClick={goSettings}>
        {t("nav.settings")}
      </NavButton>
      {IS_DEV && (
        <NavButton active={state.view === "tokens"} onClick={goTokens} hideOnMobile>
          {t("nav.tokens")}
        </NavButton>
      )}
    </nav>
  );
}

function NavButton({
  active,
  onClick,
  hideOnMobile,
  children,
}: {
  active: boolean;
  onClick: () => void;
  hideOnMobile?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`${hideOnMobile ? "hidden sm:inline-flex" : ""} px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-pill text-[11px] sm:text-caption font-medium transition-colors ${
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
