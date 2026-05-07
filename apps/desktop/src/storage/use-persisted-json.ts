import { useCallback, useEffect, useState } from "react";
import { useStorage } from "./context.tsx";

/**
 * useState-shaped hook backed by the active StorageBackend. Same call
 * site as `useState`, but the value is JSON-serialized to the given
 * key on every write and re-hydrated from the backend on mount.
 *
 * Sync-capable backends (localStorage, MemoryBackend) hydrate on the
 * lazy initial state so there is no loading flicker. Async-only
 * backends (Drive, GitHub, …) populate the value once their initial
 * `read` resolves; until then the caller sees `fallback`.
 *
 * Use this for small per-recipe / per-session state (carbonation form,
 * "hop added" marks, UI-only preferences) — the heavyweight stores
 * (recipes, equipment, brew sessions) have their own dedicated hooks.
 *
 * Caveats:
 *   - Failures to parse stored JSON fall back silently. We treat bad
 *     data as "missing" rather than crashing the screen.
 *   - Writes are fire-and-forget. Two writes in flight at once for a
 *     non-serializing backend can race; that's fine for localStorage
 *     (effectively synchronous) and a known limitation for cloud
 *     backends until we add a per-key write queue.
 */
export function usePersistedJson<T>(
  key: string,
  fallback: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const backend = useStorage();

  const [value, setValue] = useState<T>(() => {
    if (!backend.readSync) return fallback;
    const raw = backend.readSync(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    if (backend.readSync) return;
    let cancelled = false;
    void backend.read(key).then((raw) => {
      if (cancelled || raw === null) return;
      try {
        const parsed = JSON.parse(raw) as T;
        setValue(parsed);
      } catch {
        // Bad data — leave the fallback in place.
      }
    });
    return () => {
      cancelled = true;
    };
  }, [backend, key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function"
            ? (next as (prev: T) => T)(prev)
            : next;
        void backend.write(key, JSON.stringify(resolved));
        return resolved;
      });
    },
    [backend, key],
  );

  return [value, update];
}
