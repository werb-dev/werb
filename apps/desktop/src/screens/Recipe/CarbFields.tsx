/**
 * Boxed-input + stat-tile components used by the lower Recipe-screen
 * sections (yeast pitch, water chemistry, carbonation, cost).
 * Distinct from the inline editor primitives — these draw a visible
 * border and live in standalone form rows, not table cells.
 */

import { useNumericText } from "../../components/editor/Fields.tsx";

export function CarbField({
  label,
  unit,
  value,
  step,
  onChange,
  hint,
}: {
  label: string;
  unit: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-caption uppercase tracking-widest text-text-muted mb-1">
        {label}
      </span>
      <div className="flex items-baseline gap-1 bg-bg border border-border rounded-lg px-3 py-2 focus-within:border-accent">
        <input
          type="number"
          step={step}
          {...useNumericText(value, onChange)}
          className="w-full bg-transparent text-body font-mono tabular-nums text-text focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-caption font-mono text-text-muted shrink-0">{unit}</span>
      </div>
      {hint && <span className="block text-caption text-text-muted mt-1">{hint}</span>}
    </label>
  );
}

export function CarbStat({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div className="bg-surface-raised border border-border rounded-lg px-4 py-3">
      <p className="text-caption uppercase tracking-widest text-text-muted">{label}</p>
      <p className={`font-mono text-h3 mt-1 ${warn ? "text-warning" : "text-text"}`}>
        {value}
      </p>
      {sub && <p className="text-caption text-text-muted mt-1">{sub}</p>}
    </div>
  );
}

export function CarbResult({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: string;
}) {
  const display = value > 0 ? `${value.toFixed(0)} g` : "—";
  return (
    <div className="bg-surface px-3 py-3 sm:px-5 sm:py-4">
      <p className="text-[10px] sm:text-caption uppercase tracking-widest text-text-muted">{label}</p>
      <p className="font-mono text-body sm:text-h3 mt-1 text-text">{display}</p>
      <p className="font-mono text-caption mt-1 text-text-muted">{note}</p>
    </div>
  );
}
