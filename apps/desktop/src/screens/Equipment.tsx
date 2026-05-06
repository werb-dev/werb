import { useState } from "react";
import { DEFAULT_PROFILE_VALUES, type ProfileWithId } from "../data/equipment.ts";
import type { useEquipment } from "../hooks/useEquipment.ts";

interface EquipmentScreenProps {
  api: ReturnType<typeof useEquipment>;
}

export function EquipmentScreen({ api }: EquipmentScreenProps) {
  const eq = api;
  const [selectedId, setSelectedId] = useState<string | null>(
    eq.activeId ?? eq.profiles[0]?.id ?? null,
  );

  const selected = eq.profiles.find((p) => p.id === selectedId);

  const handleCreate = () => {
    const fresh = eq.create({
      name: `Profile ${eq.profiles.length + 1}`,
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
      <main className="mx-auto max-w-5xl px-8 py-12">
        <header className="mb-10">
          <p className="text-caption uppercase tracking-widest text-text-muted">
            Werb · {eq.profiles.length} profile{eq.profiles.length === 1 ? "" : "s"}
          </p>
          <h1 className="text-h1 font-semibold mt-3">Equipment</h1>
          <p className="text-body text-text-muted mt-2 max-w-2xl">
            Define your kettle, mash tun, fermenter and losses. The active profile drives
            water volume calculations across the library, recipe view and brew mode.
          </p>
        </header>

        {eq.profiles.length === 0 ? (
          <EmptyState onCreate={handleCreate} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[16rem_1fr] gap-8">
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
                  if (confirm(`Delete "${selected.name}"?`)) {
                    eq.remove(selected.id);
                    setSelectedId(eq.profiles.find((p) => p.id !== selected.id)?.id ?? null);
                  }
                }}
              />
            ) : (
              <p className="text-body text-text-muted">Select a profile.</p>
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
                    active
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
        + New profile
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
    const { id, ...patch } = draft;
    onSave(patch);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
      className="space-y-8"
    >
      <Field
        label="Name"
        value={draft.name}
        onChange={(v) => update("name", v)}
        onBlur={commit}
        required
      />
      <Field
        label="Description"
        value={draft.description ?? ""}
        onChange={(v) => update("description", v || undefined)}
        onBlur={commit}
        textarea
      />

      <div className="grid grid-cols-2 gap-6">
        <NumberField
          label="Batch size"
          unit="L"
          value={draft.batch_size_l}
          onChange={(v) => update("batch_size_l", v)}
          onBlur={commit}
        />
        <NumberField
          label="Brewhouse efficiency"
          unit="%"
          value={draft.efficiency_pct}
          onChange={(v) => update("efficiency_pct", v)}
          onBlur={commit}
        />
      </div>

      <Section title="Hot liquor tank">
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            label="Capacity"
            unit="L"
            value={draft.hlt?.capacity_l ?? DEFAULT_PROFILE_VALUES.hlt.capacity_l}
            onChange={(v) => updateNested("hlt", "capacity_l", v)}
            onBlur={commit}
          />
          <NumberField
            label="Dead space"
            unit="L"
            value={draft.hlt?.dead_space_l ?? DEFAULT_PROFILE_VALUES.hlt.dead_space_l}
            onChange={(v) => updateNested("hlt", "dead_space_l", v)}
            onBlur={commit}
          />
        </div>
      </Section>

      <Section title="Mash tun">
        <div className="grid grid-cols-3 gap-4">
          <NumberField
            label="Capacity"
            unit="L"
            value={draft.mash_tun?.capacity_l ?? DEFAULT_PROFILE_VALUES.mash_tun.capacity_l}
            onChange={(v) => updateNested("mash_tun", "capacity_l", v)}
            onBlur={commit}
          />
          <NumberField
            label="Dead space"
            unit="L"
            value={draft.mash_tun?.dead_space_l ?? DEFAULT_PROFILE_VALUES.mash_tun.dead_space_l}
            onChange={(v) => updateNested("mash_tun", "dead_space_l", v)}
            onBlur={commit}
          />
          <NumberField
            label="Grain absorption"
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

      <Section title="Kettle">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <NumberField
            label="Capacity"
            unit="L"
            value={draft.kettle?.capacity_l ?? DEFAULT_PROFILE_VALUES.kettle.capacity_l}
            onChange={(v) => updateNested("kettle", "capacity_l", v)}
            onBlur={commit}
          />
          <NumberField
            label="Dead space"
            unit="L"
            value={draft.kettle?.dead_space_l ?? DEFAULT_PROFILE_VALUES.kettle.dead_space_l}
            onChange={(v) => updateNested("kettle", "dead_space_l", v)}
            onBlur={commit}
          />
          <NumberField
            label="Boil-off rate"
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
            label="Post-boil shrink"
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

      <Section title="Fermenter">
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            label="Capacity"
            unit="L"
            value={draft.fermenter?.capacity_l ?? DEFAULT_PROFILE_VALUES.fermenter.capacity_l}
            onChange={(v) => updateNested("fermenter", "capacity_l", v)}
            onBlur={commit}
          />
          <NumberField
            label="Trub loss"
            unit="L"
            value={draft.fermenter?.trub_loss_l ?? DEFAULT_PROFILE_VALUES.fermenter.trub_loss_l}
            onChange={(v) => updateNested("fermenter", "trub_loss_l", v)}
            onBlur={commit}
            step={0.1}
          />
        </div>
      </Section>

      <NumberField
        label="Kettle → fermenter transfer loss"
        unit="L"
        value={draft.transfer_loss_l ?? DEFAULT_PROFILE_VALUES.transfer_loss_l}
        onChange={(v) => update("transfer_loss_l", v)}
        onBlur={commit}
        step={0.1}
      />

      <Field
        label="Notes"
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
            ✓ Active — clear
          </button>
        ) : (
          <button
            type="button"
            onClick={onSetActive}
            className="px-4 py-2 rounded-lg bg-accent text-bg text-body-sm font-medium hover:opacity-90 transition-opacity"
          >
            Set as active
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="px-4 py-2 rounded-lg bg-surface-raised border border-border text-text-muted text-body-sm font-medium hover:text-danger hover:border-danger transition-colors"
        >
          Delete profile
        </button>
      </div>
    </form>
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
  return (
    <div className="rounded-xl bg-surface border border-border border-dashed p-12 text-center">
      <p className="text-body text-text">
        No equipment profile yet.
      </p>
      <p className="text-body-sm text-text-muted mt-2 max-w-md mx-auto">
        Without a profile, the calc engine uses generic defaults (75% efficiency, 3 L/h evap,
        0 dead space). Define yours to get accurate water volumes for every recipe.
      </p>
      <button
        onClick={onCreate}
        className="mt-6 px-5 py-3 rounded-xl bg-accent text-bg text-body font-medium hover:opacity-90 transition-opacity"
      >
        Create your first profile
      </button>
    </div>
  );
}
