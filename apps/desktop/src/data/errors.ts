/**
 * Structured errors with i18n codes.
 *
 * Pure data modules (`storage/`, `data/`) can't call `useT()` — they
 * run outside the React tree. Instead of pinning English strings in
 * those modules, they throw or return a `WerbError` carrying a stable
 * code + interpolation params. The UI layer (which already has `t`
 * via `useT()`) maps the code to a localised string via
 * `translateError`.
 *
 * Error codes are namespaced (`import.no_recipes`, `github.invalid_token`)
 * and map 1:1 to i18n keys (`error.import.no_recipes`, etc.). Unknown
 * thrown values surface their `.message` as-is — those come from
 * outside Werb (browser / network / Tauri) and aren't worth a
 * hardcoded mapping.
 */

export class WerbError extends Error {
  constructor(
    public readonly code: string,
    public readonly params?: Record<string, string | number>,
  ) {
    // Set `.message` to the code so default toString / dev tooling
    // shows something useful even before translation.
    super(code);
    this.name = "WerbError";
  }
}

export function isWerbError(err: unknown): err is WerbError {
  return err instanceof WerbError;
}

export type Translator = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Translate a caught error to a user-facing string. Pass the `t`
 * returned by `useT()`. Non-WerbError values surface raw — they come
 * from outside Werb and the original message is the best we have.
 */
export function translateError(err: unknown, t: Translator): string {
  if (err instanceof WerbError) return t(`error.${err.code}`, err.params);
  if (err instanceof Error) return err.message;
  return String(err);
}
