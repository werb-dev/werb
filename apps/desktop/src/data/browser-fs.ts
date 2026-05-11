/**
 * Browser file I/O fallbacks for the web build.
 *
 * The desktop build uses @tauri-apps/plugin-dialog + plugin-fs for native
 * open/save flows. In the browser we don't have direct filesystem access,
 * so:
 *   • Import: spin up a hidden <input type="file">, await the change.
 *   • Export: build a Blob, drop a download link, click it.
 *
 * No File System Access API (showOpenFilePicker / showSaveFilePicker) yet
 * — that's Chromium-only and the input + anchor approach works
 * everywhere modern (Firefox, Safari, mobile).
 */

export async function pickAndReadTextFile(
  accept?: string,
): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    // `accept` is intentionally optional. iOS / iPadOS filter the
    // picker by UTType, which doesn't recognize custom extensions
    // (`.beerxml`, `.beerjson`) — setting accept would grey those
    // files out in the Files app. Callers that want filtering on
    // desktop pass a value; importers leave it off so all files are
    // selectable and we surface parse errors instead.
    if (accept) input.accept = accept;
    input.style.display = "none";

    let settled = false;
    // True between "change fired with a file" and "finish has been
    // called with that file." All fallback timers check this so an
    // in-flight file.text() read isn't preempted into a null.
    let selectionInProgress = false;

    const finish = (result: { name: string; text: string } | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(safetyTimer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pointerup", onPointerUp, true);
      input.remove();
      resolve(result);
    };

    // Schedule a "treat as cancelled" check after a short delay, so a
    // `change` event landing in the same tick can still win the race.
    const checkSoon = () => {
      setTimeout(() => {
        if (!selectionInProgress) finish(null);
      }, 300);
    };

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) {
        finish(null);
        return;
      }
      selectionInProgress = true;
      try {
        const text = await file.text();
        finish({ name: file.name, text });
      } catch {
        finish(null);
      }
    });

    // Layered cancellation detection — the picker doesn't give us a
    // single reliable signal across every browser × runtime combo we
    // care about, so we listen for whichever fires first.
    //
    //   1. `cancel` event — clean signal in Chrome 113+ / Safari
    //      16.4+ / Firefox 91+. Often missing in iPadOS PWAs run
    //      from the home screen.
    //   2. window `focus` — desktop browsers regain focus when the
    //      picker closes.
    //   3. `visibilitychange` → "visible" — most reliable on mobile,
    //      where opening a system picker hides the page.
    //   4. document `pointerup` — last-resort "user just tapped the
    //      page" signal, in case neither focus nor visibility fire
    //      (e.g. some iPadOS PWA contexts where the picker is
    //      presented as a sheet without blurring the web view).
    //   5. 60 s safety timer — if everything else fails, eventually
    //      release the button instead of leaving it stuck forever.
    input.addEventListener("cancel", () => finish(null));

    const onFocus = () => checkSoon();
    window.addEventListener("focus", onFocus);

    const onVisibility = () => {
      if (document.visibilityState === "visible") checkSoon();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onPointerUp = () => checkSoon();
    document.addEventListener("pointerup", onPointerUp, true);

    const safetyTimer = setTimeout(() => finish(null), 60_000);

    document.body.appendChild(input);
    input.click();
  });
}

export function downloadTextFile(
  filename: string,
  contents: string,
  mime: string,
): void {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Defer revoke so the click handler has finished. Browsers tolerate
  // immediate revoke today, but a microtask boundary is the documented-safe
  // pattern.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
