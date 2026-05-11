import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { Tasting, WerbSession } from "@werb/types";
import { useBrewLog, useRecipeTastings } from "../src/hooks/useBrewLog.ts";
import { makeStorageWrapper } from "./helpers.tsx";

function makeSession(
  overrides: Partial<WerbSession> & { id: string; recipe_id: string },
): WerbSession {
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
    tasting: overrides.tasting,
  };
}

function makeTasting(overrides: Partial<Tasting> = {}): Tasting {
  return {
    tasted_at: overrides.tasted_at ?? "2026-04-01T12:00:00.000Z",
    axes: overrides.axes ?? {
      bitterness: 3,
      sweetness: 2,
      sourness: 0,
      hop_character: 3,
      malt_character: 3,
      body: 3,
      carbonation: 3,
    },
    overall_rating: overrides.overall_rating ?? 4,
    notes: overrides.notes,
    tags: overrides.tags,
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

  it("ignores hop-schedule sub-keys that share the werb.session.* prefix", async () => {
    // Regression: HopSchedule persists which boil hops have been marked
    // added under `werb.session.<id>.hopAdded.<step>` — a number[]
    // payload that JSON-parses cleanly but lacks every required session
    // field. The list scan must reject it instead of crashing on
    // `b.started_at.localeCompare` during the sort.
    const { wrapper } = makeStorageWrapper({
      "werb.session.s1": JSON.stringify(
        makeSession({ id: "s1", recipe_id: "ipa", recipe_name: "IPA" }),
      ),
      "werb.session.s1.hopAdded.boil-step": JSON.stringify([0, 2]),
      "werb.session.s1.hopAdded.whirlpool": JSON.stringify([]),
    });
    const { result } = renderHook(() => useBrewLog(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessions[0]!.id).toBe("s1");
  });
});

describe("useRecipeTastings", () => {
  it("returns empty when no session of the recipe has a tasting", async () => {
    const { wrapper } = makeStorageWrapper({
      "werb.session.s1": JSON.stringify(
        // Brewed but never tasted.
        makeSession({ id: "s1", recipe_id: "ipa" }),
      ),
    });
    const { result } = renderHook(() => useRecipeTastings("ipa"), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tastings).toEqual([]);
  });

  it("filters by recipe id — sessions of other recipes are ignored", async () => {
    const { wrapper } = makeStorageWrapper({
      "werb.session.s1": JSON.stringify(
        makeSession({
          id: "s1",
          recipe_id: "ipa",
          tasting: makeTasting({ overall_rating: 4 }),
        }),
      ),
      "werb.session.s2": JSON.stringify(
        makeSession({
          id: "s2",
          recipe_id: "stout",
          tasting: makeTasting({ overall_rating: 5 }),
        }),
      ),
    });
    const { result } = renderHook(() => useRecipeTastings("ipa"), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tastings).toHaveLength(1);
    expect(result.current.tastings[0]!.sessionId).toBe("s1");
  });

  it("returns multiple tastings of the same recipe, newest tasted_at first", async () => {
    const { wrapper } = makeStorageWrapper({
      "werb.session.s_old": JSON.stringify(
        makeSession({
          id: "s_old",
          recipe_id: "ipa",
          tasting: makeTasting({
            tasted_at: "2025-09-01T12:00:00.000Z",
            tags: ["v1"],
          }),
        }),
      ),
      "werb.session.s_new": JSON.stringify(
        makeSession({
          id: "s_new",
          recipe_id: "ipa",
          tasting: makeTasting({
            tasted_at: "2026-04-01T12:00:00.000Z",
            tags: ["v2"],
          }),
        }),
      ),
    });
    const { result } = renderHook(() => useRecipeTastings("ipa"), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tastings.map((t) => t.tasting.tags?.[0])).toEqual([
      "v2",
      "v1",
    ]);
  });
});
