import { useT } from "../../data/preferences.tsx";
import type { RangeHint } from "./styleFit.ts";

/**
 * Three-zone style-fit bar: sous-style | dans le style | au-dessus.
 *
 * The track is three equal thirds. The middle third is the BJCP
 * [min, max] window; each side third spans one range-width below / above
 * it, so the bar covers [min − width, max + width]. A needle marks the
 * current value (clamped to the bar's ends when it runs far out) and
 * takes the fit colour: green in-style, orange near, red out.
 *
 * Needs both bounds — a one-sided range (e.g. "≥ 4.5 %") renders nothing,
 * leaving the caller's colour + range text to carry the hint on its own.
 */
export function StyleGauge({ hint }: { hint: RangeHint }) {
  const t = useT();
  if (hint.min === undefined || hint.max === undefined) return null;
  const { min, max, current, status } = hint;
  const width = max - min;
  if (width <= 0) return null;

  // Position on a bar that runs [min − width, max + width] → 3 thirds.
  const pos = Math.min(1, Math.max(0, (current - (min - width)) / (width * 3)));
  const marker =
    status === "in"
      ? "bg-success"
      : status === "near"
      ? "bg-warning"
      : "bg-danger";
  const label =
    status === "in"
      ? t("recipe.style.in")
      : status === "near"
      ? t("recipe.style.near")
      : t("recipe.style.out");

  return (
    <div
      className="mt-2 relative h-2"
      role="img"
      aria-label={label}
      title={label}
      data-testid="style-gauge"
      data-status={status}
    >
      {/* track: sous · dans · sur, separated by hairline gaps */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex h-1 gap-px overflow-hidden rounded-full">
        <div className="flex-1 bg-border-strong" />
        <div className="flex-1 bg-success/40" />
        <div className="flex-1 bg-border-strong" />
      </div>
      {/* current-value needle */}
      <div
        className={`absolute top-0 h-2 w-[3px] -translate-x-1/2 rounded-full ${marker}`}
        style={{ left: `${pos * 100}%` }}
      />
    </div>
  );
}
