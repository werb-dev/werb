import { useCallback, useEffect, useState } from "react";
import {
  recipeToSessionPlan,
  type BeerJsonRecipe,
} from "@werb/adapters";
import type { Measurement, WerbSession } from "@werb/types";
import { useStorage, type StorageBackend } from "../storage/index.ts";

const STORAGE_PREFIX = "werb.session.";

export function sessionStorageKey(recipeId: string): string {
  return `${STORAGE_PREFIX}${recipeId}`;
}

function parseSession(raw: string | null): WerbSession | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WerbSession;
  } catch {
    return null;
  }
}

function loadSync(backend: StorageBackend, recipeId: string): WerbSession | null {
  if (!backend.readSync) return null;
  return parseSession(backend.readSync(sessionStorageKey(recipeId)));
}

async function load(
  backend: StorageBackend,
  recipeId: string,
): Promise<WerbSession | null> {
  return parseSession(await backend.read(sessionStorageKey(recipeId)));
}

async function save(backend: StorageBackend, session: WerbSession): Promise<void> {
  try {
    await backend.write(sessionStorageKey(session.recipe_id), JSON.stringify(session));
  } catch (err) {
    console.warn("[brew] failed to persist session", err);
  }
}

/**
 * Tracks an in-progress brew session for a recipe. Keyed by recipe ID
 * in the active StorageBackend (localStorage today). Survives reloads
 * and app restarts; will follow the user across devices once a cloud
 * backend is wired up.
 */
export function useBrewSession(recipeId: string, recipe: BeerJsonRecipe) {
  const backend = useStorage();
  const [session, setSession] = useState<WerbSession | null>(() =>
    loadSync(backend, recipeId),
  );

  // Re-hydrate when recipe id changes (user navigates between recipes)
  // or when an async backend resolves its initial read.
  useEffect(() => {
    let cancelled = false;
    if (backend.readSync) {
      setSession(loadSync(backend, recipeId));
      return;
    }
    void load(backend, recipeId).then((loaded) => {
      if (!cancelled) setSession(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [backend, recipeId]);

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
      void backend.delete(sessionStorageKey(prev.recipe_id));
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
 * Returns true when a brew session is currently saved for the given
 * recipe id. Drives the "Resume brewing" / "Start brewing" label on
 * the Recipe screen.
 *
 * Sync-capable backends answer on the first render; async backends
 * resolve in a follow-up effect.
 */
export function useBrewSessionExists(recipeId: string): boolean {
  const backend = useStorage();
  const [exists, setExists] = useState<boolean>(() => {
    if (!backend.readSync) return false;
    return backend.readSync(sessionStorageKey(recipeId)) !== null;
  });

  useEffect(() => {
    if (backend.readSync) {
      setExists(backend.readSync(sessionStorageKey(recipeId)) !== null);
      return;
    }
    let cancelled = false;
    void backend.read(sessionStorageKey(recipeId)).then((raw) => {
      if (!cancelled) setExists(raw !== null);
    });
    return () => {
      cancelled = true;
    };
  }, [backend, recipeId]);

  return exists;
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
