/**
 * PDF brew sheet — a real, paginated PDF for one brew session.
 *
 * Unlike the printable HTML (which leans on the browser's Print dialog),
 * this produces a genuine multi-page PDF with jsPDF + autotable: one
 * document that tells the whole story of a brew — recipe, targets vs.
 * the numbers actually measured on the day, the schedule, the
 * fermentation log, incidents, and the post-brew tasting (7-axis radar
 * + rating + tags). Built to be printed and slipped into a binder, the
 * way a paper brew sheet works.
 *
 * jsPDF and autotable are heavy (~150KB gzipped) and only needed when a
 * brewer actually exports, so this module is dynamically imported off
 * the export path and never lands in the cold-start bundle.
 *
 * Anchored on the session, not the recipe: one brew = one sheet. The
 * recipe is optional — if its file was deleted, the sheet still renders
 * from the snapshot fields on the session.
 */

import type { jsPDF } from "jspdf";
import type { BeerJsonRecipe } from "@werb/adapters";
import type { WerbSession, SensoryAxes } from "@werb/types";
import { isTauri } from "./runtime.ts";
import { WerbError } from "./errors.ts";
import { downloadBinaryFile } from "./browser-fs.ts";
import { slugify, type ExportResult } from "./recipe-export.ts";
import {
  DEFAULT_PREFS,
  formatColor,
  formatSpecificGravity,
  type UnitPreferences,
} from "./units-format.ts";

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * The numbers a brewer actually recorded, derived from the session's
 * measurements. Gravity readings are chronological: the first is OG
 * (pre-fermentation), the last is FG. ABV uses a measured value when
 * present, else the standard (OG − FG) × 131.25 estimate.
 */
export interface BrewActuals {
  og?: number;
  fg?: number;
  abv?: number;
}

export function deriveActuals(session: WerbSession): BrewActuals {
  const ms = session.measurements ?? [];
  const byTime = (a: { at: string }, b: { at: string }) => a.at.localeCompare(b.at);
  const gravities = ms.filter((m) => m.kind === "gravity_sg").sort(byTime);
  const abvs = ms.filter((m) => m.kind === "abv_pct").sort(byTime);

  const firstGravity = gravities[0];
  const lastGravity = gravities[gravities.length - 1];
  const lastAbv = abvs[abvs.length - 1];
  const og = firstGravity?.value;
  const fg = gravities.length > 1 ? lastGravity?.value : undefined;
  let abv = lastAbv?.value;
  if (abv === undefined && og !== undefined && fg !== undefined && og > fg) {
    abv = (og - fg) * 131.25;
  }
  return {
    ...(og !== undefined ? { og } : {}),
    ...(fg !== undefined ? { fg } : {}),
    ...(abv !== undefined ? { abv } : {}),
  };
}

/** Export a session as a paginated PDF brew sheet. */
export async function exportSessionPdf(
  session: WerbSession,
  recipe?: BeerJsonRecipe,
  prefs: UnitPreferences = DEFAULT_PREFS,
): Promise<ExportResult> {
  let bytes: Uint8Array;
  try {
    bytes = await buildSessionPdf(session, recipe, prefs);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { written: false, error: new WerbError("export.pdf_failed", { detail }) };
  }

  const filename = `${slugify(session.recipe_name ?? "brew")}-${session.started_at.slice(0, 10)}.pdf`;

  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const selected = await save({
      defaultPath: filename,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (typeof selected !== "string") return { written: false }; // cancelled
    try {
      const { writeFile } = await import("@tauri-apps/plugin-fs");
      await writeFile(selected, bytes);
      return { written: true, path: selected };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return { written: false, error: new WerbError("export.write_failed", { detail }) };
    }
  }

  try {
    downloadBinaryFile(filename, bytes, "application/pdf");
    return { written: true };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { written: false, error: new WerbError("export.download_failed", { detail }) };
  }
}

// ─── PDF construction ────────────────────────────────────────────────────────

const MARGIN = 40;
const INK = 17; // near-black for body text
const MUTED = 110;
const RULE = 210;
const ACCENT: [number, number, number] = [37, 99, 140];

interface Ctx {
  doc: jsPDF;
  prefs: UnitPreferences;
  pageW: number;
  pageH: number;
  y: number;
}

export async function buildSessionPdf(
  session: WerbSession,
  recipe: BeerJsonRecipe | undefined,
  prefs: UnitPreferences,
): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const ctx: Ctx = { doc, prefs, pageW, pageH, y: MARGIN };

  drawHeader(ctx, session, recipe);
  drawTargetsVsActuals(ctx, session, recipe, autoTable);
  if (recipe) drawRecipe(ctx, recipe, autoTable);
  drawSchedule(ctx, session, recipe, autoTable);
  drawFermentationLog(ctx, session, autoTable);
  drawIncidents(ctx, session);
  drawTasting(ctx, session, autoTable);

  paginateFooter(doc, pageW, pageH);

  return new Uint8Array(doc.output("arraybuffer"));
}

// ─── Sections ────────────────────────────────────────────────────────────────

function drawHeader(ctx: Ctx, session: WerbSession, recipe?: BeerJsonRecipe): void {
  const { doc, pageW } = ctx;
  const styleBits: string[] = [];
  if (recipe?.style) {
    const tag =
      recipe.style.category_number !== undefined && recipe.style.style_letter
        ? `${recipe.style.style_guide ?? "BJCP"} ${recipe.style.category_number}${recipe.style.style_letter}`
        : undefined;
    styleBits.push(...[tag, recipe.style.category, recipe.style.name].filter(isStr));
  }
  const kicker = [`Brew sheet · ${formatDate(session.started_at)}`, ...styleBits].join("  ·  ");

  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(MUTED);
  doc.text(kicker.toUpperCase(), MARGIN, ctx.y);
  ctx.y += 18;

  doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(INK);
  doc.text(session.recipe_name ?? "Untitled brew", MARGIN, ctx.y);
  ctx.y += 16;

  const meta: string[] = [];
  if (recipe) meta.push(`${Math.round(toL(recipe.batch_size))} L`);
  if (recipe?.boil?.boil_time) meta.push(`${Math.round(recipe.boil.boil_time.value)} min boil`);
  if (recipe?.efficiency?.brewhouse) meta.push(`${recipe.efficiency.brewhouse.value}% eff.`);
  if (recipe?.author && recipe.author !== "Unknown") meta.push(recipe.author);
  meta.push(statusLabel(session.status));
  if (session.completed_at) meta.push(`finished ${formatDate(session.completed_at)}`);

  doc.setFont("courier", "normal").setFontSize(9).setTextColor(MUTED);
  doc.text(meta.join("  ·  "), MARGIN, ctx.y);
  ctx.y += 10;

  doc.setDrawColor(RULE).setLineWidth(0.75).line(MARGIN, ctx.y, pageW - MARGIN, ctx.y);
  ctx.y += 18;
}

function drawTargetsVsActuals(
  ctx: Ctx,
  session: WerbSession,
  recipe: BeerJsonRecipe | undefined,
  autoTable: AutoTable,
): void {
  const { prefs } = ctx;
  const actuals = deriveActuals(session);
  const rows: string[][] = [];

  const sg = (v: number) => formatSpecificGravity(v, prefs).display;
  if (recipe?.original_gravity || actuals.og !== undefined) {
    rows.push([
      "OG",
      recipe?.original_gravity ? sg(recipe.original_gravity.value) : "—",
      actuals.og !== undefined ? sg(actuals.og) : "—",
    ]);
  }
  if (recipe?.final_gravity || actuals.fg !== undefined) {
    rows.push([
      "FG",
      recipe?.final_gravity ? sg(recipe.final_gravity.value) : "—",
      actuals.fg !== undefined ? sg(actuals.fg) : "—",
    ]);
  }
  if (recipe?.alcohol_by_volume || actuals.abv !== undefined) {
    rows.push([
      "ABV",
      recipe?.alcohol_by_volume ? `${recipe.alcohol_by_volume.value.toFixed(1)}%` : "—",
      actuals.abv !== undefined ? `${actuals.abv.toFixed(1)}%` : "—",
    ]);
  }
  if (recipe?.ibu_estimate?.ibu) rows.push(["IBU", String(recipe.ibu_estimate.ibu.value), "—"]);
  if (recipe?.color_estimate) {
    rows.push(["Color", formatColor(recipe.color_estimate, prefs).display, "—"]);
  }
  if (rows.length === 0) return;

  sectionHeading(ctx, "Targets vs. actuals");
  renderTable(ctx, autoTable, ["Metric", "Target", "Measured"], rows, [0.34, 0.33, 0.33]);
}

function drawRecipe(ctx: Ctx, r: BeerJsonRecipe, autoTable: AutoTable): void {
  const f = r.ingredients.fermentable_additions ?? [];
  if (f.length > 0) {
    sectionHeading(ctx, "Fermentables");
    renderTable(
      ctx,
      autoTable,
      ["Name", "Type", "Amount", "Color", "Yield"],
      f.map((x) => [
        x.name,
        x.type,
        amount(x.amount),
        x.color ? `${x.color.value} ${x.color.unit}` : "—",
        x.yield?.fine_grind ? `${x.yield.fine_grind.value}%` : "—",
      ]),
    );
  }

  const hops = r.ingredients.hop_additions ?? [];
  if (hops.length > 0) {
    sectionHeading(ctx, "Hops");
    renderTable(
      ctx,
      autoTable,
      ["Name", "Use", "Time", "Alpha", "Amount", "Form"],
      hops.map((h) => [
        h.name,
        h.timing?.use ? h.timing.use.replace("add_to_", "").replace(/_/g, " ") : "—",
        h.timing?.time ? `${h.timing.time.value} ${h.timing.time.unit}` : "—",
        h.alpha_acid ? `${h.alpha_acid.value}%` : "—",
        amount(h.amount),
        h.form ?? "—",
      ]),
    );
  }

  const cultures = r.ingredients.culture_additions ?? [];
  if (cultures.length > 0) {
    sectionHeading(ctx, "Cultures");
    renderTable(
      ctx,
      autoTable,
      ["Name", "Type", "Form", "Amount", "Attenuation"],
      cultures.map((c) => [
        c.name,
        c.type,
        c.form,
        c.amount && "value" in c.amount ? `${c.amount.value} ${c.amount.unit}` : "—",
        c.attenuation ? `${c.attenuation.value}%` : "—",
      ]),
    );
  }

  const miscs = r.ingredients.miscellaneous_additions ?? [];
  if (miscs.length > 0) {
    sectionHeading(ctx, "Miscellaneous");
    renderTable(
      ctx,
      autoTable,
      ["Name", "Type", "Use", "Time", "Amount"],
      miscs.map((m) => [
        m.name,
        m.type ?? "—",
        m.timing?.use ? m.timing.use.replace("add_to_", "").replace(/_/g, " ") : "—",
        m.timing?.time ? `${m.timing.time.value} ${m.timing.time.unit}` : "—",
        amount(m.amount),
      ]),
    );
  }
}

function drawSchedule(
  ctx: Ctx,
  session: WerbSession,
  recipe: BeerJsonRecipe | undefined,
  autoTable: AutoTable,
): void {
  if (recipe?.mash && recipe.mash.mash_steps.length > 0) {
    sectionHeading(ctx, "Mash schedule");
    renderTable(
      ctx,
      autoTable,
      ["Step", "Type", "Volume", "Temp", "Time"],
      recipe.mash.mash_steps.map((s) => [
        s.name,
        s.type,
        s.amount ? `${s.amount.value} ${s.amount.unit}` : "—",
        `${s.step_temperature.value} ${s.step_temperature.unit}`,
        `${s.step_time.value} ${s.step_time.unit}`,
      ]),
    );
  }

  if (session.steps.length > 0) {
    sectionHeading(ctx, "Brew-day timeline");
    renderTable(
      ctx,
      autoTable,
      ["Step", "Status", "Target", "Started", "Finished", "Notes"],
      session.steps.map((s) => [
        s.label,
        statusLabel(s.status),
        stepTarget(s.target_temperature_c, s.target_duration_min),
        s.started_at ? formatTime(s.started_at) : "—",
        s.completed_at ? formatTime(s.completed_at) : "—",
        s.notes ?? "",
      ]),
    );
  }
}

function drawFermentationLog(ctx: Ctx, session: WerbSession, autoTable: AutoTable): void {
  const ms = session.measurements ?? [];
  if (ms.length === 0) return;
  sectionHeading(ctx, "Fermentation & measurements");
  renderTable(
    ctx,
    autoTable,
    ["Date", "Time", "Reading", "Value", "During step", "Notes"],
    [...ms]
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((m) => [
        formatDate(m.at),
        formatTime(m.at),
        measurementLabel(m.kind),
        formatMeasurement(m.kind, m.value),
        m.step_id ? (session.steps.find((s) => s.id === m.step_id)?.label ?? "—") : "—",
        m.notes ?? "",
      ]),
  );
}

function drawIncidents(ctx: Ctx, session: WerbSession): void {
  const parts: string[] = [];
  if (session.notes) parts.push(session.notes);
  if (parts.length === 0) return;
  sectionHeading(ctx, "Incidents & notes");
  drawParagraph(ctx, parts.join("\n\n"));
}

function drawTasting(ctx: Ctx, session: WerbSession, autoTable: AutoTable): void {
  const tasting = session.tasting;
  if (!tasting) return;
  sectionHeading(ctx, "Tasting");

  // Radar on the left, headline facts on the right.
  const radarR = 70;
  const radarCx = MARGIN + radarR + 14;
  ensureSpace(ctx, radarR * 2 + 40);
  const radarCy = ctx.y + radarR + 8;
  drawRadar(ctx.doc, radarCx, radarCy, radarR, tasting.axes);

  const { doc } = ctx;
  const textX = radarCx + radarR + 36;
  let ty = ctx.y + 14;
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(INK);
  doc.text(`Overall rating: ${tasting.overall_rating} / 5`, textX, ty);
  ty += 16;
  doc.setFont("courier", "normal").setFontSize(9).setTextColor(MUTED);
  doc.text(`Tasted ${formatDate(tasting.tasted_at)}`, textX, ty);
  ty += 16;
  if (tasting.tags && tasting.tags.length > 0) {
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(INK);
    const wrapped = doc.splitTextToSize(tasting.tags.join("  ·  "), ctx.pageW - textX - MARGIN);
    doc.text(wrapped, textX, ty);
    ty += wrapped.length * 12;
  }

  ctx.y = Math.max(radarCy + radarR + 16, ty + 4);

  // Numeric companion to the radar — exact 0-5 axis values.
  renderTable(
    ctx,
    autoTable,
    ["Bitter", "Sweet", "Sour", "Hop", "Malt", "Body", "Carb"],
    [
      [
        String(tasting.axes.bitterness),
        String(tasting.axes.sweetness),
        String(tasting.axes.sourness),
        String(tasting.axes.hop_character),
        String(tasting.axes.malt_character),
        String(tasting.axes.body),
        String(tasting.axes.carbonation),
      ],
    ],
  );

  if (tasting.notes) drawParagraph(ctx, tasting.notes);
}

// ─── Drawing primitives ──────────────────────────────────────────────────────

const RADAR_AXES: Array<[keyof SensoryAxes, string]> = [
  ["bitterness", "Bitter"],
  ["hop_character", "Hop"],
  ["malt_character", "Malt"],
  ["sweetness", "Sweet"],
  ["body", "Body"],
  ["carbonation", "Carb"],
  ["sourness", "Sour"],
];

function drawRadar(doc: jsPDF, cx: number, cy: number, r: number, axes: SensoryAxes): void {
  const n = RADAR_AXES.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const at = (i: number, radius: number): [number, number] => [
    cx + radius * Math.cos(angle(i)),
    cy + radius * Math.sin(angle(i)),
  ];

  // Concentric grid rings (1..5) + spokes.
  doc.setDrawColor(RULE).setLineWidth(0.4);
  for (let ring = 1; ring <= 5; ring++) {
    polygon(doc, RADAR_AXES.map((_, i) => at(i, (r * ring) / 5)), "S");
  }
  RADAR_AXES.forEach((_, i) => {
    const [x, y] = at(i, r);
    doc.line(cx, cy, x, y);
  });

  // Axis labels just outside the ring.
  doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(MUTED);
  RADAR_AXES.forEach(([, label], i) => {
    const [lx, ly] = at(i, r + 11);
    doc.text(label, lx, ly, { align: "center", baseline: "middle" });
  });

  // Data polygon: translucent fill + solid outline.
  const dataPts = RADAR_AXES.map(([key], i) => {
    const v = Math.max(0, Math.min(5, axes[key] ?? 0));
    return at(i, (r * v) / 5);
  });
  doc.saveGraphicsState();
  // GState exists at runtime on the jsPDF instance; not in the lib's
  // narrow type, hence the cast.
  const GState = (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState;
  (doc as unknown as { setGState: (s: unknown) => void }).setGState(new GState({ opacity: 0.25 }));
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  polygon(doc, dataPts, "F");
  doc.restoreGraphicsState();
  doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]).setLineWidth(1);
  polygon(doc, dataPts, "S");
}

function polygon(doc: jsPDF, pts: Array<[number, number]>, style: "S" | "F" | "FD"): void {
  if (pts.length < 2) return;
  const start = pts[0]!;
  const deltas: Array<[number, number]> = pts.slice(1).map((p, i) => {
    const prev = pts[i]!;
    return [p[0] - prev[0], p[1] - prev[1]];
  });
  doc.lines(deltas, start[0], start[1], [1, 1], style, true);
}

// ─── Layout helpers ──────────────────────────────────────────────────────────

type AutoTable = (doc: jsPDF, opts: Record<string, unknown>) => void;

function sectionHeading(ctx: Ctx, title: string): void {
  ensureSpace(ctx, 40);
  const { doc, pageW } = ctx;
  ctx.y += 8;
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(INK);
  doc.text(title, MARGIN, ctx.y);
  ctx.y += 6;
  doc.setDrawColor(RULE).setLineWidth(0.5).line(MARGIN, ctx.y, pageW - MARGIN, ctx.y);
  ctx.y += 10;
}

function renderTable(
  ctx: Ctx,
  autoTable: AutoTable,
  head: string[],
  body: string[][],
  widthFractions?: number[],
): void {
  const { doc, pageW } = ctx;
  const usable = pageW - MARGIN * 2;
  const columnStyles = widthFractions
    ? Object.fromEntries(
        widthFractions.map((frac, i) => [i, { cellWidth: usable * frac }]),
      )
    : undefined;
  autoTable(doc, {
    head: [head],
    body,
    startY: ctx.y,
    margin: { left: MARGIN, right: MARGIN },
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 3, textColor: INK, lineColor: RULE, lineWidth: 0.3 },
    headStyles: {
      fillColor: [247, 247, 247],
      textColor: 80,
      fontStyle: "bold",
      fontSize: 7,
      lineColor: RULE,
      lineWidth: 0.3,
    },
    ...(columnStyles ? { columnStyles } : {}),
  });
  ctx.y = lastTableY(doc) + 14;
}

function drawParagraph(ctx: Ctx, text: string): void {
  const { doc, pageW } = ctx;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(INK);
  const lines = doc.splitTextToSize(text, pageW - MARGIN * 2) as string[];
  for (const line of lines) {
    ensureSpace(ctx, 14);
    doc.text(line, MARGIN, ctx.y);
    ctx.y += 12;
  }
  ctx.y += 4;
}

function ensureSpace(ctx: Ctx, needed: number): void {
  if (ctx.y + needed > ctx.pageH - MARGIN) {
    ctx.doc.addPage();
    ctx.y = MARGIN;
  }
}

function paginateFooter(doc: jsPDF, pageW: number, pageH: number): void {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(MUTED);
    doc.text("Exported from Werb", MARGIN, pageH - 18);
    doc.text(`${i} / ${total}`, pageW - MARGIN, pageH - 18, { align: "right" });
  }
}

/** autotable stamps `lastAutoTable.finalY` on the doc; not in its types. */
function lastTableY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? MARGIN;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function isStr(x: unknown): x is string {
  return typeof x === "string" && x.length > 0;
}

function amount(a: unknown): string {
  if (a && typeof a === "object" && "value" in a && "unit" in a) {
    const { value, unit } = a as { value: number; unit: string };
    if (unit === "kg" && value < 1) return `${Math.round(value * 1000)} g`;
    return `${value} ${unit}`;
  }
  return "—";
}

function toL(v: { value: number; unit: string }): number {
  if (v.unit === "ml") return v.value / 1000;
  if (v.unit === "gal") return v.value * 3.78541;
  return v.value;
}

function statusLabel(s: WerbSession["status"] | WerbSession["steps"][number]["status"]): string {
  const map: Record<string, string> = {
    draft: "Draft",
    in_progress: "In progress",
    completed: "Completed",
    abandoned: "Abandoned",
    pending: "Pending",
    active: "Active",
    done: "Done",
    skipped: "Skipped",
  };
  return map[s] ?? s;
}

function stepTarget(tempC?: number, durMin?: number): string {
  const parts: string[] = [];
  if (tempC !== undefined) parts.push(`${tempC.toFixed(1)} °C`);
  if (durMin !== undefined) parts.push(`${durMin} min`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

const MEASUREMENT_LABELS: Record<string, string> = {
  gravity_sg: "Gravity",
  temperature_c: "Temperature",
  ph: "pH",
  volume_l: "Volume",
  abv_pct: "ABV",
};
const MEASUREMENT_UNITS: Record<string, string> = {
  gravity_sg: "SG",
  temperature_c: "°C",
  ph: "",
  volume_l: "L",
  abv_pct: "%",
};

function measurementLabel(kind: string): string {
  return MEASUREMENT_LABELS[kind] ?? kind;
}

function formatMeasurement(kind: string, value: number): string {
  const unit = MEASUREMENT_UNITS[kind] ?? "";
  const v = kind === "gravity_sg" ? value.toFixed(3) : kind === "ph" ? value.toFixed(2) : value.toFixed(1);
  return unit ? `${v} ${unit}` : v;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}
