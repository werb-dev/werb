import { useMemo, useState } from "react";
import type { BeerJsonRecipe } from "@werb/adapters";
import { useT, useUnitsControl } from "../../data/preferences.tsx";
import { computeRecipeCost, priceKey, type CostLine } from "../../data/cost.ts";
import { parseLocaleNumber } from "../../components/editor/Fields.tsx";
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
  const { prefs, setPrefs } = useUnitsControl();
  const tt = useT();
  const breakdown = useMemo(
    () => computeRecipeCost(recipe, prefs.cost_inflation_pct, prefs.ingredient_prices),
    [recipe, prefs.cost_inflation_pct, prefs.ingredient_prices],
  );

  if (breakdown.total_count === 0) return null;

  const setOverride = (line: CostLine, value: number | null) => {
    setPrefs((p) => {
      const next = { ...(p.ingredient_prices ?? {}) };
      const key = priceKey(line.category, line.name);
      if (value === null) delete next[key];
      else next[key] = value;
      return { ...p, ingredient_prices: next };
    });
  };

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
              onSetPrice={(v) => setOverride(line, v)}
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
  onSetPrice,
}: {
  line: CostLine;
  prefs: UnitPreferences;
  onSetPrice: (value: number | null) => void;
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
        <p className="text-caption text-text-muted mt-0.5 flex items-center gap-1 flex-wrap">
          <span>{t(CATEGORY_KEY[line.category])}</span>
          {line.unit_price !== null && line.natural_unit && (
            <PriceEditor
              line={line}
              prefs={prefs}
              onSetPrice={onSetPrice}
            />
          )}
          {line.is_override && (
            <span className="text-accent" title={t("recipe.cost.your_price_hint")}>
              · {t("recipe.cost.your_price")}
            </span>
          )}
        </p>
      </div>
      <p
        className={`font-mono text-body tabular-nums shrink-0 ${
          line.line_cost !== null
            ? line.is_override
              ? "text-accent"
              : "text-text"
            : "text-text-muted"
        }`}
      >
        {line.line_cost !== null ? formatMoney(line.line_cost, prefs) : "—"}
      </p>
    </li>
  );
}

/**
 * Inline editor for a personal per-unit price. Shows the active price as a
 * button; clicking opens a small input (price per natural unit). ✓ saves,
 * ↺ clears back to the bundled baseline, × cancels.
 */
function PriceEditor({
  line,
  prefs,
  onSetPrice,
}: {
  line: CostLine;
  prefs: UnitPreferences;
  onSetPrice: (value: number | null) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");

  const apply = () => {
    const n = parseLocaleNumber(val);
    if (Number.isFinite(n) && n >= 0) onSetPrice(n);
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setVal(String(line.unit_price ?? ""));
          setOpen(true);
        }}
        className="underline decoration-dotted underline-offset-2 hover:text-accent transition-colors"
        title={t("recipe.cost.edit_price")}
      >
        · {formatMoney(line.unit_price ?? 0, prefs)}/{line.natural_unit}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      ·{" "}
      <input
        autoFocus
        type="text"
        inputMode="decimal"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") apply();
          if (e.key === "Escape") setOpen(false);
        }}
        className="w-14 bg-transparent border-b border-accent text-text font-mono tabular-nums text-right focus:outline-none"
      />
      <span className="font-mono">/{line.natural_unit}</span>
      <button type="button" onClick={apply} className="text-accent" aria-label={t("editor.tools.apply")}>
        ✓
      </button>
      {line.is_override && (
        <button
          type="button"
          onClick={() => {
            onSetPrice(null);
            setOpen(false);
          }}
          className="text-text-muted hover:text-text"
          aria-label={t("recipe.cost.reset_price")}
          title={t("recipe.cost.reset_price")}
        >
          ↺
        </button>
      )}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-text-muted"
        aria-label={t("editor.tools.cancel")}
      >
        ×
      </button>
    </span>
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
