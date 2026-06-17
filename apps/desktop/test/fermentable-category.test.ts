import { describe, it, expect } from "vitest";
import type { FermentableAddition } from "@werb/adapters";
import { changeFermentableType } from "../src/screens/RecipeEditor.tsx";

const PALE: FermentableAddition = {
  name: "Pale 2-Row",
  type: "grain",
  amount: { value: 4.5, unit: "kg" },
  color: { value: 4, unit: "EBC" },
  yield: { fine_grind: { value: 80, unit: "%" } },
  producer: "Crisp",
  origin: "UK",
} as FermentableAddition;

describe("changeFermentableType (#50)", () => {
  it("resets the stale catalog identity when the category actually changes", () => {
    const next = changeFermentableType(PALE, "honey");
    expect(next.type).toBe("honey");
    // The grain's name + spec no longer apply to a honey.
    expect(next.name).toBe("");
    expect(next.color).toBeUndefined();
    expect(next.yield).toBeUndefined();
    expect(next.producer).toBeUndefined();
    expect(next.origin).toBeUndefined();
  });

  it("keeps the amount the brewer already set", () => {
    expect(changeFermentableType(PALE, "sugar").amount).toEqual({ value: 4.5, unit: "kg" });
  });

  it("is a no-op (same reference) when the type is unchanged", () => {
    expect(changeFermentableType(PALE, "grain")).toBe(PALE);
  });
});
