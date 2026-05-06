import { useState } from "react";
import type {
  BeerJsonRecipe,
  CultureAddition,
  CultureType,
  FermentableAddition,
  HopAddition,
} from "@werb/adapters";

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

const COLOR_UNITS = ["Lovi", "SRM", "EBC"] as const;

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
      <ul className="rounded-xl bg-surface border border-border divide-y divide-border">
        {items.map((f, i) => (
          <li key={i} className="px-5 py-4">
            <div className="grid grid-cols-12 gap-3">
              <Field
                className="col-span-5"
                label="Name"
                value={f.name}
                onChange={(v) => updateRow(i, { ...f, name: v })}
              />
              <SelectField
                className="col-span-3"
                label="Type"
                value={f.type}
                onChange={(v) =>
                  updateRow(i, { ...f, type: v as FermentableAddition["type"] })
                }
                options={FERMENTABLE_TYPES}
              />
              <NumberField
                className="col-span-3"
                label="Amount"
                unit="kg"
                value={f.amount.value}
                step={0.05}
                onChange={(v) => updateRow(i, { ...f, amount: { ...f.amount, value: v } })}
              />
              <DeleteButton className="col-span-1" onClick={() => removeRow(i)} />
            </div>
            <div className="grid grid-cols-12 gap-3 mt-3">
              <NumberField
                className="col-span-3"
                label="Color"
                unit={f.color?.unit ?? "Lovi"}
                value={f.color?.value ?? 0}
                step={0.5}
                onChange={(v) =>
                  updateRow(i, {
                    ...f,
                    color: { value: v, unit: f.color?.unit ?? "Lovi" },
                  })
                }
              />
              <SelectField
                className="col-span-3"
                label="Color unit"
                value={f.color?.unit ?? "Lovi"}
                onChange={(v) =>
                  updateRow(i, {
                    ...f,
                    color: {
                      value: f.color?.value ?? 0,
                      unit: v as (typeof COLOR_UNITS)[number],
                    },
                  })
                }
                options={[...COLOR_UNITS]}
              />
              <NumberField
                className="col-span-3"
                label="Yield (fine grind)"
                unit="%"
                value={f.yield?.fine_grind?.value ?? 0}
                step={1}
                onChange={(v) =>
                  updateRow(i, {
                    ...f,
                    yield: {
                      ...f.yield,
                      fine_grind: { value: v, unit: "%" },
                    },
                  })
                }
              />
            </div>
          </li>
        ))}
      </ul>
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
      <ul className="rounded-xl bg-surface border border-border divide-y divide-border">
        {items.map((h, i) => (
          <li key={i} className="px-5 py-4">
            <div className="grid grid-cols-12 gap-3">
              <Field
                className="col-span-5"
                label="Name"
                value={h.name}
                onChange={(v) => updateRow(i, { ...h, name: v })}
              />
              <NumberField
                className="col-span-3"
                label="Alpha"
                unit="%"
                value={h.alpha_acid?.value ?? 0}
                step={0.1}
                onChange={(v) =>
                  updateRow(i, { ...h, alpha_acid: { value: v, unit: "%" } })
                }
              />
              <NumberField
                className="col-span-3"
                label="Amount"
                unit="g"
                value={h.amount.value * (h.amount.unit === "kg" ? 1000 : 1)}
                step={1}
                onChange={(v) =>
                  updateRow(i, {
                    ...h,
                    amount: { value: v / 1000, unit: "kg" },
                  })
                }
              />
              <DeleteButton className="col-span-1" onClick={() => removeRow(i)} />
            </div>
            <div className="grid grid-cols-12 gap-3 mt-3">
              <SelectField
                className="col-span-3"
                label="Use"
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
              <NumberField
                className="col-span-3"
                label="Time"
                unit="min"
                value={h.timing.time?.value ?? 0}
                step={1}
                onChange={(v) =>
                  updateRow(i, {
                    ...h,
                    timing: { ...h.timing, time: { value: v, unit: "min" } },
                  })
                }
              />
              <SelectField
                className="col-span-3"
                label="Form"
                value={h.form ?? "pellet"}
                onChange={(v) =>
                  updateRow(i, { ...h, form: v as (typeof HOP_FORMS)[number] })
                }
                options={[...HOP_FORMS]}
              />
            </div>
          </li>
        ))}
      </ul>
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
      <ul className="rounded-xl bg-surface border border-border divide-y divide-border">
        {items.map((c, i) => (
          <li key={i} className="px-5 py-4">
            <div className="grid grid-cols-12 gap-3">
              <Field
                className="col-span-5"
                label="Name"
                value={c.name}
                onChange={(v) => updateRow(i, { ...c, name: v })}
              />
              <SelectField
                className="col-span-3"
                label="Type"
                value={c.type}
                onChange={(v) => updateRow(i, { ...c, type: v as CultureType })}
                options={CULTURE_TYPES}
              />
              <SelectField
                className="col-span-3"
                label="Form"
                value={c.form}
                onChange={(v) =>
                  updateRow(i, { ...c, form: v as CultureAddition["form"] })
                }
                options={CULTURE_FORMS}
              />
              <DeleteButton className="col-span-1" onClick={() => removeRow(i)} />
            </div>
            <div className="grid grid-cols-12 gap-3 mt-3">
              <NumberField
                className="col-span-3"
                label="Attenuation"
                unit="%"
                value={c.attenuation?.value ?? 75}
                step={1}
                onChange={(v) =>
                  updateRow(i, { ...c, attenuation: { value: v, unit: "%" } })
                }
              />
              <NumberField
                className="col-span-3"
                label="Amount"
                unit={c.amount && "unit" in c.amount ? c.amount.unit : "g"}
                value={c.amount && "value" in c.amount ? c.amount.value : 0}
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
            </div>
          </li>
        ))}
      </ul>
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

function DeleteButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <div className={`flex items-end ${className ?? ""}`}>
      <button
        type="button"
        onClick={onClick}
        title="Delete"
        className="w-full h-10 rounded-lg bg-surface-raised border border-border text-text-muted hover:text-danger hover:border-danger transition-colors"
      >
        ×
      </button>
    </div>
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
