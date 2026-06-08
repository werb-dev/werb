import { toLiters } from "@werb/adapters";
import type { BeerJsonRecipe } from "@werb/adapters";
import { computeWaterAdditions, suggestWaterAdditions } from "@werb/calc";
import type { WaterAdditionsInput, WaterAdditionsOutput } from "@werb/types";
import { SOURCE_WATER_PROFILES, type SourceWaterProfile } from "../../data/catalog/index.ts";
import { useT } from "../../data/preferences.tsx";
import { usePersistedJson } from "../../storage/index.ts";
import { Section } from "./Section.tsx";
import { CarbField } from "./CarbFields.tsx";

const WATER_STORAGE_PREFIX = "werb.water.";
// Source water is the brewer's tap / RO / spring — same across recipes
// for most home brewers. Caching the latest entry as a preference auto-
// fills new recipes without forcing the user to retype.
const WATER_SOURCE_PREFS_KEY = "local.prefs.water";

interface IonProfile {
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
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? Math.max(0, n) : 0);
        }}
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
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange(Number.isFinite(n) ? Math.max(0, n) : 0);
          }}
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
