import type { BeerJsonRecipe } from "@werb/adapters";

/**
 * Recipe export — BeerJSON, BeerXML, and "print to PDF" via the
 * browser. All three open a native Tauri save dialog (or a print
 * dialog for PDF) and write the file from the renderer.
 *
 * BeerJSON export wraps the stored recipe in the `{ beerjson: { ... } }`
 * envelope. BeerXML export converts the BeerJSON shape back into a
 * BeerXML 1.0 document — the inverse of what `werb-beerxml` does on
 * import — covering the same Pareto field set so a recipe round-trips
 * cleanly between the two formats.
 */

export interface ExportResult {
  /** True when a file was written. False when the user cancelled. */
  written: boolean;
  /** Human-readable error message when something went wrong. */
  error?: string;
  /** Path the file was saved to (when written). */
  path?: string;
}

/**
 * Sanitize a recipe name into a filename: ASCII-friendly and safe on
 * every desktop OS. "Hazy IPA / Mosaic" → "hazy-ipa-mosaic".
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "recipe";
}

/**
 * Save text contents to a file. Desktop: native save dialog + Tauri-fs
 * write, returning the chosen path. Browser: fall back to a Blob +
 * anchor click download — no path to report back, so `path` is omitted.
 *
 * Returns `{ written: false }` (no error) when the user cancels.
 */
async function saveTextFile(
  recipe: BeerJsonRecipe,
  extension: "beerjson" | "xml" | "html",
  filterName: string,
  mime: string,
  contents: string,
): Promise<ExportResult> {
  const filename = `${slugify(recipe.name)}.${extension}`;
  const { isTauri } = await import("@tauri-apps/api/core");

  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const selected = await save({
      defaultPath: filename,
      filters: [{ name: filterName, extensions: [extension] }],
    });
    if (typeof selected !== "string") return { written: false }; // cancelled
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    try {
      await writeTextFile(selected, contents);
      return { written: true, path: selected };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return { written: false, error: `Write failed: ${detail || "unknown error"}` };
    }
  }

  // Browser: trigger a download. No way to confirm where the user saved
  // it (or whether they did), so we report success once the download
  // anchor has been clicked.
  const { downloadTextFile } = await import("./browser-fs.ts");
  try {
    downloadTextFile(filename, contents, mime);
    return { written: true };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { written: false, error: `Download failed: ${detail || "unknown error"}` };
  }
}

/** Export the recipe as a `.beerjson` file. */
export async function exportBeerJson(recipe: BeerJsonRecipe): Promise<ExportResult> {
  const file = {
    beerjson: {
      version: 2.06,
      recipes: [recipe],
    },
  };
  return saveTextFile(
    recipe,
    "beerjson",
    "BeerJSON",
    "application/json",
    JSON.stringify(file, null, 2),
  );
}

/**
 * Export the recipe as a standalone, print-friendly `.html` file.
 * Tauri's webview `window.print()` is unreliable on macOS / Linux —
 * generating a self-contained HTML doc that the brewer opens in any
 * browser and prints to PDF from there is more dependable and
 * portable.
 */
export async function exportRecipeHtml(recipe: BeerJsonRecipe): Promise<ExportResult> {
  return saveTextFile(
    recipe,
    "html",
    "HTML",
    "text/html",
    recipeToPrintableHtml(recipe),
  );
}

/** Standalone HTML document for printing — black on white, no externals. */
export function recipeToPrintableHtml(r: BeerJsonRecipe): string {
  const sections: string[] = [];
  const metaTag =
    r.style?.category_number !== undefined && r.style?.style_letter
      ? `${r.style.style_guide ?? "BJCP"} ${r.style.category_number}${r.style.style_letter}`
      : null;

  sections.push(`<header>
    ${r.style ? `<p class="kicker">${[metaTag, r.style.category, r.style.name].filter((x): x is string => Boolean(x)).map(esc).join(" · ")}</p>` : ""}
    <h1>${esc(r.name)}</h1>
    ${r.author && r.author !== "Unknown" ? `<p class="author">by ${esc(r.author)}</p>` : ""}
    <p class="meta">
      ${esc(String(Math.round(toL(r.batch_size))))} L
      ${r.boil?.boil_time ? ` · ${Math.round(r.boil.boil_time.value)} min boil` : ""}
      ${r.efficiency?.brewhouse ? ` · ${r.efficiency.brewhouse.value}% efficiency` : ""}
      ${r.type ? ` · ${esc(r.type)}` : ""}
    </p>
  </header>`);

  // Targets strip
  const targets: string[] = [];
  if (r.original_gravity) targets.push(tile("OG", r.original_gravity.value.toFixed(3)));
  if (r.final_gravity) targets.push(tile("FG", r.final_gravity.value.toFixed(3)));
  if (r.ibu_estimate?.ibu) targets.push(tile("IBU", String(r.ibu_estimate.ibu.value)));
  if (r.alcohol_by_volume) targets.push(tile("ABV", `${r.alcohol_by_volume.value.toFixed(1)}%`));
  if (r.color_estimate) targets.push(tile("Color", `${r.color_estimate.value} ${r.color_estimate.unit}`));
  if (targets.length > 0) sections.push(`<section class="tiles">${targets.join("")}</section>`);

  if (r.ingredients.fermentable_additions.length > 0) {
    sections.push(`<section><h2>Fermentables</h2>${
      table(
        ["Name", "Type", "Amount", "Color", "Yield"],
        r.ingredients.fermentable_additions.map((f) => [
          f.name,
          f.type,
          "value" in f.amount ? `${f.amount.value} ${f.amount.unit}` : "—",
          f.color ? `${f.color.value} ${f.color.unit}` : "—",
          f.yield?.fine_grind ? `${f.yield.fine_grind.value}%` : "—",
        ]),
      )
    }</section>`);
  }

  if (r.ingredients.hop_additions && r.ingredients.hop_additions.length > 0) {
    sections.push(`<section><h2>Hops</h2>${
      table(
        ["Name", "Use", "Time", "Alpha", "Amount", "Form"],
        r.ingredients.hop_additions.map((h) => [
          h.name,
          h.timing?.use ? h.timing.use.replace("add_to_", "").replace("_", " ") : "—",
          h.timing?.time ? `${h.timing.time.value} ${h.timing.time.unit}` : "—",
          h.alpha_acid ? `${h.alpha_acid.value}%` : "—",
          "value" in h.amount
            ? h.amount.unit === "kg"
              ? `${Math.round(h.amount.value * 1000)} g`
              : `${h.amount.value} ${h.amount.unit}`
            : "—",
          h.form ?? "—",
        ]),
      )
    }</section>`);
  }

  if (r.ingredients.culture_additions && r.ingredients.culture_additions.length > 0) {
    sections.push(`<section><h2>Cultures</h2>${
      table(
        ["Name", "Type", "Form", "Amount", "Attenuation"],
        r.ingredients.culture_additions.map((c) => [
          c.name,
          c.type,
          c.form,
          c.amount && "value" in c.amount ? `${c.amount.value} ${c.amount.unit}` : "—",
          c.attenuation ? `${c.attenuation.value}%` : "—",
        ]),
      )
    }</section>`);
  }

  if (r.ingredients.miscellaneous_additions && r.ingredients.miscellaneous_additions.length > 0) {
    sections.push(`<section><h2>Miscellaneous</h2>${
      table(
        ["Name", "Type", "Use", "Time", "Amount"],
        r.ingredients.miscellaneous_additions.map((m) => [
          m.name,
          m.type ?? "—",
          m.timing?.use ? m.timing.use.replace("add_to_", "").replace("_", " ") : "—",
          m.timing?.time ? `${m.timing.time.value} ${m.timing.time.unit}` : "—",
          "value" in m.amount ? `${m.amount.value} ${m.amount.unit}` : "—",
        ]),
      )
    }</section>`);
  }

  if (r.mash && r.mash.mash_steps.length > 0) {
    sections.push(`<section><h2>Mash schedule</h2>${
      table(
        ["Step", "Type", "Volume", "Temp", "Time"],
        r.mash.mash_steps.map((s) => [
          s.name,
          s.type,
          s.amount ? `${s.amount.value} ${s.amount.unit}` : "—",
          `${s.step_temperature.value} ${s.step_temperature.unit}`,
          `${s.step_time.value} ${s.step_time.unit}`,
        ]),
      )
    }</section>`);
  }

  if (r.notes) {
    sections.push(`<section><h2>Notes</h2><p class="notes">${esc(r.notes).replace(/\n/g, "<br>")}</p></section>`);
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(r.name)} — Werb recipe</title>
<style>
  :root { color-scheme: light; }
  body { margin: 2cm; max-width: 80ch; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; color: #111; background: #fff; }
  header { margin-bottom: 2rem; }
  .kicker { text-transform: uppercase; letter-spacing: 0.1em; font-size: 11px; color: #666; margin: 0 0 0.5rem; }
  h1 { font-size: 28px; margin: 0 0 0.25rem; line-height: 1.2; text-transform: capitalize; }
  .author { color: #666; font-size: 12px; margin: 0 0 0.5rem; }
  .meta { color: #444; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; margin: 0; }
  h2 { font-size: 16px; margin: 1.75rem 0 0.5rem; border-bottom: 1px solid #ddd; padding-bottom: 0.25rem; }
  section.tiles { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem; margin-bottom: 1.5rem; }
  .tile { border: 1px solid #ddd; padding: 0.5rem 0.75rem; border-radius: 4px; }
  .tile-label { text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; color: #666; }
  .tile-value { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 18px; margin-top: 0.15rem; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 1px solid #eee; }
  th { background: #f7f7f7; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; font-size: 10px; color: #555; }
  td.num { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  .notes { white-space: pre-wrap; }
  @page { margin: 1.5cm; }
  @media print { body { margin: 0; } section { break-inside: avoid; } }
</style>
</head>
<body>
${sections.join("\n")}
<footer style="margin-top:2rem;font-size:10px;color:#999">Exported from Werb</footer>
</body>
</html>`;
}

function tile(label: string, value: string): string {
  return `<div class="tile"><div class="tile-label">${esc(label)}</div><div class="tile-value">${esc(value)}</div></div>`;
}

function table(headers: string[], rows: string[][]): string {
  return `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${
    rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")
  }</tbody></table>`;
}

function toL(v: { value: number; unit: string }): number {
  if (v.unit === "l") return v.value;
  if (v.unit === "ml") return v.value / 1000;
  if (v.unit === "gal") return v.value * 3.78541;
  return v.value;
}

/** Export the recipe as a `.xml` (BeerXML 1.0) file. */
export async function exportBeerXml(recipe: BeerJsonRecipe): Promise<ExportResult> {
  return saveTextFile(
    recipe,
    "xml",
    "BeerXML",
    "application/xml",
    recipeToBeerXml(recipe),
  );
}

// ─── BeerXML serializer ───────────────────────────────────────────────────

/**
 * Encode a BeerJSON recipe as a BeerXML 1.0 document. Inverse of the
 * werb-beerxml crate's import path: covers the same Pareto fields
 * (recipe metadata, style, fermentables, hops, yeasts, miscs, mash).
 * Out of scope: water profiles, equipment block, fermentation /
 * packaging procedures.
 */
export function recipeToBeerXml(r: BeerJsonRecipe): string {
  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<RECIPES>`);
  lines.push(`  <RECIPE>`);
  lines.push(`    <NAME>${esc(r.name)}</NAME>`);
  lines.push(`    <VERSION>1</VERSION>`);
  lines.push(`    <TYPE>${recipeTypeToBeerXml(r.type)}</TYPE>`);
  if (r.author) lines.push(`    <BREWER>${esc(r.author)}</BREWER>`);
  lines.push(`    <BATCH_SIZE>${num(r.batch_size.value)}</BATCH_SIZE>`);
  if (r.boil) {
    if ("pre_boil_size" in r.boil) {
      const pbs = (r.boil as { pre_boil_size?: { value: number } }).pre_boil_size;
      if (pbs) lines.push(`    <BOIL_SIZE>${num(pbs.value)}</BOIL_SIZE>`);
    }
    if (r.boil.boil_time) lines.push(`    <BOIL_TIME>${num(r.boil.boil_time.value)}</BOIL_TIME>`);
  }
  if (r.efficiency?.brewhouse) {
    lines.push(`    <EFFICIENCY>${num(r.efficiency.brewhouse.value)}</EFFICIENCY>`);
  }

  if (r.style) {
    lines.push(`    <STYLE>`);
    lines.push(`      <NAME>${esc(r.style.name)}</NAME>`);
    lines.push(`      <VERSION>1</VERSION>`);
    if (r.style.category) lines.push(`      <CATEGORY>${esc(r.style.category)}</CATEGORY>`);
    if (r.style.category_number !== undefined)
      lines.push(`      <CATEGORY_NUMBER>${r.style.category_number}</CATEGORY_NUMBER>`);
    if (r.style.style_letter) lines.push(`      <STYLE_LETTER>${esc(r.style.style_letter)}</STYLE_LETTER>`);
    if (r.style.style_guide) lines.push(`      <STYLE_GUIDE>${esc(r.style.style_guide)}</STYLE_GUIDE>`);
    if (r.style.type) lines.push(`      <TYPE>${capitalize(r.style.type)}</TYPE>`);
    lines.push(`    </STYLE>`);
  }

  if (r.ingredients.fermentable_additions.length > 0) {
    lines.push(`    <FERMENTABLES>`);
    for (const f of r.ingredients.fermentable_additions) {
      lines.push(`      <FERMENTABLE>`);
      lines.push(`        <NAME>${esc(f.name)}</NAME>`);
      lines.push(`        <VERSION>1</VERSION>`);
      lines.push(`        <TYPE>${capitalize(f.type)}</TYPE>`);
      const amountKg = "value" in f.amount && f.amount.unit === "kg" ? f.amount.value : null;
      if (amountKg !== null) lines.push(`        <AMOUNT>${num(amountKg)}</AMOUNT>`);
      if (f.yield?.fine_grind?.value !== undefined)
        lines.push(`        <YIELD>${num(f.yield.fine_grind.value)}</YIELD>`);
      if (f.color?.value !== undefined) lines.push(`        <COLOR>${num(f.color.value)}</COLOR>`);
      if (f.origin) lines.push(`        <ORIGIN>${esc(f.origin)}</ORIGIN>`);
      if (f.producer) lines.push(`        <SUPPLIER>${esc(f.producer)}</SUPPLIER>`);
      lines.push(`      </FERMENTABLE>`);
    }
    lines.push(`    </FERMENTABLES>`);
  }

  if (r.ingredients.hop_additions && r.ingredients.hop_additions.length > 0) {
    lines.push(`    <HOPS>`);
    for (const h of r.ingredients.hop_additions) {
      lines.push(`      <HOP>`);
      lines.push(`        <NAME>${esc(h.name)}</NAME>`);
      lines.push(`        <VERSION>1</VERSION>`);
      if (h.alpha_acid?.value !== undefined) lines.push(`        <ALPHA>${num(h.alpha_acid.value)}</ALPHA>`);
      if ("value" in h.amount && h.amount.unit === "kg")
        lines.push(`        <AMOUNT>${num(h.amount.value)}</AMOUNT>`);
      if (h.timing?.use) lines.push(`        <USE>${hopUseToBeerXml(h.timing.use)}</USE>`);
      if (h.timing?.time?.value !== undefined)
        lines.push(`        <TIME>${num(h.timing.time.value)}</TIME>`);
      if (h.form) lines.push(`        <FORM>${capitalize(h.form)}</FORM>`);
      if (h.notes) lines.push(`        <NOTES>${esc(h.notes)}</NOTES>`);
      lines.push(`      </HOP>`);
    }
    lines.push(`    </HOPS>`);
  }

  if (r.ingredients.culture_additions && r.ingredients.culture_additions.length > 0) {
    lines.push(`    <YEASTS>`);
    for (const c of r.ingredients.culture_additions) {
      lines.push(`      <YEAST>`);
      lines.push(`        <NAME>${esc(c.name)}</NAME>`);
      lines.push(`        <VERSION>1</VERSION>`);
      lines.push(`        <TYPE>${cultureTypeToBeerXml(c.type)}</TYPE>`);
      lines.push(`        <FORM>${capitalize(c.form)}</FORM>`);
      if (c.amount && "value" in c.amount) {
        const isWeight = c.amount.unit === "g" || c.amount.unit === "kg";
        const valueL = c.amount.unit === "kg" ? c.amount.value : c.amount.unit === "g" ? c.amount.value / 1000 : c.amount.value;
        lines.push(`        <AMOUNT>${num(valueL)}</AMOUNT>`);
        lines.push(`        <AMOUNT_IS_WEIGHT>${isWeight ? "TRUE" : "FALSE"}</AMOUNT_IS_WEIGHT>`);
      }
      if (c.producer) lines.push(`        <LABORATORY>${esc(c.producer)}</LABORATORY>`);
      if (c.product_id) lines.push(`        <PRODUCT_ID>${esc(c.product_id)}</PRODUCT_ID>`);
      if (c.attenuation?.value !== undefined)
        lines.push(`        <ATTENUATION>${num(c.attenuation.value)}</ATTENUATION>`);
      if (c.temperature_range?.minimum?.value !== undefined)
        lines.push(`        <MIN_TEMPERATURE>${num(c.temperature_range.minimum.value)}</MIN_TEMPERATURE>`);
      if (c.temperature_range?.maximum?.value !== undefined)
        lines.push(`        <MAX_TEMPERATURE>${num(c.temperature_range.maximum.value)}</MAX_TEMPERATURE>`);
      lines.push(`      </YEAST>`);
    }
    lines.push(`    </YEASTS>`);
  }

  if (r.ingredients.miscellaneous_additions && r.ingredients.miscellaneous_additions.length > 0) {
    lines.push(`    <MISCS>`);
    for (const m of r.ingredients.miscellaneous_additions) {
      lines.push(`      <MISC>`);
      lines.push(`        <NAME>${esc(m.name)}</NAME>`);
      lines.push(`        <VERSION>1</VERSION>`);
      if (m.type) lines.push(`        <TYPE>${capitalize(m.type.replace("_", " "))}</TYPE>`);
      if (m.timing?.use) lines.push(`        <USE>${miscUseToBeerXml(m.timing.use)}</USE>`);
      if (m.timing?.time?.value !== undefined)
        lines.push(`        <TIME>${num(m.timing.time.value)}</TIME>`);
      if ("value" in m.amount) {
        const isWeight = m.amount.unit === "g" || m.amount.unit === "kg";
        const value = m.amount.unit === "kg" ? m.amount.value : m.amount.unit === "g" ? m.amount.value / 1000 : m.amount.value;
        lines.push(`        <AMOUNT>${num(value)}</AMOUNT>`);
        lines.push(`        <AMOUNT_IS_WEIGHT>${isWeight ? "TRUE" : "FALSE"}</AMOUNT_IS_WEIGHT>`);
      }
      lines.push(`      </MISC>`);
    }
    lines.push(`    </MISCS>`);
  }

  if (r.mash && r.mash.mash_steps.length > 0) {
    lines.push(`    <MASH>`);
    lines.push(`      <NAME>${esc(r.mash.name ?? "Mash")}</NAME>`);
    lines.push(`      <VERSION>1</VERSION>`);
    if (r.mash.grain_temperature?.value !== undefined)
      lines.push(`      <GRAIN_TEMP>${num(r.mash.grain_temperature.value)}</GRAIN_TEMP>`);
    lines.push(`      <MASH_STEPS>`);
    for (const s of r.mash.mash_steps) {
      lines.push(`        <MASH_STEP>`);
      lines.push(`          <NAME>${esc(s.name)}</NAME>`);
      lines.push(`          <VERSION>1</VERSION>`);
      lines.push(`          <TYPE>${capitalize(s.type)}</TYPE>`);
      if (s.amount?.value !== undefined)
        lines.push(`          <INFUSE_AMOUNT>${num(s.amount.value)}</INFUSE_AMOUNT>`);
      lines.push(`          <STEP_TEMP>${num(s.step_temperature.value)}</STEP_TEMP>`);
      lines.push(`          <STEP_TIME>${num(s.step_time.value)}</STEP_TIME>`);
      lines.push(`        </MASH_STEP>`);
    }
    lines.push(`      </MASH_STEPS>`);
    lines.push(`    </MASH>`);
  }

  if (r.original_gravity?.value !== undefined)
    lines.push(`    <EST_OG>${r.original_gravity.value.toFixed(3)} SG</EST_OG>`);
  if (r.final_gravity?.value !== undefined)
    lines.push(`    <EST_FG>${r.final_gravity.value.toFixed(3)} SG</EST_FG>`);
  if (r.color_estimate?.value !== undefined)
    lines.push(`    <EST_COLOR>${num(r.color_estimate.value)} ${r.color_estimate.unit}</EST_COLOR>`);
  if (r.ibu_estimate?.ibu?.value !== undefined)
    lines.push(`    <IBU>${num(r.ibu_estimate.ibu.value)}</IBU>`);
  if (r.notes) lines.push(`    <NOTES>${esc(r.notes)}</NOTES>`);

  lines.push(`  </RECIPE>`);
  lines.push(`</RECIPES>`);
  return lines.join("\n");
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function num(n: number): string {
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : "0";
}

function capitalize(s: string): string {
  return s
    .split(/[ _-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function recipeTypeToBeerXml(t: string): string {
  if (t === "all grain") return "All Grain";
  if (t === "partial mash") return "Partial Mash";
  if (t === "extract") return "Extract";
  return capitalize(t);
}

function hopUseToBeerXml(use: string): string {
  switch (use) {
    case "add_to_boil": return "Boil";
    case "add_to_fermentation": return "Dry Hop";
    case "add_to_mash": return "Mash";
    case "add_to_package": return "Bottling";
    default: return "Boil";
  }
}

function miscUseToBeerXml(use: string): string {
  switch (use) {
    case "add_to_boil": return "Boil";
    case "add_to_mash": return "Mash";
    case "add_to_fermentation": return "Primary";
    case "add_to_package": return "Bottling";
    default: return "Boil";
  }
}

function cultureTypeToBeerXml(t: string): string {
  if (t === "ale" || t === "lager" || t === "wheat" || t === "wine" || t === "champagne") {
    return capitalize(t);
  }
  // BeerXML 1.0's TYPE enum is narrow; map exotic types to "Ale" as a
  // safe fallback. Exporters that round-trip to BeerXML lose the precise
  // strain category, but the recipe still imports cleanly elsewhere.
  return "Ale";
}
