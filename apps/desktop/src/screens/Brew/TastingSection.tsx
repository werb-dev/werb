import { useState } from "react";
import type { SensoryAxes, Tasting } from "@werb/types";
import { useBcp47, useT } from "../../data/preferences.tsx";
import { EMPTY_AXES, SENSORY_AXES, SensoryRadar } from "../../components/SensoryRadar.tsx";
import { Section } from "./Section.tsx";

/**
 * Sensory tasting block at the bottom of the Brew screen — radar +
 * star rating + chip tags + freeform notes. Renders in summary mode
 * when a tasting exists, an edit form otherwise. Removing a tasting
 * is destructive (no soft-delete; principle #6 — Git is the
 * timeline), so it asks for confirmation.
 *
 * The first five tag chips appear as suggestions on the empty state
 * to give the brewer a head start; everything else is freeform.
 */
const TAG_SUGGESTION_KEYS = [
  "tasting.suggest.best",
  "tasting.suggest.too_bitter",
  "tasting.suggest.too_sweet",
  "tasting.suggest.low_body",
  "tasting.suggest.high_carb",
];

export function TastingSection({
  tasting,
  onSave,
}: {
  tasting: Tasting | undefined;
  onSave: (t: Tasting | null) => void;
}) {
  // When a tasting already exists, render in summary mode; otherwise
  // open the form. "Edit" toggles back to the form with the saved
  // values preloaded.
  const [editing, setEditing] = useState(!tasting);
  const tr = useT();

  return (
    <Section title={tr("brew.tasting")}>
      {tasting && !editing ? (
        <TastingSummary
          tasting={tasting}
          onEdit={() => setEditing(true)}
          onClear={() => {
            if (confirm(tr("tasting.remove_confirm"))) {
              onSave(null);
            }
          }}
        />
      ) : (
        <TastingForm
          initial={tasting}
          onSave={(t) => {
            onSave(t);
            setEditing(false);
          }}
          onCancel={tasting ? () => setEditing(false) : undefined}
        />
      )}
    </Section>
  );
}

function TastingForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Tasting | undefined;
  onSave: (t: Tasting) => void;
  onCancel?: (() => void) | undefined;
}) {
  const tr = useT();
  const [axes, setAxes] = useState<SensoryAxes>(initial?.axes ?? EMPTY_AXES);
  const [rating, setRating] = useState<number>(initial?.overall_rating ?? 4);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");

  const addTag = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    if (tags.includes(t)) return;
    setTags([...tags, t]);
    setTagDraft("");
  };
  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const submit = () => {
    onSave({
      tasted_at: initial?.tasted_at ?? new Date().toISOString(),
      axes,
      overall_rating: rating,
      ...(notes.trim() && { notes: notes.trim() }),
      ...(tags.length > 0 && { tags }),
    });
  };

  return (
    <div className="rounded-xl bg-surface border border-border p-5 sm:p-6">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-start">
        <div className="space-y-3">
          {SENSORY_AXES.map((axis) => (
            <SliderRow
              key={axis.key}
              label={tr(axis.labelKey)}
              value={axes[axis.key]}
              onChange={(v) => setAxes({ ...axes, [axis.key]: v })}
            />
          ))}
        </div>
        <div className="flex justify-center md:justify-end">
          <SensoryRadar axes={axes} size={220} />
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-5 space-y-5">
        <div>
          <p className="text-caption uppercase tracking-widest text-text-muted mb-2">
            {tr("tasting.overall_rating")}
          </p>
          <StarRating value={rating} onChange={setRating} />
        </div>

        <div>
          <p className="text-caption uppercase tracking-widest text-text-muted mb-2">
            {tr("tasting.tags")}{" "}
            <span className="text-text-muted normal-case">{tr("tasting.tags_hint")}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => removeTag(tag)}
                title={tr("tasting.remove_tag")}
                className="px-3 py-1 rounded-pill bg-accent/20 text-accent text-caption font-medium hover:bg-accent/30 transition-colors"
              >
                {tag} <span aria-hidden className="ml-1 opacity-60">×</span>
              </button>
            ))}
            <input
              type="text"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag(tagDraft);
                }
              }}
              onBlur={() => addTag(tagDraft)}
              placeholder={tr("tasting.tag_placeholder")}
              className="flex-1 min-w-[10rem] bg-bg border border-border rounded-pill px-3 py-1 text-caption text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>
          {tags.length === 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {TAG_SUGGESTION_KEYS.map((key) => {
                const label = tr(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => addTag(label)}
                    className="px-3 py-1 rounded-pill bg-bg border border-border border-dashed text-caption text-text-muted hover:text-text hover:border-accent transition-colors"
                  >
                    + {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <p className="text-caption uppercase tracking-widest text-text-muted mb-2">
            {tr("tasting.notes")}
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder={tr("tasting.notes_placeholder")}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-body-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex flex-wrap gap-3 justify-end pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 rounded-lg bg-surface-raised border border-border text-body-sm font-medium text-text-muted hover:text-text transition-colors min-h-[40px]"
            >
              {tr("tasting.cancel")}
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            className="px-5 py-2.5 rounded-lg bg-accent text-bg text-body-sm font-medium hover:opacity-90 transition-opacity min-h-[40px]"
          >
            {tr("tasting.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function TastingSummary({
  tasting,
  onEdit,
  onClear,
}: {
  tasting: Tasting;
  onEdit: () => void;
  onClear: () => void;
}) {
  const t = useT();
  const localeTag = useBcp47();
  return (
    <div className="rounded-xl bg-surface border border-border p-5 sm:p-6">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-start">
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <StarRating value={tasting.overall_rating} readOnly />
            <p className="font-mono text-caption text-text-muted">
              {new Date(tasting.tasted_at).toLocaleDateString(localeTag, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>

          {tasting.tags && tasting.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {tasting.tags.map((t) => (
                <span
                  key={t}
                  className="px-3 py-1 rounded-pill bg-accent/15 text-accent text-caption font-medium"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {tasting.notes && (
            <p className="mt-4 text-body-sm text-text whitespace-pre-wrap">
              {tasting.notes}
            </p>
          )}

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={onEdit}
              className="px-4 py-2 rounded-lg bg-surface-raised border border-border text-body-sm font-medium hover:border-accent hover:text-accent transition-colors"
            >
              {t("tasting.edit")}
            </button>
            <button
              type="button"
              onClick={onClear}
              className="px-4 py-2 rounded-lg text-caption text-text-muted hover:text-danger transition-colors"
            >
              {t("tasting.remove")}
            </button>
          </div>
        </div>

        <div className="flex justify-center md:justify-end">
          <SensoryRadar axes={tasting.axes} size={200} />
        </div>
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="grid grid-cols-[5rem_1fr_2.5rem] items-center gap-3">
      <span className="text-caption uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={5}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
      <span className="font-mono text-body-sm tabular-nums text-right">
        {value.toFixed(1)}
      </span>
    </label>
  );
}

function StarRating({
  value,
  onChange,
  readOnly,
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
}) {
  const t = useT();
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={t("brew.tasting.aria_rating")}>
      {stars.map((n) => {
        const filled = n <= value;
        const className = `text-h3 leading-none transition-colors ${
          filled ? "text-accent" : "text-text-muted"
        } ${readOnly ? "" : "hover:text-accent cursor-pointer"}`;
        if (readOnly) {
          return (
            <span key={n} aria-hidden className={className}>
              ★
            </span>
          );
        }
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange?.(n)}
            className={className}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}
