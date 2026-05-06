import { useState } from "react";
import type {
  BeerJsonRecipe,
  CultureAddition,
  CultureType,
  FermentableAddition,
  HopAddition,
  MiscAddition,
} from "@werb/adapters";
import {
  searchCultures,
  searchFermentables,
  searchHops,
  searchMiscs,
  type CultureEntry,
  type FermentableEntry,
  type HopEntry,
  type MiscEntry,
} from "../data/catalog/index.ts";

/**
 * Pareto in-app recipe editor. Edits metadata + ingredients in place;
 * on save commits the whole recipe back to the store via onSave.
 *
 * Out of scope for v1: mash steps, style picker, fermentation procedure,
 * water profile, packaging. Those round-trip from BeerXML/BeerJSON
 * imports and rarely need editing.
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
      <main className="mx-auto max-w-4xl px-8 py-12">
        <header className="mb-10 flex items-center justify-between gap-4">
          <button
            onClick={onClose}
            className="text-caption font-medium text-text-muted hover:text-text transition-colors flex items-center gap-2"
          >
            <span aria-hidden>←</span> Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-accent text-bg text-body-sm font-medium hover:opacity-90 transition-opacity"
          >
            Save changes
          </button>
        </header>

        <h1 className="text-h1 font-semibold mb-2">Edit recipe</h1>
        <p className="text-body text-text-muted mb-10">
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
      <div className="grid grid-cols-2 gap-6 mt-6">
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
      <div className="grid grid-cols-2 gap-6 mt-6">
        <NumberField
          label="Batch size"
          unit="L"
          value={draft.batch_size.value}
          onChange={(v) => update("batch_size", { value: v, unit: draft.batch_size.unit })}
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
      <div className="rounded-xl bg-surface border border-border">
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
            className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-border last:border-b-0 items-center hover:bg-surface-raised/40 transition-colors"
          >
            <Combobox
              className="col-span-4"
              value={f.name}
              onChange={(v) => updateRow(i, { ...f, name: v })}
              suggest={searchFermentables}
              onPick={(entry) => updateRow(i, applyFermentableEntry(f, entry))}
              renderItem={(entry) => (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium truncate">{entry.name}</span>
                  <span className="font-mono text-caption text-text-muted shrink-0">
                    {entry.color_ebc} EBC · {entry.yield_pct}%
                    {entry.producer && ` · ${entry.producer}`}
                  </span>
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
            <InlineNumber
              className="col-span-2"
              value={f.amount.value}
              unit="kg"
              step={0.05}
              onChange={(v) => updateRow(i, { ...f, amount: { ...f.amount, value: v } })}
            />
            <InlineNumber
              className="col-span-2"
              value={f.color?.value ?? 0}
              unit={f.color?.unit ?? "Lovi"}
              step={0.5}
              onChange={(v) =>
                updateRow(i, {
                  ...f,
                  color: { value: v, unit: f.color?.unit ?? "Lovi" },
                })
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
      <div className="rounded-xl bg-surface border border-border">
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
            className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-border last:border-b-0 items-center hover:bg-surface-raised/40 transition-colors"
          >
            <Combobox
              className="col-span-3"
              value={h.name}
              onChange={(v) => updateRow(i, { ...h, name: v })}
              suggest={searchHops}
              onPick={(entry) => updateRow(i, applyHopEntry(h, entry))}
              renderItem={(entry) => (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium truncate">
                    {entry.name}
                    {entry.origin && (
                      <span className="text-caption text-text-muted ml-2">{entry.origin}</span>
                    )}
                  </span>
                  <span className="font-mono text-caption text-text-muted shrink-0">
                    {entry.alpha_acid_pct}% AA
                  </span>
                </div>
              )}
            />
            <InlineSelect
              className="col-span-2"
              value={h.timing.use ?? "add_to_boil"}
              onChange={(v) =>
                updateRow(i, {
                  ...h,
                  timing: { ...h.timing, use: v as (typeof HOP_USES)[number] },
                })
              }
              options={[...HOP_USES]}
              labels={HOP_USE_LABELS}
            />
            <InlineNumber
              className="col-span-1"
              value={h.timing.time?.value ?? 0}
              unit="min"
              step={1}
              onChange={(v) =>
                updateRow(i, {
                  ...h,
                  timing: { ...h.timing, time: { value: v, unit: "min" } },
                })
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
            <InlineNumber
              className="col-span-2"
              value={h.amount.value * (h.amount.unit === "kg" ? 1000 : 1)}
              unit="g"
              step={1}
              onChange={(v) =>
                updateRow(i, { ...h, amount: { value: v / 1000, unit: "kg" } })
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
      <div className="rounded-xl bg-surface border border-border">
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
            className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-border last:border-b-0 items-center hover:bg-surface-raised/40 transition-colors"
          >
            <Combobox
              className="col-span-4"
              value={c.name}
              onChange={(v) => updateRow(i, { ...c, name: v })}
              suggest={searchCultures}
              onPick={(entry) => updateRow(i, applyCultureEntry(c, entry))}
              renderItem={(entry) => (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium truncate">{entry.name}</span>
                  <span className="font-mono text-caption text-text-muted shrink-0">
                    {entry.form} · {entry.attenuation_pct}% · {entry.default_amount}{" "}
                    {entry.default_amount_unit}
                  </span>
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
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="block text-caption uppercase tracking-widest text-text-muted mb-2">
        {label}
      </span>
      <div className="flex items-baseline gap-2 bg-surface border border-border rounded-lg px-3 py-2 focus-within:border-accent">
        <input
          type="number"
          value={Number.isFinite(value) ? value : ""}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value);
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
      <div className="rounded-xl bg-surface border border-border">
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
            className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-border last:border-b-0 items-center hover:bg-surface-raised/40 transition-colors"
          >
            <Combobox
              className="col-span-3"
              value={m.name}
              onChange={(v) => updateRow(i, { ...m, name: v })}
              suggest={searchMiscs}
              onPick={(entry) => updateRow(i, applyMiscEntry(m, entry))}
              renderItem={(entry) => (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium truncate">{entry.name}</span>
                  <span className="font-mono text-caption text-text-muted shrink-0">
                    {entry.type} · {entry.default_amount} {entry.default_amount_unit}
                  </span>
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
  const items = focused && value.trim().length > 0 ? suggest(value) : [];

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
        <div className="absolute top-full left-0 right-0 z-50 max-h-72 overflow-auto bg-surface-raised border border-border rounded-lg shadow-xl mt-1">
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(item);
                setFocused(false);
              }}
              className="block w-full text-left px-3 py-2 hover:bg-surface focus:bg-surface text-body-sm border-b border-border last:border-b-0"
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
    <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-surface-raised text-caption uppercase tracking-widest text-text-muted border-b border-border">
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
  return (
    <div
      className={`flex items-baseline gap-1 border-b border-transparent px-1 py-1 focus-within:border-accent hover:border-border transition-colors min-w-0 ${className ?? ""}`}
    >
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        // Hide native browser spinner buttons — they steal column space
        // and overlap the value in narrow cells (Time, Alpha, Yield, …).
        // Keyboard arrows still work for nudging values.
        className="w-full bg-transparent text-body font-mono tabular-nums text-text focus:outline-none min-w-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-outer-spin-button]:m-0"
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
