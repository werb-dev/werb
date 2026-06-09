import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateBeerJson } from "@werb/validate";

/**
 * Every bundled example must be valid BeerJSON. The app loads them via
 * `import.meta.glob` + `validateBeerJson` and *silently skips* anything that
 * fails (recipes.ts), so an invalid sample would just quietly disappear from
 * "Import samples" — and from the README screenshots. This test fails loudly
 * with the offending file + schema errors instead.
 */
const EXAMPLES_DIR = join(__dirname, "../../../examples");

const files = readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith(".beerjson"));

describe("bundled examples are valid BeerJSON", () => {
  it("ships at least the curated sample set", () => {
    expect(files.length).toBeGreaterThanOrEqual(6);
  });

  for (const file of files) {
    it(`${file} validates`, () => {
      const parsed = JSON.parse(readFileSync(join(EXAMPLES_DIR, file), "utf8"));
      const result = validateBeerJson(parsed);
      expect(
        result.valid,
        `${file} failed BeerJSON validation: ${JSON.stringify(result.errors?.slice(0, 5), null, 2)}`,
      ).toBe(true);
    });
  }
});
