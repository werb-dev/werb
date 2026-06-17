import { afterEach } from "vitest";

// Node 20/22 + happy-dom provide a working `localStorage` global. Node
// 23+ ships its own experimental Web Storage, whose `localStorage`
// global is inert (undefined) unless the process is launched with
// `--localstorage-file`, and it shadows happy-dom's — so the bare
// `localStorage` the storage backends use resolves to nothing and every
// spec blows up in the afterEach below.
//
// Install a minimal in-memory Storage when no usable one is present.
// This keeps `pnpm test` working flag-free across Node versions; on
// Node 20/22 happy-dom's localStorage is already usable and this is a
// no-op.
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(String(key), String(value));
    },
  } as Storage;
}

function ensureLocalStorage(): void {
  let usable = false;
  try {
    usable = typeof globalThis.localStorage?.setItem === "function";
  } catch {
    usable = false;
  }
  if (usable) return;

  const storage = memoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    writable: true,
    configurable: true,
  });
  if (typeof window !== "undefined" && window !== (globalThis as unknown as Window)) {
    Object.defineProperty(window, "localStorage", {
      value: storage,
      writable: true,
      configurable: true,
    });
  }
}

ensureLocalStorage();

// Storage-backed hooks (useRecipes, useEquipment, useBrewSession) read
// localStorage on mount. Wipe it after every test so each spec starts
// from a clean slate — happy-dom's localStorage persists across tests
// in the same suite by default.
afterEach(() => {
  localStorage.clear();
});
