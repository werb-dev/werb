import { useEffect, useState } from "react";
import {
  clearWerbData,
  copyKeysToBackend,
  gitHubBackend,
  restoreSnapshot,
  snapshotBackend,
  useStorage,
  usePersistedJson,
  verifyGitHubAccess,
  type DataSnapshot,
  type GitHubBackendConfig,
  type StorageBackend,
} from "../storage/index.ts";
import { useUnitsControl, useUnits } from "../data/preferences.tsx";
import {
  currencySymbol,
  formatMoney,
  type UnitPreferences,
} from "../data/units-format.ts";
import { downloadTextFile, pickAndReadTextFile } from "../data/browser-fs.ts";
import { usePriceCatalog } from "../hooks/usePriceCatalog.ts";
import { useRecipes } from "../hooks/useRecipes.ts";
import {
  collectLibraryIngredients,
  type CostCategory,
  type LibraryIngredient,
} from "../data/cost.ts";
import type { PriceEntry, PriceUnit } from "../data/prices.ts";

/**
 * Sync + advanced storage settings. v1 covers a single GitHub-based
 * sync target: user pastes a Personal Access Token + "owner/repo",
 * we verify the credentials, and Push / Pull buttons fan every
 * werb.* key in or out via the StorageBackend port. No automatic
 * background sync — explicit only, so the brewer always knows what
 * just happened to their data.
 */

interface SyncConfig {
  config: GitHubBackendConfig;
  /** Login of the user the token authenticates as — shown for confirmation. */
  login: string;
  /** Normalized repo full_name from GitHub — guards against typo'd casing. */
  repoName: string;
}

interface SyncStatus {
  kind: "idle" | "verifying" | "syncing";
  message?: string;
  error?: string;
}

interface ProgressState {
  done: number;
  total: number;
}

export function SettingsScreen() {
  const backend = useStorage();
  // The sync config lives under a key OUTSIDE the werb.* namespace,
  // so it never round-trips through the GitHub backend (which would
  // be a recursive sync of the token, both pointless and a small
  // security footgun).
  const [sync, setSync] = usePersistedJson<SyncConfig | null>(
    "local.sync.github",
    null,
  );

  return (
    <div className="min-h-dvh bg-bg text-text">
      <main className="mx-auto max-w-2xl px-4 pt-12 pb-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <header className="mb-8 sm:mb-10">
          <p className="text-caption uppercase tracking-widest text-text-muted">
            Werb · settings
          </p>
          <h1 className="text-h2 sm:text-h1 font-semibold mt-3">Sync &amp; storage</h1>
          <p className="text-body text-text-muted mt-2 max-w-2xl">
            Keep recipes, equipment profiles, and brew sessions in sync
            across devices via a private GitHub repo. Manual push / pull
            in v1 — no background sync.
          </p>
        </header>

        <Section title="Units">
          <UnitsCard />
        </Section>

        <Section title="Prices">
          <PricesCard />
        </Section>

        <Section title="GitHub sync">
          {sync ? (
            <Connected backend={backend} sync={sync} onDisconnect={() => setSync(null)} />
          ) : (
            <Connect onConnected={setSync} />
          )}
        </Section>

        <Section title="Data">
          <DataCard backend={backend} />
        </Section>
      </main>
    </div>
  );
}

// ─── Units ────────────────────────────────────────────────────────────────

function UnitsCard() {
  const { prefs, setPrefs } = useUnitsControl();

  const update = <K extends keyof UnitPreferences>(key: K, value: UnitPreferences[K]) =>
    setPrefs((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="rounded-xl bg-surface border border-border p-4 sm:p-6">
      <p className="text-body-sm text-text-muted mb-5 max-w-prose">
        Display-only. The editor and stored data are unchanged — these
        preferences just change how recipes and brew screens render
        numbers.
      </p>

      <div className="space-y-4">
        <UnitPicker
          label="Temperature"
          value={prefs.temperature}
          onChange={(v) => update("temperature", v)}
          options={[
            { value: "C", label: "°C" },
            { value: "F", label: "°F" },
          ]}
        />
        <UnitPicker
          label="Volume"
          value={prefs.volume}
          onChange={(v) => update("volume", v)}
          options={[
            { value: "l", label: "Liters" },
            { value: "gal", label: "US gallons" },
          ]}
        />
        <UnitPicker
          label="Mass"
          value={prefs.mass}
          onChange={(v) => update("mass", v)}
          options={[
            { value: "kg", label: "kg / g" },
            { value: "lb", label: "lb / oz" },
          ]}
        />
        <UnitPicker
          label="Gravity"
          value={prefs.gravity}
          onChange={(v) => update("gravity", v)}
          options={[
            { value: "sg", label: "Specific gravity (1.052)" },
            { value: "plato", label: "Plato (12.9 °P)" },
          ]}
        />
        <UnitPicker
          label="Color"
          value={prefs.color}
          onChange={(v) => update("color", v)}
          options={[
            { value: "EBC", label: "EBC" },
            { value: "SRM", label: "SRM" },
          ]}
        />
        <UnitPicker
          label="Currency"
          value={prefs.currency}
          onChange={(v) => update("currency", v)}
          options={[
            { value: "EUR", label: "€ Euro" },
            { value: "USD", label: "$ US dollar" },
            { value: "GBP", label: "£ Pound sterling" },
          ]}
        />
      </div>
    </div>
  );
}

function UnitPicker<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
}) {
  return (
    <div>
      <p className="text-caption uppercase tracking-widest text-text-muted mb-2">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`px-4 py-2 rounded-lg text-body-sm font-medium transition-colors ${
                active
                  ? "bg-accent text-bg"
                  : "bg-bg border border-border text-text-muted hover:text-text hover:border-accent"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Prices ──────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<CostCategory, string> = {
  fermentable: "Grain",
  hop: "Hop",
  culture: "Yeast",
  misc: "Misc",
};

const DEFAULT_UNIT_FOR_CATEGORY: Record<CostCategory, PriceUnit> = {
  fermentable: "kg",
  hop: "g",
  culture: "pack",
  misc: "g",
};

function PricesCard() {
  const prefs = useUnits();
  const { catalog, setPrice, unsetPrice } = usePriceCatalog();
  const { recipes } = useRecipes();
  const [filter, setFilter] = useState("");

  // Aggregate every ingredient appearing in any recipe so the brewer
  // can see what they haven't priced yet — far less painful than
  // chasing them through individual recipe screens.
  const libraryIngredients = collectLibraryIngredients(
    recipes.map((r) => r.recipe),
  );
  const catalogKeys = new Set(catalog.prices.map((p) => p.key));
  const missing = libraryIngredients.filter((i) => !catalogKeys.has(i.key));

  const needle = filter.trim().toLowerCase();
  const filterPrices = (entries: PriceEntry[]) =>
    needle
      ? entries.filter((p) => p.key.includes(needle))
      : entries;
  const filterMissing = (entries: LibraryIngredient[]) =>
    needle
      ? entries.filter((i) => i.key.includes(needle))
      : entries;

  const visiblePrices = filterPrices(catalog.prices).slice().sort((a, b) =>
    a.key.localeCompare(b.key),
  );
  const visibleMissing = filterMissing(missing);

  return (
    <div className="rounded-xl bg-surface border border-border p-4 sm:p-6">
      <p className="text-body-sm text-text-muted mb-5 max-w-prose">
        One global price book. Set a unit price per ingredient and every
        recipe using that name picks it up. Stored locally and synced
        through GitHub like everything else.
      </p>

      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search by name…"
        className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-body-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent mb-5"
      />

      {/* Missing-from-library block — the headline UX. */}
      {missing.length > 0 && (
        <div className="mb-6">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-caption uppercase tracking-widest text-warning font-medium">
              Missing prices · {missing.length}
            </h3>
            <p className="text-caption text-text-muted">
              In your recipes, no catalog entry yet
            </p>
          </div>
          {visibleMissing.length === 0 ? (
            <p className="text-caption text-text-muted">
              No missing prices match the filter.
            </p>
          ) : (
            <ul className="rounded-lg bg-bg border border-border divide-y divide-border">
              {visibleMissing.map((ing) => (
                <MissingPriceRow
                  key={ing.key}
                  ingredient={ing}
                  prefs={prefs}
                  onSave={(price, unit) => setPrice(ing.display_name, price, unit)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Saved prices block. */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-caption uppercase tracking-widest text-text-muted font-medium">
            Saved · {catalog.prices.length}
          </h3>
        </div>
        {visiblePrices.length === 0 ? (
          <p className="text-caption text-text-muted">
            {catalog.prices.length === 0
              ? "No prices set yet."
              : "No saved prices match the filter."}
          </p>
        ) : (
          <ul className="rounded-lg bg-bg border border-border divide-y divide-border">
            {visiblePrices.map((entry) => (
              <SavedPriceRow
                key={entry.key}
                entry={entry}
                prefs={prefs}
                onUpdate={(price, unit) => setPrice(entry.key, price, unit)}
                onRemove={() => unsetPrice(entry.key)}
              />
            ))}
          </ul>
        )}
      </div>

      <NewPriceForm
        prefs={prefs}
        onAdd={(name, price, unit) => setPrice(name, price, unit)}
      />
    </div>
  );
}

function MissingPriceRow({
  ingredient,
  prefs,
  onSave,
}: {
  ingredient: LibraryIngredient;
  prefs: UnitPreferences;
  onSave: (price: number, unit: PriceUnit) => void;
}) {
  const [price, setPrice] = useState<number>(0);
  const [unit, setUnit] = useState<PriceUnit>(
    DEFAULT_UNIT_FOR_CATEGORY[ingredient.category],
  );

  return (
    <li className="px-3 py-3 sm:px-4 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center">
      <div className="min-w-0">
        <p className="text-body-sm font-medium truncate">
          {ingredient.display_name}
        </p>
        <p className="text-caption text-text-muted mt-0.5">
          {CATEGORY_LABEL[ingredient.category]} · in {ingredient.recipe_count}{" "}
          recipe{ingredient.recipe_count === 1 ? "" : "s"}
        </p>
      </div>
      <PriceFields
        prefs={prefs}
        price={price}
        unit={unit}
        onPriceChange={setPrice}
        onUnitChange={setUnit}
        onSubmit={() => {
          if (price > 0) {
            onSave(price, unit);
            setPrice(0);
          }
        }}
        submitLabel="Set"
      />
    </li>
  );
}

function SavedPriceRow({
  entry,
  prefs,
  onUpdate,
  onRemove,
}: {
  entry: PriceEntry;
  prefs: UnitPreferences;
  onUpdate: (price: number, unit: PriceUnit) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState<number>(entry.unit_price);
  const [unit, setUnit] = useState<PriceUnit>(entry.natural_unit);

  if (!editing) {
    return (
      <li className="px-3 py-3 sm:px-4 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body-sm font-medium truncate capitalize">
            {entry.key}
          </p>
          <p className="text-caption text-text-muted mt-0.5 font-mono">
            {formatMoney(entry.unit_price, prefs)} / {entry.natural_unit}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setPrice(entry.unit_price);
              setUnit(entry.natural_unit);
              setEditing(true);
            }}
            className="text-caption text-text-muted hover:text-accent transition-colors"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Remove price for "${entry.key}"?`)) onRemove();
            }}
            className="text-caption text-text-muted hover:text-danger transition-colors"
          >
            Remove
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="px-3 py-3 sm:px-4 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center">
      <p className="text-body-sm font-medium truncate capitalize min-w-0">
        {entry.key}
      </p>
      <PriceFields
        prefs={prefs}
        price={price}
        unit={unit}
        onPriceChange={setPrice}
        onUnitChange={setUnit}
        onSubmit={() => {
          if (price > 0) onUpdate(price, unit);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
        submitLabel="Save"
      />
    </li>
  );
}

function NewPriceForm({
  prefs,
  onAdd,
}: {
  prefs: UnitPreferences;
  onAdd: (name: string, price: number, unit: PriceUnit) => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [unit, setUnit] = useState<PriceUnit>("kg");

  const submit = () => {
    if (!name.trim() || !(price > 0)) return;
    onAdd(name.trim(), price, unit);
    setName("");
    setPrice(0);
  };

  return (
    <div className="rounded-lg bg-bg border border-border border-dashed p-3 sm:p-4">
      <p className="text-caption uppercase tracking-widest text-text-muted mb-3">
        Add a price
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
        <label className="block">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ingredient name (e.g. Mosaic, Pilsner malt)"
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-body-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        </label>
        <PriceFields
          prefs={prefs}
          price={price}
          unit={unit}
          onPriceChange={setPrice}
          onUnitChange={setUnit}
          onSubmit={submit}
          submitLabel="Add"
        />
      </div>
    </div>
  );
}

function PriceFields({
  prefs,
  price,
  unit,
  onPriceChange,
  onUnitChange,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  prefs: UnitPreferences;
  price: number;
  unit: PriceUnit;
  onPriceChange: (v: number) => void;
  onUnitChange: (u: PriceUnit) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex items-stretch gap-2">
      <div className="flex items-baseline gap-1 bg-surface border border-border rounded-lg px-2 py-2 focus-within:border-accent">
        <span className="text-caption font-mono text-text-muted shrink-0">
          {currencySymbol(prefs)}
        </span>
        <input
          type="number"
          value={Number.isFinite(price) && price !== 0 ? price : ""}
          step={0.01}
          min={0}
          onChange={(e) => {
            const n = Number(e.target.value);
            onPriceChange(Number.isFinite(n) ? n : 0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
          }}
          placeholder="0.00"
          className="w-20 bg-transparent text-body-sm font-mono tabular-nums text-text focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-caption font-mono text-text-muted shrink-0">/</span>
        <select
          value={unit}
          onChange={(e) => onUnitChange(e.target.value as PriceUnit)}
          className="bg-transparent text-caption text-text focus:outline-none"
        >
          <option value="kg">kg</option>
          <option value="g">g</option>
          <option value="L">L</option>
          <option value="pack">pack</option>
        </select>
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={!(price > 0)}
        className="px-3 py-2 rounded-lg bg-accent text-bg text-caption font-medium hover:opacity-90 disabled:opacity-50 transition-opacity min-h-[36px]"
      >
        {submitLabel}
      </button>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 rounded-lg text-caption text-text-muted hover:text-text transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

// ─── Data management ─────────────────────────────────────────────────────

function DataCard({ backend }: { backend: StorageBackend }) {
  const [stats, setStats] = useState<{ recipes: number; sessions: number; equipment: number; other: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Recount whenever the section mounts. The brewer pushes / pulls /
  // wipes from here, so the numbers should reflect what was just
  // done — but tracking every storage write into a live counter is
  // overkill for a screen people visit occasionally.
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const keys = await backend.list("werb.");
      if (cancelled) return;
      let recipes = 0;
      let sessions = 0;
      let equipment = 0;
      let other = 0;
      for (const k of keys) {
        if (k === "werb.recipes") recipes = await countItems(backend, k, "recipes");
        else if (k === "werb.equipment") equipment = await countItems(backend, k, "profiles");
        else if (k.startsWith("werb.session.")) sessions++;
        else other++;
      }
      if (!cancelled) {
        setStats({ recipes, sessions, equipment, other, total: keys.length });
      }
    }
    void refresh();
    return () => {
      cancelled = true;
    };
  }, [backend, message]);

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const msg = await fn();
      if (msg) setMessage(msg);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onExport = () =>
    run(async () => {
      const snapshot = await snapshotBackend(backend);
      const filename = `werb-backup-${snapshot.exported_at.slice(0, 10)}.json`;
      downloadTextFile(filename, JSON.stringify(snapshot, null, 2), "application/json");
      const count = Object.keys(snapshot.data).length;
      return `Exported ${count} ${count === 1 ? "item" : "items"} to ${filename}.`;
    });

  const onRestore = () =>
    run(async () => {
      const picked = await pickAndReadTextFile();
      if (!picked) return null;
      let parsed: DataSnapshot;
      try {
        parsed = JSON.parse(picked.text) as DataSnapshot;
      } catch {
        throw new Error("That file isn't valid JSON.");
      }
      if (typeof parsed !== "object" || parsed === null || !("schema_version" in parsed)) {
        throw new Error("That file isn't a Werb backup.");
      }
      const count = await restoreSnapshot(backend, parsed);
      return `Restored ${count} ${count === 1 ? "item" : "items"} from backup. Reload the app to see the changes.`;
    });

  const onClear = () =>
    run(async () => {
      const confirmed = confirm(
        "Delete every recipe, equipment profile, and brew session?\n\n" +
          "Unit preferences and your GitHub sync settings are NOT affected. " +
          "Export a backup first if you might want to undo this.",
      );
      if (!confirmed) return null;
      const count = await clearWerbData(backend);
      return `Cleared ${count} ${count === 1 ? "item" : "items"}. Reload the app to see an empty state.`;
    });

  return (
    <div className="rounded-xl bg-surface border border-border p-4 sm:p-6">
      <p className="text-body-sm text-text-muted mb-5 max-w-prose">
        Export a JSON backup of your recipes, equipment, and brew sessions —
        or wipe everything for a fresh start. Unit preferences and sync
        settings are stored separately and aren't touched by these actions.
      </p>

      {stats && (
        <p className="text-caption font-mono text-text-muted mb-5">
          {stats.recipes} recipe{stats.recipes === 1 ? "" : "s"} ·{" "}
          {stats.equipment} equipment profile{stats.equipment === 1 ? "" : "s"} ·{" "}
          {stats.sessions} brew session{stats.sessions === 1 ? "" : "s"}
          {stats.other > 0 && ` · ${stats.other} other`}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onExport}
          disabled={busy}
          className="px-5 py-2 rounded-lg bg-accent text-bg text-body-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {busy ? "Working…" : "Export backup"}
        </button>
        <button
          type="button"
          onClick={onRestore}
          disabled={busy}
          className="px-5 py-2 rounded-lg bg-surface-raised border border-border text-body-sm font-medium hover:border-accent hover:text-accent disabled:opacity-50 transition-colors"
        >
          {busy ? "Working…" : "Restore from file"}
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={busy}
          className="ml-auto px-4 py-2 rounded-lg text-body-sm text-text-muted hover:text-danger disabled:opacity-50 transition-colors"
        >
          Clear all data
        </button>
      </div>

      {message && (
        <p className="mt-4 text-caption text-success">{message}</p>
      )}
      {error && (
        <p className="mt-4 text-body-sm text-warning">{error}</p>
      )}
    </div>
  );
}

/**
 * Count how many items live inside a blob whose top-level shape is
 * `{ [arrayKey]: T[] }`. Used to surface "N recipes / M profiles" in
 * the Data section header. Returns 0 on parse failure rather than
 * blowing up the whole stats display.
 */
async function countItems(
  backend: StorageBackend,
  key: string,
  arrayKey: string,
): Promise<number> {
  const raw = await backend.read(key);
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const arr = parsed[arrayKey];
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

// ─── Connection form ──────────────────────────────────────────────────────

function Connect({ onConnected }: { onConnected: (s: SyncConfig) => void }) {
  const [token, setToken] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [status, setStatus] = useState<SyncStatus>({ kind: "idle" });

  const onVerify = async () => {
    if (!token || !repo) {
      setStatus({ kind: "idle", error: "Token and repo are required." });
      return;
    }
    setStatus({ kind: "verifying" });
    try {
      const result = await verifyGitHubAccess({ token, repo, branch });
      onConnected({
        config: { token, repo, branch },
        login: result.login,
        repoName: result.repoName,
      });
      setStatus({ kind: "idle" });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "idle", error: detail });
    }
  };

  return (
    <div className="rounded-xl bg-surface border border-border p-4 sm:p-6">
      <p className="text-body text-text-muted mb-5 max-w-prose">
        Paste a Personal Access Token with{" "}
        <code className="font-mono text-mono text-text">Contents: read+write</code>{" "}
        on the target repo (fine-grained) or the classic{" "}
        <code className="font-mono text-mono text-text">repo</code> scope.
      </p>

      <div className="space-y-4">
        <Field
          label="Token"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={token}
          onChange={setToken}
          placeholder="github_pat_…"
        />
        <Field
          label="Repository"
          autoComplete="off"
          spellCheck={false}
          value={repo}
          onChange={setRepo}
          placeholder="owner/recipes"
        />
        <Field
          label="Branch"
          autoComplete="off"
          spellCheck={false}
          value={branch}
          onChange={setBranch}
          placeholder="main"
        />
      </div>

      {status.error && (
        <p className="mt-4 text-body-sm text-warning">{status.error}</p>
      )}

      <button
        type="button"
        onClick={onVerify}
        disabled={status.kind === "verifying"}
        className="mt-5 px-5 py-2 rounded-lg bg-accent text-bg text-body-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {status.kind === "verifying" ? "Verifying…" : "Verify & connect"}
      </button>

      <p className="text-caption text-text-muted mt-4 max-w-prose">
        The token sits in this browser's local storage. Use a
        fine-grained token scoped to one repo — that's the smallest
        blast radius if anything ever leaks.
      </p>
    </div>
  );
}

// ─── Connected: Push / Pull / Disconnect ──────────────────────────────────

function Connected({
  backend,
  sync,
  onDisconnect,
}: {
  backend: ReturnType<typeof useStorage>;
  sync: SyncConfig;
  onDisconnect: () => void;
}) {
  const [status, setStatus] = useState<SyncStatus>({ kind: "idle" });
  const [progress, setProgress] = useState<ProgressState | null>(null);

  const runSync = async (
    direction: "push" | "pull",
  ) => {
    setStatus({ kind: "syncing" });
    setProgress({ done: 0, total: 0 });
    const remote = gitHubBackend(sync.config);
    try {
      const source = direction === "push" ? backend : remote;
      const target = direction === "push" ? remote : backend;
      const count = await copyKeysToBackend(source, target, (done, total) =>
        setProgress({ done, total }),
      );
      setStatus({
        kind: "idle",
        message:
          count === 0
            ? "Nothing to copy."
            : direction === "push"
            ? `Pushed ${count} ${count === 1 ? "item" : "items"} to GitHub.`
            : `Pulled ${count} ${count === 1 ? "item" : "items"} from GitHub.`,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "idle", error: `Sync failed: ${detail}` });
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="rounded-xl bg-surface border border-border p-4 sm:p-6">
      <p className="text-body-sm text-text">
        Connected as{" "}
        <span className="font-mono text-mono">{sync.login}</span> · syncing{" "}
        <span className="font-mono text-mono">{sync.repoName}</span>
        {sync.config.branch && sync.config.branch !== "main" && (
          <>
            {" "}@ <span className="font-mono text-mono">{sync.config.branch}</span>
          </>
        )}
      </p>
      <p className="text-caption text-text-muted mt-2 max-w-prose">
        Push overwrites the remote with your local data. Pull overwrites
        local with the remote. Neither deletes — keys on one side that
        are missing on the other are left alone.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => runSync("push")}
          disabled={status.kind === "syncing"}
          className="px-5 py-2 rounded-lg bg-accent text-bg text-body-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {status.kind === "syncing" ? "Working…" : "Push to GitHub"}
        </button>
        <button
          type="button"
          onClick={() => runSync("pull")}
          disabled={status.kind === "syncing"}
          className="px-5 py-2 rounded-lg bg-surface-raised border border-border text-body-sm font-medium hover:border-accent hover:text-accent disabled:opacity-50 transition-colors"
        >
          {status.kind === "syncing" ? "Working…" : "Pull from GitHub"}
        </button>
        <button
          type="button"
          onClick={onDisconnect}
          disabled={status.kind === "syncing"}
          className="ml-auto px-4 py-2 rounded-lg text-caption text-text-muted hover:text-danger disabled:opacity-50 transition-colors"
        >
          Disconnect
        </button>
      </div>

      {progress && progress.total > 0 && (
        <p className="mt-4 text-caption font-mono tabular-nums text-text-muted">
          {progress.done}/{progress.total} items…
        </p>
      )}
      {status.message && !progress && (
        <p className="mt-4 text-caption text-success">{status.message}</p>
      )}
      {status.error && (
        <p className="mt-4 text-body-sm text-warning">{status.error}</p>
      )}
    </div>
  );
}

// ─── Form primitives ──────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8 sm:mb-10">
      <h2 className="text-h3 font-semibold mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  spellCheck,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  spellCheck?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-caption uppercase tracking-widest text-text-muted mb-1">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        spellCheck={spellCheck}
        className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-body text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
      />
    </label>
  );
}
