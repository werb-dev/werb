import { useT } from "../../data/preferences.tsx";
import { formatMassSmall, type UnitPreferences } from "../../data/units-format.ts";
import { usePersistedJson } from "../../storage/index.ts";
import type { BoilHop } from "../Brew.tsx";
import { formatDuration } from "./format.ts";

/**
 * Boil-step companion: lists the recipe's hop additions in order of
 * boil time, highlights the next one with an "Add now" callout when
 * it's due, and lets the brewer mark each as added. Per-hop state
 * persists via the StorageBackend so it survives a navigation away
 * and back during the boil.
 */
export function HopSchedule({
  hops,
  boilDurationMin,
  elapsedSec,
  storageKey,
  prefs,
}: {
  hops: BoilHop[];
  boilDurationMin: number;
  elapsedSec: number;
  storageKey: string;
  prefs: UnitPreferences;
}) {
  const t = useT();
  const [addedArr, setAddedArr] = usePersistedJson<number[]>(storageKey, []);
  const added = new Set(addedArr);
  const toggle = (i: number) => {
    setAddedArr((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return [...next];
    });
  };

  // Sort by addition order (earliest first). BeerXML TIME=X means "X min
  // before flameout" → addition at minute (boilDuration - X) of the boil.
  const events = hops
    .map((h, originalIndex) => ({
      ...h,
      originalIndex,
      additionAtMin: Math.max(0, boilDurationMin - h.time_min),
    }))
    .sort((a, b) => a.additionAtMin - b.additionAtMin);

  // The "next" highlight is the earliest unmarked addition — once
  // it's marked added, the highlight moves to the next one.
  const nextIdx = events.findIndex((e) => !added.has(e.originalIndex));
  const nextEvent = nextIdx >= 0 ? events[nextIdx] : undefined;
  const nextRemainingSec = nextEvent ? nextEvent.additionAtMin * 60 - elapsedSec : 0;
  const nextDue = nextEvent !== undefined && nextRemainingSec <= 0;

  return (
    <div className="rounded-lg bg-bg border border-border p-4">
      <p className="text-caption uppercase tracking-widest text-text-muted mb-3">
        {t("brew.hops.title")}
      </p>
      {nextEvent && (
        <div
          className={`mb-3 px-3 py-3 rounded-lg border ${
            nextDue
              ? "bg-accent/15 border-accent/60"
              : "bg-accent/5 border-accent/30"
          }`}
        >
          <p className="text-caption uppercase tracking-widest text-accent mb-1">
            {t("brew.hops.next_label")}
          </p>
          <p className="text-body font-medium">
            {formatMassSmall({ value: nextEvent.amount_g, unit: "g" }, prefs).display}{" "}
            {nextEvent.name}
          </p>
          <p className="font-mono text-caption text-text-muted mt-0.5">
            {nextDue
              ? t("brew.hops.add_now")
              : t("brew.hops.in_duration", { duration: formatDuration(nextRemainingSec) })}
            {" · "}
            {t("brew.hops.at_min", { min: nextEvent.additionAtMin })}
          </p>
        </div>
      )}
      <ul className="space-y-2">
        {events.map((h, i) => {
          const isAdded = added.has(h.originalIndex);
          const additionAtSec = h.additionAtMin * 60;
          const remainingSec = additionAtSec - elapsedSec;
          const due = !isAdded && remainingSec <= 0;
          const isNext = !isAdded && i === nextIdx;
          return (
            <li
              key={h.originalIndex}
              className={`flex items-center justify-between gap-3 sm:gap-4 px-2 py-2 rounded ${
                isNext && due ? "bg-accent/10 ring-1 ring-accent/40" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p
                  className={`text-body-sm font-medium break-words ${
                    isAdded ? "text-text-muted line-through" : "text-text"
                  }`}
                >
                  {formatMassSmall({ value: h.amount_g, unit: "g" }, prefs).display} {h.name}
                  {h.alpha_acid_pct > 0 && (
                    <span className="text-text-muted font-mono text-caption ml-2">
                      {h.alpha_acid_pct.toFixed(1)}% AA
                    </span>
                  )}
                </p>
                {h.notes && (
                  <p className="text-caption text-text-muted mt-0.5">{h.notes}</p>
                )}
                <p className="font-mono text-caption text-text-muted mt-0.5">
                  {t("brew.hops.at_min", { min: h.additionAtMin })}
                  {!isAdded && !due &&
                    ` · ${t("brew.hops.in_duration", { duration: formatDuration(remainingSec) })}`}
                </p>
              </div>
              <button
                onClick={() => toggle(h.originalIndex)}
                title={isAdded ? t("brew.hops.tap_to_undo") : t("brew.hops.tap_when_added")}
                className={`shrink-0 px-3 py-2 sm:py-1.5 rounded-pill border text-caption font-medium transition-colors min-h-[36px] ${
                  isAdded
                    ? "border-success text-success bg-success/10 hover:bg-success/20"
                    : due
                    ? "border-accent text-accent bg-accent/10 hover:bg-accent/20"
                    : "border-border text-text-muted hover:border-border-strong hover:text-text"
                }`}
              >
                {isAdded ? t("brew.hops.added") : t("brew.hops.mark_added")}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
