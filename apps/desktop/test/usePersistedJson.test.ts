import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePersistedJson } from "../src/storage/index.ts";
import { makeStorageWrapper } from "./helpers.tsx";

describe("usePersistedJson", () => {
  it("returns the fallback when nothing is stored", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(
      () => usePersistedJson("some.key", { count: 0 }),
      { wrapper },
    );
    expect(result.current[0]).toEqual({ count: 0 });
  });

  it("hydrates from the backend on mount when a value is present", () => {
    const { wrapper } = makeStorageWrapper({
      "some.key": JSON.stringify({ count: 5 }),
    });
    const { result } = renderHook(
      () => usePersistedJson("some.key", { count: 0 }),
      { wrapper },
    );
    expect(result.current[0]).toEqual({ count: 5 });
  });

  it("setter writes through to the backend", async () => {
    const { wrapper, backend } = makeStorageWrapper();
    const { result } = renderHook(
      () => usePersistedJson<{ name: string }>("some.key", { name: "init" }),
      { wrapper },
    );

    act(() => {
      result.current[1]({ name: "updated" });
    });

    expect(result.current[0]).toEqual({ name: "updated" });
    expect(JSON.parse((await backend.read("some.key"))!)).toEqual({ name: "updated" });
  });

  it("functional setter receives the previous value", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(
      () => usePersistedJson<number[]>("list", []),
      { wrapper },
    );

    act(() => {
      result.current[1]((prev) => [...prev, 1]);
    });
    act(() => {
      result.current[1]((prev) => [...prev, 2]);
    });

    expect(result.current[0]).toEqual([1, 2]);
  });

  it("falls back when stored data is malformed JSON", () => {
    const { wrapper } = makeStorageWrapper({ "broken.key": "{not json" });
    const { result } = renderHook(
      () => usePersistedJson("broken.key", { fine: true }),
      { wrapper },
    );
    expect(result.current[0]).toEqual({ fine: true });
  });

  it("rehydrates with the stored value on a fresh mount", () => {
    const { wrapper } = makeStorageWrapper();
    const { result: first } = renderHook(
      () => usePersistedJson<string>("greeting", "hello"),
      { wrapper },
    );

    act(() => {
      first.current[1]("hola");
    });

    const { result: second } = renderHook(
      () => usePersistedJson<string>("greeting", "hello"),
      { wrapper },
    );
    expect(second.current[0]).toBe("hola");
  });
});
