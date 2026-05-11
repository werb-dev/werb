import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { WerbSession } from "@werb/types";
import { useBrewLog } from "../src/hooks/useBrewLog.ts";
import { makeStorageWrapper } from "./helpers.tsx";

function makeSession(overrides: Partial<WerbSession> & { id: string; recipe_id: string }): WerbSession {
  return {
    id: overrides.id,
    recipe_id: overrides.recipe_id,
    recipe_name: overrides.recipe_name ?? `Recipe ${overrides.recipe_id}`,
    status: overrides.status ?? "completed",
    started_at: overrides.started_at ?? "2026-01-01T10:00:00.000Z",
    completed_at: overrides.completed_at,
    steps: overrides.steps ?? [],
    measurements: overrides.measurements,
    notes: overrides.notes,
  };
}

describe("useBrewLog", () => {
  it("starts empty when the backend has no sessions", async () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useBrewLog(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sessions).toEqual([]);
  });

  it("lists every session stored under the werb.session.* prefix", async () => {
    const { wrapper } = makeStorageWrapper({
      "werb.session.r1": JSON.stringify(
        makeSession({ id: "s1", recipe_id: "r1", recipe_name: "IPA" }),
      ),
      "werb.session.r2": JSON.stringify(
        makeSession({ id: "s2", recipe_id: "r2", recipe_name: "Stout" }),
      ),
      "werb.session.r3": JSON.stringify(
        makeSession({ id: "s3", recipe_id: "r3", recipe_name: "Pils" }),
      ),
    });
    const { result } = renderHook(() => useBrewLog(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sessions).toHaveLength(3);
    expect(result.current.sessions.map((s) => s.recipe_name).sort()).toEqual([
      "IPA",
      "Pils",
      "Stout",
    ]);
  });

  it("sorts sessions by started_at, newest first", async () => {
    const { wrapper } = makeStorageWrapper({
      "werb.session.a": JSON.stringify(
        makeSession({
          id: "a",
          recipe_id: "a",
          recipe_name: "Old",
          started_at: "2025-01-01T00:00:00.000Z",
        }),
      ),
      "werb.session.b": JSON.stringify(
        makeSession({
          id: "b",
          recipe_id: "b",
          recipe_name: "Mid",
          started_at: "2026-02-01T00:00:00.000Z",
        }),
      ),
      "werb.session.c": JSON.stringify(
        makeSession({
          id: "c",
          recipe_id: "c",
          recipe_name: "New",
          started_at: "2026-05-01T00:00:00.000Z",
        }),
      ),
    });
    const { result } = renderHook(() => useBrewLog(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sessions.map((s) => s.recipe_name)).toEqual([
      "New",
      "Mid",
      "Old",
    ]);
  });

  it("ignores corrupted session JSON instead of failing the whole list", async () => {
    const { wrapper } = makeStorageWrapper({
      "werb.session.ok": JSON.stringify(
        makeSession({ id: "ok", recipe_id: "ok", recipe_name: "Good" }),
      ),
      "werb.session.broken": "{not json",
    });
    const { result } = renderHook(() => useBrewLog(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessions[0]!.recipe_name).toBe("Good");
  });

  it("ignores keys outside the werb.session.* prefix", async () => {
    const { wrapper } = makeStorageWrapper({
      "werb.session.real": JSON.stringify(
        makeSession({ id: "real", recipe_id: "real" }),
      ),
      // Recipe / equipment stores share the werb. namespace — make
      // sure the journal doesn't try to deserialize them as sessions.
      "werb.recipes": JSON.stringify({ recipes: [] }),
      "werb.equipment": JSON.stringify({ profiles: [], activeId: null }),
    });
    const { result } = renderHook(() => useBrewLog(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sessions).toHaveLength(1);
  });
});
