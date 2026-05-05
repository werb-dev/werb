import {
  recipeToIbuInput,
  recipeToWaterInput,
  toLiters,
  toSrm,
  srmToHex,
  type BeerJsonRecipe,
} from "@werb/adapters";
import { computeIbu, computeWater } from "@werb/calc";
import type { LoadedRecipe } from "../data/recipes.ts";
import type { RecipeSource } from "../hooks/useRecipes.ts";
import { profileToWaterOverrides, type ProfileWithId } from "../data/equipment.ts";

interface LibraryScreenProps {
  recipes: LoadedRecipe[];
  source: RecipeSource;
  loading: boolean;
  error: string | null;
  skipped: { path: string; reason: string }[];
  pickFolder: () => Promise<void>;
  useBundled: () => void;
  refresh: () => Promise<void>;
  onSelect: (id: string) => void;
  activeProfile?: ProfileWithId | undefined;
  onGoEquipment: () => void;
}

export function LibraryScreen({
  recipes,
  source,
  loading,
  error,
  skipped,
  pickFolder,
  useBundled,
  refresh,
  onSelect,
  activeProfile,
  onGoEquipment,
}: LibraryScreenProps) {
  const isDisk = source.type === "disk";

  return (
    <div className="min-h-dvh bg-bg text-text">
      <main className="mx-auto max-w-5xl px-8 py-12">
        <header className="mb-12">
          <p className="text-caption uppercase tracking-widest text-text-muted">
            Werb · {recipes.length} recipe{recipes.length === 1 ? "" : "s"}
            {isDisk ? " · disk" : " · bundled examples"}
          </p>
          <h1 className="text-h1 font-semibold mt-3">Library</h1>
          <ProfileBadge profile={activeProfile} onGoEquipment={onGoEquipment} />
          {isDisk ? (
            <p className="text-body text-text-muted mt-2 font-mono break-all">
              {source.path}
            </p>
          ) : (
            <p className="text-body text-text-muted mt-2 max-w-2xl">
              Showing the bundled examples. Pick a folder of{" "}
              <code className="font-mono text-mono">.beerjson</code> files to
              load your own.
            </p>
          )}

          <div className="flex flex-wrap gap-2 mt-5">
            <button
              onClick={pickFolder}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-accent text-bg text-body-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? "Loading…" : isDisk ? "Change folder" : "Open folder"}
            </button>
            {isDisk && (
              <>
                <button
                  onClick={refresh}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-surface-raised border border-border text-body-sm font-medium hover:border-border-strong disabled:opacity-50 transition-colors"
                >
                  Refresh
                </button>
                <button
                  onClick={useBundled}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-surface-raised border border-border text-text-muted text-body-sm font-medium hover:text-text disabled:opacity-50 transition-colors"
                >
                  Use bundled examples
                </button>
              </>
            )}
          </div>

          {error && (
            <div className="mt-5 rounded-lg border border-warning bg-surface p-4">
              <p className="text-caption uppercase tracking-widest text-warning font-medium">
                Couldn't load folder
              </p>
              <p className="text-body-sm text-text mt-2 font-mono break-all">{error}</p>
            </div>
          )}

          {skipped.length > 0 && (
            <details className="mt-5 rounded-lg bg-surface border border-border p-4">
              <summary className="text-body-sm font-medium cursor-pointer">
                {skipped.length} file{skipped.length === 1 ? "" : "s"} skipped
              </summary>
              <ul className="mt-3 space-y-2">
                {skipped.map((s, i) => (
                  <li key={i} className="text-caption font-mono text-text-muted break-all">
                    <span className="text-warning">✗</span>{" "}
                    {s.path.split("/").pop()} — {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </header>

        {recipes.length === 0 ? (
          <EmptyState isDisk={isDisk} />
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recipes.map(({ id, recipe }) => (
              <li key={id}>
                <RecipeCard
                  recipe={recipe}
                  activeProfile={activeProfile}
                  onSelect={() => onSelect(id)}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function RecipeCard({
  recipe,
  activeProfile,
  onSelect,
}: {
  recipe: BeerJsonRecipe;
  activeProfile?: ProfileWithId | undefined;
  onSelect: () => void;
}) {
  const beerColor = recipe.color_estimate ? srmToHex(toSrm(recipe.color_estimate)) : null;
  const computedIbu = (() => {
    try {
      return computeIbu(recipeToIbuInput(recipe)).total_ibu;
    } catch {
      return null;
    }
  })();
  const totalWaterL = (() => {
    try {
      return computeWater(recipeToWaterInput(recipe, profileToWaterOverrides(activeProfile)))
        .total_water_l;
    } catch {
      return null;
    }
  })();
  const claimedIbu = recipe.ibu_estimate?.ibu?.value ?? null;

  return (
    <button
      onClick={onSelect}
      className="group w-full text-left rounded-xl bg-surface border border-border hover:bg-surface-raised hover:border-border-strong transition-colors p-6 flex flex-col gap-4 focus:outline-none focus:ring-2 focus:ring-accent"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {recipe.style && (
            <p className="text-caption uppercase tracking-widest text-text-muted truncate">
              {recipe.style.category_number ?? ""}
              {recipe.style.style_letter ?? ""}
              {recipe.style.style_letter || recipe.style.category_number ? " · " : ""}
              {recipe.style.name}
            </p>
          )}
          <h2 className="text-h4 font-semibold mt-2 capitalize leading-tight">
            {recipe.name.toLowerCase()}
          </h2>
        </div>
        {beerColor && (
          <span
            aria-hidden
            className="block w-10 h-10 rounded-pill border border-border-strong shrink-0"
            style={{ backgroundColor: beerColor }}
            title={`${recipe.color_estimate?.value} ${recipe.color_estimate?.unit}`}
          />
        )}
      </div>

      <dl className="grid grid-cols-3 gap-x-2 gap-y-3 mt-auto pt-4 border-t border-border font-mono">
        <Stat label="Vol" value={`${toLiters(recipe.batch_size).toFixed(0)} L`} />
        <Stat
          label="OG"
          value={recipe.original_gravity?.value.toFixed(3) ?? "—"}
        />
        <Stat
          label="ABV"
          value={
            recipe.alcohol_by_volume
              ? `${recipe.alcohol_by_volume.value.toFixed(1)}%`
              : "—"
          }
        />
        <Stat
          label="IBU"
          value={claimedIbu !== null ? claimedIbu.toString() : "—"}
          sub={
            computedIbu !== null && claimedIbu !== null
              ? `≈${computedIbu.toFixed(0)}`
              : computedIbu !== null
              ? computedIbu.toFixed(0)
              : undefined
          }
          warn={
            claimedIbu !== null &&
            computedIbu !== null &&
            Math.abs(computedIbu - claimedIbu) > 15
          }
        />
        <Stat
          label="FG"
          value={recipe.final_gravity?.value.toFixed(3) ?? "—"}
        />
        <Stat
          label="Water"
          value={totalWaterL !== null ? `${totalWaterL.toFixed(0)} L` : "—"}
          sub={activeProfile ? "rig" : "default"}
        />
      </dl>
    </button>
  );
}

function Stat({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string;
  sub?: string | undefined;
  warn?: boolean | undefined;
}) {
  return (
    <div>
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd className={`text-body-sm mt-0.5 ${warn ? "text-warning" : "text-text"}`}>
        {value}
        {sub && <span className="text-text-muted text-caption ml-1">{sub}</span>}
      </dd>
    </div>
  );
}

function ProfileBadge({
  profile,
  onGoEquipment,
}: {
  profile?: ProfileWithId | undefined;
  onGoEquipment: () => void;
}) {
  if (profile) {
    return (
      <button
        onClick={onGoEquipment}
        className="mt-3 inline-flex items-center gap-2 rounded-pill bg-surface border border-border px-3 py-1.5 text-caption text-text-muted hover:text-text hover:border-border-strong transition-colors"
        title="Equipment profile in use — click to edit"
      >
        <span aria-hidden className="block w-1.5 h-1.5 rounded-pill bg-success" />
        <span className="font-mono">
          Brewing on <span className="text-text">{profile.name}</span> ·{" "}
          {profile.efficiency_pct}% eff
        </span>
      </button>
    );
  }
  return (
    <button
      onClick={onGoEquipment}
      className="mt-3 inline-flex items-center gap-2 rounded-pill bg-surface border border-border border-dashed px-3 py-1.5 text-caption text-text-muted hover:text-text hover:border-accent transition-colors"
    >
      <span aria-hidden className="block w-1.5 h-1.5 rounded-pill bg-text-muted" />
      <span>No equipment profile — using defaults</span>
      <span aria-hidden className="text-accent">→</span>
    </button>
  );
}

function EmptyState({ isDisk }: { isDisk: boolean }) {
  return (
    <div className="rounded-xl bg-surface border border-border border-dashed p-12 text-center">
      <p className="text-body text-text-muted">
        {isDisk
          ? "No .beerjson files found in this folder."
          : "No bundled examples found — check examples/ exists at the workspace root."}
      </p>
    </div>
  );
}
