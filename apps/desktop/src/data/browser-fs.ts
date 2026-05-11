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
    // called with that file." The focus-fallback timer checks this
    // so an in-flight file.text() isn't preempted into a null.
    let selectionInProgress = false;

    const finish = (result: { name: string; text: string } | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("focus", onFocus);
      input.remove();
      resolve(result);
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

    // Cancellation detection.
    //
    // Modern browsers (Chrome 113+ / Safari 16.4+ / Firefox 91+) fire
    // a `cancel` event when the picker is dismissed without a
    // selection — the clean signal.
    //
    // Older WebKit (iPadOS 16.3 and below) doesn't fire `cancel`, so
    // we rely on the window `focus` event: when the picker closes
    // (either way), the page regains focus. The 300 ms delay gives
    // the `change` event a chance to win if the user did pick a file
    // — the `selectionInProgress` guard prevents the timer from
    // racing the in-flight file.text() read.
    input.addEventListener("cancel", () => finish(null));
    const onFocus = () => {
      setTimeout(() => {
        if (selectionInProgress) return;
        finish(null);
      }, 300);
    };
    window.addEventListener("focus", onFocus);

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
