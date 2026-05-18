/**
 * Time-of-day + duration formatters used across the brew screen.
 * Locale-aware where the user's clock-display convention matters
 * (24h vs 12h), monospace-friendly H:MM:SS otherwise.
 */

import type { SessionStep } from "@werb/types";

type Translator = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Human-readable title for a brew session step. Pulls the
 * `brew.kind.<kind>` translation for the canonical kinds and falls
 * back to the stored label only when the brewer (or the recipe)
 * has named the step explicitly — a custom mash step like "Sacc
 * rest" or the strain names appended to a pitch step.
 *
 * Sessions written before the recipe-to-session writer stopped
 * baking English defaults will still have label="Sparge" or
 * "Heat strike water". Those slip through verbatim; new sessions
 * carry an empty label and rely on the translation.
 */
export function stepTitle(step: Pick<SessionStep, "kind" | "label">, t: Translator): string {
  const kindLabel = t(`brew.kind.${step.kind}`);
  const label = step.label?.trim();
  if (!label) return kindLabel;
  // For pitch we want "Pitch · WLP001" so the strain names land
  // beside the translated kind. Mash custom names ("Sacc rest")
  // replace the kind entirely.
  if (step.kind === "ferment_pitch") return `${kindLabel} · ${label}`;
  return label;
}

export function formatTimeOfDay(iso: string, localeTag: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" });
}

export function formatDuration(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? "-" : "";
  const t = Math.abs(totalSeconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) return `${sign}${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${sign}${m}:${String(s).padStart(2, "0")}`;
}
