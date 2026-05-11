/**
 * Synchronous runtime check for the Tauri webview.
 *
 * `@tauri-apps/api/core` ships an `isTauri()` helper that does the same
 * thing, but importing it dynamically (which is how we keep the Tauri
 * runtime out of the web bundle) crosses a microtask boundary. iOS
 * Safari / iPadOS revoke the user-gesture token across awaits, so any
 * follow-up `input.click()` for a file picker or `anchor.click()` for a
 * download silently fails. Doing the detection inline keeps the chain
 * from the user's tap to the click() synchronous.
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
