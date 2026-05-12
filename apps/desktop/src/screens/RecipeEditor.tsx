import { useEffect, useState } from "react";
import type {
  BeerJsonRecipe,
  CultureAddition,
  CultureType,
  FermentableAddition,
  HopAddition,
  MashProcedure,
  MashStep,
  MiscAddition,
  TimeType,
} from "@werb/adapters";
import { isMass, toCelsius, toGrams, toKilograms, toLiters, toSrm } from "@werb/adapters";
import {
  searchCultures,
  searchFermentables,
  searchHops,
  searchMiscs,
  searchStyles,
  type CultureEntry,
  type FermentableEntry,
  type HopEntry,
  type MiscEntry,
  type StyleEntry,
} from "../data/catalog/index.ts";
import { useUnits } from "../data/preferences.tsx";
import {
  celsiusToUserTemp,
  colorUnitLabel,
  kgToUserMassLarge,
  kgToUserMassSmall,
  litersToUserVolume,
  massLargeUnitLabel,
  massSmallUnitLabel,
  srmToUserColor,
  tempUnitLabel,
  userColorToSrm,
  userMassLargeToKg,
  userMassSmallToG,
  userTempToCelsius,
  userVolumeToLiters,
  volumeUnitLabel,
} from "../data/units-format.ts";

/**
 * Pareto in-app recipe editor. Edits metadata + ingredients + mash schedule
 * in place; on save commits the whole recipe back to the store via onSave.
 *
 * Out of scope for v1: fermentation procedure, water profile, packaging.
 * Those round-trip from BeerXML/BeerJSON imports and rarely need editing.
 */

interface RecipeEditorProps {
  recipe: BeerJsonRecipe;
  onClose: () => void;
  onSave: (updated: BeerJsonRecipe) => void;
}

export function RecipeEditor({ recipe, onClose, onSave }: RecipeEditorProps) {
  const [draft, setDraft] = useState<BeerJsonRecipe>(recipe);

  const update = <K extends keyof BeerJsonRecipe>(key: K, value: BeerJsonRecipe[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const updateIngredients = (patch: Partial<BeerJsonRecipe["ingredients"]>) =>
    setDraft((d) => ({ ...d, ingredients: { ...d.ingredients, ...patch } }));

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  return (
    <div className="min-h-dvh bg-bg text-text">
      <main className="mx-auto max-w-4xl px-4 pt-12 pb-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <header className="mb-8 sm:mb-10 flex items-center justify-between gap-4">
          <button
            onClick={onClose}
            className="text-caption font-medium text-text-muted hover:text-text transition-colors flex items-center gap-2"
          >
            <span aria-hidden>←</span> Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-accent text-bg text-body-sm font-medium hover:opacity-90 transition-opacity min-h-[40px]"
          >
            Save changes
          </button>
        </header>

        <h1 className="text-h2 sm:text-h1 font-semibold mb-2">Edit recipe</h1>
        <p className="text-body text-text-muted mb-8 sm:mb-10">
          Changes are kept locally until you press <span className="text-text">Save changes</span>.
        </p>

        <MetadataSection draft={draft} update={update} />
        <FermentablesSection
          draft={draft}
          updateIngredients={updateIngredients}
        />
        <HopsSection draft={draft} updateIngredients={updateIngredients} />
        <CulturesSection draft={draft} updateIngredients={updateIngredients} />
        <MiscsSection draft={draft} updateIngredients={updateIngredients} />
        <MashSection draft={draft} update={update} />
      </main>
    </div>
  );
}

// ─── Metadata ─────────────────────────────────────────────────────────────

function MetadataSection({
  draft,
  update,
}: {
  draft: BeerJsonRecipe;
  update: <K extends keyof BeerJsonRecipe>(key: K, value: BeerJsonRecipe[K]) => void;
}) {
  return (
    <Section title="Recipe">
      <Field label="Name" value={draft.name} onChange={(v) => update("name", v)} required />
      <StylePicker
        className="mt-6"
        style={draft.style}
        onChange={(s) => update("style", s)}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-6">
        <SelectField
          label="Type"
          value={draft.type}
          onChange={(v) => update("type", v as BeerJsonRecipe["type"])}
          options={RECIPE_TYPES}
        />
        <Field
          label="Author"
          value={draft.author}
          onChange={(v) => update("author", v)}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-6">
        <VolumeField
          label="Batch size"
          valueL={toLiters(draft.batch_size)}
          onChangeL={(l) => update("batch_size", { value: l, unit: "l" })}
        />
        <NumberField
          label="Brewhouse efficiency"
          unit="%"
          value={draft.efficiency?.brewhouse?.value ?? 75}
          onChange={(v) =>
            update("efficiency", {
              ...draft.efficiency,
              brewhouse: { value: v, unit: "%" },
            })
          }
        />
      </div>
      <Field
        label="Notes"
        value={draft.notes ?? ""}
        onChange={(v) => update("notes", v || undefined)}
        textarea
        className="mt-6"
      />
    </Section>
  );
}

const RECIPE_TYPES: BeerJsonRecipe["type"][] = [
  "all grain",
  "partial mash",
  "extract",
  "cider",
  "kombucha",
  "mead",
  "soda",
  "wine",
  "other",
];

// ─── Fermentables ─────────────────────────────────────────────────────────

const FERMENTABLE_TYPES: FermentableAddition["type"][] = [
  "grain",
  "sugar",
  "extract",
  "dry extract",
  "fruit",
  "juice",
  "honey",
  "other",
];

function FermentablesSection({
  draft,
  updateIngredients,
}: {
  draft: BeerJsonRecipe;
  updateIngredients: (patch: Partial<BeerJsonRecipe["ingredients"]>) => void;
}) {
  const items = draft.ingredients.fermentable_additions;

  const addRow = () => {
    const fresh: FermentableAddition = {
      name: "New fermentable",
      type: "grain",
      amount: { value: 1, unit: "kg" },
      color: { value: 2, unit: "Lovi" },
      yield: { fine_grind: { value: 80, unit: "%" } },
    };
    updateIngredients({ fermentable_additions: [...items, fresh] });
  };

  const updateRow = (i: number, next: FermentableAddition) => {
    const copy = items.slice();
    copy[i] = next;
    updateIngredients({ fermentable_additions: copy });
  };

  const removeRow = (i: number) => {
    updateIngredients({
      fermentable_additions: items.filter((_, j) => j !== i),
    });
  };

  return (
    <Section title="Fermentables">
      <div className="rounded-xl bg-surface border border-border overflow-x-auto md:overflow-x-visible">
        <RowHeader
          cols={[
            { label: "Name", span: "col-span-4" },
            { label: "Type", span: "col-span-2" },
            { label: "Amount", span: "col-span-2" },
            { label: "Color", span: "col-span-2" },
            { label: "Yield", span: "col-span-1" },
            { label: "", span: "col-span-1" },
          ]}
        />
        {items.map((f, i) => (
          <div
            key={i}
            className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-border last:border-b-0 items-center hover:bg-surface-raised/40 transition-colors min-w-[720px] md:min-w-0"
          >
            <Combobox
              className="col-span-4"
              value={f.name}
              onChange={(v) => updateRow(i, { ...f, name: v })}
              suggest={searchFermentables}
              onPick={(entry) => updateRow(i, applyFermentableEntry(f, entry))}
              renderItem={(entry) => (
                <div>
                  <p className="text-body-sm font-medium text-text">{entry.name}</p>
                  <p className="font-mono text-caption text-text-muted mt-0.5">
                    <span className="capitalize">{entry.type}</span>
                    {" · "}
                    {entry.color_ebc} EBC · {entry.yield_pct}% yield
                    {entry.producer && ` · ${entry.producer}`}
                    {entry.origin && ` · ${entry.origin}`}
                  </p>
                </div>
              )}
            />
            <InlineSelect
              className="col-span-2"
              value={f.type}
              onChange={(v) =>
                updateRow(i, { ...f, type: v as FermentableAddition["type"] })
              }
              options={FERMENTABLE_TYPES}
            />
            <MassLargeInlineInput
              className="col-span-2"
              valueKg={isMass(f.amount) ? toKilograms(f.amount) : 0}
              onChangeKg={(kg) =>
                updateRow(i, { ...f, amount: { value: kg, unit: "kg" } })
              }
            />
            <ColorInlineInput
              className="col-span-2"
              valueSrm={f.color ? toSrm(f.color) : 0}
              onChangeSrm={(srm) =>
                // Normalize to SRM on edit. The display layer
                // (formatColor / Recipe screen) handles whichever unit
                // the imported recipe came with, so we don't lose
                // anything by canonicalizing the store.
                updateRow(i, { ...f, color: { value: srm, unit: "SRM" } })
              }
            />
            <InlineNumber
              className="col-span-1"
              value={f.yield?.fine_grind?.value ?? 0}
              unit="%"
              step={1}
              onChange={(v) =>
                updateRow(i, {
                  ...f,
                  yield: { ...f.yield, fine_grind: { value: v, unit: "%" } },
                })
              }
            />
            <div className="col-span-1 flex justify-end">
              <InlineDeleteButton onClick={() => removeRow(i)} />
            </div>
          </div>
        ))}
      </div>
      <AddRowButton label="+ Add fermentable" onClick={addRow} />
    </Section>
  );
}

// ─── Hops ─────────────────────────────────────────────────────────────────

const HOP_FORMS = ["pellet", "leaf", "leaf (wet)", "plug", "extract", "powder"] as const;
const HOP_USES = ["add_to_boil", "add_to_fermentation", "add_to_mash", "add_to_package"] as const;
const HOP_USE_LABELS: Record<(typeof HOP_USES)[number], string> = {
  add_to_boil: "Boil",
  add_to_fermentation: "Dry hop",
  add_to_mash: "Mash",
  add_to_package: "Package",
};

function HopsSection({
  draft,
  updateIngredients,
}: {
  draft: BeerJsonRecipe;
  updateIngredients: (patch: Partial<BeerJsonRecipe["ingredients"]>) => void;
}) {
  const items = draft.ingredients.hop_additions ?? [];

  const addRow = () => {
    const fresh: HopAddition = {
      name: "New hop",
      alpha_acid: { value: 5, unit: "%" },
      amount: { value: 0.028, unit: "kg" },
      form: "pellet",
      timing: { use: "add_to_boil", time: { value: 60, unit: "min" } },
    };
    updateIngredients({ hop_additions: [...items, fresh] });
  };

  const updateRow = (i: number, next: HopAddition) => {
    const copy = items.slice();
    copy[i] = next;
    updateIngredients({ hop_additions: copy });
  };

  const removeRow = (i: number) => {
    updateIngredients({ hop_additions: items.filter((_, j) => j !== i) });
  };

  return (
    <Section title="Hops">
      <div className="rounded-xl bg-surface border border-border overflow-x-auto md:overflow-x-visible">
        <RowHeader
          cols={[
            { label: "Name", span: "col-span-3" },
            { label: "Use", span: "col-span-2" },
            { label: "Time", span: "col-span-1" },
            { label: "Alpha", span: "col-span-1" },
            { label: "Amount", span: "col-span-2" },
            { label: "Form", span: "col-span-2" },
            { label: "", span: "col-span-1" },
          ]}
        />
        {items.map((h, i) => (
          <div
            key={i}
            className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-border last:border-b-0 items-center hover:bg-surface-raised/40 transition-colors min-w-[720px] md:min-w-0"
          >
            <Combobox
              className="col-span-3"
              value={h.name}
              onChange={(v) => updateRow(i, { ...h, name: v })}
              suggest={searchHops}
              onPick={(entry) => updateRow(i, applyHopEntry(h, entry))}
              renderItem={(entry) => (
                <div>
                  <p className="text-body-sm font-medium text-text">
                    {entry.name}
                    {entry.origin && (
                      <span className="text-caption text-text-muted font-normal ml-2">
                        {entry.origin}
                      </span>
                    )}
                  </p>
                  <p className="font-mono text-caption text-text-muted mt-0.5">
                    {entry.alpha_acid_pct}% AA
                    {entry.hop_type && ` · ${entry.hop_type}`}
                    {entry.notes && ` — ${entry.notes}`}
                  </p>
                </div>
              )}
            />
            <InlineSelect
              className="col-span-2"
              value={h.timing.use ?? "add_to_boil"}
              onChange={(v) => {
                const next = v as (typeof HOP_USES)[number];
                // Switching between boil/mash (minutes) and dry hop /
                // package (days) needs the time unit to follow — a "60"
                // typed for boil isn't "60 days" in the fermenter.
                const time = retimeForUse(next, h.timing.time);
                updateRow(i, { ...h, timing: { ...h.timing, use: next, time } });
              }}
              options={[...HOP_USES]}
              labels={HOP_USE_LABELS}
            />
            <HopTimeInlineInput
              className="col-span-1"
              use={h.timing.use ?? "add_to_boil"}
              time={h.timing.time}
              onChange={(time) =>
                updateRow(i, { ...h, timing: { ...h.timing, time } })
              }
            />
            <InlineNumber
              className="col-span-1"
              value={h.alpha_acid?.value ?? 0}
              unit="%"
              step={0.1}
              onChange={(v) =>
                updateRow(i, { ...h, alpha_acid: { value: v, unit: "%" } })
              }
            />
            <MassSmallInlineInput
              className="col-span-2"
              valueG={isMass(h.amount) ? toGrams(h.amount) : 0}
              onChangeG={(g) =>
                updateRow(i, { ...h, amount: { value: g / 1000, unit: "kg" } })
              }
            />
            <InlineSelect
              className="col-span-2"
              value={h.form ?? "pellet"}
              onChange={(v) =>
                updateRow(i, { ...h, form: v as (typeof HOP_FORMS)[number] })
              }
              options={[...HOP_FORMS]}
            />
            <div className="col-span-1 flex justify-end">
              <InlineDeleteButton onClick={() => removeRow(i)} />
            </div>
          </div>
        ))}
      </div>
      <AddRowButton label="+ Add hop" onClick={addRow} />
    </Section>
  );
}

// ─── Cultures ─────────────────────────────────────────────────────────────

const CULTURE_TYPES: CultureType[] = [
  "ale",
  "lager",
  "wheat",
  "wild",
  "kveik",
  "lacto",
  "pedio",
  "brett",
  "mixed-culture",
  "champagne",
  "wine",
  "bacteria",
  "malolactic",
  "other",
  "spontaneous",
];

const CULTURE_FORMS: CultureAddition["form"][] = ["liquid", "dry", "slant", "culture", "dregs"];

function CulturesSection({
  draft,
  updateIngredients,
}: {
  draft: BeerJsonRecipe;
  updateIngredients: (patch: Partial<BeerJsonRecipe["ingredients"]>) => void;
}) {
  const items = draft.ingredients.culture_additions ?? [];

  const addRow = () => {
    const fresh: CultureAddition = {
      name: "New culture",
      type: "ale",
      form: "dry",
      amount: { value: 11, unit: "g" },
      attenuation: { value: 75, unit: "%" },
    };
    updateIngredients({ culture_additions: [...items, fresh] });
  };

  const updateRow = (i: number, next: CultureAddition) => {
    const copy = items.slice();
    copy[i] = next;
    updateIngredients({ culture_additions: copy });
  };

  const removeRow = (i: number) => {
    updateIngredients({ culture_additions: items.filter((_, j) => j !== i) });
  };

  return (
    <Section title="Cultures">
      <div className="rounded-xl bg-surface border border-border overflow-x-auto md:overflow-x-visible">
        <RowHeader
          cols={[
            { label: "Name", span: "col-span-4" },
            { label: "Type", span: "col-span-2" },
            { label: "Form", span: "col-span-2" },
            { label: "Amount", span: "col-span-2" },
            { label: "Attenuation", span: "col-span-1" },
            { label: "", span: "col-span-1" },
          ]}
        />
        {items.map((c, i) => (
          <div
            key={i}
            className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-border last:border-b-0 items-center hover:bg-surface-raised/40 transition-colors min-w-[720px] md:min-w-0"
          >
            <Combobox
              className="col-span-4"
              value={c.name}
              onChange={(v) => updateRow(i, { ...c, name: v })}
              suggest={searchCultures}
              onPick={(entry) => updateRow(i, applyCultureEntry(c, entry))}
              renderItem={(entry) => (
                <div>
                  <p className="text-body-sm font-medium text-text">
                    {entry.name}
                    {entry.producer && (
                      <span className="text-caption text-text-muted font-normal ml-2">
                        {entry.producer}
                      </span>
                    )}
                  </p>
                  <p className="font-mono text-caption text-text-muted mt-0.5">
                    <span className="capitalize">{entry.type}</span>
                    {" · "}
                    <span className="capitalize">{entry.form}</span>
                    {" · "}
                    {entry.attenuation_pct}% atten
                    {entry.temp_min_c !== undefined &&
                      entry.temp_max_c !== undefined &&
                      ` · ${entry.temp_min_c}–${entry.temp_max_c}°C`}
                    {" · "}
                    {entry.default_amount} {entry.default_amount_unit}
                  </p>
                </div>
              )}
            />
            <InlineSelect
              className="col-span-2"
              value={c.type}
              onChange={(v) => updateRow(i, { ...c, type: v as CultureType })}
              options={CULTURE_TYPES}
            />
            <InlineSelect
              className="col-span-2"
              value={c.form}
              onChange={(v) => updateRow(i, { ...c, form: v as CultureAddition["form"] })}
              options={CULTURE_FORMS}
            />
            <InlineNumber
              className="col-span-2"
              value={c.amount && "value" in c.amount ? c.amount.value : 0}
              unit={c.amount && "unit" in c.amount ? c.amount.unit : "g"}
              step={0.1}
              onChange={(v) =>
                updateRow(i, {
                  ...c,
                  amount:
                    c.amount && "unit" in c.amount
                      ? { ...c.amount, value: v }
                      : { value: v, unit: "g" },
                })
              }
            />
            <InlineNumber
              className="col-span-1"
              value={c.attenuation?.value ?? 75}
              unit="%"
              step={1}
              onChange={(v) =>
                updateRow(i, { ...c, attenuation: { value: v, unit: "%" } })
              }
            />
            <div className="col-span-1 flex justify-end">
              <InlineDeleteButton onClick={() => removeRow(i)} />
            </div>
          </div>
        ))}
      </div>
      <AddRowButton label="+ Add culture" onClick={addRow} />
    </Section>
  );
}

// ─── Form primitives ──────────────────────────────────────────────────────

// ─── Mash schedule ────────────────────────────────────────────────────────

const MASH_STEP_TYPES: MashStep["type"][] = [
  "infusion",
  "temperature",
  "decoction",
  "sparge",
  "drain mash tun",
  "souring mash",
  "souring wort",
];

function MashSection({
  draft,
  update,
}: {
  draft: BeerJsonRecipe;
  update: <K extends keyof BeerJsonRecipe>(key: K, value: BeerJsonRecipe[K]) => void;
}) {
  const ensureMash = (): MashProcedure =>
    draft.mash ?? {
      name: "Mash",
      grain_temperature: { value: 20, unit: "C" },
      mash_steps: [],
    };

  const setMash = (next: MashProcedure) => update("mash", next);

  const setSteps = (steps: MashStep[]) => setMash({ ...ensureMash(), mash_steps: steps });

  const addStep = () => {
    const m = ensureMash();
    const isFirst = m.mash_steps.length === 0;
    const fresh: MashStep = {
      name: isFirst ? "Saccharification" : "Step",
      type: "infusion",
      step_temperature: { value: isFirst ? 67 : 72, unit: "C" },
      step_time: { value: isFirst ? 60 : 15, unit: "min" },
      amount: { value: isFirst ? 20 : 0, unit: "l" },
      infuse_temperature: { value: isFirst ? 75 : 90, unit: "C" },
    };
    setSteps([...m.mash_steps, fresh]);
  };

  const updateStep = (i: number, next: MashStep) => {
    const m = ensureMash();
    const copy = m.mash_steps.slice();
    copy[i] = next;
    setSteps(copy);
  };

  const removeStep = (i: number) => {
    const m = ensureMash();
    setSteps(m.mash_steps.filter((_, j) => j !== i));
  };

  // exactOptionalPropertyTypes-friendly setter — clearing a number field
  // strips the key entirely instead of setting it to `undefined`.
  const setStepAmount = (i: number, step: MashStep, value: number) => {
    if (value > 0) {
      updateStep(i, { ...step, amount: { value, unit: "l" } });
    } else {
      const { amount: _drop, ...rest } = step;
      updateStep(i, rest);
    }
  };

  const setStepInfuseTemp = (i: number, step: MashStep, value: number) => {
    if (value > 0) {
      updateStep(i, { ...step, infuse_temperature: { value, unit: "C" } });
    } else {
      const { infuse_temperature: _drop, ...rest } = step;
      updateStep(i, rest);
    }
  };

  const steps = draft.mash?.mash_steps ?? [];

  return (
    <Section title="Mash schedule">
      <div className="rounded-xl bg-surface border border-border overflow-x-auto md:overflow-x-visible">
        <RowHeader
          cols={[
            { label: "Name", span: "col-span-3" },
            { label: "Type", span: "col-span-2" },
            { label: "Temp", span: "col-span-2" },
            { label: "Time", span: "col-span-1" },
            { label: "Infusion", span: "col-span-3" },
            { label: "", span: "col-span-1" },
          ]}
        />
        {steps.length === 0 && (
          <div className="px-4 py-6 text-body-sm text-text-muted text-center">
            No mash steps. Add one below.
          </div>
        )}
        {steps.map((step, i) => (
          <div
            key={i}
            className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-border last:border-b-0 items-center hover:bg-surface-raised/40 transition-colors min-w-[720px] md:min-w-0"
          >
            <InlineInput
              className="col-span-3"
              value={step.name}
              onChange={(v) => updateStep(i, { ...step, name: v })}
            />
            <InlineSelect
              className="col-span-2"
              value={step.type}
              onChange={(v) => updateStep(i, { ...step, type: v as MashStep["type"] })}
              options={[...MASH_STEP_TYPES]}
            />
            <TempInlineInput
              className="col-span-2"
              valueC={toCelsius(step.step_temperature)}
              onChangeC={(c) =>
                updateStep(i, { ...step, step_temperature: { value: c, unit: "C" } })
              }
            />
            <InlineNumber
              className="col-span-1"
              value={step.step_time.value}
              unit="min"
              step={1}
              onChange={(v) =>
                updateStep(i, { ...step, step_time: { value: v, unit: "min" } })
              }
            />
            <div className="col-span-3 flex items-center gap-1">
              <VolumeInlineInput
                valueL={step.amount ? toLiters(step.amount) : 0}
                onChangeL={(l) => setStepAmount(i, step, l)}
              />
              <span className="text-caption text-text-muted shrink-0">@</span>
              <TempInlineInput
                valueC={step.infuse_temperature ? toCelsius(step.infuse_temperature) : 0}
                onChangeC={(c) => setStepInfuseTemp(i, step, c)}
              />
            </div>
            <div className="col-span-1 flex justify-end">
              <InlineDeleteButton onClick={() => removeStep(i)} />
            </div>
          </div>
        ))}
      </div>
      <AddRowButton label="+ Add mash step" onClick={addStep} />
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-h3 font-semibold mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea,
  required,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="block text-caption uppercase tracking-widest text-text-muted mb-2">
        {label}
        {required && <span className="text-warning ml-1">*</span>}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-body text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-body text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
      )}
    </label>
  );
}

function NumberField({
  label,
  unit,
  value,
  onChange,
  step = 1,
  className,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  className?: string;
}) {
  const [text, setText] = useState(() => formatForStep(value, step));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(formatForStep(value, step));
  }, [value, step, focused]);

  return (
    <label className={`block ${className ?? ""}`}>
      <span className="block text-caption uppercase tracking-widest text-text-muted mb-2">
        {label}
      </span>
      <div className="flex items-baseline gap-2 bg-surface border border-border rounded-lg px-3 py-2 focus-within:border-accent">
        <input
          type="text"
          inputMode="decimal"
          value={text}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            const n = parseLocaleNumber(text);
            setText(formatForStep(Number.isFinite(n) ? n : 0, step));
          }}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseLocaleNumber(e.target.value);
            onChange(Number.isFinite(n) ? n : 0);
          }}
          className="w-full bg-transparent text-body font-mono tabular-nums text-text focus:outline-none"
        />
        <span className="text-caption font-mono text-text-muted shrink-0">{unit}</span>
      </div>
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  labels,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: Record<string, string>;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="block text-caption uppercase tracking-widest text-text-muted mb-2">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-body text-text focus:outline-none focus:border-accent capitalize"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {labels?.[opt] ?? opt}
          </option>
        ))}
      </select>
    </label>
  );
}

// ─── Miscs ────────────────────────────────────────────────────────────────

const MISC_TYPES: MiscEntry["type"][] = [
  "spice",
  "fining",
  "water_agent",
  "herb",
  "flavor",
  "wood",
  "other",
];

const MISC_USES = ["add_to_boil", "add_to_mash", "add_to_fermentation", "add_to_package"] as const;
const MISC_USE_LABELS: Record<(typeof MISC_USES)[number], string> = {
  add_to_boil: "Boil",
  add_to_mash: "Mash",
  add_to_fermentation: "Ferment",
  add_to_package: "Package",
};

function MiscsSection({
  draft,
  updateIngredients,
}: {
  draft: BeerJsonRecipe;
  updateIngredients: (patch: Partial<BeerJsonRecipe["ingredients"]>) => void;
}) {
  const items = draft.ingredients.miscellaneous_additions ?? [];

  const addRow = () => {
    const fresh: MiscAddition = {
      name: "New addition",
      type: "spice",
      amount: { value: 5, unit: "g" },
      timing: { use: "add_to_boil", time: { value: 5, unit: "min" } },
    };
    updateIngredients({ miscellaneous_additions: [...items, fresh] });
  };

  const updateRow = (i: number, next: MiscAddition) => {
    const copy = items.slice();
    copy[i] = next;
    updateIngredients({ miscellaneous_additions: copy });
  };

  const removeRow = (i: number) => {
    updateIngredients({ miscellaneous_additions: items.filter((_, j) => j !== i) });
  };

  return (
    <Section title="Miscellaneous">
      <div className="rounded-xl bg-surface border border-border overflow-x-auto md:overflow-x-visible">
        <RowHeader
          cols={[
            { label: "Name", span: "col-span-3" },
            { label: "Type", span: "col-span-2" },
            { label: "Use", span: "col-span-2" },
            { label: "Time", span: "col-span-1" },
            { label: "Amount", span: "col-span-3" },
            { label: "", span: "col-span-1" },
          ]}
        />
        {items.map((m, i) => (
          <div
            key={i}
            className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-border last:border-b-0 items-center hover:bg-surface-raised/40 transition-colors min-w-[720px] md:min-w-0"
          >
            <Combobox
              className="col-span-3"
              value={m.name}
              onChange={(v) => updateRow(i, { ...m, name: v })}
              suggest={searchMiscs}
              onPick={(entry) => updateRow(i, applyMiscEntry(m, entry))}
              renderItem={(entry) => (
                <div>
                  <p className="text-body-sm font-medium text-text">{entry.name}</p>
                  <p className="font-mono text-caption text-text-muted mt-0.5">
                    {entry.type.replace("_", " ")}
                    {" · "}
                    {MISC_USE_LABELS[entry.default_use]}
                    {entry.default_time_min !== undefined && ` · ${entry.default_time_min} min`}
                    {" · "}
                    {entry.default_amount} {entry.default_amount_unit}
                  </p>
                </div>
              )}
            />
            <InlineSelect
              className="col-span-2"
              value={m.type ?? "other"}
              onChange={(v) => updateRow(i, { ...m, type: v })}
              options={MISC_TYPES}
            />
            <InlineSelect
              className="col-span-2"
              value={m.timing?.use ?? "add_to_boil"}
              onChange={(v) =>
                updateRow(i, {
                  ...m,
                  timing: { ...m.timing, use: v as (typeof MISC_USES)[number] },
                })
              }
              options={[...MISC_USES]}
              labels={MISC_USE_LABELS}
            />
            <InlineNumber
              className="col-span-1"
              value={m.timing?.time?.value ?? 0}
              unit="min"
              step={1}
              onChange={(v) =>
                updateRow(i, {
                  ...m,
                  timing: { ...m.timing, time: { value: v, unit: "min" } },
                })
              }
            />
            <InlineNumber
              className="col-span-3"
              value={m.amount.value}
              unit={m.amount.unit}
              step={0.1}
              onChange={(v) => updateRow(i, { ...m, amount: { ...m.amount, value: v } })}
            />
            <div className="col-span-1 flex justify-end">
              <InlineDeleteButton onClick={() => removeRow(i)} />
            </div>
          </div>
        ))}
      </div>
      <AddRowButton label="+ Add miscellaneous" onClick={addRow} />
    </Section>
  );
}

// ─── Catalog-aware combobox + apply-entry helpers ─────────────────────────

function Combobox<T>({
  value,
  onChange,
  suggest,
  onPick,
  renderItem,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  suggest: (query: string) => T[];
  onPick: (item: T) => void;
  renderItem: (item: T) => React.ReactNode;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  // Suggest on focus regardless of whether the field has text yet —
  // catalog search returns the top N for an empty query, giving the
  // brewer a browse list when they don't know what to type yet.
  const items = focused ? suggest(value) : [];

  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
        className="w-full bg-transparent border-b border-transparent px-1 py-1 text-body text-text placeholder:text-text-muted focus:outline-none focus:border-accent hover:border-border transition-colors min-w-0"
      />
      {items.length > 0 && (
        <div className="absolute top-full left-0 z-50 min-w-[22rem] max-h-80 overflow-auto bg-surface-raised border border-border rounded-lg shadow-xl mt-1">
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(item);
                setFocused(false);
              }}
              className="block w-full text-left px-3 py-2 hover:bg-surface focus:bg-surface border-b border-border last:border-b-0"
            >
              {renderItem(item)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function applyFermentableEntry(
  f: FermentableAddition,
  e: FermentableEntry,
): FermentableAddition {
  return {
    ...f,
    name: e.name,
    type: e.type,
    color: { value: e.color_ebc, unit: "EBC" },
    yield: { fine_grind: { value: e.yield_pct, unit: "%" } },
    ...(e.producer && { producer: e.producer }),
    ...(e.origin && { origin: e.origin }),
  };
}

function applyHopEntry(h: HopAddition, e: HopEntry): HopAddition {
  return {
    ...h,
    name: e.name,
    alpha_acid: { value: e.alpha_acid_pct, unit: "%" },
    ...(e.origin && { producer: e.origin }),
  };
}

function cultureAmountFromEntry(
  e: CultureEntry,
): NonNullable<CultureAddition["amount"]> {
  if (e.default_amount_unit === "g") {
    return { value: e.default_amount, unit: "g" };
  }
  if (e.default_amount_unit === "ml") {
    return { value: e.default_amount, unit: "ml" };
  }
  return { value: e.default_amount, unit: "pkg" };
}

function applyCultureEntry(c: CultureAddition, e: CultureEntry): CultureAddition {
  return {
    ...c,
    name: e.name,
    type: e.type,
    form: e.form,
    amount: cultureAmountFromEntry(e),
    attenuation: { value: e.attenuation_pct, unit: "%" },
    ...(e.producer && { producer: e.producer }),
    ...(e.product_id && { product_id: e.product_id }),
    ...((e.temp_min_c !== undefined || e.temp_max_c !== undefined) && {
      temperature_range: {
        ...(e.temp_min_c !== undefined && { minimum: { value: e.temp_min_c, unit: "C" } }),
        ...(e.temp_max_c !== undefined && { maximum: { value: e.temp_max_c, unit: "C" } }),
      },
    }),
  };
}

function miscAmountFromEntry(e: MiscEntry): MiscAddition["amount"] {
  if (e.default_amount_unit === "g" || e.default_amount_unit === "kg") {
    return { value: e.default_amount, unit: e.default_amount_unit };
  }
  return { value: e.default_amount, unit: e.default_amount_unit };
}

function styleEntryToBeerJson(e: StyleEntry): NonNullable<BeerJsonRecipe["style"]> {
  return {
    name: e.name,
    category: e.category,
    category_number: e.category_number,
    style_letter: e.style_letter,
    style_guide: "BJCP 2021",
    type: e.type === "lager" || e.type === "ale" || e.type === "wheat" || e.type === "wild"
      ? "beer"
      : e.type === "mead"
      ? "mead"
      : e.type === "cider"
      ? "cider"
      : "other",
    original_gravity: {
      minimum: { value: e.og_min, unit: "sg" },
      maximum: { value: e.og_max, unit: "sg" },
    },
    final_gravity: {
      minimum: { value: e.fg_min, unit: "sg" },
      maximum: { value: e.fg_max, unit: "sg" },
    },
    international_bitterness_units: {
      minimum: { value: e.ibu_min, unit: "IBUs" },
      maximum: { value: e.ibu_max, unit: "IBUs" },
    },
    color: {
      minimum: { value: e.srm_min, unit: "SRM" },
      maximum: { value: e.srm_max, unit: "SRM" },
    },
    alcohol_by_volume: {
      minimum: { value: e.abv_min, unit: "%" },
      maximum: { value: e.abv_max, unit: "%" },
    },
  };
}

function StylePicker({
  style,
  onChange,
  className,
}: {
  style: BeerJsonRecipe["style"];
  onChange: (next: NonNullable<BeerJsonRecipe["style"]> | undefined) => void;
  className?: string;
}) {
  const display = style?.name ?? "";
  const tag =
    style?.category_number !== undefined && style?.style_letter
      ? `${style.category_number}${style.style_letter}`
      : null;

  return (
    <label className={`block ${className ?? ""}`}>
      <span className="block text-caption uppercase tracking-widest text-text-muted mb-2">
        Style
        {tag && (
          <span className="ml-2 text-text-muted font-mono normal-case tracking-normal">
            BJCP {tag}
          </span>
        )}
      </span>
      <div className="relative flex items-center gap-2">
        <Combobox
          className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 focus-within:border-accent"
          value={display}
          onChange={(v) => {
            // Free-text edits clear the picked-style envelope but keep
            // the name so the brewer can leave a custom style in.
            if (v.trim().length === 0) onChange(undefined);
            else onChange({ ...(style ?? { name: v }), name: v });
          }}
          suggest={searchStyles}
          onPick={(entry) => onChange(styleEntryToBeerJson(entry))}
          renderItem={(entry) => (
            <div>
              <p className="text-body-sm font-medium text-text">
                <span className="font-mono text-caption text-text-muted mr-2">
                  {entry.category_number}
                  {entry.style_letter}
                </span>
                {entry.name}
              </p>
              <p className="font-mono text-caption text-text-muted mt-0.5">
                {entry.category}
                {" · "}
                OG {entry.og_min.toFixed(3)}–{entry.og_max.toFixed(3)}
                {" · "}
                {entry.ibu_min}–{entry.ibu_max} IBU
                {" · "}
                {entry.srm_min}–{entry.srm_max} SRM
                {" · "}
                {entry.abv_min}–{entry.abv_max}% ABV
              </p>
            </div>
          )}
        />
        {style && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="shrink-0 px-3 py-2 rounded-lg bg-surface-raised border border-border text-caption text-text-muted hover:text-text transition-colors"
            title="Clear style"
          >
            Clear
          </button>
        )}
      </div>
    </label>
  );
}

function applyMiscEntry(m: MiscAddition, e: MiscEntry): MiscAddition {
  return {
    ...m,
    name: e.name,
    type: e.type,
    amount: miscAmountFromEntry(e),
    timing: {
      use: e.default_use,
      ...(e.default_time_min !== undefined && {
        time: { value: e.default_time_min, unit: "min" },
      }),
    },
    ...(e.notes && { notes: e.notes }),
  };
}

// ─── Inline (table-style) primitives for ingredient rows ──────────────────

function RowHeader({ cols }: { cols: { label: string; span: string }[] }) {
  return (
    <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-surface-raised text-caption uppercase tracking-widest text-text-muted border-b border-border min-w-[720px] md:min-w-0">
      {cols.map((c, i) => (
        <div key={i} className={c.span}>
          {c.label}
        </div>
      ))}
    </div>
  );
}

function InlineInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-transparent border-b border-transparent px-1 py-1 text-body text-text placeholder:text-text-muted focus:outline-none focus:border-accent hover:border-border transition-colors min-w-0 ${className ?? ""}`}
    />
  );
}

// ─── Unit-aware inputs ────────────────────────────────────────────────────
//
// Wrappers that show the canonical-stored value (kg / L / °C / SRM) in the
// user's preferred unit (lb / gal / °F / EBC), and reverse the conversion
// on edit. Decimals scale with step so kg-vs-lb conversion noise stays
// invisible to the brewer.

function decimalsForStep(step: number): number {
  if (step >= 1) return 0;
  if (step >= 0.1) return 1;
  if (step >= 0.01) return 2;
  if (step >= 0.001) return 3;
  return 4;
}

function roundForStep(value: number, step: number): number {
  const f = 10 ** decimalsForStep(step);
  return Math.round(value * f) / f;
}

// Parse a user-typed string that may use either "." or "," as the
// decimal separator (browsers localize <input type="number"> display,
// but here we use type="text" so we must accept both).
function parseLocaleNumber(s: string): number {
  const cleaned = s.replace(/\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function formatForStep(value: number, step: number): string {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(decimalsForStep(step));
}

function MassLargeInlineInput({
  valueKg,
  onChangeKg,
  className,
}: {
  valueKg: number;
  onChangeKg: (kg: number) => void;
  className?: string;
}) {
  const prefs = useUnits();
  // 50 g feels right in metric (typical fermentable bumping); lb prefers
  // 0.1 lb increments. Either way we keep the increment visible in the
  // displayed unit.
  const step = prefs.mass === "lb" ? 0.1 : 0.05;
  return (
    <InlineNumber
      {...(className !== undefined && { className })}
      value={roundForStep(kgToUserMassLarge(valueKg, prefs), step)}
      unit={massLargeUnitLabel(prefs)}
      step={step}
      onChange={(v) => onChangeKg(userMassLargeToKg(v, prefs))}
    />
  );
}

function MassSmallInlineInput({
  valueG,
  onChangeG,
  className,
}: {
  valueG: number;
  onChangeG: (g: number) => void;
  className?: string;
}) {
  const prefs = useUnits();
  // Hops: brewers think in whole grams (or 0.1 oz). 1 g ≈ 0.035 oz so the
  // imperial increment is finer; that matches the typical hop bag precision.
  const step = prefs.mass === "lb" ? 0.1 : 1;
  const display =
    prefs.mass === "lb"
      ? kgToUserMassSmall(valueG / 1000, prefs)
      : valueG;
  return (
    <InlineNumber
      {...(className !== undefined && { className })}
      value={roundForStep(display, step)}
      unit={massSmallUnitLabel(prefs)}
      step={step}
      onChange={(v) =>
        onChangeG(prefs.mass === "lb" ? userMassSmallToG(v, prefs) : v)
      }
    />
  );
}

function VolumeInlineInput({
  valueL,
  onChangeL,
  className,
}: {
  valueL: number;
  onChangeL: (l: number) => void;
  className?: string;
}) {
  const prefs = useUnits();
  const step = prefs.volume === "gal" ? 0.1 : 0.5;
  return (
    <InlineNumber
      {...(className !== undefined && { className })}
      value={roundForStep(litersToUserVolume(valueL, prefs), step)}
      unit={volumeUnitLabel(prefs)}
      step={step}
      onChange={(v) => onChangeL(userVolumeToLiters(v, prefs))}
    />
  );
}

function TempInlineInput({
  valueC,
  onChangeC,
  className,
}: {
  valueC: number;
  onChangeC: (c: number) => void;
  className?: string;
}) {
  const prefs = useUnits();
  return (
    <InlineNumber
      {...(className !== undefined && { className })}
      value={roundForStep(celsiusToUserTemp(valueC, prefs), 1)}
      unit={tempUnitLabel(prefs)}
      step={1}
      onChange={(v) => onChangeC(userTempToCelsius(v, prefs))}
    />
  );
}

// Hop additions track time in BeerJSON as { value, unit }. Boil and
// mash additions are minutes; dry-hop and packaging additions are
// days. The editor exposes whatever the data says and switches the
// unit when the use is changed so a typed "3" reads as days for a
// dry hop, minutes for the boil.
function hopTimeUnitForUse(
  use: (typeof HOP_USES)[number],
): TimeType["unit"] {
  if (use === "add_to_fermentation" || use === "add_to_package") return "day";
  return "min";
}

function retimeForUse(
  use: (typeof HOP_USES)[number],
  current: TimeType | undefined,
): TimeType {
  const want = hopTimeUnitForUse(use);
  if (current && current.unit === want) return current;
  // Default new-unit value: boil = 60 min, dry hop = 3 days.
  const defaultValue = want === "day" ? 3 : 60;
  return { value: defaultValue, unit: want };
}

function HopTimeInlineInput({
  use,
  time,
  onChange,
  className,
}: {
  use: (typeof HOP_USES)[number];
  time: TimeType | undefined;
  onChange: (time: TimeType) => void;
  className?: string;
}) {
  const unit = time?.unit ?? hopTimeUnitForUse(use);
  return (
    <InlineNumber
      {...(className !== undefined && { className })}
      value={time?.value ?? 0}
      unit={unit}
      step={1}
      onChange={(v) => onChange({ value: v, unit })}
    />
  );
}

function ColorInlineInput({
  valueSrm,
  onChangeSrm,
  className,
}: {
  valueSrm: number;
  onChangeSrm: (srm: number) => void;
  className?: string;
}) {
  const prefs = useUnits();
  // SRM jumps in half-points; EBC is roughly 2× SRM so whole-unit
  // increments are about the same perceptual change.
  const step = prefs.color === "EBC" ? 1 : 0.5;
  return (
    <InlineNumber
      {...(className !== undefined && { className })}
      value={roundForStep(srmToUserColor(valueSrm, prefs), step)}
      unit={colorUnitLabel(prefs)}
      step={step}
      onChange={(v) => onChangeSrm(userColorToSrm(v, prefs))}
    />
  );
}

function VolumeField({
  label,
  valueL,
  onChangeL,
}: {
  label: string;
  valueL: number;
  onChangeL: (l: number) => void;
}) {
  const prefs = useUnits();
  const step = prefs.volume === "gal" ? 0.1 : 0.5;
  return (
    <NumberField
      label={label}
      unit={volumeUnitLabel(prefs)}
      value={roundForStep(litersToUserVolume(valueL, prefs), step)}
      step={step}
      onChange={(v) => onChangeL(userVolumeToLiters(v, prefs))}
    />
  );
}

function InlineNumber({
  value,
  unit,
  onChange,
  step = 1,
  className,
}: {
  value: number;
  unit: string;
  onChange: (v: number) => void;
  step?: number;
  className?: string;
}) {
  // Local text buffer so the user can freely type "1.", "1.5", "1.50"
  // without React stripping trailing zeros on every keystroke. We resync
  // from the prop only when not focused — that way an external change
  // (row reload, picker fill) reformats with the canonical decimal count,
  // but in-flight typing is preserved.
  const [text, setText] = useState(() => formatForStep(value, step));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(formatForStep(value, step));
  }, [value, step, focused]);

  return (
    <div
      className={`flex items-baseline gap-1 border-b border-transparent px-1 py-1 focus-within:border-accent hover:border-border transition-colors min-w-0 ${className ?? ""}`}
    >
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          const n = parseLocaleNumber(text);
          setText(formatForStep(Number.isFinite(n) ? n : 0, step));
        }}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseLocaleNumber(e.target.value);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        className="w-full bg-transparent text-body font-mono tabular-nums text-text focus:outline-none min-w-0"
      />
      <span className="text-caption font-mono text-text-muted shrink-0">{unit}</span>
    </div>
  );
}

function InlineSelect({
  value,
  onChange,
  options,
  labels,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: Record<string, string>;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-transparent border-b border-transparent px-1 py-1 text-body text-text focus:outline-none focus:border-accent hover:border-border transition-colors capitalize min-w-0 ${className ?? ""}`}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {labels?.[opt] ?? opt}
        </option>
      ))}
    </select>
  );
}

function InlineDeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Delete"
      className="w-7 h-7 rounded-pill flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
    >
      ×
    </button>
  );
}

function AddRowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 w-full px-4 py-3 rounded-xl bg-surface border border-border border-dashed text-body-sm font-medium text-text-muted hover:text-text hover:border-accent transition-colors"
    >
      {label}
    </button>
  );
}
