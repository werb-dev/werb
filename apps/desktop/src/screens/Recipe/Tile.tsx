import { StyleGauge } from "./StyleGauge.tsx";
import type { RangeHint } from "./styleFit.ts";

export type { RangeHint } from "./styleFit.ts";

/**
 * Recipe-screen header tile. Renders a single metric with optional
 * subtitle, optional BJCP-range hint, and three colour rules:
 *  - `warn`: claimed-vs-computed disagreement (always wins);
 *  - `highlight`: brand accent for totals / hero numbers;
 *  - `styleHint`: green / orange / red by BJCP fit when no warn / highlight.
 * When a style hint is present, the range text is followed by a
 * sous / dans / sur gauge marking where the value lands.
 */
export function Tile({
  label,
  value,
  sub,
  highlight,
  warn,
  styleHint,
  testId,
}: {
  label: string;
  value: string;
  sub?: string | undefined;
  highlight?: boolean | undefined;
  warn?: boolean | undefined;
  styleHint?: RangeHint | null | undefined;
  testId?: string | undefined;
}) {
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
    <div
      className="bg-surface px-2 py-2 sm:px-4 sm:py-3"
      {...(testId && { "data-testid": testId })}
    >
      <p className="text-[10px] sm:text-caption uppercase tracking-widest text-text-muted">{label}</p>
      <p className={`font-mono text-body sm:text-h3 mt-1 tabular-nums ${valueColor}`}>{value}</p>
      {sub && (
        <p className={`font-mono text-[10px] sm:text-caption mt-1 ${warn ? "text-warning" : "text-text-muted"}`}>
          {sub}
        </p>
      )}
      {styleHint && (
        <>
          <p className="font-mono text-[10px] sm:text-caption mt-1 text-text-muted">{styleHint.range}</p>
          <StyleGauge hint={styleHint} />
        </>
      )}
    </div>
  );
}
