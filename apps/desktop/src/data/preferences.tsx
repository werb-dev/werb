import { createContext, useContext, type ReactNode } from "react";
import { usePersistedJson } from "../storage/index.ts";
import { DEFAULT_PREFS, type UnitPreferences } from "./units-format.ts";

/**
 * React context for user preferences. Currently just unit choices;
 * future locale / display-density / behavior toggles can hang off the
 * same provider.
 *
 * Preferences live under `local.prefs.*` — outside the `werb.*`
 * namespace so they aren't synced to GitHub or migrated between
 * backends. Each install of the app keeps its own preferences.
 */

const STORAGE_KEY = "local.prefs.units";

interface UnitsContextValue {
  prefs: UnitPreferences;
  setPrefs: (next: UnitPreferences | ((prev: UnitPreferences) => UnitPreferences)) => void;
}

const UnitsContext = createContext<UnitsContextValue>({
  prefs: DEFAULT_PREFS,
  setPrefs: () => {
    throw new Error("setPrefs called without a <PreferencesProvider> ancestor");
  },
});

/**
 * Mounted once near the root, inside the StorageProvider so the
 * underlying usePersistedJson can resolve `useStorage()`.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = usePersistedJson<UnitPreferences>(
    STORAGE_KEY,
    DEFAULT_PREFS,
  );
  return (
    <UnitsContext.Provider value={{ prefs, setPrefs }}>
      {children}
    </UnitsContext.Provider>
  );
}

/**
 * Read-only access to the active unit preferences. Use this in
 * display components — formatters take the bundle as a parameter.
 */
export function useUnits(): UnitPreferences {
  return useContext(UnitsContext).prefs;
}

/**
 * Read + write access. Use this in the Settings screen where the
 * user picks their preferences.
 */
export function useUnitsControl(): UnitsContextValue {
  return useContext(UnitsContext);
}
