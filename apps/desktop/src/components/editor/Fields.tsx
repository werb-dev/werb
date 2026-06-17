import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  steppers = false,
  className,
}: {
  value: number;
  unit: string;
  onChange: (v: number) => void;
  step?: number;
  /** Show −/+ buttons that nudge the value by `step` (clamped ≥ 0). */
  steppers?: boolean;
  className?: string;
}) {
  const t = useT();
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

  // Nudge by one step. Round to the step grid so repeated clicks don't
  // accumulate float drift (0.05 + 0.05 + … → 0.15000000002).
  const nudge = (dir: 1 | -1) => {
    const next = Math.max(0, roundForStep(value + dir * step, step));
    setText(formatForStep(next, step));
    onChange(next);
  };

  const stepBtn =
    "shrink-0 w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-accent hover:bg-surface-raised transition-colors select-none";

  return (
    <div
      className={`flex items-baseline gap-1 border-b border-transparent px-1 py-1 focus-within:border-accent hover:border-border transition-colors min-w-0 ${className ?? ""}`}
    >
      {steppers && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={t("editor.stepper.decrement")}
          onClick={() => nudge(-1)}
          className={stepBtn}
        >
          −
        </button>
      )}
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
      {steppers && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={t("editor.stepper.increment")}
          onClick={() => nudge(1)}
          className={stepBtn}
        >
          +
        </button>
      )}
    </div>
  );
}

/**
 * Local-text-buffer behaviour for boxed `type="number"` inputs. Without it a
 * controlled `value={number}` snaps an emptied field back to "0" mid-edit
 * (clear the box → onChange(0) → it re-renders as "0", so you can't retype
 * cleanly). Buffering the raw text and only resyncing from the prop while
 * unfocused lets the field sit empty while you retype, then reformat on blur.
 * Spread the result onto an input: `<input type="number" {...useNumericText(v, commit)} />`.
 */
export function useNumericText(
  value: number,
  commit: (n: number) => void,
  // What an emptied field commits. Defaults to 0; pass NaN for fields where
  // "blank" means "no reading" (e.g. brew-day measurements) rather than zero.
  opts: { emptyValue?: number } = {},
) {
  const emptyValue = opts.emptyValue ?? 0;
  const fmt = (n: number) => (Number.isFinite(n) ? String(n) : "");
  const [text, setText] = useState<string>(() => fmt(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(fmt(value));
  }, [value, focused]);
  return {
    value: text,
    onFocus: () => setFocused(true),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setText(raw);
      if (raw.trim() === "") {
        commit(emptyValue);
        return;
      }
      const n = parseLocaleNumber(raw);
      commit(Number.isFinite(n) ? n : emptyValue);
    },
    onBlur: () => {
      setFocused(false);
      if (text.trim() === "") {
        setText(fmt(emptyValue));
        return;
      }
      const n = parseLocaleNumber(text);
      setText(Number.isFinite(n) ? String(n) : fmt(emptyValue));
    },
  };
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

/**
 * Up / down controls to reorder a row within its section. Disabled at the
 * ends so the brewer can't move the first row up or the last row down.
 */
export function RowReorder({
  index,
  count,
  onMove,
}: {
  index: number;
  count: number;
  onMove: (dir: -1 | 1) => void;
}) {
  const t = useT();
  const cls =
    "w-6 h-7 rounded-pill flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-raised transition-colors disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-text-muted";
  return (
    <>
      <button
        type="button"
        onClick={() => onMove(-1)}
        disabled={index === 0}
        title={t("editor.row.move_up")}
        aria-label={t("editor.row.move_up")}
        className={cls}
      >
        ↑
      </button>
      <button
        type="button"
        onClick={() => onMove(1)}
        disabled={index === count - 1}
        title={t("editor.row.move_down")}
        aria-label={t("editor.row.move_down")}
        className={cls}
      >
        ↓
      </button>
    </>
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
  steppers = false,
  className,
}: {
  valueKg: number;
  onChangeKg: (kg: number) => void;
  steppers?: boolean;
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
      steppers={steppers}
      onChange={(v) => onChangeKg(userMassLargeToKg(v, prefs))}
    />
  );
}

export function MassSmallInlineInput({
  valueG,
  onChangeG,
  steppers = false,
  className,
}: {
  valueG: number;
  onChangeG: (g: number) => void;
  steppers?: boolean;
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
      steppers={steppers}
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
  renderItem: (item: T, query: string) => React.ReactNode;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  // Anchor coords (viewport-relative) for the portalled popup. Updated
  // on focus + on scroll/resize so the menu tracks the input even when
  // an ancestor scrolls. Rendering the menu as a child of <body> via
  // a portal sidesteps section cards' `overflow-hidden`/rounded
  // corners that used to clip the popup on small screens.
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null);

  // Suggest on focus regardless of whether the field has text yet —
  // catalog search returns the full list for an empty query, giving
  // the brewer a scrollable browse list when they don't know what to
  // type yet.
  const items = focused ? suggest(value) : [];

  useLayoutEffect(() => {
    if (!focused) return;
    const update = () => {
      const el = inputRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setAnchor({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    update();
    // Capture phase catches scrolls inside any ancestor — passive for
    // touch perf since we only read coordinates, never preventDefault.
    window.addEventListener("scroll", update, { capture: true, passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, { capture: true });
      window.removeEventListener("resize", update);
    };
  }, [focused]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
        {...(placeholder !== undefined && { placeholder })}
        {...(autoFocus && { autoFocus: true })}
        className="w-full bg-transparent border-b border-transparent px-1 py-1 text-body text-text placeholder:text-text-muted focus:outline-none focus:border-accent hover:border-border transition-colors min-w-0"
      />
      {focused &&
        items.length > 0 &&
        anchor &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            data-testid="combobox-menu"
            style={{
              position: "fixed",
              top: anchor.top,
              left: anchor.left,
              width: Math.max(anchor.width, 280),
              maxHeight: "20rem",
              zIndex: 60,
            }}
            className="overflow-auto bg-surface-raised border border-border rounded-lg shadow-xl"
          >
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
                {renderItem(item, value)}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
