import { useState } from "react";
import { toLiters } from "@werb/adapters";
import type { BeerJsonRecipe } from "@werb/adapters";
import { computeWaterAdditions, suggestWaterAdditions } from "@werb/calc";
import type { WaterAdditionsInput, WaterAdditionsOutput } from "@werb/types";
import { SOURCE_WATER_PROFILES, type SourceWaterProfile } from "../../data/catalog/index.ts";
import { useT } from "../../data/preferences.tsx";
import { translateError } from "../../data/errors.ts";
import { isTauri } from "../../data/runtime.ts";
import {
  fetchCommuneAnalyses,
  isValidInsee,
  type CommuneAnalyses,
  type WaterAnalysis,
} from "../../data/moneaudebrassage.ts";
import { usePersistedJson } from "../../storage/index.ts";
import { Section } from "./Section.tsx";
import { CarbField } from "./CarbFields.tsx";
import { useNumericText } from "../../components/editor/Fields.tsx";

const WATER_STORAGE_PREFIX = "werb.water.";
// Source water is the brewer's tap / RO / spring — same across recipes
// for most home brewers. Caching the latest entry as a preference auto-
// fills new recipes without forcing the user to retype.
const WATER_SOURCE_PREFS_KEY = "local.prefs.water";

export interface IonProfile {
  ca_ppm: number;
  mg_ppm: number;
  na_ppm: number;
  cl_ppm: number;
  so4_ppm: number;
  hco3_ppm: number;
}

interface SaltAmounts {
  gypsum_g: number;
  calcium_chloride_g: number;
  epsom_g: number;
  table_salt_g: number;
  baking_soda_g: number;
}

interface WaterFormState {
  source: IonProfile;
  target_key: string;
  custom_target: IonProfile | null;
  salts: SaltAmounts;
  // Total water volume override. null → derive from recipe + active
  // profile losses (default).
  volume_l_override: number | null;
}

const ZERO_IONS: IonProfile = {
  ca_ppm: 0, mg_ppm: 0, na_ppm: 0, cl_ppm: 0, so4_ppm: 0, hco3_ppm: 0,
};

const ZERO_SALTS: SaltAmounts = {
  gypsum_g: 0, calcium_chloride_g: 0, epsom_g: 0, table_salt_g: 0, baking_soda_g: 0,
};

// City-named targets pull from the source-water catalog so picking the
// same name on both sides reports a real match (e.g. source Burton +
// target Burton → no additions needed). Separate hand-rolled numbers
// drift over time, which is exactly the bug this prevents.
function sourceAsTarget(key: string): IonProfile {
  const src = SOURCE_WATER_PROFILES.find((p) => p.key === key);
  if (!src) {
    throw new Error(`sourceAsTarget: no source profile for "${key}"`);
  }
  return {
    ca_ppm: src.ca_ppm,
    mg_ppm: src.mg_ppm,
    na_ppm: src.na_ppm,
    cl_ppm: src.cl_ppm,
    so4_ppm: src.so4_ppm,
    hco3_ppm: src.hco3_ppm,
  };
}

// Style-aligned target ion profiles. Round-numbered, drawn from Palmer
// and Bru'n Water common-target tables. "off" disables comparison —
// useful when the brewer just wants the resulting strip. The `key`
// doubles as the i18n suffix (`recipe.water.target.{key}`).
const TARGETS: Array<{ key: string; profile: IonProfile | null }> = [
  { key: "off", profile: null },
  { key: "balanced", profile: { ca_ppm: 80, mg_ppm: 10, na_ppm: 20, cl_ppm: 80, so4_ppm: 80, hco3_ppm: 80 } },
  { key: "pilsner", profile: { ca_ppm: 50, mg_ppm: 5, na_ppm: 5, cl_ppm: 25, so4_ppm: 25, hco3_ppm: 0 } },
  { key: "pale_ale", profile: { ca_ppm: 100, mg_ppm: 10, na_ppm: 15, cl_ppm: 60, so4_ppm: 150, hco3_ppm: 0 } },
  { key: "american_ipa", profile: { ca_ppm: 110, mg_ppm: 10, na_ppm: 15, cl_ppm: 50, so4_ppm: 250, hco3_ppm: 0 } },
  { key: "burton", profile: sourceAsTarget("burton") },
  { key: "munich", profile: sourceAsTarget("munich") },
  { key: "dublin_stout", profile: { ca_ppm: 120, mg_ppm: 10, na_ppm: 15, cl_ppm: 70, so4_ppm: 60, hco3_ppm: 250 } },
];

// Persist the last moneaudebrassage pull globally (not per-recipe) so a
// brewer's home commune is one click away on the next recipe and stays
// usable offline.
const MAB_CACHE_KEY = "local.prefs.water.mab";

export function analysisToIons(a: WaterAnalysis): IonProfile {
  return {
    ca_ppm: a.ca_ppm,
    mg_ppm: a.mg_ppm,
    na_ppm: a.na_ppm,
    cl_ppm: a.cl_ppm,
    so4_ppm: a.so4_ppm,
    hco3_ppm: a.hco3_ppm,
  };
}

/**
 * Pull source ions off a recipe's BeerJSON `water_additions` (WaterBase).
 * Concentrations are stored as ppm/mg-L objects; for dilute brewing
 * water the two are interchangeable, so we read `.value` directly.
 * Returns null when the recipe carries no usable source profile.
 */
export function recipeSourceIons(recipe: BeerJsonRecipe): IonProfile | null {
  const additions = (recipe.ingredients as { water_additions?: unknown[] }).water_additions;
  if (!Array.isArray(additions) || additions.length === 0) return null;
  const w = additions[0] as Record<string, { value?: unknown } | undefined>;
  const conc = (key: string): number => {
    const v = w[key]?.value;
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  };
  const ions: IonProfile = {
    ca_ppm: conc("calcium"),
    mg_ppm: conc("magnesium"),
    na_ppm: conc("sodium"),
    cl_ppm: conc("chloride"),
    so4_ppm: conc("sulfate"),
    hco3_ppm: conc("bicarbonate"),
  };
  const total =
    ions.ca_ppm + ions.mg_ppm + ions.na_ppm + ions.cl_ppm + ions.so4_ppm + ions.hco3_ppm;
  return total > 0 ? ions : null;
}

const FLAVOR_HINT_KEYS: Record<WaterAdditionsOutput["flavor_hint"], string> = {
  very_malty: "recipe.water.flavor_label.very_malty",
  malty: "recipe.water.flavor_label.malty",
  balanced: "recipe.water.flavor_label.balanced",
  hoppy: "recipe.water.flavor_label.hoppy",
  very_hoppy: "recipe.water.flavor_label.very_hoppy",
  none: "—",
};

export function WaterChemistrySection({ recipe }: { recipe: BeerJsonRecipe }) {
  const tt = useT();
  const batchL = toLiters(recipe.batch_size);

  // The total water that mixes with salts is mash + sparge — well
  // larger than the finished batch. Approximate as 1.4× batch when
  // we don't have a better number; the brewer can override.
  const defaultVolumeL = Math.round(batchL * 1.4 * 10) / 10;

  const [savedSource, setSavedSource] = usePersistedJson<IonProfile>(
    WATER_SOURCE_PREFS_KEY,
    ZERO_IONS,
  );
  const [form, setForm] = usePersistedJson<WaterFormState>(
    `${WATER_STORAGE_PREFIX}${recipe.name}`,
    {
      source: savedSource,
      target_key: "off",
      custom_target: null,
      salts: ZERO_SALTS,
      volume_l_override: null,
    },
  );

  const updateSource = (next: IonProfile) =>
    setForm((prev) => ({ ...prev, source: next }));

  const updateSalt = <K extends keyof SaltAmounts>(key: K, value: number) =>
    setForm((prev) => ({
      ...prev,
      salts: { ...prev.salts, [key]: Math.max(0, value) },
    }));

  const waterVolume = form.volume_l_override ?? defaultVolumeL;
  const target = TARGETS.find((t) => t.key === form.target_key)?.profile ?? null;

  // Inverse calc: suggest salt grams that move the source toward the chosen
  // target, then drop them into the editable salt fields so the brewer can
  // tweak from there (the forward flow stays the source of truth).
  const suggestSalts = () => {
    if (!target) return;
    const out = suggestWaterAdditions({
      water_volume_l: waterVolume,
      source: form.source,
      target,
    });
    setForm((prev) => ({
      ...prev,
      salts: {
        gypsum_g: out.additions.gypsum_g,
        calcium_chloride_g: out.additions.calcium_chloride_g,
        epsom_g: out.additions.epsom_g,
        table_salt_g: out.additions.table_salt_g,
        baking_soda_g: out.additions.baking_soda_g,
      },
    }));
  };

  const calcInput: WaterAdditionsInput = {
    water_volume_l: waterVolume,
    source: form.source,
    additions: {
      ...(form.salts.gypsum_g > 0 && { gypsum_g: form.salts.gypsum_g }),
      ...(form.salts.calcium_chloride_g > 0 && {
        calcium_chloride_g: form.salts.calcium_chloride_g,
      }),
      ...(form.salts.epsom_g > 0 && { epsom_g: form.salts.epsom_g }),
      ...(form.salts.table_salt_g > 0 && { table_salt_g: form.salts.table_salt_g }),
      ...(form.salts.baking_soda_g > 0 && { baking_soda_g: form.salts.baking_soda_g }),
    },
  };
  const result = computeWaterAdditions(calcInput);

  return (
    <Section
      title={tt("recipe.water.section_title")}
      subtitle={tt("recipe.water.subtitle")}
      testId="water-chemistry"
    >
      <div className="rounded-xl bg-surface border border-border p-4 sm:p-6">
        <SourceWaterRow
          source={form.source}
          onChange={updateSource}
          onSaveDefault={() => setSavedSource(form.source)}
          savedMatches={ionsEqual(form.source, savedSource)}
        />

        <SourceProfileLoaders
          recipeIons={recipeSourceIons(recipe)}
          recipeMatches={(ions) => ionsEqual(form.source, ions)}
          onLoad={updateSource}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <CarbField
            label={tt("recipe.water.total")}
            unit="L"
            value={waterVolume}
            step={0.5}
            onChange={(v) =>
              setForm((prev) => ({
                ...prev,
                volume_l_override: Math.abs(v - defaultVolumeL) < 0.01 ? null : v,
              }))
            }
            hint={tt("recipe.water.default_volume", { volume: defaultVolumeL.toFixed(1) })}
          />
          <label className="block sm:col-span-1 md:col-span-3">
            <span className="block text-caption uppercase tracking-widest text-text-muted mb-1">
              {tt("recipe.water.target_profile")}
            </span>
            <select
              data-testid="water-target-select"
              value={form.target_key}
              onChange={(e) => setForm((p) => ({ ...p, target_key: e.target.value }))}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-body text-text focus:outline-none focus:border-accent"
            >
              {TARGETS.map((tgt) => (
                <option key={tgt.key} value={tgt.key}>
                  {tt(`recipe.water.target.${tgt.key}`)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <SaltsRow
          salts={form.salts}
          onChange={updateSalt}
          onSuggest={suggestSalts}
          canSuggest={target !== null}
        />

        <ResultStrip result={result} target={target} />

        <div className="mt-5 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-surface-raised border border-border px-4 py-3">
            <p className="text-caption uppercase tracking-widest text-text-muted">
              {tt("recipe.water.so4_cl")}
            </p>
            <p className="font-mono text-h3 mt-1">
              {result.so4_cl_ratio > 0 ? result.so4_cl_ratio.toFixed(2) : "—"}
            </p>
          </div>
          <div className="rounded-lg bg-surface-raised border border-border px-4 py-3">
            <p className="text-caption uppercase tracking-widest text-text-muted">
              {tt("recipe.water.flavor")}
            </p>
            <p className="font-mono text-h3 mt-1">
              {result.flavor_hint === "none"
                ? "—"
                : tt(FLAVOR_HINT_KEYS[result.flavor_hint])}
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

/** Picks a preset whose six ions match the current source. Lets the
 *  dropdown stay in sync after a manual tweak: switch back to the
 *  exact preset numbers and the matching name shows up again. */
function matchingProfileKey(source: IonProfile): string | "" {
  const hit = SOURCE_WATER_PROFILES.find((p) =>
    p.ca_ppm === source.ca_ppm &&
    p.mg_ppm === source.mg_ppm &&
    p.na_ppm === source.na_ppm &&
    p.cl_ppm === source.cl_ppm &&
    p.so4_ppm === source.so4_ppm &&
    p.hco3_ppm === source.hco3_ppm,
  );
  return hit?.key ?? "";
}

function profileToIons(p: SourceWaterProfile): IonProfile {
  return {
    ca_ppm: p.ca_ppm,
    mg_ppm: p.mg_ppm,
    na_ppm: p.na_ppm,
    cl_ppm: p.cl_ppm,
    so4_ppm: p.so4_ppm,
    hco3_ppm: p.hco3_ppm,
  };
}

function SourceWaterRow({
  source,
  onChange,
  onSaveDefault,
  savedMatches,
}: {
  source: IonProfile;
  onChange: (next: IonProfile) => void;
  onSaveDefault: () => void;
  savedMatches: boolean;
}) {
  const t = useT();
  const currentProfileKey = matchingProfileKey(source);
  return (
    <>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <p className="text-caption uppercase tracking-widest text-text-muted">
          {t("recipe.water.source_ppm")}
        </p>
        <button
          type="button"
          onClick={onSaveDefault}
          disabled={savedMatches}
          className="text-caption text-text-muted hover:text-accent disabled:opacity-40 disabled:cursor-default transition-colors"
        >
          {savedMatches ? t("recipe.water.saved_default") : t("recipe.water.save_default")}
        </button>
      </div>
      <label className="block mb-3">
        <span className="block text-caption uppercase tracking-widest text-text-muted mb-1">
          {t("recipe.water.source_profile")}
        </span>
        <select
          data-testid="water-source-select"
          value={currentProfileKey}
          onChange={(e) => {
            const picked = SOURCE_WATER_PROFILES.find((p) => p.key === e.target.value);
            if (picked) onChange(profileToIons(picked));
          }}
          className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-body text-text focus:outline-none focus:border-accent"
        >
          {currentProfileKey === "" && (
            <option value="">{t("recipe.water.source_custom")}</option>
          )}
          {SOURCE_WATER_PROFILES.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name}
              {p.notes ? ` — ${p.notes}` : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        <IonField label="Ca²⁺" value={source.ca_ppm} onChange={(v) => onChange({ ...source, ca_ppm: v })} />
        <IonField label="Mg²⁺" value={source.mg_ppm} onChange={(v) => onChange({ ...source, mg_ppm: v })} />
        <IonField label="Na⁺" value={source.na_ppm} onChange={(v) => onChange({ ...source, na_ppm: v })} />
        <IonField label="Cl⁻" value={source.cl_ppm} onChange={(v) => onChange({ ...source, cl_ppm: v })} />
        <IonField label="SO₄²⁻" value={source.so4_ppm} onChange={(v) => onChange({ ...source, so4_ppm: v })} />
        <IonField label="HCO₃⁻" value={source.hco3_ppm} onChange={(v) => onChange({ ...source, hco3_ppm: v })} />
      </div>
    </>
  );
}

/**
 * Two one-click ways to fill the source ions without typing:
 *   1. From the recipe's own BeerJSON water profile, when it carries one.
 *   2. From the moneaudebrassage.fr public analysis for a French commune
 *      (desktop only — the API is cross-origin + Origin-gated, which a
 *      browser fetch can't do). The last pull is cached so the brewer's
 *      home commune stays one tap away and works offline.
 */
function SourceProfileLoaders({
  recipeIons,
  recipeMatches,
  onLoad,
}: {
  recipeIons: IonProfile | null;
  recipeMatches: (ions: IonProfile) => boolean;
  onLoad: (ions: IonProfile) => void;
}) {
  const t = useT();
  const desktop = isTauri();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cache, setCache] = usePersistedJson<CommuneAnalyses | null>(MAB_CACHE_KEY, null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetchCommuneAnalyses(code);
      setCache(res);
      // One network → apply straight away; several → let the brewer
      // pick from the list the panel renders below.
      const only = res.networks[0];
      if (res.networks.length === 1 && only) onLoad(analysisToIons(only));
    } catch (err) {
      setError(translateError(err, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {recipeIons && (
          <button
            type="button"
            onClick={() => onLoad(recipeIons)}
            disabled={recipeMatches(recipeIons)}
            className="text-caption font-medium text-accent hover:opacity-80 disabled:opacity-40 disabled:cursor-default transition-opacity"
          >
            {recipeMatches(recipeIons)
              ? t("recipe.water.from_recipe_loaded")
              : t("recipe.water.from_recipe")}
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="text-caption font-medium text-accent hover:opacity-80 transition-opacity"
        >
          {t("recipe.water.from_mab")}
        </button>
      </div>

      {open && (
        <div
          data-testid="water-mab-panel"
          className="rounded-lg bg-surface-raised border border-border p-3"
        >
          {desktop ? (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <label className="block">
                  <span className="block text-caption uppercase tracking-widest text-text-muted mb-1">
                    {t("recipe.water.mab_insee")}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={code}
                    placeholder="73008"
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && isValidInsee(code) && !loading) submit();
                    }}
                    className="w-28 bg-bg border border-border rounded-lg px-2 py-1.5 text-body-sm font-mono tabular-nums text-text focus:outline-none focus:border-accent"
                  />
                </label>
                <button
                  type="button"
                  onClick={submit}
                  disabled={loading || !isValidInsee(code)}
                  className="rounded-lg bg-accent text-bg px-3 py-1.5 text-body-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-default transition-opacity"
                >
                  {loading ? t("recipe.water.mab_loading") : t("recipe.water.mab_load")}
                </button>
              </div>
              {error && <p className="mt-2 text-caption text-warning">{error}</p>}
              {cache && cache.networks.length > 0 && (
                <MabNetworkList
                  commune={cache}
                  onPick={(a) => onLoad(analysisToIons(a))}
                />
              )}
            </>
          ) : (
            <p className="text-caption text-text-muted">{t("recipe.water.mab_desktop_only")}</p>
          )}
          <p className="mt-3 text-caption text-text-muted opacity-70">
            {t("recipe.water.mab_attribution")}
          </p>
        </div>
      )}
    </div>
  );
}

/** Per-network rows from a moneaudebrassage pull; click one to apply. */
function MabNetworkList({
  commune,
  onPick,
}: {
  commune: CommuneAnalyses;
  onPick: (a: WaterAnalysis) => void;
}) {
  const t = useT();
  return (
    <div className="mt-3">
      <p className="text-caption uppercase tracking-widest text-text-muted mb-2">
        {t("recipe.water.mab_networks", { insee: commune.insee })}
      </p>
      <div className="flex flex-col gap-1">
        {commune.networks.map((a, i) => (
          <button
            key={`${a.network}-${i}`}
            type="button"
            onClick={() => onPick(a)}
            className="text-left rounded-lg border border-border px-3 py-2 hover:border-accent transition-colors"
          >
            <span className="block text-body-sm text-text">
              {a.network}
              {a.date ? <span className="text-text-muted"> · {a.date}</span> : null}
            </span>
            <span className="block text-caption font-mono text-text-muted mt-0.5">
              Ca {a.ca_ppm.toFixed(0)} · Mg {a.mg_ppm.toFixed(0)} · Na {a.na_ppm.toFixed(0)} · Cl{" "}
              {a.cl_ppm.toFixed(0)} · SO₄ {a.so4_ppm.toFixed(0)} · HCO₃ {a.hco3_ppm.toFixed(0)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SaltsRow({
  salts,
  onChange,
  onSuggest,
  canSuggest,
}: {
  salts: SaltAmounts;
  onChange: <K extends keyof SaltAmounts>(key: K, value: number) => void;
  onSuggest: () => void;
  canSuggest: boolean;
}) {
  const t = useT();
  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <p className="text-caption uppercase tracking-widest text-text-muted">
          {t("recipe.water.salts")}
        </p>
        <button
          type="button"
          onClick={onSuggest}
          disabled={!canSuggest}
          title={
            canSuggest
              ? t("recipe.water.suggest_hint")
              : t("recipe.water.suggest_disabled")
          }
          className="text-caption font-medium text-accent hover:opacity-80 disabled:opacity-40 disabled:cursor-default transition-opacity"
        >
          {t("recipe.water.suggest")}
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <SaltField label={t("recipe.water.gypsum")} sub="CaSO₄" value={salts.gypsum_g} onChange={(v) => onChange("gypsum_g", v)} />
        <SaltField label={t("recipe.water.cacl2")} sub="dihydrate" value={salts.calcium_chloride_g} onChange={(v) => onChange("calcium_chloride_g", v)} />
        <SaltField label={t("recipe.water.epsom")} sub="MgSO₄" value={salts.epsom_g} onChange={(v) => onChange("epsom_g", v)} />
        <SaltField label={t("recipe.water.table_salt")} sub="NaCl" value={salts.table_salt_g} onChange={(v) => onChange("table_salt_g", v)} />
        <SaltField label={t("recipe.water.baking_soda")} sub="NaHCO₃" value={salts.baking_soda_g} onChange={(v) => onChange("baking_soda_g", v)} />
      </div>
    </div>
  );
}

function ResultStrip({
  result,
  target,
}: {
  result: WaterAdditionsOutput;
  target: IonProfile | null;
}) {
  const t = useT();
  const ions: Array<{ label: string; key: string; value: number; targetVal: number | undefined }> = [
    { label: "Ca²⁺", key: "ca", value: result.ca_ppm, targetVal: target?.ca_ppm },
    { label: "Mg²⁺", key: "mg", value: result.mg_ppm, targetVal: target?.mg_ppm },
    { label: "Na⁺", key: "na", value: result.na_ppm, targetVal: target?.na_ppm },
    { label: "Cl⁻", key: "cl", value: result.cl_ppm, targetVal: target?.cl_ppm },
    { label: "SO₄²⁻", key: "so4", value: result.so4_ppm, targetVal: target?.so4_ppm },
    { label: "HCO₃⁻", key: "hco3", value: result.hco3_ppm, targetVal: target?.hco3_ppm },
  ];
  return (
    <div
      data-testid="water-result-strip"
      className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-px bg-border rounded-xl overflow-hidden"
    >
      {ions.map((ion) => {
        const delta = ion.targetVal !== undefined ? ion.value - ion.targetVal : null;
        // Tolerance is generous — water chemistry isn't a precision
        // game, and chasing the last few ppm encourages over-adjusting.
        const tolerance = ion.targetVal !== undefined ? Math.max(15, ion.targetVal * 0.2) : 0;
        const offTarget = delta !== null && Math.abs(delta) > tolerance;
        return (
          <div
            key={ion.label}
            data-testid={`water-ion-${ion.key}`}
            data-off-target={offTarget ? "true" : "false"}
            className="bg-surface px-3 py-3 sm:px-4"
          >
            <p className="text-[10px] sm:text-caption uppercase tracking-widest text-text-muted">{ion.label}</p>
            <p className={`font-mono text-body sm:text-h3 mt-1 ${offTarget ? "text-warning" : "text-text"}`}>
              {ion.value.toFixed(0)}
            </p>
            {ion.targetVal !== undefined && (
              <p className={`font-mono text-caption mt-1 ${offTarget ? "text-warning" : "text-text-muted"}`}>
                {t("recipe.water.target", { value: ion.targetVal })}
                {delta !== null && Math.abs(delta) >= 1 && (
                  <>
                    {" · "}
                    {delta > 0 ? "+" : ""}
                    {delta.toFixed(0)}
                  </>
                )}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function IonField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="block text-caption font-mono text-text-muted mb-1">{label}</span>
      <input
        type="number"
        min={0}
        step={1}
        {...useNumericText(value, (n) => onChange(Math.max(0, n)))}
        className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-body-sm font-mono tabular-nums text-text focus:outline-none focus:border-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
    </label>
  );
}

function SaltField({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="block text-caption uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <span className="block text-caption font-mono text-text-muted opacity-70 mb-1">
        {sub}
      </span>
      <div className="flex items-baseline gap-1 bg-bg border border-border rounded-lg px-2 py-1.5 focus-within:border-accent">
        <input
          type="number"
          min={0}
          step={0.5}
          {...useNumericText(value, (n) => onChange(Math.max(0, n)))}
          className="w-full bg-transparent text-body-sm font-mono tabular-nums text-text focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-caption font-mono text-text-muted shrink-0">g</span>
      </div>
    </label>
  );
}

function ionsEqual(a: IonProfile, b: IonProfile): boolean {
  return (
    a.ca_ppm === b.ca_ppm &&
    a.mg_ppm === b.mg_ppm &&
    a.na_ppm === b.na_ppm &&
    a.cl_ppm === b.cl_ppm &&
    a.so4_ppm === b.so4_ppm &&
    a.hco3_ppm === b.hco3_ppm
  );
}
