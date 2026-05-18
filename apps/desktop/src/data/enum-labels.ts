/**
 * Translate the BeerJSON enum strings (fermentable type, hop form,
 * culture form / type, misc type) into the user's locale.
 *
 * BeerJSON enum values come with mixed punctuation — spaces in
 * "all grain", a hyphen in "mixed-culture", an underscore-free
 * "water_agent" in our catalog type. The lookup folds them all to
 * underscore form so a single key namespace (`enum.<group>.<slug>`)
 * covers every value.
 */

type Translator = (key: string, vars?: Record<string, string | number>) => string;

function slug(value: string): string {
  return value.replace(/[ -]/g, "_");
}

function translateOrFallback(
  t: Translator,
  group: string,
  value: string | undefined,
): string {
  if (!value) return "";
  const key = `enum.${group}.${slug(value)}`;
  const out = t(key);
  // Translator returns the key itself when missing — surface the
  // raw enum value rather than a debug-looking "enum.foo.bar".
  return out === key ? value : out;
}

export function fermentableTypeLabel(t: Translator, type: string | undefined): string {
  return translateOrFallback(t, "fermentable", type);
}

export function hopFormLabel(t: Translator, form: string | undefined): string {
  return translateOrFallback(t, "hop_form", form);
}

export function cultureFormLabel(t: Translator, form: string | undefined): string {
  return translateOrFallback(t, "culture_form", form);
}

export function cultureTypeLabel(t: Translator, type: string | undefined): string {
  return translateOrFallback(t, "culture_type", type);
}

export function miscTypeLabel(t: Translator, type: string | undefined): string {
  return translateOrFallback(t, "misc_type", type);
}
