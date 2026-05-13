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
import { useT, useUnits } from "../data/preferences.tsx";
import { WerbError, translateError } from "../data/errors.ts";
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
  onImportFile: () => Promise<{
    count: number;
    error?: WerbError | undefined;
    info?: string | undefined;
  }>;
  onCreateBlank: () => void;
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
  onImportFile,
  onCreateBlank,
  activeProfile,
  onGoEquipment,
}: LibraryScreenProps) {
  const t = useT();
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
    else if (count === 0) setImportError(t("error.import.no_samples"));
  };

  const runImport = async (
    fn: () => Promise<{ count: number; error?: WerbError | undefined; info?: string | undefined }>,
  ) => {
    setImportError(null);
    setImportInfo(null);
    setImporting(true);
    try {
      const { error, info } = await fn();
      if (error) setImportError(translateError(error, t));
      if (info) setImportInfo(info);
    } finally {
      setImporting(false);
    }
  };

  const handleImportFile = () => runImport(onImportFile);

  return (
    <div className="min-h-dvh bg-bg text-text">
      <main className="mx-auto max-w-5xl px-4 pt-12 pb-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <header className="mb-8 sm:mb-10 lg:mb-12">
          <p className="text-caption uppercase tracking-widest text-text-muted">
            {loading
              ? t("library.subtitle_loading")
              : t("library.subtitle_count", { count: recipes.length })}
          </p>
          <h1 className="text-h2 sm:text-h1 font-semibold mt-3">{t("library.title")}</h1>
          <ProfileBadge profile={activeProfile} onGoEquipment={onGoEquipment} />

          <div className="flex flex-wrap gap-2 mt-5">
            <button
              onClick={onCreateBlank}
              className="px-4 py-2 rounded-lg bg-accent text-bg text-body-sm font-medium hover:opacity-90 transition-opacity"
            >
              {t("library.new_recipe")}
            </button>
            <button
              onClick={handleImportFile}
              disabled={importing}
              title={t("library.import_formats_help")}
              className="px-4 py-2 rounded-lg bg-surface-raised border border-border text-body-sm font-medium hover:border-border-strong disabled:opacity-50 transition-colors"
            >
              {importing ? t("library.importing") : t("library.import_recipes")}
            </button>
            <button
              onClick={handleImportSamples}
              className="px-4 py-2 rounded-lg bg-surface-raised border border-border text-body-sm font-medium hover:border-border-strong transition-colors"
            >
              {t("library.import_samples")}
            </button>
          </div>

          {recipes.length > 1 && (
            <div className="mt-5 flex flex-wrap gap-3 items-center">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("library.search_placeholder")}
                className="flex-1 min-w-[12rem] bg-surface border border-border rounded-lg px-3 py-2 text-body-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="bg-surface border border-border rounded-lg px-3 py-2 text-body-sm text-text focus:outline-none focus:border-accent"
              >
                <option value="updated">{t("library.sort_updated")}</option>
                <option value="name">{t("library.sort_name")}</option>
                <option value="style">{t("library.sort_style")}</option>
              </select>
            </div>
          )}

          {importError && (
            <div className="mt-5 rounded-lg border border-warning bg-surface p-4">
              <p className="text-caption uppercase tracking-widest text-warning font-medium">
                {t("library.import_failed")}
              </p>
              <p className="text-body-sm text-text mt-2 font-mono break-all">{importError}</p>
            </div>
          )}

          {importInfo && (
            <div className="mt-5 rounded-lg border border-border bg-surface p-4">
              <p className="text-caption uppercase tracking-widest text-text-muted font-medium">
                {t("library.import_notice")}
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
            {t("library.no_match", { query })}
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
  const t = useT();
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
      <div className="absolute top-3 right-3 z-10 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
        <button
          onClick={onDuplicate}
          aria-label={t("library.card.duplicate_aria", { name: recipe.name })}
          title={t("library.card.duplicate_title")}
          className="w-7 h-7 rounded-pill flex items-center justify-center text-text-muted bg-surface-raised border border-border hover:text-accent hover:border-accent transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <span aria-hidden className="text-caption font-mono leading-none">+</span>
        </button>
        <button
          onClick={onDelete}
          aria-label={t("library.card.delete_aria", { name: recipe.name })}
          title={t("library.card.delete_title")}
          className="w-7 h-7 rounded-pill flex items-center justify-center text-text-muted bg-surface-raised border border-border hover:text-danger hover:border-danger transition-colors focus:outline-none focus:ring-2 focus:ring-danger"
        >
          <span aria-hidden className="text-body-sm font-mono leading-none">×</span>
        </button>
      </div>
    <button
      onClick={onSelect}
      className="w-full text-left rounded-xl bg-surface border border-border hover:bg-surface-raised hover:border-border-strong transition-colors p-5 sm:p-6 flex flex-col gap-4 focus:outline-none focus:ring-2 focus:ring-accent"
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
          label={t("library.card.stat.vol")}
          value={(() => {
            const v = formatVolume(recipe.batch_size, prefs);
            return `${v.value.toFixed(0)} ${v.unit}`;
          })()}
        />
        <Stat
          label={t("library.card.stat.og")}
          value={
            recipe.original_gravity
              ? formatSpecificGravity(recipe.original_gravity.value, prefs).display
              : "—"
          }
        />
        <Stat
          label={t("library.card.stat.abv")}
          value={
            recipe.alcohol_by_volume
              ? `${recipe.alcohol_by_volume.value.toFixed(1)}%`
              : "—"
          }
        />
        <Stat
          label={t("library.card.stat.ibu")}
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
          label={t("library.card.stat.fg")}
          value={
            recipe.final_gravity
              ? formatSpecificGravity(recipe.final_gravity.value, prefs).display
              : "—"
          }
        />
        <Stat
          label={t("library.card.stat.water")}
          value={
            totalWaterL !== null
              ? (() => {
                  const v = formatLiters(totalWaterL, prefs);
                  return `${v.value.toFixed(0)} ${v.unit}`;
                })()
              : "—"
          }
          sub={activeProfile ? t("library.card.water.rig") : t("library.card.water.default")}
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
  const t = useT();
  if (profile) {
    return (
      <button
        onClick={onGoEquipment}
        className="mt-3 inline-flex items-center gap-2 rounded-pill bg-surface border border-border px-3 py-1.5 text-caption text-text-muted hover:text-text hover:border-border-strong transition-colors"
        title={t("library.profile_in_use_title")}
      >
        <span aria-hidden className="block w-1.5 h-1.5 rounded-pill bg-success" />
        <span className="font-mono">
          {t("library.profile_brewing_on")}{" "}
          <span className="text-text">{profile.name}</span> ·{" "}
          {t("library.profile_eff_suffix", { eff: profile.efficiency_pct })}
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
      <span>{t("library.profile_default")}</span>
      <span aria-hidden className="text-accent">→</span>
    </button>
  );
}

function EmptyState() {
  const t = useT();
  return (
    <div className="rounded-xl bg-surface border border-border border-dashed p-6 sm:p-10 text-center">
      <p className="text-h3 text-text font-semibold">{t("library.onboarding.title")}</p>
      <p className="text-body-sm text-text-muted mt-2 max-w-md mx-auto">
        {t("library.onboarding.subtitle")}
      </p>
      <ol className="mt-6 max-w-md mx-auto text-left space-y-3">
        <OnboardingStep
          n={1}
          title={t("library.onboarding.step1.title")}
          body={t("library.onboarding.step1.body")}
        />
        <OnboardingStep
          n={2}
          title={t("library.onboarding.step2.title")}
          body={t("library.onboarding.step2.body")}
        />
        <OnboardingStep
          n={3}
          title={t("library.onboarding.step3.title")}
          body={t("library.onboarding.step3.body")}
        />
      </ol>
    </div>
  );
}

function OnboardingStep({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="shrink-0 w-6 h-6 mt-0.5 rounded-pill bg-accent text-bg text-caption font-semibold font-mono flex items-center justify-center"
      >
        {n}
      </span>
      <div>
        <p className="text-body-sm font-medium text-text">{title}</p>
        <p className="text-caption text-text-muted mt-0.5 leading-relaxed">
          {body}
        </p>
      </div>
    </li>
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

