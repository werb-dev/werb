import { useMemo } from "react";
import {
  isMass,
  recipeToWaterInput,
  toGrams,
  toKilograms,
  toMinutes,
  type BeerJsonRecipe,
} from "@werb/adapters";
import type { SessionStep, WaterOutput } from "@werb/types";
import { computeWater } from "@werb/calc";
import { useBrewSession, useScreenWakeLock, useTick } from "../hooks/useBrewSession.ts";
import { profileToWaterOverrides, type ProfileWithId } from "../data/equipment.ts";

interface BrewScreenProps {
  recipeId: string;
  recipe: BeerJsonRecipe;
  activeProfile?: ProfileWithId | undefined;
  onBack: () => void;
}

interface BoilHop {
  name: string;
  amount_g: number;
  alpha_acid_pct: number;
  time_min: number;
  notes: string | undefined;
}

interface BrewContext {
  water: WaterOutput;
  totalGrainKg: number;
  totalMashedKg: number;
  boilHops: BoilHop[];
  cultures: BeerJsonRecipe["ingredients"]["culture_additions"];
  hltFit: HltFit | null;
  kettleFit: KettleFit | null;
}

/**
 * Verdict on whether the HLT can hold the planned water.
 *
 * The brewer heats strike water first, drains it to the mash tun, then heats
 * sparge water in the same vessel. So the binding constraint is the *larger*
 * of the two volumes, not their sum — a combined check is informational only.
 */
type HltFit =
  | { kind: "ok" }
  | { kind: "two_heats"; strikeL: number; spargeL: number; capacityL: number }
  | { kind: "overflow"; volumeL: number; capacityL: number; which: "strike" | "sparge" };

type KettleFit =
  | { kind: "ok" }
  | { kind: "overflow"; preBoilL: number; capacityL: number };

function checkHltFit(water: WaterOutput, profile: ProfileWithId | undefined): HltFit | null {
  const capacityL = profile?.hlt?.capacity_l;
  if (!capacityL || capacityL <= 0) return null;
  const usableL = capacityL - (profile.hlt?.dead_space_l ?? 0);
  const strikeL = water.mash_water_l;
  const spargeL = water.sparge_water_l;
  if (strikeL > usableL) return { kind: "overflow", volumeL: strikeL, capacityL: usableL, which: "strike" };
  if (spargeL > usableL) return { kind: "overflow", volumeL: spargeL, capacityL: usableL, which: "sparge" };
  if (strikeL + spargeL > usableL) return { kind: "two_heats", strikeL, spargeL, capacityL: usableL };
  return { kind: "ok" };
}

function checkKettleFit(water: WaterOutput, profile: ProfileWithId | undefined): KettleFit | null {
  const capacityL = profile?.kettle?.capacity_l;
  if (!capacityL || capacityL <= 0) return null;
  const usableL = capacityL - (profile.kettle?.dead_space_l ?? 0);
  const preBoilL = water.pre_boil_volume_l;
  if (preBoilL > usableL) return { kind: "overflow", preBoilL, capacityL: usableL };
  return { kind: "ok" };
}

export function BrewScreen({ recipeId, recipe, activeProfile, onBack }: BrewScreenProps) {
  const brew = useBrewSession(recipeId, recipe);
  const tick = useTick(1000);
  const wakeLockHeld = useScreenWakeLock(brew.session?.status === "in_progress");

  const ctx = useMemo<BrewContext>(() => {
    const water = computeWater(recipeToWaterInput(recipe, profileToWaterOverrides(activeProfile)));
    const fermentables = recipe.ingredients.fermentable_additions;
    const totalGrainKg = fermentables.reduce(
      (sum, f) => sum + (isMass(f.amount) ? toKilograms(f.amount) : 0),
      0,
    );
    const totalMashedKg = fermentables
      .filter((f) => f.type === "grain" && isMass(f.amount))
      .reduce((sum, f) => sum + toKilograms(f.amount as Parameters<typeof toKilograms>[0]), 0);
    const boilHops: BoilHop[] = (recipe.ingredients.hop_additions ?? [])
      .filter((h) => h.timing?.use === "add_to_boil")
      .map((h) => ({
        name: h.name,
        amount_g: isMass(h.amount) ? toGrams(h.amount) : 0,
        alpha_acid_pct: h.alpha_acid?.value ?? 0,
        time_min: h.timing?.time ? toMinutes(h.timing.time) : 0,
        notes: h.notes,
      }));
    const cultures = recipe.ingredients.culture_additions;
    const hltFit = checkHltFit(water, activeProfile);
    const kettleFit = checkKettleFit(water, activeProfile);
    return { water, totalGrainKg, totalMashedKg, boilHops, cultures, hltFit, kettleFit };
  }, [recipe, activeProfile]);

  if (!brew.session) {
    return <NoSession onBack={onBack} recipe={recipe} onStart={brew.start} />;
  }

  const { session, activeStep } = brew;

  return (
    <div className="min-h-dvh bg-bg text-text">
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Header
          recipe={recipe}
          session={session}
          wakeLockHeld={wakeLockHeld}
          onBack={onBack}
        />

        {ctx.hltFit && ctx.hltFit.kind !== "ok" && <HltFitBanner fit={ctx.hltFit} />}
        {ctx.kettleFit && ctx.kettleFit.kind !== "ok" && <KettleFitBanner fit={ctx.kettleFit} />}

        {activeStep ? (
          <ActiveStepCard
            step={activeStep}
            now={tick}
            ctx={ctx}
            onFinish={() => brew.finishStep(activeStep.id)}
          />
        ) : session.status === "completed" ? (
          <CompletedCard session={session} />
        ) : (
          <StartHint />
        )}

        <Section title="Timeline">
          <ol className="rounded-xl bg-surface border border-border divide-y divide-border">
            {session.steps.map((step) => (
              <TimelineRow
                key={step.id}
                step={step}
                now={tick}
                isActive={step.id === activeStep?.id}
                ctx={ctx}
                onStart={() => brew.startStep(step.id)}
                onFinish={() => brew.finishStep(step.id)}
                onNotes={(notes) => brew.setStepNotes(step.id, notes)}
                disabled={session.status === "completed"}
              />
            ))}
          </ol>
        </Section>

        <div className="mt-12 flex flex-wrap gap-3 justify-between">
          {session.status !== "completed" ? (
            <button
              onClick={brew.completeSession}
              className="px-5 py-3 rounded-lg bg-success text-bg text-body-sm font-medium hover:opacity-90 transition-opacity"
            >
              Complete session
            </button>
          ) : (
            <span className="text-body-sm text-text-muted">
              Brew session completed.
            </span>
          )}
          <button
            onClick={() => {
              if (
                confirm("Discard this brew session? All progress and notes will be lost.")
              ) {
                brew.abandon();
              }
            }}
            className="px-5 py-3 rounded-lg bg-surface-raised border border-border text-text-muted text-body-sm font-medium hover:text-danger hover:border-danger transition-colors"
          >
            Discard session
          </button>
        </div>
      </main>
    </div>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────

function Header({
  recipe,
  session,
  wakeLockHeld,
  onBack,
}: {
  recipe: BeerJsonRecipe;
  session: { status: string; started_at: string };
  wakeLockHeld: boolean;
  onBack: () => void;
}) {
  return (
    <header className="mb-10">
      <button
        onClick={onBack}
        className="text-caption font-medium text-text-muted hover:text-text transition-colors flex items-center gap-2"
      >
        <span aria-hidden>←</span> Recipe
      </button>
      <div className="mt-6 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-caption uppercase tracking-widest text-accent font-medium">
            Brew session · <StatusLabel status={session.status} />
          </p>
          <h1 className="text-h1 font-semibold mt-2 capitalize">
            {recipe.name.toLowerCase()}
          </h1>
          <p className="text-body-sm text-text-muted mt-2 font-mono">
            Started {new Date(session.started_at).toLocaleString()}
          </p>
        </div>
        <WakeLockBadge held={wakeLockHeld} />
      </div>
    </header>
  );
}

function HltFitBanner({ fit }: { fit: Exclude<HltFit, { kind: "ok" }> }) {
  if (fit.kind === "overflow") {
    const label = fit.which === "strike" ? "Strike water" : "Sparge water";
    return (
      <section className="mb-8 rounded-xl border border-danger bg-danger/10 px-5 py-4">
        <p className="text-caption uppercase tracking-widest text-danger font-medium">
          HLT too small
        </p>
        <p className="text-body-sm text-text mt-1">
          {label} ({fit.volumeL.toFixed(1)} L) exceeds your HLT usable capacity (
          {fit.capacityL.toFixed(1)} L). You can't heat this batch in one pass — split the
          heat or use a larger vessel.
        </p>
      </section>
    );
  }
  return (
    <section className="mb-8 rounded-xl border border-warning bg-warning/10 px-5 py-4">
      <p className="text-caption uppercase tracking-widest text-warning font-medium">
        Two-heat session
      </p>
      <p className="text-body-sm text-text mt-1">
        Strike ({fit.strikeL.toFixed(1)} L) + sparge ({fit.spargeL.toFixed(1)} L) =
        {" "}
        {(fit.strikeL + fit.spargeL).toFixed(1)} L exceeds your HLT capacity (
        {fit.capacityL.toFixed(1)} L). Heat strike first, drain to mash, then heat sparge.
      </p>
    </section>
  );
}

function KettleFitBanner({ fit }: { fit: Exclude<KettleFit, { kind: "ok" }> }) {
  return (
    <section className="mb-8 rounded-xl border border-danger bg-danger/10 px-5 py-4">
      <p className="text-caption uppercase tracking-widest text-danger font-medium">
        Kettle too small
      </p>
      <p className="text-body-sm text-text mt-1">
        Pre-boil volume ({fit.preBoilL.toFixed(1)} L) exceeds your kettle usable
        capacity ({fit.capacityL.toFixed(1)} L). You'll boil over — reduce batch size
        or use a bigger kettle.
      </p>
    </section>
  );
}

function StatusLabel({ status }: { status: string }) {
  return <span className="capitalize">{status.replace("_", " ")}</span>;
}

function WakeLockBadge({ held }: { held: boolean }) {
  return (
    <span
      title={
        held
          ? "Screen wake lock held — display won't sleep"
          : "Screen wake lock NOT held — display may sleep"
      }
      className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-pill text-caption font-mono border ${
        held ? "border-success text-success" : "border-border text-text-muted"
      }`}
    >
      <span
        aria-hidden
        className={`block w-2 h-2 rounded-pill ${held ? "bg-success" : "bg-text-muted"}`}
      />
      {held ? "WAKE" : "SLEEP"}
    </span>
  );
}

function ActiveStepCard({
  step,
  now,
  ctx,
  onFinish,
}: {
  step: SessionStep;
  now: number;
  ctx: BrewContext;
  onFinish: () => void;
}) {
  const elapsedSec = step.started_at
    ? Math.floor((now - new Date(step.started_at).getTime()) / 1000)
    : 0;
  const target = step.target_duration_min ?? null;
  const targetSec = target !== null ? target * 60 : null;
  const remaining = targetSec !== null ? targetSec - elapsedSec : null;
  const overrun = remaining !== null && remaining < 0;

  return (
    <section className="mb-10 rounded-2xl bg-surface border border-border p-8">
      <div className="flex items-baseline justify-between gap-6">
        <div>
          <p className="text-caption uppercase tracking-widest text-text-muted">
            {kindLabel(step.kind)}
          </p>
          <h2 className="text-h2 font-semibold mt-2 capitalize">{step.label}</h2>
        </div>
        <div className="text-right">
          <p
            className={`font-mono text-display tabular-nums ${
              overrun ? "text-warning" : "text-accent"
            }`}
          >
            {remaining !== null ? formatDuration(Math.abs(remaining)) : formatDuration(elapsedSec)}
          </p>
          <p className="font-mono text-caption text-text-muted mt-1">
            {target !== null
              ? overrun
                ? "overrun"
                : `${formatDuration(elapsedSec)} / ${target} min`
              : `elapsed ${formatDuration(elapsedSec)}`}
          </p>
        </div>
      </div>

      <StepInfo step={step} ctx={ctx} elapsedSec={elapsedSec} variant="active" />

      <button
        onClick={onFinish}
        className="mt-6 w-full px-5 py-4 rounded-xl bg-accent text-bg text-body-lg font-medium hover:opacity-90 transition-opacity"
      >
        Mark done
      </button>
    </section>
  );
}

/**
 * Renders the per-kind context numbers for a step. The active step shows a
 * larger version (variant="active"); timeline rows show a compact line
 * (variant="row").
 */
function StepInfo({
  step,
  ctx,
  elapsedSec,
  variant,
}: {
  step: SessionStep;
  ctx: BrewContext;
  elapsedSec: number;
  variant: "active" | "row";
}) {
  const stats = stepStats(step, ctx);
  const showHops = step.kind === "boil" && variant === "active" && ctx.boilHops.length > 0;
  const showCultures =
    step.kind === "ferment_pitch" && variant === "active" && ctx.cultures && ctx.cultures.length > 0;

  if (stats.length === 0 && !showHops && !showCultures && step.target_temperature_c === undefined) {
    return null;
  }

  if (variant === "active") {
    return (
      <div className="mt-6 space-y-5">
        {(stats.length > 0 || step.target_temperature_c !== undefined) && (
          <div className="grid grid-cols-3 gap-4">
            {step.target_temperature_c !== undefined && (
              <StatTile
                value={`${step.target_temperature_c.toFixed(1)}°C`}
                label="Target"
                tone="data"
              />
            )}
            {stats.map((s, i) => (
              <StatTile key={i} value={s.value} label={s.label} tone={s.tone} />
            ))}
          </div>
        )}
        {showHops && (
          <HopSchedule
            hops={ctx.boilHops}
            boilDurationMin={step.target_duration_min ?? 60}
            elapsedSec={elapsedSec}
          />
        )}
        {showCultures && <CultureList cultures={ctx.cultures!} />}
      </div>
    );
  }

  // Compact row variant: small font, comma-separated.
  const inline: string[] = [];
  if (step.target_temperature_c !== undefined) {
    inline.push(`${step.target_temperature_c.toFixed(1)}°C`);
  }
  if (step.target_duration_min !== undefined) {
    inline.push(`${step.target_duration_min} min`);
  }
  for (const s of stats) inline.push(`${s.value} ${s.label.toLowerCase()}`);
  if (inline.length === 0) return null;
  return (
    <p className="font-mono text-caption text-text-muted mt-1">
      {inline.join(" · ")}
    </p>
  );
}

interface StatLine {
  value: string;
  label: string;
  tone?: "default" | "data" | "accent";
}

function stepStats(step: SessionStep, ctx: BrewContext): StatLine[] {
  switch (step.kind) {
    case "mash":
      if (ctx.totalMashedKg <= 0) return [];
      return [
        { value: `${ctx.water.mash_water_l.toFixed(1)} L`, label: "Strike water" },
        { value: `${ctx.totalMashedKg.toFixed(2)} kg`, label: "Grain" },
        {
          value: `${(ctx.water.mash_water_l / ctx.totalMashedKg).toFixed(2)} L/kg`,
          label: "Thickness",
        },
      ];
    case "sparge":
      return [
        {
          value: ctx.water.sparge_water_l > 0
            ? `${ctx.water.sparge_water_l.toFixed(1)} L`
            : "—",
          label: "Sparge water",
        },
        { value: `${ctx.water.pre_boil_volume_l.toFixed(1)} L`, label: "Pre-boil target" },
        { value: `${ctx.water.grain_absorption_l.toFixed(1)} L`, label: "Absorbed" },
      ];
    case "boil":
      return [
        { value: `${ctx.water.pre_boil_volume_l.toFixed(1)} L`, label: "Pre-boil" },
        { value: `${ctx.water.boil_off_l.toFixed(1)} L`, label: "Boil-off" },
        { value: `${ctx.boilHops.length}`, label: "Hop additions" },
      ];
    case "chill":
      return [
        {
          value: `${ctx.water.post_cool_kettle_volume_l.toFixed(1)} L`,
          label: "In kettle",
        },
      ];
    case "transfer":
      return [
        {
          value: `${(ctx.water.post_cool_kettle_volume_l - 0.5).toFixed(1)} L`,
          label: "To fermenter",
        },
      ];
    default:
      return [];
  }
}

function StatTile({
  value,
  label,
  tone = "default",
}: {
  value: string;
  label: string;
  tone?: "default" | "data" | "accent" | undefined;
}) {
  const valueColor =
    tone === "data" ? "text-data" : tone === "accent" ? "text-accent" : "text-text";
  return (
    <div className="rounded-lg bg-surface-raised border border-border px-4 py-3">
      <p className="text-caption uppercase tracking-widest text-text-muted">{label}</p>
      <p className={`font-mono text-h3 mt-1 tabular-nums ${valueColor}`}>{value}</p>
    </div>
  );
}

function HopSchedule({
  hops,
  boilDurationMin,
  elapsedSec,
}: {
  hops: BoilHop[];
  boilDurationMin: number;
  elapsedSec: number;
}) {
  // Sort by addition order (earliest first). BeerXML TIME=X means "X min
  // before flameout" → addition at minute (boilDuration - X) of the boil.
  const events = hops
    .map((h) => ({
      ...h,
      additionAtMin: Math.max(0, boilDurationMin - h.time_min),
    }))
    .sort((a, b) => a.additionAtMin - b.additionAtMin);

  return (
    <div className="rounded-lg bg-bg border border-border p-4">
      <p className="text-caption uppercase tracking-widest text-text-muted mb-3">
        Hop schedule
      </p>
      <ul className="space-y-2">
        {events.map((h, i) => {
          const additionAtSec = h.additionAtMin * 60;
          const remainingSec = additionAtSec - elapsedSec;
          const due = remainingSec <= 0;
          const next = !due && events.findIndex((e) => e.additionAtMin * 60 - elapsedSec > 0) === i;
          return (
            <li
              key={i}
              className={`flex items-baseline justify-between gap-4 px-2 py-2 rounded ${
                next ? "bg-accent/10 ring-1 ring-accent/40" : ""
              }`}
            >
              <div className="min-w-0">
                <p
                  className={`text-body-sm font-medium ${
                    due ? "text-text-muted line-through" : "text-text"
                  }`}
                >
                  {h.amount_g.toFixed(0)} g {h.name}
                  {h.alpha_acid_pct > 0 && (
                    <span className="text-text-muted font-mono text-caption ml-2">
                      {h.alpha_acid_pct.toFixed(1)}% AA
                    </span>
                  )}
                </p>
                {h.notes && (
                  <p className="text-caption text-text-muted mt-0.5">{h.notes}</p>
                )}
              </div>
              <div className="text-right shrink-0 font-mono">
                <p className={`text-mono-lg tabular-nums ${due ? "text-success" : next ? "text-accent" : "text-text-muted"}`}>
                  {due ? "✓ added" : `in ${formatDuration(remainingSec)}`}
                </p>
                <p className="text-caption text-text-muted">@ {h.additionAtMin} min</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CultureList({
  cultures,
}: {
  cultures: NonNullable<BeerJsonRecipe["ingredients"]["culture_additions"]>;
}) {
  return (
    <div className="rounded-lg bg-bg border border-border p-4">
      <p className="text-caption uppercase tracking-widest text-text-muted mb-3">
        Yeast pitch
      </p>
      <ul className="space-y-2">
        {cultures.map((c, i) => (
          <li key={i} className="flex items-baseline justify-between gap-4">
            <div>
              <p className="text-body-sm font-medium">{c.name}</p>
              <p className="text-caption text-text-muted">
                {c.form} · {c.type}
                {c.producer && ` · ${c.producer}`}
                {c.product_id && ` · ${c.product_id}`}
                {c.attenuation && ` · ${c.attenuation.value}% atten`}
              </p>
            </div>
            <p className="font-mono text-mono-lg shrink-0">
              {c.amount ? `${c.amount.value} ${c.amount.unit}` : "—"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TimelineRow({
  step,
  now,
  isActive,
  ctx,
  onStart,
  onFinish,
  onNotes,
  disabled,
}: {
  step: SessionStep;
  now: number;
  isActive: boolean;
  ctx: BrewContext;
  onStart: () => void;
  onFinish: () => void;
  onNotes: (notes: string) => void;
  disabled: boolean;
}) {
  const icon =
    step.status === "done"
      ? "✓"
      : step.status === "active"
      ? "▶"
      : step.status === "skipped"
      ? "−"
      : "○";
  const elapsedSec =
    step.status === "active" && step.started_at
      ? Math.floor((now - new Date(step.started_at).getTime()) / 1000)
      : 0;

  return (
    <li className="px-5 py-4">
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className={`shrink-0 w-7 mt-0.5 text-h4 text-center font-mono ${
            step.status === "done"
              ? "text-success"
              : step.status === "active"
              ? "text-accent"
              : "text-text-muted"
          }`}
        >
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-body font-medium">{step.label}</p>
          </div>
          <StepInfo step={step} ctx={ctx} elapsedSec={elapsedSec} variant="row" />
          {step.status === "active" && elapsedSec > 0 && (
            <p className="font-mono text-caption text-accent mt-1 tabular-nums">
              {formatDuration(elapsedSec)} elapsed
            </p>
          )}
          {step.completed_at && step.started_at && (
            <p className="font-mono text-caption text-text-muted mt-1">
              {formatDuration(
                Math.floor(
                  (new Date(step.completed_at).getTime() - new Date(step.started_at).getTime()) /
                    1000,
                ),
              )}{" "}
              · finished {new Date(step.completed_at).toLocaleTimeString()}
            </p>
          )}
          {isActive && (
            <textarea
              defaultValue={step.notes ?? ""}
              onBlur={(e) => onNotes(e.target.value)}
              placeholder="Notes for this step…"
              rows={2}
              className="mt-3 w-full bg-bg border border-border rounded-lg px-3 py-2 text-body-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          )}
          {!isActive && step.notes && (
            <p className="text-body-sm text-text-muted mt-2 whitespace-pre-wrap">
              {step.notes}
            </p>
          )}
        </div>
        {!disabled && (
          <div className="shrink-0">
            {step.status === "pending" && (
              <button
                onClick={onStart}
                className="px-3 py-1.5 rounded-lg bg-surface-raised border border-border text-caption font-medium hover:border-accent hover:text-accent transition-colors"
              >
                Start
              </button>
            )}
            {step.status === "active" && (
              <button
                onClick={onFinish}
                className="px-3 py-1.5 rounded-lg bg-accent text-bg text-caption font-medium hover:opacity-90 transition-opacity"
              >
                Done
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function NoSession({
  onBack,
  recipe,
  onStart,
}: {
  onBack: () => void;
  recipe: BeerJsonRecipe;
  onStart: () => void;
}) {
  return (
    <div className="min-h-dvh bg-bg text-text flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <h2 className="text-h2 font-semibold capitalize">{recipe.name.toLowerCase()}</h2>
        <p className="text-body text-text-muted mt-3">
          Ready to brew? A new session will start now and the screen will stay awake until
          you finish.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={onStart}
            className="px-5 py-4 rounded-xl bg-accent text-bg text-body-lg font-medium hover:opacity-90 transition-opacity"
          >
            Start brewing
          </button>
          <button
            onClick={onBack}
            className="px-5 py-2 text-caption text-text-muted hover:text-text transition-colors"
          >
            Back to recipe
          </button>
        </div>
      </div>
    </div>
  );
}

function CompletedCard({
  session,
}: {
  session: { completed_at?: string; started_at: string };
}) {
  const total = session.completed_at
    ? Math.floor(
        (new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 1000,
      )
    : 0;
  return (
    <section className="mb-10 rounded-2xl bg-surface border border-success p-8 text-center">
      <p className="text-caption uppercase tracking-widest text-success font-medium">
        Brew completed
      </p>
      <p className="font-mono text-display text-success mt-3">{formatDuration(total)}</p>
      <p className="font-mono text-caption text-text-muted mt-1">total brew time</p>
    </section>
  );
}

function StartHint() {
  return (
    <section className="mb-10 rounded-2xl bg-surface border border-border border-dashed p-8 text-center">
      <p className="text-body text-text-muted">
        Tap <span className="text-text font-medium">Start</span> on a step to begin.
      </p>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-h3 font-semibold mb-4">{title}</h2>
      {children}
    </section>
  );
}

function kindLabel(kind: SessionStep["kind"]): string {
  switch (kind) {
    case "mash": return "Mash";
    case "sparge": return "Sparge";
    case "boil": return "Boil";
    case "hop_addition": return "Hop addition";
    case "whirlpool": return "Whirlpool";
    case "chill": return "Chill";
    case "transfer": return "Transfer";
    case "ferment_pitch": return "Pitch";
    case "custom": return "Step";
  }
}

function formatDuration(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? "-" : "";
  const t = Math.abs(totalSeconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) return `${sign}${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${sign}${m}:${String(s).padStart(2, "0")}`;
}
