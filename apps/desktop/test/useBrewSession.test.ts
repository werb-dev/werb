import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { useBrewSession, sessionStorageKey } from "../src/hooks/useBrewSession.ts";
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
    // Persisted under the recipe-keyed slot.
    expect(await backend.read(sessionStorageKey(RECIPE_ID))).toBeTruthy();
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
    expect(await backend.read(sessionStorageKey(RECIPE_ID))).toBeTruthy();

    act(() => result.current.abandon());

    expect(result.current.session).toBeNull();
    expect(await backend.read(sessionStorageKey(RECIPE_ID))).toBeNull();
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

  it("re-running start() replaces the session for the same recipe id", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useBrewSession(RECIPE_ID, RECIPE), { wrapper });

    act(() => result.current.start());
    const firstSessionId = result.current.session!.id;
    act(() => result.current.startStep(result.current.session!.steps[0]!.id));

    act(() => result.current.start());
    expect(result.current.session!.id).not.toBe(firstSessionId);
    expect(result.current.session!.steps.every((s) => s.status === "pending")).toBe(true);
  });
});
