import { useState } from "react";
import type { Measurement, WerbSession } from "@werb/types";
import { useBcp47, useT } from "../../data/preferences.tsx";
import { Section } from "./Section.tsx";
import { formatTimeOfDay } from "./format.ts";

/**
 * Each measurement kind ships a sensible default value so the input
 * resets to a brewer-recognisable number after every log — keeps a
 * stale 67°C from sitting in a gravity field after the user just
 * switched kinds.
 */
// The display label for each kind comes from `t("brew.meas.kind.${k.kind}")`
// at render time — no English label here.
const MEASUREMENT_KINDS: Array<{
  kind: Measurement["kind"];
  unit: string;
  step: number;
  defaultValue: number;
}> = [
  { kind: "gravity_sg", unit: "SG", step: 0.001, defaultValue: 1.05 },
  { kind: "temperature_c", unit: "°C", step: 0.5, defaultValue: 67 },
  { kind: "ph", unit: "", step: 0.01, defaultValue: 5.4 },
  { kind: "volume_l", unit: "L", step: 0.5, defaultValue: 25 },
  { kind: "abv_pct", unit: "%", step: 0.1, defaultValue: 5.5 },
];

export function MeasurementsSection({
  session,
  onAdd,
  onRemove,
  disabled,
}: {
  session: WerbSession;
  onAdd: (m: Omit<Measurement, "at">) => void;
  onRemove: (at: string) => void;
  disabled: boolean;
}) {
  const [kind, setKind] = useState<Measurement["kind"]>("gravity_sg");
  const spec = MEASUREMENT_KINDS.find((k) => k.kind === kind)!;
  const [value, setValue] = useState<number>(spec.defaultValue);
  const [notes, setNotes] = useState("");
  const localeTag = useBcp47();

  // Re-seed value when kind changes so the input is sensible for the
  // new unit (e.g. switching gravity → temperature shouldn't leave
  // 1.050 in a °C field).
  const onKindChange = (k: Measurement["kind"]) => {
    setKind(k);
    const next = MEASUREMENT_KINDS.find((x) => x.kind === k)!;
    setValue(next.defaultValue);
  };

  const measurements = session.measurements ?? [];
  const stepLabel = (stepId: string | undefined) => {
    if (!stepId) return null;
    const step = session.steps.find((s) => s.id === stepId);
    return step?.label ?? null;
  };
  const t = useT();

  const submit = () => {
    if (!Number.isFinite(value)) return;
    onAdd({ kind, value, ...(notes.trim() && { notes: notes.trim() }) });
    setValue(spec.defaultValue);
    setNotes("");
  };

  return (
    <Section title={t("brew.measurements")}>
      {!disabled && (
        <div className="rounded-xl bg-surface border border-border p-4 mb-4">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-end gap-3">
            <label className="col-span-1 sm:flex-1 sm:min-w-[10rem]">
              <span className="block text-caption uppercase tracking-widest text-text-muted mb-1">
                {t("brew.meas.reading")}
              </span>
              <select
                value={kind}
                onChange={(e) => onKindChange(e.target.value as Measurement["kind"])}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-body text-text focus:outline-none focus:border-accent"
              >
                {MEASUREMENT_KINDS.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {t(`brew.meas.kind.${k.kind}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="col-span-1 sm:flex-1 sm:min-w-[8rem]">
              <span className="block text-caption uppercase tracking-widest text-text-muted mb-1">
                {t("brew.meas.value")}{spec.unit && ` (${spec.unit})`}
              </span>
              <input
                type="number"
                step={spec.step}
                value={Number.isFinite(value) ? value : ""}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setValue(Number.isFinite(n) ? n : NaN);
                }}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-body font-mono tabular-nums text-text focus:outline-none focus:border-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
            </label>
            <label className="col-span-2 sm:flex-[2] sm:min-w-[12rem]">
              <span className="block text-caption uppercase tracking-widest text-text-muted mb-1">
                {t("brew.meas.notes")}
              </span>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("brew.meas.notes_placeholder")}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-body text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            </label>
            <button
              type="button"
              onClick={submit}
              disabled={!Number.isFinite(value)}
              className="col-span-2 sm:col-auto w-full sm:w-auto px-5 py-2.5 sm:py-2 rounded-lg bg-accent text-bg text-body-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px]"
            >
              {t("brew.meas.log")}
            </button>
          </div>
        </div>
      )}

      {measurements.length === 0 ? (
        <p className="text-body-sm text-text-muted px-4">
          {disabled ? t("brew.meas.empty_disabled") : t("brew.meas.empty_active")}
        </p>
      ) : (
        <ul className="rounded-xl bg-surface border border-border divide-y divide-border">
          {measurements.map((m) => {
            const k = MEASUREMENT_KINDS.find((x) => x.kind === m.kind);
            const label = k ? t(`brew.meas.kind.${k.kind}`) : m.kind;
            const unit = k?.unit ?? "";
            const valStr =
              m.kind === "gravity_sg"
                ? m.value.toFixed(3)
                : m.kind === "ph"
                ? m.value.toFixed(2)
                : m.value.toFixed(1);
            const stepName = stepLabel(m.step_id);
            return (
              <li
                key={m.at}
                className="px-4 py-3 flex items-baseline justify-between gap-3 sm:gap-4 hover:bg-surface-raised/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-body-sm text-text">
                    <span className="text-text-muted">{label}</span>{" "}
                    <span className="font-mono tabular-nums text-text">
                      {valStr}
                      {unit && ` ${unit}`}
                    </span>
                    {stepName && (
                      <span className="text-caption text-text-muted ml-2">
                        {t("brew.meas.during", { step: stepName })}
                      </span>
                    )}
                  </p>
                  {m.notes && (
                    <p className="text-caption text-text-muted mt-0.5">{m.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-caption text-text-muted font-mono tabular-nums">
                    {formatTimeOfDay(m.at, localeTag)}
                  </span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => onRemove(m.at)}
                      title={t("brew.meas.delete")}
                      className="w-7 h-7 rounded-pill flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                    >
                      ×
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
