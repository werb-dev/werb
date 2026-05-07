import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEquipment } from "../src/hooks/useEquipment.ts";
import { EQUIPMENT_STORAGE_KEY } from "../src/data/equipment.ts";
import { makeStorageWrapper } from "./helpers.tsx";
import type { WerbEquipmentProfile } from "@werb/types";

const PROFILE: Omit<WerbEquipmentProfile, "id"> = {
  name: "Brewzilla 35L",
  batch_size_l: 23,
  efficiency_pct: 72,
};

describe("useEquipment", () => {
  it("starts empty with no active profile", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useEquipment(), { wrapper });
    expect(result.current.profiles).toEqual([]);
    expect(result.current.activeId).toBeNull();
    expect(result.current.activeProfile).toBeUndefined();
  });

  it("the first created profile auto-activates", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useEquipment(), { wrapper });

    let id = "";
    act(() => {
      id = result.current.create(PROFILE).id;
    });

    expect(result.current.profiles).toHaveLength(1);
    expect(result.current.activeId).toBe(id);
    expect(result.current.activeProfile?.id).toBe(id);
  });

  it("subsequent creates do not steal the active selection", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useEquipment(), { wrapper });

    let firstId = "";
    act(() => {
      firstId = result.current.create({ ...PROFILE, name: "First" }).id;
      result.current.create({ ...PROFILE, name: "Second" });
    });

    expect(result.current.profiles).toHaveLength(2);
    expect(result.current.activeId).toBe(firstId);
    expect(result.current.activeProfile?.name).toBe("First");
  });

  it("setActive switches the live profile", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useEquipment(), { wrapper });

    let secondId = "";
    act(() => {
      result.current.create({ ...PROFILE, name: "First" });
      secondId = result.current.create({ ...PROFILE, name: "Second" }).id;
    });

    act(() => {
      result.current.setActive(secondId);
    });

    expect(result.current.activeProfile?.name).toBe("Second");
  });

  it("remove drops the profile and clears activeId when it was the active one", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useEquipment(), { wrapper });

    let id = "";
    act(() => {
      id = result.current.create(PROFILE).id;
    });
    expect(result.current.activeId).toBe(id);

    act(() => {
      result.current.remove(id);
    });

    expect(result.current.profiles).toEqual([]);
    expect(result.current.activeId).toBeNull();
  });

  it("remove leaves activeId untouched when removing a different profile", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useEquipment(), { wrapper });

    let firstId = "";
    let secondId = "";
    act(() => {
      firstId = result.current.create({ ...PROFILE, name: "First" }).id;
      secondId = result.current.create({ ...PROFILE, name: "Second" }).id;
    });

    act(() => {
      result.current.remove(secondId);
    });

    expect(result.current.activeId).toBe(firstId);
  });

  it("update patches a profile in place", () => {
    const { wrapper } = makeStorageWrapper();
    const { result } = renderHook(() => useEquipment(), { wrapper });

    let id = "";
    act(() => {
      id = result.current.create(PROFILE).id;
    });

    act(() => {
      result.current.update(id, { name: "Renamed", batch_size_l: 25 });
    });

    const updated = result.current.profiles[0]!;
    expect(updated.id).toBe(id);
    expect(updated.name).toBe("Renamed");
    expect(updated.batch_size_l).toBe(25);
    expect(updated.efficiency_pct).toBe(72); // unchanged
  });

  it("rehydrates from the backend on a fresh mount", () => {
    const { wrapper } = makeStorageWrapper();
    const { result: first } = renderHook(() => useEquipment(), { wrapper });
    act(() => {
      first.current.create({ ...PROFILE, name: "Persisted" });
    });

    const { result: second } = renderHook(() => useEquipment(), { wrapper });
    expect(second.current.profiles).toHaveLength(1);
    expect(second.current.profiles[0]!.name).toBe("Persisted");
    expect(second.current.activeProfile?.name).toBe("Persisted");
  });

  it("backfills the hlt section on legacy profiles missing it", () => {
    // A profile saved before the HLT section was introduced — no hlt key.
    const legacy = JSON.stringify({
      profiles: [
        {
          id: "legacy",
          name: "Old kit",
          batch_size_l: 19,
          efficiency_pct: 70,
          mash_tun: { capacity_l: 50 },
        },
      ],
      activeId: "legacy",
    });
    const { wrapper } = makeStorageWrapper({ [EQUIPMENT_STORAGE_KEY]: legacy });
    const { result } = renderHook(() => useEquipment(), { wrapper });
    expect(result.current.profiles).toHaveLength(1);
    expect(result.current.profiles[0]!.hlt).toBeDefined();
    expect(result.current.profiles[0]!.hlt!.capacity_l).toBeGreaterThan(0);
  });
});
