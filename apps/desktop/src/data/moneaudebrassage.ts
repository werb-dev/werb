/**
 * moneaudebrassage.fr source-water lookup.
 *
 * The site exposes a public per-commune endpoint keyed by INSEE code
 * (`code commune`, not the postal code): the latest official tap-water
 * analysis for every distribution network in that commune. We pull it
 * to pre-fill the water-chemistry source ions so FR brewers don't have
 * to copy six numbers by hand.
 *
 * The request is cross-origin and the API gates on the `Origin` header
 * — neither works from a browser `fetch` (CORS rejects it, and `Origin`
 * is a forbidden header the browser won't let JS set). So the fetch
 * goes through the Tauri HTTP plugin (a native request, no CORS, the
 * `Origin` header passes through). In the web build the feature is
 * unavailable and the caller falls back to manual entry / the last
 * cached pull.
 *
 * Data © moneaudebrassage.fr — attribute the source in the UI.
 */

import { isTauri } from "./runtime.ts";
import { WerbError } from "./errors.ts";

const API_BASE = "https://apidb.moneaudebrassage.fr/lastanalyses";
const ORIGIN = "https://www.moneaudebrassage.fr";

/** One distribution network's latest ion analysis (ppm). */
export interface WaterAnalysis {
  /** Network name as reported (`nomreseau`), e.g. "AIX LES BAINS PORTS". */
  network: string;
  ca_ppm: number;
  mg_ppm: number;
  na_ppm: number;
  cl_ppm: number;
  so4_ppm: number;
  hco3_ppm: number;
  /** Reported pH, when present. */
  ph?: number;
  /** Most recent analysis date among the ions (YYYY-MM-DD), when present. */
  date?: string;
}

/** Parsed result for one commune — usually one network, sometimes several. */
export interface CommuneAnalyses {
  insee: string;
  departement?: string;
  networks: WaterAnalysis[];
}

/** Raw shape of one `quartiers[]` entry from the API (only fields we read). */
interface RawQuartier {
  nomreseau?: unknown;
  quartier?: unknown;
  ca?: unknown;
  mg?: unknown;
  na?: unknown;
  cl?: unknown;
  so4?: unknown;
  hco3?: unknown;
  ph?: unknown;
  date_ca?: unknown;
  date_hco3?: unknown;
}

/** INSEE commune codes are 5 chars: digits, plus 2A/2B for Corsica. */
export function isValidInsee(code: string): boolean {
  return /^[0-9][0-9ab][0-9]{3}$/i.test(code.trim());
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function toAnalysis(q: RawQuartier): WaterAnalysis {
  const name = str(q.nomreseau) ?? str(q.quartier) ?? "—";
  const date = str(q.date_ca) ?? str(q.date_hco3);
  return {
    network: name,
    ca_ppm: num(q.ca),
    mg_ppm: num(q.mg),
    na_ppm: num(q.na),
    cl_ppm: num(q.cl),
    so4_ppm: num(q.so4),
    hco3_ppm: num(q.hco3),
    ...(typeof q.ph === "number" && q.ph > 0 ? { ph: q.ph } : {}),
    ...(date ? { date } : {}),
  };
}

/**
 * Fetch and parse the latest analyses for an INSEE commune code.
 *
 * Throws a {@link WerbError} the UI can translate:
 *   - `water.mab.web_unsupported` — not running under Tauri.
 *   - `water.mab.bad_code`        — code isn't a valid INSEE code.
 *   - `water.mab.not_found`       — commune has no published analysis.
 *   - `water.mab.network`         — request failed (offline, 5xx, …).
 */
export async function fetchCommuneAnalyses(rawCode: string): Promise<CommuneAnalyses> {
  const code = rawCode.trim().toUpperCase();
  if (!isValidInsee(code)) {
    throw new WerbError("water.mab.bad_code");
  }
  if (!isTauri()) {
    throw new WerbError("water.mab.web_unsupported");
  }

  // Dynamic import keeps the Tauri HTTP plugin out of the web bundle.
  const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");

  let res: Response;
  try {
    res = await tauriFetch(`${API_BASE}/${encodeURIComponent(code)}`, {
      method: "GET",
      headers: { Accept: "application/json", Origin: ORIGIN },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new WerbError("water.mab.network", { detail });
  }

  if (res.status === 404) throw new WerbError("water.mab.not_found");
  if (!res.ok) {
    throw new WerbError("water.mab.network", { detail: `HTTP ${res.status}` });
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new WerbError("water.mab.network", { detail });
  }

  const obj = (body ?? {}) as {
    inseecommune?: unknown;
    departement?: unknown;
    quartiers?: unknown;
  };
  const quartiers = Array.isArray(obj.quartiers) ? (obj.quartiers as RawQuartier[]) : [];
  // Keep only networks that actually carry ion data — the API
  // occasionally lists a network with every value at 0.
  const networks = quartiers
    .map(toAnalysis)
    .filter((a) => a.ca_ppm + a.mg_ppm + a.na_ppm + a.cl_ppm + a.so4_ppm + a.hco3_ppm > 0);

  if (networks.length === 0) throw new WerbError("water.mab.not_found");

  const departement = str(obj.departement);
  return {
    insee: str(obj.inseecommune) ?? code,
    ...(departement ? { departement } : {}),
    networks,
  };
}
