import { useEffect, useState } from "react";
import { useT, useUnits } from "../../data/preferences.tsx";
import {
  celsiusToUserTemp,
  colorUnitLabel,
  kgToUserMassLarge,
  kgToUserMassSmall,
  litersToUserVolume,
  massLargeUnitLabel,
  massSmallUnitLabel,
  srmToUserColor,
  tempUnitLabel,
  userColorToSrm,
  userMassLargeToKg,
  userMassSmallToG,
  userTempToCelsius,
  userVolumeToLiters,
  volumeUnitLabel,
} from "../../data/units-format.ts";

/**
 * Inline form primitives + unit-aware wrappers + typeahead Combobox.
 * These were inline in RecipeEditor.tsx (~400 lines); extracted so the
 * editor file stays focused on what *changes* per ingredient kind and
 * the primitives can be tested or restyled in one place.
 *
 * Domain-specific inputs (HopTimeInlineInput, anything reading HOP_USES /
 * MISC_USES / culture amounts) stay in RecipeEditor — they would just
 * drag the BeerJSON adapter dependency along.
 */

// ─── Number-typing helpers ────────────────────────────────────────────

export function decimalsForStep(step: number): number {
  if (step >= 1) return 0;
  if (step >= 0.1) return 1;
  if (step >= 0.01) return 2;
  if (step >= 0.001) return 3;
  return 4;
}

export function roundForStep(value: number, step: number): number {
  const f = 10 ** decimalsForStep(step);
  return Math.round(value * f) / f;
}

/**
 * Parse a user-typed string that may use either "." or "," as the
 * decimal separator (browsers localise <input type="number"> display,
 * but we use type="text" so we must accept both).
 */
export function parseLocaleNumber(s: string): number {
  const cleaned = s.replace(/\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

export function formatForStep(value: number, step: number): string {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(decimalsForStep(step));
}

// ─── Inline (table-cell) primitives ───────────────────────────────────

export function InlineInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-transparent border-b border-transparent px-1 py-1 text-body text-text placeholder:text-text-muted focus:outline-none focus:border-accent hover:border-border transition-colors min-w-0 ${className ?? ""}`}
    />
  );
}

export function InlineNumber({
  value,
  unit,
  onChange,
  step = 1,
  className,
}: {
  value: number;
  unit: string;
  onChange: (v: number) => void;
  step?: number;
  className?: string;
}) {
  // Local text buffer so the user can freely type "1.", "1.5", "1.50"
  // without React stripping trailing zeros on every keystroke. We resync
  // from the prop only when not focused — that way an external change
  // (row reload, picker fill) reformats with the canonical decimal count,
  // but in-flight typing is preserved.
  const [text, setText] = useState(() => formatForStep(value, step));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(formatForStep(value, step));
  }, [value, step, focused]);

  return (
    <div
      className={`flex items-baseline gap-1 border-b border-transparent px-1 py-1 focus-within:border-accent hover:border-border transition-colors min-w-0 ${className ?? ""}`}
    >
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          const n = parseLocaleNumber(text);
          setText(formatForStep(Number.isFinite(n) ? n : 0, step));
        }}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseLocaleNumber(e.target.value);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        className="w-full bg-transparent text-body font-mono tabular-nums text-text focus:outline-none min-w-0 text-right"
      />
      <span className="text-caption font-mono text-text-muted shrink-0">{unit}</span>
    </div>
  );
}

export function InlineSelect({
  value,
  onChange,
  options,
  labels,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: Record<string, string>;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-transparent border-b border-transparent px-1 py-1 text-body text-text focus:outline-none focus:border-accent hover:border-border transition-colors capitalize min-w-0 ${className ?? ""}`}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {labels?.[opt] ?? opt}
        </option>
      ))}
    </select>
  );
}

export function InlineDeleteButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      title={t("editor.row.delete")}
      className="w-7 h-7 rounded-pill flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
    >
      ×
    </button>
  );
}

export function AddRowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 w-full px-4 py-3 rounded-xl bg-surface border border-border border-dashed text-body-sm font-medium text-text-muted hover:text-text hover:border-accent transition-colors"
    >
      {label}
    </button>
  );
}

export function RowHeader({ cols }: { cols: { label: string; span: string }[] }) {
  return (
    <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-surface-raised text-caption uppercase tracking-widest text-text-muted border-b border-border min-w-[720px] md:min-w-0">
      {cols.map((c, i) => (
        <div key={i} className={c.span}>
          {c.label}
        </div>
      ))}
    </div>
  );
}

// ─── Unit-aware wrappers ──────────────────────────────────────────────
//
// Show the canonical-stored value (kg / L / °C / SRM) in the user's
// preferred unit (lb / gal / °F / EBC), and reverse the conversion on
// edit. Decimals scale with step so kg-vs-lb conversion noise stays
// invisible to the brewer.

export function MassLargeInlineInput({
  valueKg,
  onChangeKg,
  className,
}: {
  valueKg: number;
  onChangeKg: (kg: number) => void;
  className?: string;
}) {
  const prefs = useUnits();
  // 50 g feels right in metric (typical fermentable bumping); lb prefers
  // 0.1 lb increments. Either way we keep the increment visible in the
  // displayed unit.
  const step = prefs.mass === "lb" ? 0.1 : 0.05;
  return (
    <InlineNumber
      {...(className !== undefined && { className })}
      value={roundForStep(kgToUserMassLarge(valueKg, prefs), step)}
      unit={massLargeUnitLabel(prefs)}
      step={step}
      onChange={(v) => onChangeKg(userMassLargeToKg(v, prefs))}
    />
  );
}

export function MassSmallInlineInput({
  valueG,
  onChangeG,
  className,
}: {
  valueG: number;
  onChangeG: (g: number) => void;
  className?: string;
}) {
  const prefs = useUnits();
  // Hops: brewers think in whole grams (or 0.1 oz). 1 g ≈ 0.035 oz so the
  // imperial increment is finer; that matches the typical hop bag precision.
  const step = prefs.mass === "lb" ? 0.1 : 1;
  const display =
    prefs.mass === "lb" ? kgToUserMassSmall(valueG / 1000, prefs) : valueG;
  return (
    <InlineNumber
      {...(className !== undefined && { className })}
      value={roundForStep(display, step)}
      unit={massSmallUnitLabel(prefs)}
      step={step}
      onChange={(v) =>
        onChangeG(prefs.mass === "lb" ? userMassSmallToG(v, prefs) : v)
      }
    />
  );
}

export function VolumeInlineInput({
  valueL,
  onChangeL,
  className,
}: {
  valueL: number;
  onChangeL: (l: number) => void;
  className?: string;
}) {
  const prefs = useUnits();
  const step = prefs.volume === "gal" ? 0.1 : 0.5;
  return (
    <InlineNumber
      {...(className !== undefined && { className })}
      value={roundForStep(litersToUserVolume(valueL, prefs), step)}
      unit={volumeUnitLabel(prefs)}
      step={step}
      onChange={(v) => onChangeL(userVolumeToLiters(v, prefs))}
    />
  );
}

export function TempInlineInput({
  valueC,
  onChangeC,
  className,
}: {
  valueC: number;
  onChangeC: (c: number) => void;
  className?: string;
}) {
  const prefs = useUnits();
  return (
    <InlineNumber
      {...(className !== undefined && { className })}
      value={roundForStep(celsiusToUserTemp(valueC, prefs), 1)}
      unit={tempUnitLabel(prefs)}
      step={1}
      onChange={(v) => onChangeC(userTempToCelsius(v, prefs))}
    />
  );
}

export function ColorInlineInput({
  valueSrm,
  onChangeSrm,
  className,
}: {
  valueSrm: number;
  onChangeSrm: (srm: number) => void;
  className?: string;
}) {
  const prefs = useUnits();
  // SRM jumps in half-points; EBC is roughly 2× SRM so whole-unit
  // increments are about the same perceptual change.
  const step = prefs.color === "EBC" ? 1 : 0.5;
  return (
    <InlineNumber
      {...(className !== undefined && { className })}
      value={roundForStep(srmToUserColor(valueSrm, prefs), step)}
      unit={colorUnitLabel(prefs)}
      step={step}
      onChange={(v) => onChangeSrm(userColorToSrm(v, prefs))}
    />
  );
}

// ─── Typeahead Combobox ───────────────────────────────────────────────

export function Combobox<T>({
  value,
  onChange,
  suggest,
  onPick,
  renderItem,
  placeholder,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  suggest: (query: string) => T[];
  onPick: (item: T) => void;
  renderItem: (item: T) => React.ReactNode;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  // Suggest on focus regardless of whether the field has text yet —
  // catalog search returns the top N for an empty query, giving the
  // brewer a browse list when they don't know what to type yet.
  const items = focused ? suggest(value) : [];

  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
        {...(placeholder !== undefined && { placeholder })}
        {...(autoFocus && { autoFocus: true })}
        className="w-full bg-transparent border-b border-transparent px-1 py-1 text-body text-text placeholder:text-text-muted focus:outline-none focus:border-accent hover:border-border transition-colors min-w-0"
      />
      {items.length > 0 && (
        <div className="absolute top-full left-0 z-50 min-w-[22rem] max-h-80 overflow-auto bg-surface-raised border border-border rounded-lg shadow-xl mt-1">
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(item);
                setFocused(false);
              }}
              className="block w-full text-left px-3 py-2 hover:bg-surface focus:bg-surface border-b border-border last:border-b-0"
            >
              {renderItem(item)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
