import { describe, it, expect } from "vitest";
import {
  EMPTY_CATALOG,
  findPrice,
  normalizeKey,
  removePrice,
  upsertPrice,
} from "../src/data/prices.ts";

describe("price catalog helpers", () => {
  it("normalizes keys to lower-case + trimmed", () => {
    expect(normalizeKey("Mosaic")).toBe("mosaic");
    expect(normalizeKey("  PALE ALE MALT ")).toBe("pale ale malt");
  });

  it("upsertPrice adds a new entry when the key doesn't exist", () => {
    const next = upsertPrice(EMPTY_CATALOG, "Mosaic", 0.04, "g");
    expect(next.prices).toHaveLength(1);
    expect(next.prices[0]!.key).toBe("mosaic");
    expect(next.prices[0]!.unit_price).toBe(0.04);
    expect(next.prices[0]!.natural_unit).toBe("g");
    expect(next.prices[0]!.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("upsertPrice overwrites the existing entry for the same key", () => {
    const first = upsertPrice(EMPTY_CATALOG, "Mosaic", 0.04, "g");
    const second = upsertPrice(first, "mosaic", 0.05, "g");
    expect(second.prices).toHaveLength(1);
    expect(second.prices[0]!.unit_price).toBe(0.05);
  });

  it("upsertPrice treats capitalization variants as the same ingredient", () => {
    const a = upsertPrice(EMPTY_CATALOG, "Mosaic", 0.04, "g");
    const b = upsertPrice(a, "MOSAIC", 0.06, "g");
    expect(b.prices).toHaveLength(1);
    expect(b.prices[0]!.unit_price).toBe(0.06);
  });

  it("findPrice returns the matching entry regardless of input case", () => {
    const c = upsertPrice(EMPTY_CATALOG, "Pale Ale Malt", 2.5, "kg");
    expect(findPrice(c, "pale ale malt")?.unit_price).toBe(2.5);
    expect(findPrice(c, "PALE ALE MALT")?.unit_price).toBe(2.5);
    expect(findPrice(c, "mosaic")).toBeUndefined();
  });

  it("removePrice drops the entry by case-insensitive key", () => {
    let c = upsertPrice(EMPTY_CATALOG, "Mosaic", 0.04, "g");
    c = upsertPrice(c, "Citra", 0.05, "g");
    const next = removePrice(c, "MOSAIC");
    expect(next.prices.map((p) => p.key)).toEqual(["citra"]);
  });
});
