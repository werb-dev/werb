/**
 * Time-of-day + duration formatters used across the brew screen.
 * Locale-aware where the user's clock-display convention matters
 * (24h vs 12h), monospace-friendly H:MM:SS otherwise.
 */

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
