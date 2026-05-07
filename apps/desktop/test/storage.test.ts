import { localStorageBackend, MemoryBackend } from "../src/storage/index.ts";
import { describeBackend } from "./storage-contract.ts";

describeBackend("MemoryBackend", () => new MemoryBackend());

// localStorage is shared across the test run; the global setup hook
// clears it between specs, but the backend is a singleton — same
// instance, fresh data per test.
describeBackend("localStorageBackend", () => {
  localStorage.clear();
  return localStorageBackend;
});
