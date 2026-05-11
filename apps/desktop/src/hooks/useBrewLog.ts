import { useEffect, useState } from "react";
import type { Tasting, WerbSession } from "@werb/types";
import { useStorage, type StorageBackend } from "../storage/index.ts";

const STORAGE_PREFIX = "werb.session.";

/** A tasting paired with its session, so the UI can link back. */
export interface SessionTasting {
  sessionId: string;
  startedAt: string;
  tasting: Tasting;
}

function parseSession(raw: string | null): WerbSession | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  // The `werb.session.` prefix is shared with sub-keys like
  // `werb.session.<id>.hopAdded.<step>` (used by the brew screen to
  // remember which hops you've marked added during a boil). Those
  // parse as a number[] — not a session. Validate the minimum shape
  // before trusting the cast.
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    typeof (parsed as WerbSession).id !== "string" ||
    typeof (parsed as WerbSession).recipe_id !== "string" ||
    typeof (parsed as WerbSession).started_at !== "string"
  ) {
    return null;
  }
  return parsed as WerbSession;
}

function loadSync(backend: StorageBackend): WerbSession[] {
  if (!backend.readSync) return [];
  // No list-sync API yet; reuse the existing list which is fast for
  // every shipped adapter (localStorage, MemoryBackend). Async paths
  // go through the effect below.
  return [];
}

/**
 * Lists every brew session in storage, newest first. Each backend key
 * `werb.session.<recipeId>` holds at most one session, so the result
 * is one entry per recipe-that-has-been-brewed.
 *
 * Hydrates lazily on mount — the Journal screen pays a ~10 ms penalty
 * to scan the OPFS / localStorage prefix. Re-runs when the screen
 * remounts (e.g. user navigates away and back), so brews completed
 * elsewhere in the app surface on the next visit.
 */
export function useBrewLog() {
  const backend = useStorage();
  const [sessions, setSessions] = useState<WerbSession[]>(() => loadSync(backend));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const keys = await backend.list(STORAGE_PREFIX);
        const reads = await Promise.all(keys.map((k) => backend.read(k)));
        const parsed = reads
          .map(parseSession)
          .filter((s): s is WerbSession => s !== null)
          // Newest started_at first. Completed and in-progress brews
          // share the same axis — users typically remember "I brewed
          // X yesterday" not "I finished X yesterday."
          .sort((a, b) => b.started_at.localeCompare(a.started_at));
        if (!cancelled) {
          setSessions(parsed);
          setError(null);
        }
      } catch (err) {
        // Surface backend failures instead of letting the journal hang
        // on the skeleton forever. Most likely cause: a stuck OPFS
        // handle after a hot-reload, or a corrupt entry that crashes
        // mid-read. Either way, the brewer needs to see what failed.
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[useBrewLog] failed to load sessions", err);
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [backend]);

  return { sessions, loading, error };
}

/**
 * All tastings recorded against any session of a given recipe, newest
 * first. Used on the Recipe screen to surface the most recent sensory
 * profile and lessons-learned tags so the next brew can react.
 */
export function useRecipeTastings(recipeId: string): {
  tastings: SessionTasting[];
  loading: boolean;
} {
  const backend = useStorage();
  const [tastings, setTastings] = useState<SessionTasting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const keys = await backend.list(STORAGE_PREFIX);
      const reads = await Promise.all(keys.map((k) => backend.read(k)));
      const all: SessionTasting[] = [];
      for (const raw of reads) {
        const session = parseSession(raw);
        if (!session) continue;
        if (session.recipe_id !== recipeId) continue;
        if (!session.tasting) continue;
        all.push({
          sessionId: session.id,
          startedAt: session.started_at,
          tasting: session.tasting,
        });
      }
      all.sort((a, b) => b.tasting.tasted_at.localeCompare(a.tasting.tasted_at));
      if (!cancelled) {
        setTastings(all);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [backend, recipeId]);

  return { tastings, loading };
}
