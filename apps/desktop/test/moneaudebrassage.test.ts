import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCommuneAnalyses, isValidInsee } from "../src/data/moneaudebrassage.ts";
import { isWerbError } from "../src/data/errors.ts";

// The module fetches through the Tauri HTTP plugin (dynamic import).
// Mock the plugin so we can drive responses without a real network /
// Tauri runtime.
const tauriFetch = vi.fn();
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: (...args: unknown[]) => tauriFetch(...args) }));

const TAURI_KEY = "__TAURI_INTERNALS__";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

// One commune, two networks: the second has every ion at 0 and must be
// dropped by the parser.
const SAMPLE = {
  departement: "73",
  inseecommune: "73008",
  quartiers: [
    {
      nomreseau: "AIX LES BAINS PORTS",
      ca: 54.5,
      cl: 10.1,
      mg: 5.75,
      na: 5.9,
      so4: 12.8,
      hco3: 183,
      ph: 8,
      date_ca: "2026-04-22",
    },
    {
      nomreseau: "EMPTY NETWORK",
      ca: 0,
      cl: 0,
      mg: 0,
      na: 0,
      so4: 0,
      hco3: 0,
      ph: 0,
    },
  ],
};

describe("isValidInsee", () => {
  it("accepts 5-digit metropolitan codes", () => {
    expect(isValidInsee("73008")).toBe(true);
    expect(isValidInsee(" 75056 ")).toBe(true); // trims
  });

  it("accepts Corsican 2A / 2B codes", () => {
    expect(isValidInsee("2A004")).toBe(true);
    expect(isValidInsee("2b033")).toBe(true);
  });

  it("rejects malformed codes", () => {
    expect(isValidInsee("7300")).toBe(false); // too short
    expect(isValidInsee("730080")).toBe(false); // too long
    expect(isValidInsee("ABCDE")).toBe(false);
    expect(isValidInsee("")).toBe(false);
  });
});

describe("fetchCommuneAnalyses", () => {
  beforeEach(() => {
    tauriFetch.mockReset();
    (globalThis as Record<string, unknown>).window = globalThis as unknown as Window;
    (window as unknown as Record<string, unknown>)[TAURI_KEY] = {};
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>)[TAURI_KEY];
  });

  it("rejects a bad code before touching the network", async () => {
    await expect(fetchCommuneAnalyses("nope")).rejects.toMatchObject({ code: "water.mab.bad_code" });
    expect(tauriFetch).not.toHaveBeenCalled();
  });

  it("refuses to run outside Tauri", async () => {
    delete (window as unknown as Record<string, unknown>)[TAURI_KEY];
    await expect(fetchCommuneAnalyses("73008")).rejects.toMatchObject({
      code: "water.mab.web_unsupported",
    });
    expect(tauriFetch).not.toHaveBeenCalled();
  });

  it("parses networks, drops empty ones, and reads ph + date", async () => {
    tauriFetch.mockResolvedValue(jsonResponse(SAMPLE));
    const res = await fetchCommuneAnalyses("73008");

    expect(res.insee).toBe("73008");
    expect(res.departement).toBe("73");
    expect(res.networks).toHaveLength(1);
    expect(res.networks[0]).toMatchObject({
      network: "AIX LES BAINS PORTS",
      ca_ppm: 54.5,
      mg_ppm: 5.75,
      na_ppm: 5.9,
      cl_ppm: 10.1,
      so4_ppm: 12.8,
      hco3_ppm: 183,
      ph: 8,
      date: "2026-04-22",
    });
  });

  it("sends the Origin header the API gates on", async () => {
    tauriFetch.mockResolvedValue(jsonResponse(SAMPLE));
    await fetchCommuneAnalyses("73008");
    const [url, opts] = tauriFetch.mock.calls[0];
    expect(url).toContain("/lastanalyses/73008");
    expect((opts as { headers: Record<string, string> }).headers.Origin).toBe(
      "https://www.moneaudebrassage.fr",
    );
  });

  it("maps a 404 to not_found", async () => {
    tauriFetch.mockResolvedValue(jsonResponse({}, 404));
    await expect(fetchCommuneAnalyses("73008")).rejects.toMatchObject({
      code: "water.mab.not_found",
    });
  });

  it("treats a commune with only empty networks as not_found", async () => {
    tauriFetch.mockResolvedValue(
      jsonResponse({ inseecommune: "00000", quartiers: [SAMPLE.quartiers[1]] }),
    );
    await expect(fetchCommuneAnalyses("00000")).rejects.toMatchObject({
      code: "water.mab.not_found",
    });
  });

  it("wraps a transport failure as a network error", async () => {
    tauriFetch.mockRejectedValue(new Error("offline"));
    const err = await fetchCommuneAnalyses("73008").catch((e) => e);
    expect(isWerbError(err) && err.code).toBe("water.mab.network");
    expect(err.params?.detail).toContain("offline");
  });
});
