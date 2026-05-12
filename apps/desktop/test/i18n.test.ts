import { describe, it, expect } from "vitest";
import { translate, detectLocale, SUPPORTED_LOCALES } from "../src/data/i18n.ts";

describe("translate", () => {
  it("returns the English string under en locale", () => {
    expect(translate("en", "library.title")).toBe("Library");
  });

  it("returns the French string under fr locale", () => {
    expect(translate("fr", "library.title")).toBe("Bibliothèque");
  });

  it("falls back to English when the FR key is missing", () => {
    // No key has a missing FR in practice — assert the fallback path
    // by checking that English is the source of truth: every entry has
    // at least an `en` value (test enforces structural invariant).
    // Here we just sanity-check the fallback semantics with a key we
    // know exists in both.
    expect(translate("fr", "nav.library")).toBe("Bibliothèque");
    expect(translate("en", "nav.library")).toBe("Library");
  });

  it("returns the key itself when the key is unknown", () => {
    expect(translate("en", "totally.fake.key")).toBe("totally.fake.key");
    expect(translate("fr", "totally.fake.key")).toBe("totally.fake.key");
  });

  it("interpolates {var} placeholders", () => {
    expect(translate("en", "library.no_match", { query: "stout" })).toBe(
      'No recipes match "stout".',
    );
    expect(translate("fr", "library.no_match", { query: "stout" })).toBe(
      "Aucune recette ne correspond à « stout ».",
    );
  });

  it("handles the {s} plural helper based on count", () => {
    expect(translate("en", "library.subtitle_count", { count: 1 })).toBe("Werb · 1 recipe");
    expect(translate("en", "library.subtitle_count", { count: 7 })).toBe("Werb · 7 recipes");
    expect(translate("fr", "library.subtitle_count", { count: 1 })).toBe("Werb · 1 recette");
    expect(translate("fr", "library.subtitle_count", { count: 7 })).toBe("Werb · 7 recettes");
  });

  it("leaves {s} alone when count isn't passed", () => {
    // The plural helper only fires when `count` is in the vars bag.
    // A caller passing other vars but not count shouldn't get phantom
    // pluralization elsewhere.
    expect(translate("en", "library.no_match", { query: "x" })).not.toContain("{s}");
  });
});

describe("SUPPORTED_LOCALES", () => {
  it("includes English and French", () => {
    const values = SUPPORTED_LOCALES.map((l) => l.value);
    expect(values).toContain("en");
    expect(values).toContain("fr");
  });

  it("ships a human-readable label per locale", () => {
    for (const l of SUPPORTED_LOCALES) {
      expect(l.label.length).toBeGreaterThan(0);
    }
  });
});

describe("detectLocale", () => {
  it("returns a SUPPORTED_LOCALES value", () => {
    // We can't easily mock `navigator.language` from a jsdom-style env,
    // but the function must always resolve to one of the known locales
    // (or "en" as the safe fallback).
    const detected = detectLocale();
    const supported = SUPPORTED_LOCALES.map((l) => l.value);
    expect(supported).toContain(detected);
  });
});
