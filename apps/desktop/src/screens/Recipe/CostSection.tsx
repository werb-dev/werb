import { useMemo } from "react";
import type { BeerJsonRecipe } from "@werb/adapters";
import { useT, useUnits } from "../../data/preferences.tsx";
import { computeRecipeCost, type CostLine } from "../../data/cost.ts";
import {
  formatLiters,
  formatMassLarge,
  formatMassSmall,
  formatMoney,
  formatVolume,
  type UnitPreferences,
} from "../../data/units-format.ts";
import { Section } from "./Section.tsx";

/**
 * Approximate batch cost from the bundled default price table.
 * Brewers adjust the global "Cost adjustment" coefficient in
 * Settings to match their local market — single knob, no per-
 * ingredient maintenance.
 */
const CATEGORY_KEY: Record<CostLine["category"], string> = {
  fermentable: "recipe.cost.category.fermentable",
  hop: "recipe.cost.category.hop",
  culture: "recipe.cost.category.culture",
  misc: "recipe.cost.category.misc",
};

export function CostSection({ recipe }: { recipe: BeerJsonRecipe }) {
  const prefs = useUnits();
  const tt = useT();
  const breakdown = useMemo(
    () => computeRecipeCost(recipe, prefs.cost_inflation_pct),
    [recipe, prefs.cost_inflation_pct],
  );

  if (breakdown.total_count === 0) return null;

  const inflationNote =
    prefs.cost_inflation_pct === 100
      ? tt("recipe.cost.note_default")
      : tt("recipe.cost.note_inflated", { pct: prefs.cost_inflation_pct });

  return (
    <Section title={tt("recipe.section.cost")} subtitle={inflationNote}>
      <div className="rounded-xl bg-surface border border-border">
        <ul className="divide-y divide-border">
          {breakdown.lines.map((line, i) => (
            <CostLineRow
              key={`${line.category}-${line.name}-${i}`}
              line={line}
              prefs={prefs}
            />
          ))}
        </ul>

        <div className="px-4 py-4 sm:px-6 sm:py-5 border-t border-border grid grid-cols-2 sm:grid-cols-3 gap-px bg-border">
          <CostStat
            label={tt("recipe.cost.batch_total")}
            value={formatMoney(breakdown.total, prefs)}
            tone="highlight"
          />
          <CostStat
            label={tt("recipe.cost.per_unit", { unit: formatLiters(1, prefs).unit })}
            value={formatMoney(breakdown.per_liter, prefs)}
          />
          <CostStat
            label={tt("recipe.cost.per_bottle")}
            value={formatMoney(breakdown.per_bottle_330, prefs)}
          />
        </div>
      </div>
    </Section>
  );
}

/**
 * Render the (summed) quantity of a cost line in the user's preferred
 * units. Returns null when the line couldn't be priced (no convertible
 * amount) so the UI can omit it cleanly.
 */
function formatCostAmount(line: CostLine, prefs: UnitPreferences): string | null {
  if (line.amount_in_natural_unit === null || line.natural_unit === null) {
    return null;
  }
  const v = line.amount_in_natural_unit;
  switch (line.natural_unit) {
    case "g":
      return formatMassSmall({ value: v, unit: "g" }, prefs).display;
    case "kg":
      return formatMassLarge({ value: v, unit: "kg" }, prefs).display;
    case "L":
      return formatVolume({ value: v, unit: "l" }, prefs).display;
    case "pack": {
      const rounded = Math.round(v * 100) / 100;
      return `${rounded} pack${rounded === 1 ? "" : "s"}`;
    }
  }
}

function CostLineRow({
  line,
  prefs,
}: {
  line: CostLine;
  prefs: UnitPreferences;
}) {
  const t = useT();
  const amountDisplay = formatCostAmount(line, prefs);
  return (
    <li className="px-4 py-3 sm:px-6 sm:py-4 flex items-baseline justify-between gap-3 sm:gap-4">
      <div className="min-w-0">
        <p className="text-body-sm font-medium truncate">
          {line.name}
          {amountDisplay && (
            <span className="text-text-muted font-mono ml-2">
              {amountDisplay}
            </span>
          )}
        </p>
        <p className="text-caption text-text-muted mt-0.5">
          {t(CATEGORY_KEY[line.category])}
          {line.default_unit_price !== null && line.natural_unit && (
            <>
              {" · "}
              {formatMoney(line.default_unit_price, prefs)}/{line.natural_unit}
            </>
          )}
        </p>
      </div>
      <p
        className={`font-mono text-body tabular-nums shrink-0 ${
          line.line_cost !== null ? "text-text" : "text-text-muted"
        }`}
      >
        {line.line_cost !== null ? formatMoney(line.line_cost, prefs) : "—"}
      </p>
    </li>
  );
}

function CostStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "highlight";
}) {
  return (
    <div className="bg-surface px-4 py-3">
      <p className="text-caption uppercase tracking-widest text-text-muted">
        {label}
      </p>
      <p
        className={`font-mono text-body sm:text-h3 mt-1 tabular-nums ${
          tone === "highlight" ? "text-accent" : "text-text"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
