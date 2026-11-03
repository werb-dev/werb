import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describeErrors, stripNulls, validateBeerJson } from "../src/index.js";

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

describe("stripNulls", () => {
  it("drops null properties at any depth, keeps everything else", () => {
    expect(
      stripNulls({ a: null, b: 0, c: "", d: { e: null, f: [1, { g: null, h: false }] } }),
    ).toEqual({ b: 0, c: "", d: { f: [1, { h: false }] } });
  });

  it("lets a document with null optional properties validate", () => {
    const doc = load("brewdog-punk-ipa-2007.beerjson") as {
      beerjson: { recipes: Array<Record<string, unknown>> };
    };
    doc.beerjson.recipes[0]!.ibu_estimate = null;
    doc.beerjson.recipes[0]!.notes = null;
    expect(validateBeerJson(doc).valid).toBe(false);
    expect(validateBeerJson(stripNulls(doc)).valid).toBe(true);
  });
});

describe("describeErrors", () => {
  const recipeWith = (patch: (r: Record<string, unknown>) => void) => {
    const doc = load("brewdog-punk-ipa-2007.beerjson") as {
      beerjson: { recipes: Array<Record<string, unknown>> };
    };
    patch(doc.beerjson.recipes[0]!);
    return doc;
  };
  const describe1 = (doc: unknown) => describeErrors(doc, validateBeerJson(doc).errors);

  it("names a bad enum value and the allowed ones", () => {
    const doc = recipeWith((r) => {
      r.type = "all-grain";
    });
    expect(describe1(doc)).toBe(
      '/beerjson/recipes/0/type: "all-grain" is not one of "cider", "kombucha", "soda", "other", "mead", "wine", "extract", "partial mash", "all grain"',
    );
  });

  it("names a missing required property", () => {
    const doc = recipeWith((r) => {
      delete r.batch_size;
    });
    expect(describe1(doc)).toBe('/beerjson/recipes/0: missing required property "batch_size"');
  });

  it("names the value of a wrong type", () => {
    const doc = recipeWith((r) => {
      r.name = 42;
    });
    expect(describe1(doc)).toBe("/beerjson/recipes/0/name: expected string, found 42");
  });
});

