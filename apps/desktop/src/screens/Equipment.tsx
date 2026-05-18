import { useMemo, useState } from "react";
import { DEFAULT_PROFILE_VALUES, type ProfileWithId } from "../data/equipment.ts";
import type { useEquipment } from "../hooks/useEquipment.ts";
import { computeEquipmentSuggest } from "@werb/calc";
import type { EquipmentSuggestInput, EquipmentSuggestOutput } from "@werb/types";
import { useT } from "../data/preferences.tsx";

interface EquipmentScreenProps {
  api: ReturnType<typeof useEquipment>;
}

export function EquipmentScreen({ api }: EquipmentScreenProps) {
  const eq = api;
  const t = useT();
  const [selectedId, setSelectedId] = useState<string | null>(
    eq.activeId ?? eq.profiles[0]?.id ?? null,
  );

  const selected = eq.profiles.find((p) => p.id === selectedId);

  const handleCreate = () => {
    const fresh = eq.create({
      name: t("equipment.default_profile_name", { n: eq.profiles.length + 1 }),
      batch_size_l: DEFAULT_PROFILE_VALUES.batch_size_l,
      efficiency_pct: DEFAULT_PROFILE_VALUES.efficiency_pct,
      hlt: { ...DEFAULT_PROFILE_VALUES.hlt },
      mash_tun: { ...DEFAULT_PROFILE_VALUES.mash_tun },
      kettle: { ...DEFAULT_PROFILE_VALUES.kettle },
      fermenter: { ...DEFAULT_PROFILE_VALUES.fermenter },
      transfer_loss_l: DEFAULT_PROFILE_VALUES.transfer_loss_l,
    });
    setSelectedId(fresh.id);
  };

  return (
    <div className="min-h-dvh bg-bg text-text">
      <main className="mx-auto max-w-5xl px-4 pt-12 pb-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <header className="mb-8 sm:mb-10">
          <p className="text-caption uppercase tracking-widest text-text-muted">
            {eq.loading
              ? t("equipment.subtitle_loading")
              : t("equipment.subtitle_count", { count: eq.profiles.length })}
          </p>
          <h1 className="text-h2 sm:text-h1 font-semibold mt-3">{t("equipment.title")}</h1>
          <p className="text-body text-text-muted mt-2 max-w-2xl">
            {t("equipment.intro")}
          </p>
        </header>

        {eq.loading ? (
          <Skeleton />
        ) : eq.profiles.length === 0 ? (
          <EmptyState onCreate={handleCreate} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[16rem_1fr] gap-6 lg:gap-8">
            <ProfileList
              profiles={eq.profiles}
              selectedId={selectedId}
              activeId={eq.activeId}
              onSelect={setSelectedId}
              onCreate={handleCreate}
            />
            {selected ? (
              <ProfileForm
                key={selected.id}
                profile={selected}
                isActive={selected.id === eq.activeId}
                onSave={(patch) => eq.update(selected.id, patch)}
                onSetActive={() => eq.setActive(selected.id)}
                onUnsetActive={() => eq.setActive(null)}
                onDelete={() => {
                  if (confirm(t("equipment.delete_confirm", { name: selected.name }))) {
                    eq.remove(selected.id);
                    setSelectedId(eq.profiles.find((p) => p.id !== selected.id)?.id ?? null);
                  }
                }}
              />
            ) : (
              <p className="text-body text-text-muted">{t("equipment.select_profile")}</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────

function ProfileList({
  profiles,
  selectedId,
  activeId,
  onSelect,
  onCreate,
}: {
  profiles: ProfileWithId[];
  selectedId: string | null;
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  const t = useT();
  return (
    <aside>
      <ul className="rounded-xl bg-surface border border-border divide-y divide-border overflow-hidden">
        {profiles.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => onSelect(p.id)}
              className={`w-full text-left px-4 py-3 transition-colors ${
                selectedId === p.id
                  ? "bg-surface-raised"
                  : "hover:bg-surface-raised"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-body font-medium truncate">{p.name}</span>
                {p.id === activeId && (
                  <span className="shrink-0 text-caption text-success font-mono uppercase tracking-widest">
                    {t("equipment.active_badge")}
                  </span>
                )}
              </div>
              <p className="text-caption text-text-muted mt-1 font-mono">
                {p.batch_size_l} L · {p.efficiency_pct}%
              </p>
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={onCreate}
        className="mt-3 w-full px-4 py-3 rounded-xl bg-accent text-bg text-body-sm font-medium hover:opacity-90 transition-opacity"
      >
        {t("equipment.new_profile")}
      </button>
    </aside>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────

function ProfileForm({
  profile,
  isActive,
  onSave,
  onSetActive,
  onUnsetActive,
  onDelete,
}: {
  profile: ProfileWithId;
  isActive: boolean;
  onSave: (patch: Partial<Omit<ProfileWithId, "id">>) => void;
  onSetActive: () => void;
  onUnsetActive: () => void;
  onDelete: () => void;
}) {
  // Local working copy. Saved on blur.
  const [draft, setDraft] = useState(profile);

  const update = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
  };

  const updateNested = <
    Section extends "hlt" | "mash_tun" | "kettle" | "fermenter",
    Field extends keyof NonNullable<(typeof draft)[Section]>,
  >(
    section: Section,
    field: Field,
    value: NonNullable<(typeof draft)[Section]>[Field],
  ) => {
    const current = (draft[section] ?? {}) as NonNullable<(typeof draft)[Section]>;
    setDraft({ ...draft, [section]: { ...current, [field]: value } });
  };

  const commit = () => {
    const { id: _id, ...patch } = draft;
    onSave(patch);
  };

  const applySuggestion = (out: EquipmentSuggestOutput) => {
    // Replace every sizing field but preserve identity + free-form text:
    // name, description, and notes are user-authored and shouldn't be
    // overwritten by the wizard.
    const next: ProfileWithId = {
      ...draft,
      batch_size_l: out.batch_size_l,
      efficiency_pct: out.efficiency_pct,
      hlt: out.hlt,
      mash_tun: out.mash_tun,
      kettle: out.kettle,
      fermenter: out.fermenter,
      transfer_loss_l: out.transfer_loss_l,
    };
    setDraft(next);
    const { id: _id, ...patch } = next;
    onSave(patch);
  };

  const t = useT();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
      className="space-y-8"
    >
      <Field
        label={t("equipment.field.name")}
        value={draft.name}
        onChange={(v) => update("name", v)}
        onBlur={commit}
        required
      />
      <Field
        label={t("equipment.field.description")}
        value={draft.description ?? ""}
        onChange={(v) => update("description", v || undefined)}
        onBlur={commit}
        textarea
      />

      <SuggestPanel initialBatchSize={draft.batch_size_l} onApply={applySuggestion} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <NumberField
          label={t("equipment.field.batch_size")}
          unit="L"
          value={draft.batch_size_l}
          onChange={(v) => update("batch_size_l", v)}
          onBlur={commit}
        />
        <NumberField
          label={t("equipment.field.efficiency")}
          unit="%"
          value={draft.efficiency_pct}
          onChange={(v) => update("efficiency_pct", v)}
          onBlur={commit}
        />
      </div>

      <Section title={t("equipment.section.hlt")}>
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            label={t("equipment.field.capacity")}
            unit="L"
            value={draft.hlt?.capacity_l ?? DEFAULT_PROFILE_VALUES.hlt.capacity_l}
            onChange={(v) => updateNested("hlt", "capacity_l", v)}
            onBlur={commit}
          />
          <NumberField
            label={t("equipment.field.dead_space")}
            unit="L"
            value={draft.hlt?.dead_space_l ?? DEFAULT_PROFILE_VALUES.hlt.dead_space_l}
            onChange={(v) => updateNested("hlt", "dead_space_l", v)}
            onBlur={commit}
          />
        </div>
      </Section>

      <Section title={t("equipment.section.mash_tun")}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <NumberField
            label={t("equipment.field.capacity")}
            unit="L"
            value={draft.mash_tun?.capacity_l ?? DEFAULT_PROFILE_VALUES.mash_tun.capacity_l}
            onChange={(v) => updateNested("mash_tun", "capacity_l", v)}
            onBlur={commit}
          />
          <NumberField
            label={t("equipment.field.dead_space")}
            unit="L"
            value={draft.mash_tun?.dead_space_l ?? DEFAULT_PROFILE_VALUES.mash_tun.dead_space_l}
            onChange={(v) => updateNested("mash_tun", "dead_space_l", v)}
            onBlur={commit}
          />
          <NumberField
            label={t("equipment.field.grain_absorption")}
            unit="L/kg"
            value={
              draft.mash_tun?.grain_absorption_l_per_kg ??
              DEFAULT_PROFILE_VALUES.mash_tun.grain_absorption_l_per_kg
            }
            onChange={(v) => updateNested("mash_tun", "grain_absorption_l_per_kg", v)}
            onBlur={commit}
            step={0.01}
          />
        </div>
      </Section>

      <Section title={t("equipment.section.kettle")}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <NumberField
            label={t("equipment.field.capacity")}
            unit="L"
            value={draft.kettle?.capacity_l ?? DEFAULT_PROFILE_VALUES.kettle.capacity_l}
            onChange={(v) => updateNested("kettle", "capacity_l", v)}
            onBlur={commit}
          />
          <NumberField
            label={t("equipment.field.dead_space")}
            unit="L"
            value={draft.kettle?.dead_space_l ?? DEFAULT_PROFILE_VALUES.kettle.dead_space_l}
            onChange={(v) => updateNested("kettle", "dead_space_l", v)}
            onBlur={commit}
          />
          <NumberField
            label={t("equipment.field.boil_off")}
            unit="L/h"
            value={
              draft.kettle?.evaporation_rate_l_per_hour ??
              DEFAULT_PROFILE_VALUES.kettle.evaporation_rate_l_per_hour
            }
            onChange={(v) => updateNested("kettle", "evaporation_rate_l_per_hour", v)}
            onBlur={commit}
            step={0.1}
          />
          <NumberField
            label={t("equipment.field.post_boil_shrink")}
            unit="%"
            value={
              draft.kettle?.post_boil_shrinkage_pct ??
              DEFAULT_PROFILE_VALUES.kettle.post_boil_shrinkage_pct
            }
            onChange={(v) => updateNested("kettle", "post_boil_shrinkage_pct", v)}
            onBlur={commit}
            step={0.5}
          />
        </div>
      </Section>

      <Section title={t("equipment.section.fermenter")}>
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            label={t("equipment.field.capacity")}
            unit="L"
            value={draft.fermenter?.capacity_l ?? DEFAULT_PROFILE_VALUES.fermenter.capacity_l}
            onChange={(v) => updateNested("fermenter", "capacity_l", v)}
            onBlur={commit}
          />
          <NumberField
            label={t("equipment.field.trub_loss")}
            unit="L"
            value={draft.fermenter?.trub_loss_l ?? DEFAULT_PROFILE_VALUES.fermenter.trub_loss_l}
            onChange={(v) => updateNested("fermenter", "trub_loss_l", v)}
            onBlur={commit}
            step={0.1}
          />
        </div>
      </Section>

      <NumberField
        label={t("equipment.field.transfer_loss")}
        unit="L"
        value={draft.transfer_loss_l ?? DEFAULT_PROFILE_VALUES.transfer_loss_l}
        onChange={(v) => update("transfer_loss_l", v)}
        onBlur={commit}
        step={0.1}
      />

      <label className="block">
        <span className="block text-caption uppercase tracking-widest text-text-muted mb-2">
          {t("equipment.field.mash_mode")}
        </span>
        <select
          value={draft.mash_mode ?? "classic"}
          onChange={(e) => {
            update("mash_mode", e.target.value as "classic" | "biab");
            commit();
          }}
          className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-body text-text focus:outline-none focus:border-accent"
        >
          <option value="classic">{t("equipment.opt.mash_classic")}</option>
          <option value="biab">{t("equipment.opt.mash_biab")}</option>
        </select>
        <p className="text-caption text-text-muted mt-1">
          {t("equipment.field.mash_mode_hint")}
        </p>
      </label>

      <Field
        label={t("equipment.field.notes")}
        value={draft.notes ?? ""}
        onChange={(v) => update("notes", v || undefined)}
        onBlur={commit}
        textarea
      />

      <div className="flex flex-wrap gap-3 justify-between pt-6 border-t border-border">
        {isActive ? (
          <button
            type="button"
            onClick={onUnsetActive}
            className="px-4 py-2 rounded-lg bg-surface-raised border border-success text-success text-body-sm font-medium hover:bg-success/10 transition-colors"
          >
            {t("equipment.active_clear")}
          </button>
        ) : (
          <button
            type="button"
            onClick={onSetActive}
            className="px-4 py-2 rounded-lg bg-accent text-bg text-body-sm font-medium hover:opacity-90 transition-opacity"
          >
            {t("equipment.set_active")}
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="px-4 py-2 rounded-lg bg-surface-raised border border-border text-text-muted text-body-sm font-medium hover:text-danger hover:border-danger transition-colors"
        >
          {t("equipment.delete_profile")}
        </button>
      </div>
    </form>
  );
}

// ─── Suggest panel ────────────────────────────────────────────────────────

/**
 * Quick-start widget that sizes every capacity field from a target batch
 * volume + setup type. Computed live via @werb/calc so the brewer sees
 * the intermediate volumes (grain bill, mash water, sparge, pre-boil)
 * before they apply.
 */
function SuggestPanel({
  initialBatchSize,
  onApply,
}: {
  initialBatchSize: number;
  onApply: (out: EquipmentSuggestOutput) => void;
}) {
  const t = useT();
  const [setupType, setSetupType] =
    useState<EquipmentSuggestInput["setup_type"]>("three_vessel");
  // Seed from the current draft so the wizard reflects what the brewer
  // already entered. They tweak only if they want to re-derive.
  const [batchSize, setBatchSize] = useState(initialBatchSize);

  const preview = useMemo(
    () =>
      computeEquipmentSuggest({
        setup_type: setupType,
        batch_size_l: batchSize > 0 ? batchSize : 20,
      }),
    [setupType, batchSize],
  );

  return (
    <details className="rounded-xl bg-surface-raised border border-border border-dashed group">
      <summary className="cursor-pointer px-4 py-3 sm:px-5 sm:py-4 list-none flex items-center justify-between gap-4 select-none">
        <div className="min-w-0">
          <p className="text-caption uppercase tracking-widest text-text-muted">
            {t("equipment.wizard.title")}
          </p>
          <p className="text-body-sm text-text mt-1">
            {t("equipment.wizard.subtitle")}
          </p>
        </div>
        <span
          aria-hidden
          className="text-text-muted group-open:rotate-180 transition-transform shrink-0"
        >
          ▾
        </span>
      </summary>
      <div className="px-4 pb-4 sm:px-5 sm:pb-5 space-y-4 border-t border-border pt-4">
        <SetupTypePicker value={setupType} onChange={setSetupType} />

        <div className="grid grid-cols-1 sm:grid-cols-[12rem_1fr_auto] gap-3 items-end">
          <label className="block">
            <span className="block text-caption uppercase tracking-widest text-text-muted mb-2">
              {t("equipment.wizard.target_batch")}
            </span>
            <div className="flex items-baseline gap-2 bg-surface border border-border rounded-lg px-3 py-2 focus-within:border-accent">
              <input
                type="number"
                value={Number.isFinite(batchSize) ? batchSize : ""}
                step={0.5}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setBatchSize(Number.isFinite(n) ? n : 0);
                }}
                className="w-full bg-transparent text-body font-mono tabular-nums text-text focus:outline-none"
              />
              <span className="text-caption font-mono text-text-muted shrink-0">L</span>
            </div>
          </label>
          <DerivedPreview preview={preview} />
          <button
            type="button"
            onClick={() => onApply(preview)}
            disabled={!Number.isFinite(batchSize) || batchSize <= 0}
            className="px-5 py-2.5 rounded-lg bg-accent text-bg text-body-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity min-h-[40px]"
          >
            {t("equipment.wizard.apply")}
          </button>
        </div>
        <p className="text-caption text-text-muted">
          {t("equipment.wizard.replaces_note")}
        </p>
      </div>
    </details>
  );
}

// Setup-type options. `labelKey` and `hintKey` live under
// equipment.wizard.* — the picker translates at render time.
const SETUP_OPTIONS: Array<{
  value: EquipmentSuggestInput["setup_type"];
  labelKey: string;
  hintKey: string;
}> = [
  {
    value: "three_vessel",
    labelKey: "equipment.wizard.three_vessel",
    hintKey: "equipment.wizard.three_vessel_hint",
  },
  {
    value: "two_vessel",
    labelKey: "equipment.wizard.two_vessel",
    hintKey: "equipment.wizard.two_vessel_hint",
  },
  {
    value: "biab",
    labelKey: "equipment.wizard.biab",
    hintKey: "equipment.wizard.biab_hint",
  },
];

function SetupTypePicker({
  value,
  onChange,
}: {
  value: EquipmentSuggestInput["setup_type"];
  onChange: (v: EquipmentSuggestInput["setup_type"]) => void;
}) {
  const t = useT();
  const active = SETUP_OPTIONS.find((o) => o.value === value);
  return (
    <div>
      <p className="text-caption uppercase tracking-widest text-text-muted mb-2">
        {t("equipment.wizard.setup_type")}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {SETUP_OPTIONS.map((opt) => {
          const isActive = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`px-3 py-2 rounded-lg text-body-sm font-medium transition-colors ${
                isActive
                  ? "bg-accent text-bg"
                  : "bg-surface border border-border text-text-muted hover:text-text hover:border-accent"
              }`}
            >
              {t(opt.labelKey)}
            </button>
          );
        })}
      </div>
      {active && (
        <p className="text-caption text-text-muted mt-2">{t(active.hintKey)}</p>
      )}
    </div>
  );
}

function DerivedPreview({ preview }: { preview: EquipmentSuggestOutput }) {
  const t = useT();
  // Compact summary line so the brewer can sanity-check before applying.
  const spargePart =
    preview.derived.sparge_water_l > 0
      ? t("equipment.wizard.preview.sparge", { sparge: preview.derived.sparge_water_l })
      : "";
  return (
    <div className="text-caption font-mono text-text-muted leading-relaxed">
      <p>
        {t("equipment.wizard.preview.line1", {
          grain: preview.derived.grain_kg,
          mash: preview.derived.mash_water_l,
          spargePart,
          preBoil: preview.derived.pre_boil_volume_l,
        })}
      </p>
      <p>
        {preview.hlt.capacity_l > 0 && `HLT ${preview.hlt.capacity_l} L · `}
        {preview.mash_tun.capacity_l > 0 &&
          `MT ${preview.mash_tun.capacity_l} L · `}
        kettle {preview.kettle.capacity_l} L · fermenter{" "}
        {preview.fermenter.capacity_l} L
      </p>
    </div>
  );
}

// ─── Form primitives ──────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="text-caption uppercase tracking-widest text-text-muted mb-3">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  textarea,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  textarea?: boolean;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-caption uppercase tracking-widest text-text-muted mb-2">
        {label}
        {required && <span className="text-warning ml-1">*</span>}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          rows={2}
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-body text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
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
  onBlur,
  step = 1,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  onBlur: () => void;
  step?: number;
}) {
  return (
    <label className="block">
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
          onBlur={onBlur}
          className="w-full bg-transparent text-body font-mono tabular-nums text-text focus:outline-none"
        />
        <span className="text-caption font-mono text-text-muted shrink-0">{unit}</span>
      </div>
    </label>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const t = useT();
  return (
    <div className="rounded-xl bg-surface border border-border border-dashed p-8 sm:p-12 text-center">
      <p className="text-body text-text">
        {t("equipment.empty.heading")}
      </p>
      <p className="text-body-sm text-text-muted mt-2 max-w-md mx-auto">
        {t("equipment.empty.body")}
      </p>
      <button
        onClick={onCreate}
        className="mt-6 px-5 py-3 rounded-xl bg-accent text-bg text-body font-medium hover:opacity-90 transition-opacity"
      >
        {t("equipment.empty.create")}
      </button>
    </div>
  );
}

/**
 * Two-column placeholder mirroring the loaded layout. Shown during the
 * StorageBackend's initial async read on backends without readSync —
 * keeps the screen from flashing the EmptyState before profiles arrive.
 */
function Skeleton() {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-[16rem_1fr] gap-8"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="space-y-2 animate-pulse">
        <div className="h-10 rounded-lg bg-surface-raised" />
        <div className="h-10 rounded-lg bg-surface-raised opacity-70" />
      </div>
      <div className="rounded-xl bg-surface border border-border p-6 animate-pulse">
        <div className="h-4 w-1/4 rounded bg-surface-raised" />
        <div className="mt-4 h-10 w-2/3 rounded bg-surface-raised" />
        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="h-12 rounded bg-surface-raised" />
          <div className="h-12 rounded bg-surface-raised" />
          <div className="h-12 rounded bg-surface-raised" />
          <div className="h-12 rounded bg-surface-raised" />
        </div>
      </div>
    </div>
  );
}
