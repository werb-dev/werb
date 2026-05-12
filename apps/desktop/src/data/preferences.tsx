import { createContext, useCallback, useContext, useEffect, type ReactNode } from "react";
import { usePersistedJson } from "../storage/index.ts";
import { DEFAULT_PREFS, type UnitPreferences } from "./units-format.ts";
import { bcp47, translate, type Locale } from "./i18n.ts";

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
  const [storedPrefs, setPrefs] = usePersistedJson<UnitPreferences>(
    STORAGE_KEY,
    DEFAULT_PREFS,
  );
  // Backfill any missing keys from DEFAULT_PREFS so users who saved
  // their preferences before a new field was added (e.g. `currency`)
  // don't render `undefined` through the formatters. New fields take
  // their default value; existing fields are left alone.
  const prefs: UnitPreferences = { ...DEFAULT_PREFS, ...storedPrefs };

  // Reflect the active theme on <html>. "auto" leaves the attribute
  // off so CSS @media (prefers-color-scheme) wins; "light" / "dark"
  // override that with an explicit data-theme. Tailwind utilities
  // pick up the new --color-* var values automatically — no class
  // rewrites needed.
  useEffect(() => {
    const root = document.documentElement;
    if (prefs.theme === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", prefs.theme);
  }, [prefs.theme]);

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

/**
 * Translator bound to the active UI locale. Returns a `t(key, vars?)`
 * function — the rest of the app stays oblivious to locale plumbing.
 * The callback identity changes when the locale flips so React
 * components that depend on it re-render appropriately.
 */
export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  const locale = useContext(UnitsContext).prefs.locale;
  return useCallback(
    (key, vars) => translate(locale, key, vars),
    [locale],
  );
}

/**
 * Active locale (internal Werb code). Use for code that needs to
 * branch on locale — date / number formatters mostly.
 */
export function useLocale(): Locale {
  return useContext(UnitsContext).prefs.locale;
}

/**
 * Active locale as a BCP-47 tag (e.g. "fr-FR"). Pair with `Intl` or
 * `toLocaleString` so dates and numbers respect Settings → Language
 * rather than the OS locale.
 */
export function useBcp47(): string {
  return bcp47(useContext(UnitsContext).prefs.locale);
}
