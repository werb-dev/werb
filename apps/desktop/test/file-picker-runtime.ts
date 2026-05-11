/**
 * File-picker behavior simulator.
 *
 * Real iOS 15 Safari can't run in vitest (no maintained engine, no
 * free CI runner). What we can do is exercise our cancellation
 * detection against the specific event surface each platform exposes
 * — a "runtime profile" picks which dismissal signal the simulated
 * picker fires when the user closes it without a selection.
 *
 * Each profile maps to a real-world target:
 *
 *   modern             Chrome 113+ / Firefox 91+ / Safari 16.4+ — has `cancel`
 *   desktop-pre-cancel Pre-2023 desktop browsers — window `focus` after picker
 *   ios15-safari       iPad Air 2 territory — no `cancel`, no reliable `focus`,
 *                      uses `visibilitychange` → "visible"
 *   ipados-pwa         Older iPadOS in standalone PWA mode — falls back to
 *                      the next document `pointerup`
 *   walked-away        Picker hangs open: only the 60 s safety timer fires
 *
 * The simulator only swaps `HTMLInputElement.prototype.click`. Every
 * other event listener (cancel, focus, visibilitychange, pointerup,
 * change) is the real one from `browser-fs.ts`, so the test is
 * exercising production code paths, not mock equivalents.
 */

export type DismissalSignal =
  | "cancel"
  | "focus"
  | "visibility"
  | "pointerup"
  | "none";

export interface RuntimeProfile {
  name: string;
  /** Which event(s) the platform fires when the user dismisses the picker. */
  dismissalSignal: DismissalSignal;
}

export const PROFILES: RuntimeProfile[] = [
  { name: "modern (Chrome 113+ / Safari 16.4+ / FF 91+)", dismissalSignal: "cancel" },
  { name: "desktop-pre-cancel (pre-2023 Safari/Chrome)", dismissalSignal: "focus" },
  { name: "ios15-safari (iPad Air 2)", dismissalSignal: "visibility" },
  { name: "ipados-pwa (older standalone)", dismissalSignal: "pointerup" },
  { name: "walked-away (no signal)", dismissalSignal: "none" },
];

/**
 * Install a click-stub that, when the production code calls
 * `input.click()`, dispatches the events the chosen profile + action
 * would fire on a real device.
 *
 * Returns an `uninstall` that restores the original prototype, so
 * vitest's `afterEach(vi.restoreAllMocks)` isn't enough on its own —
 * tests should call it via try/finally or arrange-act-assert
 * teardown.
 */
export function simulateFilePicker(
  profile: RuntimeProfile,
  action: { kind: "select"; file: File } | { kind: "cancel" },
): () => void {
  const original = HTMLInputElement.prototype.click;

  HTMLInputElement.prototype.click = function () {
    const input = this as HTMLInputElement;
    // Schedule the simulated user response in a microtask so it
    // lands AFTER pickAndReadTextFile's listeners are wired up but
    // still inside the same event loop tick that `click()` was
    // called from — mirrors how a real browser would dispatch
    // events asynchronously after the picker UI closes.
    queueMicrotask(() => {
      if (action.kind === "select") {
        Object.defineProperty(input, "files", {
          value: [action.file],
          configurable: true,
        });
        input.dispatchEvent(new Event("change"));
        return;
      }

      // Cancellation path — fire the platform's dismissal signal.
      switch (profile.dismissalSignal) {
        case "cancel":
          input.dispatchEvent(new Event("cancel"));
          break;
        case "focus":
          window.dispatchEvent(new Event("focus"));
          break;
        case "visibility":
          // Simulate the picker closing: visibility goes back to
          // "visible" and the event fires. happy-dom's default is
          // already "visible", so just dispatching the event is
          // enough to trigger our handler's branch.
          document.dispatchEvent(new Event("visibilitychange"));
          break;
        case "pointerup":
          document.dispatchEvent(new Event("pointerup"));
          break;
        case "none":
          // Nothing fires — only the safety timer can rescue us.
          break;
      }
    });
  };

  return () => {
    HTMLInputElement.prototype.click = original;
  };
}
