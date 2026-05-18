import { useT } from "../../data/preferences.tsx";

export interface RangeHint {
  /**
   * Three-tier fit:
   *  - "in":   inside the BJCP range, green;
   *  - "near": within 10 % of the range width past either bound, orange;
   *  - "out":  further than that, red.
   */
  status: "in" | "near" | "out";
  /** Pre-formatted BJCP range, e.g. "1.046–1.054" or "≥ 4.5%". */
  range: string;
}

/**
 * Recipe-screen header tile. Renders a single metric with optional
 * subtitle, optional BJCP-range hint, and three colour rules:
 *  - `warn`: claimed-vs-computed disagreement (always wins);
 *  - `highlight`: brand accent for totals / hero numbers;
 *  - `styleHint`: green / orange / red by BJCP fit when no warn / highlight.
 */
export function Tile({
  label,
  value,
  sub,
  highlight,
  warn,
  styleHint,
}: {
  label: string;
  value: string;
  sub?: string | undefined;
  highlight?: boolean | undefined;
  warn?: boolean | undefined;
  styleHint?: RangeHint | null | undefined;
}) {
  const t = useT();
  const valueColor = warn
    ? "text-warning"
    : highlight
    ? "text-accent"
    : styleHint
    ? styleHint.status === "in"
      ? "text-success"
      : styleHint.status === "near"
      ? "text-warning"
      : "text-danger"
    : "text-text";
  return (
    <div className="bg-surface px-3 py-3 sm:px-5 sm:py-4">
      <p className="text-[10px] sm:text-caption uppercase tracking-widest text-text-muted">{label}</p>
      <p className={`font-mono text-h3 sm:text-h2 mt-1 ${valueColor}`}>{value}</p>
      {sub && (
        <p className={`font-mono text-caption mt-1 ${warn ? "text-warning" : "text-text-muted"}`}>
          {sub}
        </p>
      )}
      {styleHint && (
        <p
          className="font-mono text-caption mt-1 text-text-muted"
          title={
            styleHint.status === "in"
              ? t("recipe.style.in")
              : styleHint.status === "near"
              ? t("recipe.style.near")
              : t("recipe.style.out")
          }
        >
          {styleHint.range}
        </p>
      )}
    </div>
  );
}

/**
 * Compute the BJCP fit for a current value against a [min, max] range.
 * Either bound may be omitted. Returns `null` when there's no current
 * value (e.g. a recipe with no style) or no range at all.
 */
export function rangeHint({
  current,
  min,
  max,
  format,
}: {
  current: number | null | undefined;
  min: number | undefined;
  max: number | undefined;
  format: (v: number) => string;
}): RangeHint | null {
  if (current === null || current === undefined) return null;
  if (min === undefined && max === undefined) return null;
  const range =
    min !== undefined && max !== undefined
      ? `${format(min)}–${format(max)}`
      : min !== undefined
      ? `≥ ${format(min)}`
      : `≤ ${format(max!)}`;
  // Tolerance for "near": 10 % of the range width, or — when only one
  // bound is set — 10 % of the bound itself so a "≥ 4.5 %" comes with
  // a sensible 0.45 % cushion before turning red.
  const width =
    min !== undefined && max !== undefined
      ? max - min
      : Math.abs((min ?? max!) * 0.1);
  const tolerance = Math.abs(width) * 0.1;
  if (min !== undefined && current < min) {
    return { status: current < min - tolerance ? "out" : "near", range };
  }
  if (max !== undefined && current > max) {
    return { status: current > max + tolerance ? "out" : "near", range };
  }
  return { status: "in", range };
}
