import { afterEach } from "vitest";

// Storage-backed hooks (useRecipes, useEquipment, useBrewSession) read
// localStorage on mount. Wipe it after every test so each spec starts
// from a clean slate — happy-dom's localStorage persists across tests
// in the same suite by default.
afterEach(() => {
  localStorage.clear();
});
