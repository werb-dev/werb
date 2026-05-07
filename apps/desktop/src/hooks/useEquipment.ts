import { useCallback, useEffect, useState } from "react";
import {
  generateId,
  getActiveProfile,
  loadStore,
  loadStoreSync,
  saveStore,
  type ProfileWithId,
} from "../data/equipment.ts";
import { useStorage } from "../storage/index.ts";

interface EquipmentStore {
  profiles: ProfileWithId[];
  activeId: string | null;
}

/**
 * Equipment profile state. Mirrors a StorageBackend; every mutation
 * persists. Functional updates so consecutive calls in the same React
 * tick (create + setActive in one handler) compose cleanly.
 */
export function useEquipment() {
  const backend = useStorage();
  const [store, setStore] = useState<EquipmentStore>(() => loadStoreSync(backend));
  const [loading, setLoading] = useState(() => backend.readSync === undefined);

  useEffect(() => {
    if (backend.readSync !== undefined) return;
    let cancelled = false;
    void loadStore(backend).then((loaded) => {
      if (!cancelled) {
        setStore(loaded);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [backend]);

  const persist = useCallback(
    (updater: (prev: EquipmentStore) => EquipmentStore) => {
      setStore((prev) => {
        const next = updater(prev);
        void saveStore(backend, next);
        return next;
      });
    },
    [backend],
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
    loading,
    create,
    update,
    remove,
    setActive,
  };
}
