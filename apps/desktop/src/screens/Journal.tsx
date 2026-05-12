import { useState } from "react";
import type { WerbSession } from "@werb/types";
import { useBrewLog } from "../hooks/useBrewLog.ts";
import { useT } from "../data/preferences.tsx";

interface JournalScreenProps {
  /** Open a specific session in the brew screen. */
  onOpenSession: (recipeId: string, sessionId: string) => void;
  /** Export a session as JSON. */
  onExportJson: (session: WerbSession) => Promise<{ error?: string }>;
  /** Export a session as printable HTML. */
  onExportHtml: (session: WerbSession) => Promise<{ error?: string }>;
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
export function JournalScreen({
  onOpenSession,
  onExportJson,
  onExportHtml,
}: JournalScreenProps) {
  const { sessions, loading, error } = useBrewLog();
  const counts = countByStatus(sessions);
  const t = useT();

  return (
    <div className="min-h-dvh bg-bg text-text">
      <main className="mx-auto max-w-3xl px-4 pt-12 pb-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <header className="mb-8 sm:mb-10">
          <p className="text-caption uppercase tracking-widest text-text-muted">
            {loading
              ? t("journal.subtitle_loading")
              : t("journal.subtitle_count", { count: sessions.length })}
          </p>
          <h1 className="text-h2 sm:text-h1 font-semibold mt-3">{t("journal.title")}</h1>
          <p className="text-body text-text-muted mt-2 max-w-2xl">
            {t("journal.body")}
          </p>
          {!loading && sessions.length > 0 && (
            <p className="text-caption font-mono text-text-muted mt-4">
              {t("journal.counts", {
                in_progress: counts.in_progress,
                completed: counts.completed,
              })}
            </p>
          )}
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-warning bg-warning/10 px-4 sm:px-5 py-3 sm:py-4">
            <p className="text-caption uppercase tracking-widest text-warning font-medium">
              {t("journal.could_not_load")}
            </p>
            <p className="text-body-sm text-text mt-1 font-mono break-all">{error}</p>
          </div>
        )}

        {loading ? (
          <Skeleton />
        ) : sessions.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="rounded-xl bg-surface border border-border divide-y divide-border">
            {sessions.map((s) => (
              <li key={s.id}>
                <SessionRow
                  session={s}
                  onOpen={() => onOpenSession(s.recipe_id, s.id)}
                  onExportJson={() => onExportJson(s)}
                  onExportHtml={() => onExportHtml(s)}
                />
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
  onExportJson,
  onExportHtml,
}: {
  session: WerbSession;
  onOpen: () => void;
  onExportJson: () => Promise<{ error?: string }>;
  onExportHtml: () => Promise<{ error?: string }>;
}) {
  const stepsDone = session.steps.filter((s) => s.status === "done").length;
  const totalSteps = session.steps.length;
  const measurementsCount = session.measurements?.length ?? 0;
  const duration = sessionDuration(session);

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-5 hover:bg-surface-raised/40 transition-colors">
      <div className="flex items-baseline justify-between gap-3 sm:gap-4">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left"
        >
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
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={session.status} />
          <ExportMenu onExportJson={onExportJson} onExportHtml={onExportHtml} />
        </div>
      </div>
    </div>
  );
}

function ExportMenu({
  onExportJson,
  onExportHtml,
}: {
  onExportJson: () => Promise<{ error?: string }>;
  onExportHtml: () => Promise<{ error?: string }>;
}) {
  const [open, setOpen] = useState(false);

  const run = async (fn: () => Promise<{ error?: string }>) => {
    setOpen(false);
    const r = await fn();
    if (r.error) alert(r.error);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Export this brew log"
        aria-label="Export this brew log"
        className="w-8 h-8 rounded-pill flex items-center justify-center text-text-muted hover:text-text hover:bg-surface transition-colors text-body-sm"
      >
        ⋯
      </button>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40"
            aria-hidden
          />
          <div className="absolute right-0 top-full mt-2 z-50 w-[calc(100vw-2rem)] sm:w-auto sm:min-w-[14rem] max-w-[18rem] bg-surface-raised border border-border rounded-lg shadow-xl overflow-hidden">
            <button
              type="button"
              onClick={() => run(onExportHtml)}
              className="block w-full text-left px-4 py-3 hover:bg-surface focus:bg-surface border-b border-border transition-colors"
            >
              <p className="text-body-sm font-medium text-text">
                Printable HTML / PDF
              </p>
              <p className="text-caption text-text-muted mt-0.5">
                Open in any browser, print to PDF
              </p>
            </button>
            <button
              type="button"
              onClick={() => run(onExportJson)}
              className="block w-full text-left px-4 py-3 hover:bg-surface focus:bg-surface transition-colors"
            >
              <p className="text-body-sm font-medium text-text">JSON</p>
              <p className="text-caption text-text-muted mt-0.5">
                Full session data — steps, measurements, notes
              </p>
            </button>
          </div>
        </>
      )}
    </div>
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
    <div className="rounded-xl bg-surface border border-border border-dashed p-8 sm:p-12 text-center">
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
        <li key={i} className="px-4 py-4 sm:px-6 sm:py-5 animate-pulse">
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
