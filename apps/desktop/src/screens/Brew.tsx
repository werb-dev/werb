import { useMemo } from "react";
import type { BeerJsonRecipe } from "@werb/adapters";
import type { SessionStep } from "@werb/types";
import { useBrewSession, useScreenWakeLock, useTick } from "../hooks/useBrewSession.ts";

interface BrewScreenProps {
  recipeId: string;
  recipe: BeerJsonRecipe;
  onBack: () => void;
}

export function BrewScreen({ recipeId, recipe, onBack }: BrewScreenProps) {
  const brew = useBrewSession(recipeId, recipe);
  const tick = useTick(1000);
  const wakeLockHeld = useScreenWakeLock(brew.session?.status === "in_progress");

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

        {activeStep ? (
          <ActiveStepCard step={activeStep} now={tick} onFinish={() => brew.finishStep(activeStep.id)} />
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
        held
          ? "border-success text-success"
          : "border-border text-text-muted"
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
  onFinish,
}: {
  step: SessionStep;
  now: number;
  onFinish: () => void;
}) {
  const elapsed = step.started_at ? Math.floor((now - new Date(step.started_at).getTime()) / 1000) : 0;
  const target = step.target_duration_min ?? null;
  const targetSec = target !== null ? target * 60 : null;
  const remaining = targetSec !== null ? targetSec - elapsed : null;
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
            {remaining !== null ? formatDuration(Math.abs(remaining)) : formatDuration(elapsed)}
          </p>
          <p className="font-mono text-caption text-text-muted mt-1">
            {target !== null
              ? overrun
                ? "overrun"
                : `${formatDuration(elapsed)} / ${target} min`
              : `elapsed ${formatDuration(elapsed)}`}
          </p>
        </div>
      </div>
      {step.target_temperature_c !== undefined && (
        <p className="mt-4 font-mono text-mono-lg text-data">
          Target {step.target_temperature_c.toFixed(1)}°C
        </p>
      )}
      <button
        onClick={onFinish}
        className="mt-6 w-full px-5 py-4 rounded-xl bg-accent text-bg text-body-lg font-medium hover:opacity-90 transition-opacity"
      >
        Mark done
      </button>
    </section>
  );
}

function TimelineRow({
  step,
  now,
  isActive,
  onStart,
  onFinish,
  onNotes,
  disabled,
}: {
  step: SessionStep;
  now: number;
  isActive: boolean;
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
  const elapsed =
    step.status === "active" && step.started_at
      ? Math.floor((now - new Date(step.started_at).getTime()) / 1000)
      : null;

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
            <span className="font-mono text-caption text-text-muted shrink-0">
              {step.target_duration_min !== undefined && `${step.target_duration_min} min`}
              {step.target_temperature_c !== undefined && ` · ${step.target_temperature_c.toFixed(1)}°C`}
            </span>
          </div>
          {elapsed !== null && (
            <p className="font-mono text-caption text-accent mt-1 tabular-nums">
              {formatDuration(elapsed)} elapsed
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

function CompletedCard({ session }: { session: { completed_at?: string; started_at: string } }) {
  const total =
    session.completed_at
      ? Math.floor(
          (new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) /
            1000,
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
