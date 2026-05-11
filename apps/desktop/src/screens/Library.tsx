import { useState } from "react";
import {
  recipeToIbuInput,
  recipeToWaterInput,
  toSrm,
  srmToHex,
  type BeerJsonRecipe,
} from "@werb/adapters";
import { computeIbu, computeWater } from "@werb/calc";
import type { StoredRecipe } from "../data/recipes.ts";
import { filterAndSort, type SortKey } from "../data/library-sort.ts";
import { profileToWaterOverrides, type ProfileWithId } from "../data/equipment.ts";
import { useUnits } from "../data/preferences.tsx";
import {
  formatColor,
  formatLiters,
  formatSpecificGravity,
  formatVolume,
} from "../data/units-format.ts";

interface LibraryScreenProps {
  recipes: StoredRecipe[];
  loading: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onImportSamples: () => { count: number; info?: string | undefined };
  onImportBeerJsonFile: () => Promise<{
    count: number;
    error?: string | undefined;
    info?: string | undefined;
  }>;
  onImportBeerXmlFile: () => Promise<{
    count: number;
    error?: string | undefined;
    info?: string | undefined;
  }>;
  activeProfile?: ProfileWithId | undefined;
  onGoEquipment: () => void;
}

export function LibraryScreen({
  recipes,
  loading,
  onSelect,
  onDelete,
  onDuplicate,
  onImportSamples,
  onImportBeerJsonFile,
  onImportBeerXmlFile,
  activeProfile,
  onGoEquipment,
}: LibraryScreenProps) {
  const [importError, setImportError] = useState<string | null>(null);
  const [importInfo, setImportInfo] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updated");

  const visible = filterAndSort(recipes, query, sortKey);

  const handleImportSamples = () => {
    setImportError(null);
    setImportInfo(null);
    const { count, info } = onImportSamples();
    if (info) setImportInfo(info);
    else if (count === 0) setImportError("No bundled samples found.");
  };

  const runImport = async (
    fn: () => Promise<{ count: number; error?: string | undefined; info?: string | undefined }>,
  ) => {
    setImportError(null);
    setImportInfo(null);
    setImporting(true);
    try {
      const { error, info } = await fn();
      if (error) setImportError(error);
      if (info) setImportInfo(info);
    } finally {
      setImporting(false);
    }
  };

  const handleImportFile = () => runImport(onImportBeerJsonFile);
  const handleImportXml = () => runImport(onImportBeerXmlFile);

  return (
    <div className="min-h-dvh bg-bg text-text">
      <main className="mx-auto max-w-5xl px-8 py-12">
        <header className="mb-12">
          <p className="text-caption uppercase tracking-widest text-text-muted">
            {loading
              ? "Werb · loading…"
              : `Werb · ${recipes.length} recipe${recipes.length === 1 ? "" : "s"}`}
          </p>
          <h1 className="text-h1 font-semibold mt-3">Library</h1>
          <ProfileBadge profile={activeProfile} onGoEquipment={onGoEquipment} />

          <div className="flex flex-wrap gap-2 mt-5">
            <button
              onClick={handleImportFile}
              disabled={importing}
              className="px-4 py-2 rounded-lg bg-accent text-bg text-body-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {importing ? "Importing…" : "Import .beerjson"}
            </button>
            <button
              onClick={handleImportXml}
              disabled={importing}
              className="px-4 py-2 rounded-lg bg-surface-raised border border-border text-body-sm font-medium hover:border-border-strong disabled:opacity-50 transition-colors"
            >
              Import .beerxml
            </button>
            <button
              onClick={handleImportSamples}
              className="px-4 py-2 rounded-lg bg-surface-raised border border-border text-body-sm font-medium hover:border-border-strong transition-colors"
            >
              Import samples
            </button>
          </div>

          {recipes.length > 1 && (
            <div className="mt-5 flex flex-wrap gap-3 items-center">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search recipes…"
                className="flex-1 min-w-[12rem] bg-surface border border-border rounded-lg px-3 py-2 text-body-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="bg-surface border border-border rounded-lg px-3 py-2 text-body-sm text-text focus:outline-none focus:border-accent"
              >
                <option value="updated">Recently updated</option>
                <option value="name">Name (A→Z)</option>
                <option value="style">Style</option>
              </select>
            </div>
          )}

          {importError && (
            <div className="mt-5 rounded-lg border border-warning bg-surface p-4">
              <p className="text-caption uppercase tracking-widest text-warning font-medium">
                Import failed
              </p>
              <p className="text-body-sm text-text mt-2 font-mono break-all">{importError}</p>
            </div>
          )}

          {importInfo && (
            <div className="mt-5 rounded-lg border border-border bg-surface p-4">
              <p className="text-caption uppercase tracking-widest text-text-muted font-medium">
                Import notice
              </p>
              <p className="text-body-sm text-text mt-2">{importInfo}</p>
            </div>
          )}
        </header>

        {loading ? (
          <SkeletonGrid />
        ) : recipes.length === 0 ? (
          <EmptyState />
        ) : visible.length === 0 ? (
          <p className="text-body text-text-muted text-center py-12">
            No recipes match "{query}".
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map(({ id, recipe }) => (
              <li key={id}>
                <RecipeCard
                  recipe={recipe}
                  activeProfile={activeProfile}
                  onSelect={() => onSelect(id)}
                  onDuplicate={() => onDuplicate(id)}
                  onDelete={() => {
                    if (confirm(`Delete "${recipe.name}"?`)) onDelete(id);
                  }}
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
  onDuplicate,
  onDelete,
}: {
  recipe: BeerJsonRecipe;
  activeProfile?: ProfileWithId | undefined;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const prefs = useUnits();
  const beerColor = recipe.color_estimate ? srmToHex(toSrm(recipe.color_estimate)) : null;
  const colorLabel = recipe.color_estimate
    ? formatColor(recipe.color_estimate, prefs).display
    : null;
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
    <div className="group relative">
      <div className="absolute top-3 right-3 z-10 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          onClick={onDuplicate}
          aria-label={`Duplicate ${recipe.name}`}
          title="Duplicate recipe"
          className="w-7 h-7 rounded-pill flex items-center justify-center text-text-muted bg-surface-raised border border-border hover:text-accent hover:border-accent transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <span aria-hidden className="text-caption font-mono leading-none">+</span>
        </button>
        <button
          onClick={onDelete}
          aria-label={`Delete ${recipe.name}`}
          title="Delete recipe"
          className="w-7 h-7 rounded-pill flex items-center justify-center text-text-muted bg-surface-raised border border-border hover:text-danger hover:border-danger transition-colors focus:outline-none focus:ring-2 focus:ring-danger"
        >
          <span aria-hidden className="text-body-sm font-mono leading-none">×</span>
        </button>
      </div>
    <button
      onClick={onSelect}
      className="w-full text-left rounded-xl bg-surface border border-border hover:bg-surface-raised hover:border-border-strong transition-colors p-6 flex flex-col gap-4 focus:outline-none focus:ring-2 focus:ring-accent"
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
            title={colorLabel ?? undefined}
          />
        )}
      </div>

      <dl className="grid grid-cols-3 gap-x-2 gap-y-3 mt-auto pt-4 border-t border-border font-mono">
        <Stat
          label="Vol"
          value={(() => {
            const v = formatVolume(recipe.batch_size, prefs);
            return `${v.value.toFixed(0)} ${v.unit}`;
          })()}
        />
        <Stat
          label="OG"
          value={
            recipe.original_gravity
              ? formatSpecificGravity(recipe.original_gravity.value, prefs).display
              : "—"
          }
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
          value={
            recipe.final_gravity
              ? formatSpecificGravity(recipe.final_gravity.value, prefs).display
              : "—"
          }
        />
        <Stat
          label="Water"
          value={
            totalWaterL !== null
              ? (() => {
                  const v = formatLiters(totalWaterL, prefs);
                  return `${v.value.toFixed(0)} ${v.unit}`;
                })()
              : "—"
          }
          sub={activeProfile ? "rig" : "default"}
        />
      </dl>
    </button>
    </div>
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

function EmptyState() {
  return (
    <div className="rounded-xl bg-surface border border-border border-dashed p-12 text-center">
      <p className="text-body text-text">No recipes yet.</p>
      <p className="text-body-sm text-text-muted mt-2 max-w-md mx-auto">
        Use the buttons above to import a <code className="font-mono">.beerjson</code> file
        from disk, or load the bundled sample recipes to get started.
      </p>
    </div>
  );
}

/**
 * Three placeholder cards in the same grid shape as RecipeCard. Shown
 * while the StorageBackend resolves its initial read on async backends
 * (OPFS, future cloud) so the screen doesn't flash an EmptyState that
 * is about to be replaced with real recipes.
 */
function SkeletonGrid() {
  return (
    <ul
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      aria-busy="true"
      aria-live="polite"
    >
      {[0, 1, 2].map((i) => (
        <li key={i}>
          <div className="rounded-xl bg-surface border border-border p-5 animate-pulse">
            <div className="h-3 w-1/3 rounded bg-surface-raised" />
            <div className="mt-3 h-5 w-3/4 rounded bg-surface-raised" />
            <div className="mt-6 grid grid-cols-3 gap-2">
              <div className="h-10 rounded bg-surface-raised" />
              <div className="h-10 rounded bg-surface-raised" />
              <div className="h-10 rounded bg-surface-raised" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

