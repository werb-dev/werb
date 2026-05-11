import { useEffect, useState } from "react";
import type { WerbSession } from "@werb/types";
import { useStorage, type StorageBackend } from "../storage/index.ts";

const STORAGE_PREFIX = "werb.session.";

function parseSession(raw: string | null): WerbSession | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WerbSession;
  } catch {
    return null;
  }
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

  useEffect(() => {
    let cancelled = false;
    async function load() {
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
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [backend]);

  return { sessions, loading };
}
