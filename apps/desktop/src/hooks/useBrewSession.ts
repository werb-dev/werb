import { useCallback, useEffect, useState } from "react";
import {
  recipeToSessionPlan,
  type BeerJsonRecipe,
} from "@werb/adapters";
import type { Measurement, WerbSession } from "@werb/types";
import { useStorage, type StorageBackend } from "../storage/index.ts";

const STORAGE_PREFIX = "werb.session.";

/**
 * Storage key for a brew session, keyed by the session's own ID so a
 * recipe can accumulate multiple historical brews. The legacy layout
 * keyed by recipe_id is migrated at boot — see {@link migrateLegacySessionKeys}.
 */
export function sessionStorageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${sessionId}`;
}

function parseSession(raw: string | null): WerbSession | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WerbSession;
  } catch {
    return null;
  }
}

function isLive(session: WerbSession): boolean {
  return session.status === "draft" || session.status === "in_progress";
}

/**
 * Sync-only lookup for the active brew session of a given recipe.
 * Used by hooks for first-render hydration on sync-capable backends
 * (localStorage, in-memory). Returns null when the backend can't
 * answer synchronously or no live session exists.
 */
function findActiveSync(
  backend: StorageBackend,
  recipeId: string,
): WerbSession | null {
  if (!backend.readSync || !backend.listSync) return null;
  for (const key of backend.listSync(STORAGE_PREFIX)) {
    const session = parseSession(backend.readSync(key));
    if (session && session.recipe_id === recipeId && isLive(session)) {
      return session;
    }
  }
  return null;
}

async function findActive(
  backend: StorageBackend,
  recipeId: string,
): Promise<WerbSession | null> {
  const keys = await backend.list(STORAGE_PREFIX);
  for (const key of keys) {
    const session = parseSession(await backend.read(key));
    if (session && session.recipe_id === recipeId && isLive(session)) {
      return session;
    }
  }
  return null;
}

function loadByIdSync(
  backend: StorageBackend,
  sessionId: string,
): WerbSession | null {
  if (!backend.readSync) return null;
  return parseSession(backend.readSync(sessionStorageKey(sessionId)));
}

async function loadById(
  backend: StorageBackend,
  sessionId: string,
): Promise<WerbSession | null> {
  return parseSession(await backend.read(sessionStorageKey(sessionId)));
}

async function save(backend: StorageBackend, session: WerbSession): Promise<void> {
  try {
    await backend.write(sessionStorageKey(session.id), JSON.stringify(session));
  } catch (err) {
    console.warn("[brew] failed to persist session", err);
  }
}

/**
 * Tracks a brew session.
 *
 * Two calling modes:
 *   • Recipe screen → brew flow: pass just `recipeId` (no `sessionId`).
 *     The hook finds the live (draft/in_progress) session for that
 *     recipe, or null if none. `start()` creates a new one.
 *   • Journal → brew flow: pass `sessionId` of the specific session to
 *     view. Works for completed sessions too — the Brew screen renders
 *     them read-only via its existing status checks.
 *
 * Sessions are keyed by their own `id` in storage, so a recipe can
 * accumulate any number of completed historical brews without the
 * previous one being overwritten.
 */
export function useBrewSession(
  recipeId: string,
  recipe: BeerJsonRecipe,
  sessionId?: string,
) {
  const backend = useStorage();
  const [session, setSession] = useState<WerbSession | null>(() => {
    if (sessionId) return loadByIdSync(backend, sessionId);
    return findActiveSync(backend, recipeId);
  });

  useEffect(() => {
    let cancelled = false;
    const loader = sessionId
      ? loadById(backend, sessionId)
      : findActive(backend, recipeId);
    void loader.then((loaded) => {
      if (cancelled) return;
      // Functional update so we don't clobber a session the user
      // started while this async load was in flight. The async
      // `findActive` returns null for empty storage, but by the
      // time it resolves the user may already have called start().
      setSession((current) => {
        if (current && loaded === null) return current;
        return loaded;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [backend, recipeId, sessionId]);

  const start = useCallback(() => {
    const fresh = recipeToSessionPlan(recipe, recipeId);
    fresh.status = "in_progress";
    void save(backend, fresh);
    setSession(fresh);
  }, [backend, recipe, recipeId]);

  const update = useCallback(
    (mutator: (draft: WerbSession) => void) => {
      setSession((prev) => {
        if (!prev) return prev;
        const next: WerbSession = JSON.parse(JSON.stringify(prev));
        mutator(next);
        void save(backend, next);
        return next;
      });
    },
    [backend],
  );

  const startStep = useCallback(
    (stepId: string) => {
      update((s) => {
        // Mark previous active step as done if any.
        for (const step of s.steps) {
          if (step.status === "active") {
            step.status = "done";
            step.completed_at = new Date().toISOString();
          }
        }
        const target = s.steps.find((st) => st.id === stepId);
        if (target) {
          target.status = "active";
          target.started_at = new Date().toISOString();
        }
        if (s.status === "draft") s.status = "in_progress";
      });
    },
    [update],
  );

  const finishStep = useCallback(
    (stepId: string) => {
      update((s) => {
        const target = s.steps.find((st) => st.id === stepId);
        if (target) {
          target.status = "done";
          target.completed_at = new Date().toISOString();
        }
      });
    },
    [update],
  );

  const setStepNotes = useCallback(
    (stepId: string, notes: string) => {
      update((s) => {
        const target = s.steps.find((st) => st.id === stepId);
        if (target) target.notes = notes;
      });
    },
    [update],
  );

  const completeSession = useCallback(() => {
    update((s) => {
      s.status = "completed";
      s.completed_at = new Date().toISOString();
      for (const step of s.steps) {
        if (step.status === "active") {
          step.status = "done";
          step.completed_at = s.completed_at;
        }
      }
    });
  }, [update]);

  const abandon = useCallback(() => {
    setSession((prev) => {
      if (!prev) return prev;
      void backend.delete(sessionStorageKey(prev.id));
      return null;
    });
  }, [backend]);

  const addMeasurement = useCallback(
    (m: Omit<Measurement, "at">) => {
      update((s) => {
        const at = new Date().toISOString();
        const entry: Measurement = { at, ...m };
        // Auto-attach to the currently active step if the caller didn't
        // pass a step_id explicitly — that's the common case (you log
        // mash pH while the mash step is running).
        if (entry.step_id === undefined) {
          const active = s.steps.find((st) => st.status === "active");
          if (active) entry.step_id = active.id;
        }
        s.measurements = [...(s.measurements ?? []), entry];
      });
    },
    [update],
  );

  const removeMeasurement = useCallback(
    (at: string) => {
      update((s) => {
        s.measurements = (s.measurements ?? []).filter((m) => m.at !== at);
      });
    },
    [update],
  );

  return {
    session,
    activeStep: session?.steps.find((s) => s.status === "active") ?? null,
    start,
    startStep,
    finishStep,
    setStepNotes,
    completeSession,
    abandon,
    addMeasurement,
    removeMeasurement,
  };
}

/**
 * Returns true when there's a live (draft or in_progress) session for
 * the given recipe. Drives the "Resume brewing" / "Start brewing"
 * label on the Recipe screen.
 *
 * Sync-capable backends answer on the first render; async backends
 * resolve in a follow-up effect.
 */
export function useBrewSessionExists(recipeId: string): boolean {
  const backend = useStorage();
  const [exists, setExists] = useState<boolean>(() => {
    return findActiveSync(backend, recipeId) !== null;
  });

  useEffect(() => {
    let cancelled = false;
    void findActive(backend, recipeId).then((s) => {
      if (cancelled) return;
      // Same race-avoidance shape as useBrewSession: if the user
      // started a session while we were scanning storage, the sync
      // initializer already saw it. Don't flip true → false on a
      // stale "empty" read.
      setExists((current) => (current && s === null ? current : s !== null));
    });
    return () => {
      cancelled = true;
    };
  }, [backend, recipeId]);

  return exists;
}

/**
 * One-shot migration: pre-multi-session layout keyed sessions by
 * `recipe_id`, so the storage key suffix could disagree with the
 * session's own `id`. Rewrite each such entry under its session-id
 * key and delete the old. Idempotent — already-correct entries are
 * skipped.
 *
 * Returns the number of keys rewritten so the boot script can log it.
 */
export async function migrateLegacySessionKeys(
  backend: StorageBackend,
): Promise<number> {
  const keys = await backend.list(STORAGE_PREFIX);
  let migrated = 0;
  for (const key of keys) {
    const raw = await backend.read(key);
    if (!raw) continue;
    const session = parseSession(raw);
    if (!session) continue;
    const expected = sessionStorageKey(session.id);
    if (key === expected) continue; // already in new format
    await backend.write(expected, raw);
    await backend.delete(key);
    migrated++;
  }
  return migrated;
}

// ─── Helper hooks ─────────────────────────────────────────────────────────

/**
 * Re-renders every `intervalMs` ms — used to drive live timers without
 * persisting time-of-day in component state.
 */
export function useTick(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Acquires a Screen Wake Lock for the duration of the component lifecycle.
 * Web API (Tauri webview supports it natively on macOS desktop). Re-acquires
 * on visibility change since the lock is auto-released on tab hide.
 *
 * Returns whether the lock is currently held — surface that to the user so
 * they know whether the screen will sleep.
 */
export function useScreenWakeLock(active: boolean): boolean {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      console.warn("[wake-lock] not supported by this browser/runtime");
      return;
    }

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        sentinel = await navigator.wakeLock!.request("screen");
        if (cancelled) {
          await sentinel.release();
          return;
        }
        setHeld(true);
        sentinel.addEventListener("release", () => setHeld(false));
      } catch (err) {
        console.warn("[wake-lock] acquire failed", err);
        setHeld(false);
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible" && !sentinel) {
        void acquire();
      }
    }

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      sentinel?.release().catch(() => {});
      setHeld(false);
    };
  }, [active]);

  return held;
}
