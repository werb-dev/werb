import { useCallback, useState } from "react";
import {
  generateId,
  getActiveProfile,
  loadStore,
  saveStore,
  type ProfileWithId,
} from "../data/equipment.ts";

interface EquipmentStore {
  profiles: ProfileWithId[];
  activeId: string | null;
}

/**
 * Equipment profile state. Mirrors localStorage; every mutation persists.
 *
 * Mutations use functional updates so consecutive calls in the same React
 * tick (e.g. create + setActive in one handler) compose cleanly without
 * stale-closure issues.
 *
 * Returned API: list of profiles, active profile (or undefined), and
 * CRUD + activation actions.
 */
export function useEquipment() {
  const [store, setStore] = useState<EquipmentStore>(() => loadStore());

  const persist = useCallback(
    (updater: (prev: EquipmentStore) => EquipmentStore) => {
      setStore((prev) => {
        const next = updater(prev);
        saveStore(next);
        return next;
      });
    },
    [],
  );

  const create = useCallback(
    (profile: Omit<ProfileWithId, "id">): ProfileWithId => {
      const fresh: ProfileWithId = { ...profile, id: generateId() };
      persist((prev) => ({
        profiles: [...prev.profiles, fresh],
        // First profile auto-activates so the user sees its effect immediately.
        activeId: prev.activeId ?? fresh.id,
      }));
      return fresh;
    },
    [persist],
  );

  const update = useCallback(
    (id: string, patch: Partial<Omit<ProfileWithId, "id">>) => {
      persist((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) =>
          p.id === id ? ({ ...p, ...patch, id } as ProfileWithId) : p,
        ),
      }));
    },
    [persist],
  );

  const remove = useCallback(
    (id: string) => {
      persist((prev) => ({
        profiles: prev.profiles.filter((p) => p.id !== id),
        activeId: prev.activeId === id ? null : prev.activeId,
      }));
    },
    [persist],
  );

  const setActive = useCallback(
    (id: string | null) => {
      persist((prev) => ({ ...prev, activeId: id }));
    },
    [persist],
  );

  return {
    profiles: store.profiles,
    activeId: store.activeId,
    activeProfile: getActiveProfile(store),
    create,
    update,
    remove,
    setActive,
  };
}
