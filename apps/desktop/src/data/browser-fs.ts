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
  accept: string,
): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";

    let settled = false;
    const finish = (result: { name: string; text: string } | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(result);
    };

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) {
        finish(null);
        return;
      }
      try {
        const text = await file.text();
        finish({ name: file.name, text });
      } catch {
        finish(null);
      }
    });

    // The browser fires no event when the user cancels the file dialog,
    // so there's no clean way to detect cancellation. Falling out via
    // window blur would be racy. We just leave the input attached
    // until selection — the GC reclaims it after `finish`.
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
