import type { WerbSession } from "@werb/types";
import { useBrewLog } from "../hooks/useBrewLog.ts";

interface JournalScreenProps {
  /** Open a specific session in the brew screen. */
  onOpenSession: (recipeId: string, sessionId: string) => void;
}

/**
 * Past-and-present brew sessions, newest first. Each entry surfaces
 * the recipe name, status, and a quick stat strip (steps completed,
 * measurements logged, duration if finished).
 *
 * Tapping a row opens the session in the brew screen — that's already
 * the canonical UI for inspecting a brew's timeline, notes, and
 * measurements. Read-only behavior follows automatically once the
 * session's status is "completed."
 */
export function JournalScreen({ onOpenSession }: JournalScreenProps) {
  const { sessions, loading } = useBrewLog();
  const counts = countByStatus(sessions);

  return (
    <div className="min-h-dvh bg-bg text-text">
      <main className="mx-auto max-w-3xl px-8 py-12">
        <header className="mb-10">
          <p className="text-caption uppercase tracking-widest text-text-muted">
            {loading
              ? "Werb · loading…"
              : `Werb · ${sessions.length} brew${sessions.length === 1 ? "" : "s"}`}
          </p>
          <h1 className="text-h1 font-semibold mt-3">Journal</h1>
          <p className="text-body text-text-muted mt-2 max-w-2xl">
            Every brew session you've started. Tap one to revisit its
            timeline, measurements and notes.
          </p>
          {!loading && sessions.length > 0 && (
            <p className="text-caption font-mono text-text-muted mt-4">
              {counts.in_progress} in progress · {counts.completed} completed
              {counts.draft > 0 && ` · ${counts.draft} draft`}
            </p>
          )}
        </header>

        {loading ? (
          <Skeleton />
        ) : sessions.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="rounded-xl bg-surface border border-border divide-y divide-border">
            {sessions.map((s) => (
              <li key={s.id}>
                <SessionRow session={s} onOpen={() => onOpenSession(s.recipe_id, s.id)} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function SessionRow({
  session,
  onOpen,
}: {
  session: WerbSession;
  onOpen: () => void;
}) {
  const stepsDone = session.steps.filter((s) => s.status === "done").length;
  const totalSteps = session.steps.length;
  const measurementsCount = session.measurements?.length ?? 0;
  const duration = sessionDuration(session);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left px-6 py-5 hover:bg-surface-raised/40 transition-colors"
    >
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-body font-medium truncate capitalize">
            {(session.recipe_name ?? "Untitled recipe").toLowerCase()}
          </p>
          <p className="text-body-sm text-text-muted mt-1 font-mono tabular-nums">
            {formatDate(session.started_at)}
            {duration && ` · ${duration}`}
            {stepsDone < totalSteps
              ? ` · ${stepsDone}/${totalSteps} steps`
              : totalSteps > 0
              ? ` · ${totalSteps} steps`
              : ""}
            {measurementsCount > 0 && ` · ${measurementsCount} reading${measurementsCount === 1 ? "" : "s"}`}
          </p>
          {firstNote(session) && (
            <p className="text-caption text-text-muted mt-2 line-clamp-2">
              {firstNote(session)}
            </p>
          )}
        </div>
        <StatusBadge status={session.status} />
      </div>
    </button>
  );
}

function StatusBadge({ status }: { status: WerbSession["status"] }) {
  const styles: Record<WerbSession["status"], string> = {
    draft: "bg-surface-raised text-text-muted",
    in_progress: "bg-accent/20 text-accent",
    completed: "bg-success/20 text-success",
    abandoned: "bg-surface-raised text-text-muted line-through",
  };
  const labels: Record<WerbSession["status"], string> = {
    draft: "Draft",
    in_progress: "Active",
    completed: "Done",
    abandoned: "Abandoned",
  };
  return (
    <span
      className={`shrink-0 px-3 py-1 rounded-pill text-caption font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl bg-surface border border-border border-dashed p-12 text-center">
      <p className="text-body text-text">No brews yet.</p>
      <p className="text-body-sm text-text-muted mt-2 max-w-md mx-auto">
        Open a recipe and tap <span className="text-text">Start brewing</span> to
        log your first session. It'll show up here once you do.
      </p>
    </div>
  );
}

function Skeleton() {
  return (
    <ul
      className="rounded-xl bg-surface border border-border divide-y divide-border"
      aria-busy="true"
      aria-live="polite"
    >
      {[0, 1, 2].map((i) => (
        <li key={i} className="px-6 py-5 animate-pulse">
          <div className="flex items-baseline justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-surface-raised" />
              <div className="h-3 w-2/3 rounded bg-surface-raised opacity-60" />
            </div>
            <div className="h-6 w-16 rounded-pill bg-surface-raised" />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function countByStatus(sessions: WerbSession[]) {
  const counts = { draft: 0, in_progress: 0, completed: 0, abandoned: 0 };
  for (const s of sessions) counts[s.status] += 1;
  return counts;
}

function sessionDuration(session: WerbSession): string | null {
  if (session.status !== "completed" || !session.completed_at) return null;
  const ms = new Date(session.completed_at).getTime() - new Date(session.started_at).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes - hours * 60;
  return rem > 0 ? `${hours} h ${rem} min` : `${hours} h`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function firstNote(session: WerbSession): string | null {
  if (session.notes && session.notes.trim()) return session.notes.trim();
  for (const step of session.steps) {
    if (step.notes && step.notes.trim()) return step.notes.trim();
  }
  return null;
}
