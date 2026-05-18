import { SensoryRadar } from "../../components/SensoryRadar.tsx";
import { useRecipeTastings } from "../../hooks/useBrewLog.ts";
import { Section } from "./Section.tsx";

/**
 * Surfaces the most recent tasting recorded for any session of this
 * recipe. The radar gives the brewer a visual feel for the last brew's
 * profile; the tags + notes hint at what to tweak before the next one.
 *
 * Stays hidden when no tasting exists yet — empty state would just be
 * noise on a recipe that hasn't been brewed-and-tasted.
 */
export function TastingCard({ recipeId }: { recipeId: string }) {
  const { tastings, loading } = useRecipeTastings(recipeId);
  if (loading) return null;
  if (tastings.length === 0) return null;
  const latest = tastings[0]!;

  return (
    <Section
      title="Last tasting"
      subtitle={
        tastings.length > 1
          ? `Most recent of ${tastings.length} tastings across this recipe`
          : undefined
      }
    >
      <div className="rounded-xl bg-surface border border-border p-5 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-start">
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div className="flex gap-1" aria-label={`${latest.tasting.overall_rating} of 5 stars`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    aria-hidden
                    className={`text-h3 leading-none ${
                      n <= latest.tasting.overall_rating ? "text-accent" : "text-text-muted"
                    }`}
                  >
                    ★
                  </span>
                ))}
              </div>
              <p className="font-mono text-caption text-text-muted">
                {new Date(latest.tasting.tasted_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>

            {latest.tasting.tags && latest.tasting.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {latest.tasting.tags.map((t) => (
                  <span
                    key={t}
                    className="px-3 py-1 rounded-pill bg-accent/15 text-accent text-caption font-medium"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            {latest.tasting.notes && (
              <p className="mt-4 text-body-sm text-text whitespace-pre-wrap">
                {latest.tasting.notes}
              </p>
            )}
          </div>

          <div className="flex justify-center md:justify-end">
            <SensoryRadar axes={latest.tasting.axes} size={200} />
          </div>
        </div>
      </div>
    </Section>
  );
}
