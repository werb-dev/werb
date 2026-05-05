import {
  recipeToIbuInput,
  toLiters,
  toSrm,
  srmToHex,
  type BeerJsonRecipe,
} from "@werb/adapters";
import { computeIbu } from "@werb/calc";
import { RECIPES } from "../data/recipes.ts";

interface LibraryScreenProps {
  onSelect: (id: string) => void;
}

export function LibraryScreen({ onSelect }: LibraryScreenProps) {
  return (
    <div className="min-h-dvh bg-bg text-text">
      <main className="mx-auto max-w-5xl px-8 py-12">
        <header className="mb-12">
          <p className="text-caption uppercase tracking-widest text-text-muted">
            Werb · {RECIPES.length} recipe{RECIPES.length === 1 ? "" : "s"}
          </p>
          <h1 className="text-h1 font-semibold mt-3">Library</h1>
          <p className="text-body text-text-muted mt-2 max-w-2xl">
            Recipes loaded from <code className="font-mono text-mono">examples/*.beerjson</code>.
            Working-directory selection is coming once we wire Tauri fs.
          </p>
        </header>

        {RECIPES.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {RECIPES.map(({ id, recipe }) => (
              <li key={id}>
                <RecipeCard recipe={recipe} onSelect={() => onSelect(id)} />
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
  onSelect,
}: {
  recipe: BeerJsonRecipe;
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
          label="Color"
          value={
            recipe.color_estimate
              ? `${recipe.color_estimate.value.toFixed(0)}${recipe.color_estimate.unit === "EBC" ? "" : ""}`
              : "—"
          }
          sub={recipe.color_estimate?.unit}
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

function EmptyState() {
  return (
    <div className="rounded-xl bg-surface border border-border border-dashed p-12 text-center">
      <p className="text-body text-text-muted">
        No recipes found in <code className="font-mono text-mono">examples/</code>.
      </p>
    </div>
  );
}
