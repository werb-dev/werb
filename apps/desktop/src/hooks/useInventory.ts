import { useCallback, useEffect, useState } from "react";
import {
  generateId,
  loadStore,
  loadStoreSync,
  saveStore,
  type InventoryItem,
} from "../data/inventory.ts";
import { useStorage } from "../storage/index.ts";

interface InventoryStore {
  items: InventoryItem[];
}

/**
 * Personal stock state. Mirrors a StorageBackend; every mutation
 * persists. Functional updates so consecutive calls in one React tick
 * compose cleanly.
 */
export function useInventory() {
  const backend = useStorage();
  const [store, setStore] = useState<InventoryStore>(() => loadStoreSync(backend));
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
    (updater: (prev: InventoryStore) => InventoryStore) => {
      setStore((prev) => {
        const next = updater(prev);
        void saveStore(backend, next);
        return next;
      });
    },
    [backend],
  );

  const create = useCallback(
    (item: Omit<InventoryItem, "id">): InventoryItem => {
      const fresh: InventoryItem = { ...item, id: generateId() };
      persist((prev) => ({ items: [...prev.items, fresh] }));
      return fresh;
    },
    [persist],
  );

  const update = useCallback(
    (id: string, patch: Partial<Omit<InventoryItem, "id">>) => {
      persist((prev) => ({
        items: prev.items.map((it) => (it.id === id ? { ...it, ...patch, id } : it)),
      }));
    },
    [persist],
  );

  const remove = useCallback(
    (id: string) => {
      persist((prev) => ({ items: prev.items.filter((it) => it.id !== id) }));
    },
    [persist],
  );

  return { items: store.items, loading, create, update, remove };
}
