import { createContext, useContext, type ReactNode } from "react";
import type { StorageBackend } from "./backend.ts";
import { localStorageBackend } from "./local-storage.ts";

/**
 * React context for the active StorageBackend. Hooks read it via
 * `useStorage()`. The provider lives once at the root of the app — see
 * apps/desktop/src/main.tsx.
 *
 * Default value is the localStorage adapter so any code reachable from
 * the production tree works even if a provider is forgotten somewhere.
 * Tests still wrap their `renderHook` calls with a MemoryBackend
 * provider to stay isolated from window.localStorage.
 */
const StorageContext = createContext<StorageBackend>(localStorageBackend);

export function StorageProvider({
  backend,
  children,
}: {
  backend: StorageBackend;
  children: ReactNode;
}) {
  return <StorageContext.Provider value={backend}>{children}</StorageContext.Provider>;
}

export function useStorage(): StorageBackend {
  return useContext(StorageContext);
}
