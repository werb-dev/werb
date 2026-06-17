import { useState } from "react";
import type { InventoryCategory, InventoryItem } from "../data/inventory.ts";
import type { useInventory } from "../hooks/useInventory.ts";
import { useT } from "../data/preferences.tsx";
import { useNumericText } from "../components/editor/Fields.tsx";

interface InventoryScreenProps {
  api: ReturnType<typeof useInventory>;
}

const CATEGORY_ORDER: InventoryCategory[] = ["fermentable", "hop", "culture", "misc"];

/**
 * Personal stock list. Each entry overrides the catalog/recipe defaults
 * for the matching ingredient (by name) on the recipe screen — alpha %
 * for hops, EBC + yield for malts, attenuation for yeast. Overrides are
 * applied at display time only; the BeerJSON recipe is never rewritten.
 */
export function InventoryScreen({ api }: InventoryScreenProps) {
  const t = useT();
  const [category, setCategory] = useState<InventoryCategory>("hop");
  const [name, setName] = useState("");

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    api.create({ category, name: trimmed });
    setName("");
  };

  const byCategory = (c: InventoryCategory) =>
    api.items.filter((it) => it.category === c);

  return (
    <div className="min-h-dvh bg-bg text-text">
      <main className="mx-auto max-w-3xl px-4 pt-12 pb-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <header className="mb-8 sm:mb-10">
          <p className="text-caption uppercase tracking-widest text-text-muted">
            {api.loading
              ? t("inventory.subtitle_loading")
              : t("inventory.subtitle_count", { count: api.items.length })}
          </p>
          <h1 className="text-h2 sm:text-h1 font-semibold mt-3">{t("inventory.title")}</h1>
          <p className="text-body text-text-muted mt-2 max-w-2xl">{t("inventory.intro")}</p>
        </header>

        <div className="rounded-xl bg-surface border border-border p-4 sm:p-5 mb-8">
          <p className="text-caption uppercase tracking-widest text-text-muted mb-3">
            {t("inventory.add_title")}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="block text-caption uppercase tracking-widest text-text-muted mb-1">
                {t("inventory.field.category")}
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as InventoryCategory)}
                className="bg-bg border border-border rounded-lg px-3 py-2 text-body-sm text-text focus:outline-none focus:border-accent"
              >
                {CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {t(`inventory.category.${c}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block flex-1 min-w-[12rem]">
              <span className="block text-caption uppercase tracking-widest text-text-muted mb-1">
                {t("inventory.field.name")}
              </span>
              <input
                type="text"
                value={name}
                placeholder={t("inventory.name_placeholder")}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") add();
                }}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-body-sm text-text focus:outline-none focus:border-accent"
              />
            </label>
            <button
              type="button"
              onClick={add}
              disabled={!name.trim()}
              className="rounded-lg bg-accent text-bg px-4 py-2 text-body-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-default transition-opacity"
            >
              {t("inventory.add")}
            </button>
          </div>
        </div>

        {api.loading ? (
          <p className="text-body-sm text-text-muted animate-pulse">{t("common.loading")}</p>
        ) : api.items.length === 0 ? (
          <p className="text-body text-text-muted">{t("inventory.empty")}</p>
        ) : (
          <div className="flex flex-col gap-8">
            {CATEGORY_ORDER.map((c) => {
              const items = byCategory(c);
              if (items.length === 0) return null;
              return (
                <section key={c}>
                  <h2 className="text-caption uppercase tracking-widest text-text-muted mb-3">
                    {t(`inventory.category.${c}`)}
                  </h2>
                  <div className="flex flex-col gap-3">
                    {items.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        onChange={(patch) => api.update(item.id, patch)}
                        onRemove={() => api.remove(item.id)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function ItemCard({
  item,
  onChange,
  onRemove,
}: {
  item: InventoryItem;
  onChange: (patch: Partial<Omit<InventoryItem, "id">>) => void;
  onRemove: () => void;
}) {
  const t = useT();
  return (
    <div className="rounded-xl bg-surface border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-body font-medium text-text">{item.name}</p>
        <button
          type="button"
          onClick={onRemove}
          className="text-caption text-text-muted hover:text-warning transition-colors shrink-0"
        >
          {t("inventory.remove")}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
        {item.category === "hop" && (
          <>
            <NumField
              label={t("inventory.field.alpha")}
              unit="%"
              value={item.alpha_acid_pct}
              step={0.1}
              onChange={(v) => onChange({ alpha_acid_pct: v })}
            />
            <NumField
              label={t("inventory.field.year")}
              value={item.year}
              step={1}
              onChange={(v) => onChange({ year: v })}
            />
            <TextField
              label={t("inventory.field.form")}
              value={item.form}
              placeholder="pellet"
              onChange={(v) => onChange({ form: v })}
            />
          </>
        )}

        {item.category === "fermentable" && (
          <>
            <NumField
              label={t("inventory.field.color")}
              unit="EBC"
              value={item.color_ebc}
              step={1}
              onChange={(v) => onChange({ color_ebc: v })}
            />
            <NumField
              label={t("inventory.field.yield")}
              unit="%"
              value={item.yield_pct}
              step={0.1}
              onChange={(v) => onChange({ yield_pct: v })}
            />
          </>
        )}

        {item.category === "culture" && (
          <>
            <NumField
              label={t("inventory.field.attenuation")}
              unit="%"
              value={item.attenuation_pct}
              step={1}
              onChange={(v) => onChange({ attenuation_pct: v })}
            />
            <TextField
              label={t("inventory.field.form")}
              value={item.form}
              placeholder="dry"
              onChange={(v) => onChange({ form: v })}
            />
            <DateField
              label={t("inventory.field.viability")}
              value={item.viability_date}
              onChange={(v) => onChange({ viability_date: v })}
            />
          </>
        )}

        <NumField
          label={t("inventory.field.quantity")}
          value={item.quantity}
          step={1}
          onChange={(v) => onChange({ quantity: v })}
        />
        <TextField
          label={t("inventory.field.quantity_unit")}
          value={item.quantity_unit}
          placeholder="g"
          onChange={(v) => onChange({ quantity_unit: v })}
        />
      </div>

      <label className="block mt-3">
        <span className="block text-caption uppercase tracking-widest text-text-muted mb-1">
          {t("inventory.field.notes")}
        </span>
        <input
          type="text"
          value={item.notes ?? ""}
          onChange={(e) => onChange({ notes: e.target.value || undefined })}
          className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-body-sm text-text focus:outline-none focus:border-accent"
        />
      </label>
    </div>
  );
}

/** Optional numeric field — blank commits `undefined` (override cleared). */
function NumField({
  label,
  unit,
  value,
  step,
  onChange,
}: {
  label: string;
  unit?: string;
  value: number | undefined;
  step: number;
  onChange: (v: number | undefined) => void;
}) {
  const bind = useNumericText(value ?? NaN, (n) => onChange(Number.isFinite(n) ? n : undefined), {
    emptyValue: NaN,
  });
  return (
    <label className="block">
      <span className="block text-caption uppercase tracking-widest text-text-muted mb-1">
        {label}
        {unit ? <span className="ml-1 normal-case opacity-70">({unit})</span> : null}
      </span>
      <input
        type="number"
        min={0}
        step={step}
        {...bind}
        className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-body-sm font-mono tabular-nums text-text focus:outline-none focus:border-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string | undefined;
  placeholder?: string;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <label className="block">
      <span className="block text-caption uppercase tracking-widest text-text-muted mb-1">{label}</span>
      <input
        type="text"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.trim() || undefined)}
        className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-body-sm text-text focus:outline-none focus:border-accent"
      />
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <label className="block">
      <span className="block text-caption uppercase tracking-widest text-text-muted mb-1">{label}</span>
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-body-sm text-text focus:outline-none focus:border-accent"
      />
    </label>
  );
}
