import { useCallback, useEffect, useState } from "react";
import {
  recipeToSessionPlan,
  type BeerJsonRecipe,
} from "@werb/adapters";
import type { WerbSession, SessionStep } from "@werb/types";

const STORAGE_PREFIX = "werb.session.";

function storageKey(recipeId: string) {
  return `${STORAGE_PREFIX}${recipeId}`;
}

function load(recipeId: string): WerbSession | null {
  try {
    const raw = localStorage.getItem(storageKey(recipeId));
    if (!raw) return null;
    return JSON.parse(raw) as WerbSession;
  } catch {
    return null;
  }
}

function save(session: WerbSession): void {
  try {
    localStorage.setItem(storageKey(session.recipe_id), JSON.stringify(session));
  } catch (err) {
    console.warn("[brew] failed to persist session", err);
  }
}

function remove(recipeId: string): void {
  localStorage.removeItem(storageKey(recipeId));
}

/**
 * Tracks an in-progress brew session for a recipe. Persists to localStorage
 * keyed by recipe ID; survives reloads and app restarts. Disk persistence
 * (sessions/*.session.json files) is a v1 step.
 */
export function useBrewSession(recipeId: string, recipe: BeerJsonRecipe) {
  const [session, setSession] = useState<WerbSession | null>(() => load(recipeId));

  // Keep state in sync if the user navigates between recipes.
  useEffect(() => {
    setSession(load(recipeId));
  }, [recipeId]);

  const start = useCallback(() => {
    const fresh = recipeToSessionPlan(recipe, recipeId);
    fresh.status = "in_progress";
    save(fresh);
    setSession(fresh);
  }, [recipe, recipeId]);

  const update = useCallback(
    (mutator: (draft: WerbSession) => void) => {
      setSession((prev) => {
        if (!prev) return prev;
        const next: WerbSession = JSON.parse(JSON.stringify(prev));
        mutator(next);
        save(next);
        return next;
      });
    },
    [],
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
    if (!session) return;
    remove(session.recipe_id);
    setSession(null);
  }, [session]);

  return {
    session,
    activeStep: session?.steps.find((s) => s.status === "active") ?? null,
    start,
    startStep,
    finishStep,
    setStepNotes,
    completeSession,
    abandon,
  };
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
