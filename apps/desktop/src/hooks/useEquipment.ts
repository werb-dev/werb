import { useCallback, useState } from "react";
import {
  generateId,
  getActiveProfile,
  loadStore,
  saveStore,
  type ProfileWithId,
} from "../data/equipment.ts";

/**
 * Equipment profile state. Mirrors localStorage; every mutation persists.
 * Returned API: list of profiles, active profile (or undefined), and
 * CRUD + activation actions.
 */
export function useEquipment() {
  const [store, setStore] = useState(() => loadStore());

  const persist = useCallback((next: typeof store) => {
    saveStore(next);
    setStore(next);
  }, []);

  const create = useCallback(
    (profile: Omit<ProfileWithId, "id">): ProfileWithId => {
      const fresh: ProfileWithId = { ...profile, id: generateId() };
      const next = {
        profiles: [...store.profiles, fresh],
        // First profile auto-activates so the user sees its effect immediately.
        activeId: store.activeId ?? fresh.id,
      };
      persist(next);
      return fresh;
    },
    [store, persist],
  );

  const update = useCallback(
    (id: string, patch: Partial<Omit<ProfileWithId, "id">>) => {
      const next = {
        ...store,
        profiles: store.profiles.map((p) =>
          p.id === id ? ({ ...p, ...patch, id } as ProfileWithId) : p,
        ),
      };
      persist(next);
    },
    [store, persist],
  );

  const remove = useCallback(
    (id: string) => {
      const next = {
        profiles: store.profiles.filter((p) => p.id !== id),
        activeId: store.activeId === id ? null : store.activeId,
      };
      persist(next);
    },
    [store, persist],
  );

  const setActive = useCallback(
    (id: string | null) => {
      persist({ ...store, activeId: id });
    },
    [store, persist],
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
