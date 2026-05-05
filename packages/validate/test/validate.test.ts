import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateBeerJson } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES = join(__dirname, "../../../examples");

function load(name: string): unknown {
  return JSON.parse(readFileSync(join(EXAMPLES, name), "utf8"));
}

describe("validateBeerJson", () => {
  it("accepts every recipe in examples/", () => {
    const files = [
      "double-ipa-mandarina.beerjson",
      "mosaic-smash-neipa.beerjson",
      "brewdog-punk-ipa-2007.beerjson",
    ];
    for (const f of files) {
      const result = validateBeerJson(load(f));
      if (!result.valid) {
        console.error(`Errors in ${f}:`, result.errors.slice(0, 5));
      }
      expect(result.valid, `${f} should validate`).toBe(true);
      expect(result.errors).toHaveLength(0);
    }
  });

  it("reports an error path + message for missing required fields", () => {
    const broken = {
      beerjson: {
        version: 2.06,
        recipes: [
          // Missing batch_size, ingredients, etc.
          { name: "Bad", type: "all grain", author: "x", efficiency: { brewhouse: { value: 75, unit: "%" } } },
        ],
      },
    };
    const result = validateBeerJson(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    // First error should point inside the broken recipe and name a missing prop.
    expect(result.errors[0]!.path).toMatch(/^\/beerjson\/recipes\/0/);
    expect(result.errors.some((e) => /required property/.test(e.message))).toBe(true);
  });

  it("rejects non-object input cleanly", () => {
    const result = validateBeerJson(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
