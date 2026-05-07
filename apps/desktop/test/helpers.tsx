import { type ReactNode } from "react";
import { MemoryBackend, StorageProvider } from "../src/storage/index.ts";

/**
 * Returns `{ wrapper, backend }` for renderHook so tests get a fresh
 * isolated MemoryBackend each time. Pass the result to renderHook as:
 *
 *     const { wrapper } = makeStorageWrapper();
 *     const { result } = renderHook(() => useRecipes(), { wrapper });
 *
 * Hold onto `backend` if you need to assert against persisted state
 * (or pre-populate it before the hook runs).
 */
export function makeStorageWrapper(initial?: Record<string, string>) {
  const backend = new MemoryBackend(initial);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StorageProvider backend={backend}>{children}</StorageProvider>
  );
  return { wrapper, backend };
}
