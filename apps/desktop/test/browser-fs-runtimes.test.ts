import { describe, it, expect, vi, afterEach } from "vitest";
import { pickAndReadTextFile } from "../src/data/browser-fs.ts";
import {
  PROFILES,
  simulateFilePicker,
  type RuntimeProfile,
} from "./file-picker-runtime.ts";

/**
 * Cross-runtime tests for the cancellation detection in
 * pickAndReadTextFile. Real iOS 15 Safari isn't available in vitest,
 * so we exercise the same code against each platform's specific
 * event surface via a tiny simulator (see file-picker-runtime.ts).
 *
 * If you add a new dismissal-signal branch to pickAndReadTextFile,
 * extend PROFILES with the corresponding runtime — the same suite
 * runs for free.
 */

afterEach(() => {
  vi.useRealTimers();
});

describe("pickAndReadTextFile — selection path (cross-runtime)", () => {
  for (const profile of PROFILES) {
    it(`[${profile.name}] resolves with the chosen file`, async () => {
      const file = new File(["body content"], "recipe.beerxml", {
        type: "application/xml",
      });
      const uninstall = simulateFilePicker(profile, { kind: "select", file });
      try {
        const result = await pickAndReadTextFile();
        expect(result).not.toBeNull();
        expect(result!.name).toBe("recipe.beerxml");
        expect(result!.text).toBe("body content");
      } finally {
        uninstall();
      }
    });
  }
});

describe("pickAndReadTextFile — cancellation path (cross-runtime)", () => {
  for (const profile of profilesExcept("none")) {
    it(`[${profile.name}] resolves to null when the picker is dismissed`, async () => {
      const uninstall = simulateFilePicker(profile, { kind: "cancel" });
      try {
        const result = await pickAndReadTextFile();
        expect(result).toBeNull();
      } finally {
        uninstall();
      }
    });
  }

  it("[walked-away] resolves to null when the 60 s safety timer fires", async () => {
    vi.useFakeTimers();
    const profile = profilesByName("walked-away (no signal)");
    const uninstall = simulateFilePicker(profile, { kind: "cancel" });
    try {
      const pending = pickAndReadTextFile();
      // Less than 60 s — nothing has resolved yet.
      await vi.advanceTimersByTimeAsync(59_000);
      // Resolve via the safety timer.
      await vi.advanceTimersByTimeAsync(2_000);
      const result = await pending;
      expect(result).toBeNull();
    } finally {
      uninstall();
    }
  });
});

describe("pickAndReadTextFile — race conditions", () => {
  it("file selection wins even when a dismissal signal fires just before change", async () => {
    // Simulate the messy iOS sequence: picker closes (visibility ->
    // visible) and `change` fires for the actually-picked file in
    // the same task. The 300 ms debounce + selectionInProgress
    // guard should keep the file from being lost.
    const file = new File(["selected"], "kept.xml", { type: "application/xml" });
    const original = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () {
      const input = this as HTMLInputElement;
      queueMicrotask(() => {
        // Dismissal signal fires FIRST...
        document.dispatchEvent(new Event("visibilitychange"));
        // ...immediately followed by the change event with a file.
        Object.defineProperty(input, "files", {
          value: [file],
          configurable: true,
        });
        input.dispatchEvent(new Event("change"));
      });
    };

    try {
      const result = await pickAndReadTextFile();
      expect(result).not.toBeNull();
      expect(result!.name).toBe("kept.xml");
      expect(result!.text).toBe("selected");
    } finally {
      HTMLInputElement.prototype.click = original;
    }
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────

function profilesExcept(signal: RuntimeProfile["dismissalSignal"]) {
  return PROFILES.filter((p) => p.dismissalSignal !== signal);
}

function profilesByName(name: string): RuntimeProfile {
  const found = PROFILES.find((p) => p.name === name);
  if (!found) throw new Error(`No runtime profile named "${name}"`);
  return found;
}
