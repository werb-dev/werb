import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  useBrewSession,
  useBrewSessionExists,
  sessionStorageKey,
  migrateLegacySessionKeys,
} from "../src/hooks/useBrewSession.ts";
import { MemoryBackend } from "../src/storage/index.ts";
import { makeStorageWrapper } from "./helpers.tsx";
import type { BeerJsonFile, BeerJsonRecipe } from "@werb/adapters";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, "../../../examples/double-ipa-mandarina.beerjson");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as BeerJsonFile;
const RECIPE: BeerJsonRecipe = fixture.beerjson.recipes![0]!;
const RECIPE_ID = "double-ipa-test";

describe("useBrewSession", () => {
  it("returns null session before start()", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useBrewSession(RECIPE_ID, RECIPE), { wrapper });
    expect(result.current.session).toBeNull();
    expect(result.current.activeStep).toBeNull();
  });

  it("start() creates an in-progress session with steps from the plan", async () => {
    const { wrapper, backend } = makeStorageWrapper();
    const { result } = renderHook(() => useBrewSession(RECIPE_ID, RECIPE), { wrapper });

    act(() => {
      result.current.start();
    });

    expect(result.current.session).not.toBeNull();
    expect(result.current.session!.status).toBe("in_progress");
    expect(result.current.session!.steps.length).toBeGreaterThan(0);
    // Persisted under the session.id key — multiple historical brews
    // for the same recipe co-exist that way.
    const sessionId = result.current.session!.id;
    expect(await backend.read(sessionStorageKey(sessionId))).toBeTruthy();
  });

  it("startStep marks the chosen step active and prior active step done", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useBrewSession(RECIPE_ID, RECIPE), { wrapper });

    act(() => result.current.start());
    const [first, second] = result.current.session!.steps;

    act(() => result.current.startStep(first!.id));
    expect(result.current.activeStep?.id).toBe(first!.id);
    expect(result.current.session!.steps.find((s) => s.id === first!.id)!.status).toBe(
      "active",
    );

    act(() => result.current.startStep(second!.id));
    expect(result.current.activeStep?.id).toBe(second!.id);
    expect(result.current.session!.steps.find((s) => s.id === first!.id)!.status).toBe(
      "done",
    );
    expect(result.current.session!.steps.find((s) => s.id === first!.id)!.completed_at)
      .toBeTruthy();
  });

  it("finishStep marks a step done without picking another as active", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useBrewSession(RECIPE_ID, RECIPE), { wrapper });

    act(() => result.current.start());
    const first = result.current.session!.steps[0]!;

    act(() => result.current.startStep(first.id));
    act(() => result.current.finishStep(first.id));

    expect(result.current.session!.steps[0]!.status).toBe("done");
    expect(result.current.activeStep).toBeNull();
  });

  it("setStepNotes writes notes onto the targeted step only", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useBrewSession(RECIPE_ID, RECIPE), { wrapper });

    act(() => result.current.start());
    const [first, second] = result.current.session!.steps;

    act(() => result.current.setStepNotes(first!.id, "smelled like grapefruit"));
    expect(result.current.session!.steps.find((s) => s.id === first!.id)!.notes).toBe(
      "smelled like grapefruit",
    );
    expect(result.current.session!.steps.find((s) => s.id === second!.id)!.notes)
      .toBeUndefined();
  });

  it("completeSession seals the session and any active step", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useBrewSession(RECIPE_ID, RECIPE), { wrapper });

    act(() => result.current.start());
    const last = result.current.session!.steps[result.current.session!.steps.length - 1]!;
    act(() => result.current.startStep(last.id));

    act(() => result.current.completeSession());

    expect(result.current.session!.status).toBe("completed");
    expect(result.current.session!.completed_at).toBeTruthy();
    expect(result.current.session!.steps.find((s) => s.id === last.id)!.status).toBe("done");
    expect(result.current.activeStep).toBeNull();
  });

  it("abandon clears the session and removes persistence", async () => {
    const { wrapper, backend } = makeStorageWrapper();
    const { result } = renderHook(() => useBrewSession(RECIPE_ID, RECIPE), { wrapper });

    act(() => result.current.start());
    const sessionId = result.current.session!.id;
    expect(await backend.read(sessionStorageKey(sessionId))).toBeTruthy();

    act(() => result.current.abandon());

    expect(result.current.session).toBeNull();
    expect(await backend.read(sessionStorageKey(sessionId))).toBeNull();
  });

  it("addMeasurement appends to the session and auto-attaches to the active step", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useBrewSession(RECIPE_ID, RECIPE), { wrapper });

    act(() => result.current.start());
    const mashStep = result.current.session!.steps.find((s) => s.kind === "mash");
    if (!mashStep) throw new Error("fixture missing mash step");

    act(() => result.current.startStep(mashStep.id));
    act(() =>
      result.current.addMeasurement({ kind: "ph", value: 5.4 }),
    );

    const [m] = result.current.session!.measurements!;
    expect(m).toBeDefined();
    expect(m!.kind).toBe("ph");
    expect(m!.value).toBe(5.4);
    expect(m!.step_id).toBe(mashStep.id);
    expect(m!.at).toBeTruthy();
  });

  it("addMeasurement leaves step_id unset when no step is active", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useBrewSession(RECIPE_ID, RECIPE), { wrapper });

    act(() => result.current.start());
    act(() =>
      result.current.addMeasurement({ kind: "gravity_sg", value: 1.062 }),
    );

    const [m] = result.current.session!.measurements!;
    expect(m!.step_id).toBeUndefined();
  });

  it("addMeasurement honors an explicit step_id over the active one", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useBrewSession(RECIPE_ID, RECIPE), { wrapper });

    act(() => result.current.start());
    const [first, second] = result.current.session!.steps;

    act(() => result.current.startStep(first!.id));
    act(() =>
      result.current.addMeasurement({
        kind: "temperature_c",
        value: 67,
        step_id: second!.id,
      }),
    );

    expect(result.current.session!.measurements![0]!.step_id).toBe(second!.id);
  });

  it("setTasting writes a sensory record onto the session", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useBrewSession(RECIPE_ID, RECIPE), { wrapper });

    act(() => result.current.start());
    act(() => {
      result.current.setTasting({
        tasted_at: "2026-04-01T12:00:00.000Z",
        axes: {
          bitterness: 4,
          sweetness: 2,
          sourness: 0,
          hop_character: 4,
          malt_character: 3,
          body: 3,
          carbonation: 3,
        },
        overall_rating: 4,
        notes: "Great hop expression, a bit too bitter for the style.",
        tags: ["too bitter", "great head"],
      });
    });

    const t = result.current.session!.tasting!;
    expect(t.overall_rating).toBe(4);
    expect(t.axes.bitterness).toBe(4);
    expect(t.tags).toEqual(["too bitter", "great head"]);
    expect(t.notes).toBe("Great hop expression, a bit too bitter for the style.");
  });

  it("setTasting(null) removes a previously-saved tasting", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useBrewSession(RECIPE_ID, RECIPE), { wrapper });

    act(() => result.current.start());
    act(() => {
      result.current.setTasting({
        tasted_at: "2026-04-01T12:00:00.000Z",
        axes: {
          bitterness: 3,
          sweetness: 3,
          sourness: 0,
          hop_character: 3,
          malt_character: 3,
          body: 3,
          carbonation: 3,
        },
        overall_rating: 3,
      });
    });
    expect(result.current.session!.tasting).toBeDefined();

    act(() => result.current.setTasting(null));
    expect(result.current.session!.tasting).toBeUndefined();
  });

  it("removeMeasurement deletes by timestamp", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useBrewSession(RECIPE_ID, RECIPE), { wrapper });

    act(() => result.current.start());

    act(() => {
      result.current.addMeasurement({ kind: "volume_l", value: 24 });
    });
    // Sleep a tick to guarantee distinct ISO strings.
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        act(() => {
          result.current.addMeasurement({ kind: "volume_l", value: 22 });
        });
        const [first, second] = result.current.session!.measurements!;
        expect(result.current.session!.measurements).toHaveLength(2);

        act(() => result.current.removeMeasurement(first!.at));

        expect(result.current.session!.measurements).toHaveLength(1);
        expect(result.current.session!.measurements![0]!.at).toBe(second!.at);
        resolve();
      }, 5);
    });
  });

  it("rehydrates from the backend on a fresh mount", () => {
    const { wrapper } = makeStorageWrapper();
    const { result: first } = renderHook(() => useBrewSession(RECIPE_ID, RECIPE), {
      wrapper,
    });
    act(() => first.current.start());
    const initialStepId = first.current.session!.steps[0]!.id;
    act(() => first.current.startStep(initialStepId));

    const { result: second } = renderHook(() => useBrewSession(RECIPE_ID, RECIPE), {
      wrapper,
    });
    expect(second.current.session?.status).toBe("in_progress");
    expect(second.current.activeStep?.id).toBe(initialStepId);
  });

  it("re-running start() creates a fresh session and leaves the previous one in storage", async () => {
    const { wrapper, backend } = makeStorageWrapper();
    const { result } = renderHook(() => useBrewSession(RECIPE_ID, RECIPE), { wrapper });

    act(() => result.current.start());
    const firstId = result.current.session!.id;
    act(() => result.current.completeSession());

    act(() => result.current.start());
    const secondId = result.current.session!.id;

    expect(secondId).not.toBe(firstId);
    expect(result.current.session!.status).toBe("in_progress");
    expect(result.current.session!.steps.every((s) => s.status === "pending")).toBe(true);

    // Both sessions are independently retrievable from storage.
    const keys = await backend.list("werb.session.");
    expect(keys.sort()).toEqual(
      [sessionStorageKey(firstId), sessionStorageKey(secondId)].sort(),
    );
  });

  it("useBrewSession only surfaces the live session for the recipe", async () => {
    const oldCompletedId = "old-session-id";
    const { wrapper } = makeStorageWrapper({
      [sessionStorageKey(oldCompletedId)]: JSON.stringify({
        id: oldCompletedId,
        recipe_id: RECIPE_ID,
        recipe_name: "Old brew",
        status: "completed",
        started_at: "2025-01-01T00:00:00.000Z",
        completed_at: "2025-01-01T05:00:00.000Z",
        steps: [],
      }),
    });
    const { result } = renderHook(() => useBrewSession(RECIPE_ID, RECIPE), { wrapper });
    // Sync init runs against the seeded backend: it should ignore the
    // completed session and return null because there's no live one.
    expect(result.current.session).toBeNull();
  });
});

describe("useBrewSession — explicit sessionId mode (Journal flow)", () => {
  it("loads the specific session passed as the third argument", () => {
    const sessionId = "specific-session";
    const { wrapper } = makeStorageWrapper({
      [sessionStorageKey(sessionId)]: JSON.stringify({
        id: sessionId,
        recipe_id: RECIPE_ID,
        recipe_name: "Past brew",
        status: "completed",
        started_at: "2025-06-01T00:00:00.000Z",
        completed_at: "2025-06-01T04:00:00.000Z",
        steps: [],
        notes: "Hit numbers on the nose.",
      }),
    });
    const { result } = renderHook(
      () => useBrewSession(RECIPE_ID, RECIPE, sessionId),
      { wrapper },
    );
    expect(result.current.session).not.toBeNull();
    expect(result.current.session!.id).toBe(sessionId);
    expect(result.current.session!.status).toBe("completed");
  });
});

describe("useBrewSessionExists", () => {
  it("returns false when no session is saved for the recipe id", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useBrewSessionExists("nope"), { wrapper });
    expect(result.current).toBe(false);
  });

  it("returns true when a live session is already in the backend on mount", () => {
    const { wrapper } = makeStorageWrapper({
      // Storage is keyed by session.id, but the hook scans by recipe_id.
      [sessionStorageKey("session-x")]: JSON.stringify({
        id: "session-x",
        recipe_id: "rid",
        recipe_name: "Test",
        status: "in_progress",
        started_at: "2026-01-01T00:00:00.000Z",
        steps: [],
      }),
    });
    const { result } = renderHook(() => useBrewSessionExists("rid"), { wrapper });
    expect(result.current).toBe(true);
  });

  it("returns false for a completed session of the same recipe", () => {
    const { wrapper } = makeStorageWrapper({
      [sessionStorageKey("session-done")]: JSON.stringify({
        id: "session-done",
        recipe_id: "rid",
        recipe_name: "Test",
        status: "completed",
        started_at: "2026-01-01T00:00:00.000Z",
        completed_at: "2026-01-01T05:00:00.000Z",
        steps: [],
      }),
    });
    const { result } = renderHook(() => useBrewSessionExists("rid"), { wrapper });
    expect(result.current).toBe(false);
  });

  it("flips to true after a sibling component starts a session", () => {
    const { wrapper } = makeStorageWrapper();
    const { result: existsHook } = renderHook(
      () => useBrewSessionExists(RECIPE_ID),
      { wrapper },
    );
    const { result: sessionHook } = renderHook(
      () => useBrewSession(RECIPE_ID, RECIPE),
      { wrapper },
    );

    expect(existsHook.current).toBe(false);

    act(() => sessionHook.current.start());

    // existsHook returns the cached snapshot from its own render. A fresh
    // mount (the user navigating back to the recipe screen) sees the
    // session — that's the real-world flow this hook supports.
    const { result: remounted } = renderHook(
      () => useBrewSessionExists(RECIPE_ID),
      { wrapper },
    );
    expect(remounted.current).toBe(true);
  });
});

describe("migrateLegacySessionKeys", () => {
  it("rewrites recipe-id-keyed sessions under their session.id", async () => {
    const session = {
      id: "session-1",
      recipe_id: "recipe-1",
      recipe_name: "Old layout",
      status: "completed" as const,
      started_at: "2025-01-01T00:00:00.000Z",
      steps: [],
    };
    // Pre-migration: key suffix is the recipe id, not the session id.
    const backend = new MemoryBackend({
      "werb.session.recipe-1": JSON.stringify(session),
    });

    const migrated = await migrateLegacySessionKeys(backend);
    expect(migrated).toBe(1);
    expect(await backend.read("werb.session.recipe-1")).toBeNull();
    expect(await backend.read("werb.session.session-1")).toBeTruthy();
  });

  it("is idempotent — already-correct entries are skipped", async () => {
    const session = {
      id: "session-1",
      recipe_id: "recipe-1",
      recipe_name: "Already migrated",
      status: "in_progress" as const,
      started_at: "2025-01-01T00:00:00.000Z",
      steps: [],
    };
    const backend = new MemoryBackend({
      "werb.session.session-1": JSON.stringify(session),
    });

    const first = await migrateLegacySessionKeys(backend);
    const second = await migrateLegacySessionKeys(backend);
    expect(first).toBe(0);
    expect(second).toBe(0);
  });

  it("preserves multiple sessions of the same recipe (the whole point)", async () => {
    const a = {
      id: "a",
      recipe_id: "recipe-x",
      recipe_name: "Brew A",
      status: "completed" as const,
      started_at: "2025-01-01T00:00:00.000Z",
      steps: [],
    };
    const b = {
      id: "b",
      recipe_id: "recipe-x",
      recipe_name: "Brew B",
      status: "completed" as const,
      started_at: "2025-02-01T00:00:00.000Z",
      steps: [],
    };
    // Hypothetical: storage already has two completed brews of the
    // same recipe under session-id keys. Migrate is a no-op.
    const backend = new MemoryBackend({
      "werb.session.a": JSON.stringify(a),
      "werb.session.b": JSON.stringify(b),
    });
    await migrateLegacySessionKeys(backend);
    const keys = (await backend.list("werb.session.")).sort();
    expect(keys).toEqual(["werb.session.a", "werb.session.b"]);
  });

  it("ignores corrupt JSON instead of failing the whole migration", async () => {
    const backend = new MemoryBackend({
      "werb.session.broken": "{not json",
      "werb.session.recipe-1": JSON.stringify({
        id: "session-1",
        recipe_id: "recipe-1",
        recipe_name: "OK",
        status: "completed",
        started_at: "2025-01-01T00:00:00.000Z",
        steps: [],
      }),
    });
    const migrated = await migrateLegacySessionKeys(backend);
    expect(migrated).toBe(1);
    expect(await backend.read("werb.session.session-1")).toBeTruthy();
    // Broken entry is left in place — nothing safe to do with it.
    expect(await backend.read("werb.session.broken")).toBe("{not json");
  });
});
