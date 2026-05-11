import { describe, it, expect, vi, afterEach } from "vitest";
import { downloadTextFile, pickAndReadTextFile } from "../src/data/browser-fs.ts";

describe("downloadTextFile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a Blob, drops an anchor, and clicks it", () => {
    const clicks: HTMLElement[] = [];
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      clicks.push(this);
    };

    try {
      downloadTextFile("test.json", '{"hello":"world"}', "application/json");
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
    }

    expect(clicks).toHaveLength(1);
    const anchor = clicks[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("test.json");
    expect(anchor.href).toMatch(/^blob:/);
  });

  it("removes the anchor from the DOM after the click", () => {
    HTMLAnchorElement.prototype.click = () => {};
    const before = document.querySelectorAll("a").length;
    downloadTextFile("x.txt", "hi", "text/plain");
    expect(document.querySelectorAll("a").length).toBe(before);
  });
});

describe("pickAndReadTextFile", () => {
  it("resolves with file name + text when one is selected", async () => {
    let createdInput: HTMLInputElement | null = null;
    HTMLInputElement.prototype.click = function () {
      createdInput = this as HTMLInputElement;
      // Simulate the user picking a file by attaching one and firing change.
      const file = new File(["hello"], "greet.txt", { type: "text/plain" });
      Object.defineProperty(this, "files", {
        value: [file],
        configurable: true,
      });
      this.dispatchEvent(new Event("change"));
    };

    const result = await pickAndReadTextFile(".txt");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("greet.txt");
    expect(result!.text).toBe("hello");
    expect(createdInput).not.toBeNull();
    // Input is cleaned up after selection.
    expect(document.body.contains(createdInput)).toBe(false);
  });

  it("resolves with null when the change fires with no files", async () => {
    HTMLInputElement.prototype.click = function () {
      Object.defineProperty(this, "files", {
        value: [],
        configurable: true,
      });
      this.dispatchEvent(new Event("change"));
    };

    const result = await pickAndReadTextFile(".txt");
    expect(result).toBeNull();
  });

  it("resolves with null when the picker fires a 'cancel' event", async () => {
    HTMLInputElement.prototype.click = function () {
      // Modern browsers dispatch 'cancel' on the input when the user
      // dismisses the picker without selecting anything.
      this.dispatchEvent(new Event("cancel"));
    };

    const result = await pickAndReadTextFile(".txt");
    expect(result).toBeNull();
  });
});
