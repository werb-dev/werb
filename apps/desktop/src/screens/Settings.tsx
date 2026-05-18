import { useEffect, useRef, useState } from "react";
import {
  clearWerbData,
  pushRecipes,
  pullRecipes,
  restoreSnapshot,
  snapshotBackend,
  useStorage,
  usePersistedJson,
  verifyGitHubAccess,
  type DataSnapshot,
  type GitHubRecipesConfig,
  type StorageBackend,
} from "../storage/index.ts";
import { loadStore, saveStore, type StoredRecipe } from "../data/recipes.ts";
import { useT, useUnitsControl } from "../data/preferences.tsx";
import type { UnitPreferences } from "../data/units-format.ts";
import { SUPPORTED_LOCALES } from "../data/i18n.ts";
import { downloadTextFile, pickAndReadTextFile } from "../data/browser-fs.ts";
import { translateError } from "../data/errors.ts";

/**
 * Sync + advanced storage settings.
 *
 * v1 of sync is a GitHub-backed *recipes archive*: each recipe lives
 * in its own `<recipesPath>/<slug>.beerjson` file inside the chosen
 * repo. The user pastes a Personal Access Token + `owner/repo`, we
 * verify the credentials, and the Push / Pull buttons drive the
 * per-file flow. No automatic background sync — explicit only, so
 * the brewer always knows what just happened to their data.
 */

interface SyncConfig {
  config: GitHubRecipesConfig;
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

export function SettingsScreen() {
  const backend = useStorage();
  const t = useT();
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
            {t("settings.subtitle")}
          </p>
          <h1 className="text-h2 sm:text-h1 font-semibold mt-3">{t("settings.title")}</h1>
          <p className="text-body text-text-muted mt-2 max-w-2xl">
            {t("settings.intro")}
          </p>
        </header>

        <Section title={t("settings.section.units")}>
          <UnitsCard />
        </Section>

        <Section title={t("settings.section.github")}>
          {sync ? (
            <Connected backend={backend} sync={sync} onDisconnect={() => setSync(null)} />
          ) : (
            <Connect onConnected={setSync} />
          )}
        </Section>

        <Section title={t("settings.section.data")}>
          <DataCard backend={backend} />
        </Section>

        <PrivacyNote />

        <BuildFooter />
      </main>
    </div>
  );
}

/**
 * Bottom-of-Settings stamp: `Werb 0.2.0 · 7747019 · 2026-05-18`.
 * Concrete numbers a bug report can quote — version, commit, build
 * date — instead of "the version I downloaded last week". Values
 * come from build-time defines injected by vite.config.ts.
 */
function BuildFooter() {
  const t = useT();
  return (
    <p className="mt-12 pt-6 border-t border-border text-caption text-text-muted font-mono text-center">
      {t("settings.build_stamp", {
        version: __APP_VERSION__,
        commit: __APP_COMMIT__,
        date: __APP_BUILD_DATE__,
      })}
    </p>
  );
}

// ─── Units ────────────────────────────────────────────────────────────────

function UnitsCard() {
  const { prefs, setPrefs } = useUnitsControl();
  const t = useT();

  const update = <K extends keyof UnitPreferences>(key: K, value: UnitPreferences[K]) =>
    setPrefs((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="rounded-xl bg-surface border border-border p-4 sm:p-6">
      <p className="text-body-sm text-text-muted mb-5 max-w-prose">
        {t("settings.units.intro")}
      </p>

      <div className="space-y-4">
        <UnitPicker
          label={t("settings.units.language")}
          value={prefs.locale}
          onChange={(v) => update("locale", v)}
          options={SUPPORTED_LOCALES.map((l) => ({ value: l.value, label: l.label }))}
        />
        <UnitPicker
          label={t("settings.units.theme")}
          value={prefs.theme}
          onChange={(v) => update("theme", v)}
          options={[
            { value: "auto", label: t("settings.units.opt.theme_auto") },
            { value: "dark", label: t("settings.units.opt.theme_dark") },
            { value: "light", label: t("settings.units.opt.theme_light") },
          ]}
        />
        <UnitPicker
          label={t("settings.units.temperature")}
          value={prefs.temperature}
          onChange={(v) => update("temperature", v)}
          options={[
            { value: "C", label: "°C" },
            { value: "F", label: "°F" },
          ]}
        />
        <UnitPicker
          label={t("settings.units.volume")}
          value={prefs.volume}
          onChange={(v) => update("volume", v)}
          options={[
            { value: "l", label: t("settings.units.opt.liters") },
            { value: "gal", label: t("settings.units.opt.us_gallons") },
          ]}
        />
        <UnitPicker
          label={t("settings.units.mass")}
          value={prefs.mass}
          onChange={(v) => update("mass", v)}
          options={[
            { value: "kg", label: t("settings.units.opt.kg_g") },
            { value: "lb", label: t("settings.units.opt.lb_oz") },
          ]}
        />
        <UnitPicker
          label={t("settings.units.gravity")}
          value={prefs.gravity}
          onChange={(v) => update("gravity", v)}
          options={[
            { value: "sg", label: t("settings.units.opt.sg") },
            { value: "plato", label: t("settings.units.opt.plato") },
          ]}
        />
        <UnitPicker
          label={t("settings.units.color")}
          value={prefs.color}
          onChange={(v) => update("color", v)}
          options={[
            { value: "EBC", label: "EBC" },
            { value: "SRM", label: "SRM" },
          ]}
        />
        <UnitPicker
          label={t("settings.units.currency")}
          value={prefs.currency}
          onChange={(v) => update("currency", v)}
          options={[
            { value: "EUR", label: t("settings.units.opt.eur") },
            { value: "USD", label: t("settings.units.opt.usd") },
            { value: "GBP", label: t("settings.units.opt.gbp") },
          ]}
        />
        <CostAdjustmentField
          value={prefs.cost_inflation_pct}
          onChange={(v) => update("cost_inflation_pct", v)}
        />
      </div>
    </div>
  );
}

/**
 * Single global multiplier applied to every bundled default ingredient
 * price. The recipe Cost section uses it; brewers in pricier markets
 * bump to 110-130 to roughly match local supplier prices. No per-
 * ingredient overrides — this is an approximation tool.
 */
function CostAdjustmentField({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const t = useT();
  // Same controlled-text pattern as RecipeEditor's InlineNumber: keep
  // a local string buffer so the user can type "120" or "120,5" without
  // React stripping in-flight characters; commit / clamp on blur.
  const clamp = (n: number) => Math.max(10, Math.min(300, n));
  const display = (n: number) =>
    Number.isFinite(n) ? String(Math.round(n)) : "100";
  const [text, setText] = useState(() => display(value));
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!focusedRef.current) setText(display(value));
  }, [value]);
  return (
    <div>
      <p className="text-caption uppercase tracking-widest text-text-muted mb-2">
        {t("settings.units.cost_adjustment")}
      </p>
      <div className="flex items-baseline gap-2 bg-bg border border-border rounded-lg px-3 py-2 focus-within:border-accent max-w-[12rem]">
        <input
          type="text"
          inputMode="numeric"
          value={text}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onBlur={() => {
            focusedRef.current = false;
            const parsed = Number(text.replace(",", "."));
            const next = Number.isFinite(parsed) ? clamp(parsed) : 100;
            setText(display(next));
            onChange(next);
          }}
          onChange={(e) => {
            setText(e.target.value);
            const parsed = Number(e.target.value.replace(",", "."));
            if (Number.isFinite(parsed)) onChange(clamp(parsed));
          }}
          className="w-full bg-transparent text-body font-mono tabular-nums text-text focus:outline-none"
        />
        <span className="text-caption font-mono text-text-muted shrink-0">%</span>
      </div>
      <p className="text-caption text-text-muted mt-1 max-w-prose">
        {t("settings.units.cost_adjustment_hint")}
      </p>
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

// ─── Privacy footer ──────────────────────────────────────────────────────

/**
 * Plain-English explainer at the bottom of Settings. Establishes the
 * data-locality contract for cloud-shy brewers: everything stays on
 * this device, GitHub sync is opt-in, no telemetry.
 */
function PrivacyNote() {
  const t = useT();
  return (
    <section className="mb-8 sm:mb-10">
      <h2 className="text-h3 font-semibold mb-1">{t("settings.privacy.title")}</h2>
      <p className="text-body-sm text-text-muted mb-4">
        {t("settings.privacy.subtitle")}
      </p>
      <div className="rounded-xl bg-surface border border-border p-4 sm:p-6 space-y-3 text-body-sm text-text-muted leading-relaxed">
        <p>{t("settings.privacy.local")}</p>
        <p>{t("settings.privacy.optin")}</p>
        <p>{t("settings.privacy.telemetry")}</p>
        <p className="text-caption">
          {t("settings.privacy.source")}:{" "}
          <a
            href="https://github.com/werb-dev/werb"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            github.com/werb-dev/werb
          </a>
          {" · "}MIT.
        </p>
      </div>
    </section>
  );
}

// ─── Data management ─────────────────────────────────────────────────────

function DataCard({ backend }: { backend: StorageBackend }) {
  const t = useT();
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
      return t("settings.data.exported", { count, filename });
    });

  const onRestore = () =>
    run(async () => {
      const picked = await pickAndReadTextFile();
      if (!picked) return null;
      let parsed: DataSnapshot;
      try {
        parsed = JSON.parse(picked.text) as DataSnapshot;
      } catch {
        throw new Error(t("settings.data.error.bad_json"));
      }
      if (typeof parsed !== "object" || parsed === null || !("schema_version" in parsed)) {
        throw new Error(t("settings.data.error.not_werb"));
      }
      const count = await restoreSnapshot(backend, parsed);
      return t("settings.data.restored", { count });
    });

  const onClear = () =>
    run(async () => {
      const confirmed = confirm(t("settings.data.confirm_clear"));
      if (!confirmed) return null;
      const count = await clearWerbData(backend);
      return t("settings.data.cleared", { count });
    });

  return (
    <div className="rounded-xl bg-surface border border-border p-4 sm:p-6">
      <p className="text-body-sm text-text-muted mb-5 max-w-prose">
        {t("settings.data.intro")}
      </p>

      {stats && (
        <p className="text-caption font-mono text-text-muted mb-5">
          {t("settings.data.stats.recipes", { count: stats.recipes })} ·{" "}
          {t("settings.data.stats.equipment", { count: stats.equipment })} ·{" "}
          {t("settings.data.stats.sessions", { count: stats.sessions })}
          {stats.other > 0 && ` · ${t("settings.data.stats.other", { count: stats.other })}`}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onExport}
          disabled={busy}
          className="px-5 py-2 rounded-lg bg-accent text-bg text-body-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {busy ? t("settings.data.working") : t("settings.data.export")}
        </button>
        <button
          type="button"
          onClick={onRestore}
          disabled={busy}
          className="px-5 py-2 rounded-lg bg-surface-raised border border-border text-body-sm font-medium hover:border-accent hover:text-accent disabled:opacity-50 transition-colors"
        >
          {busy ? t("settings.data.working") : t("settings.data.restore")}
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={busy}
          className="ml-auto px-4 py-2 rounded-lg text-body-sm text-text-muted hover:text-danger disabled:opacity-50 transition-colors"
        >
          {t("settings.data.clear")}
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
  const t = useT();
  const [token, setToken] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [recipesPath, setRecipesPath] = useState("recipes");
  const [status, setStatus] = useState<SyncStatus>({ kind: "idle" });

  const onVerify = async () => {
    if (!token || !repo) {
      setStatus({ kind: "idle", error: t("settings.connect.error.required") });
      return;
    }
    setStatus({ kind: "verifying" });
    try {
      const result = await verifyGitHubAccess({ token, repo, branch });
      onConnected({
        config: { token, repo, branch, recipesPath: recipesPath.trim() || "recipes" },
        login: result.login,
        repoName: result.repoName,
      });
      setStatus({ kind: "idle" });
    } catch (err) {
      setStatus({ kind: "idle", error: translateError(err, t) });
    }
  };

  return (
    <div className="rounded-xl bg-surface border border-border p-4 sm:p-6">
      <p className="text-body text-text-muted mb-5 max-w-prose">
        {t("settings.connect.intro_lead")}{" "}
        <code className="font-mono text-mono text-text">Contents: read+write</code>{" "}
        {t("settings.connect.intro_scope_a")}{" "}
        <code className="font-mono text-mono text-text">repo</code>
        {t("settings.connect.intro_scope_b")}
      </p>

      <div className="space-y-4">
        <Field
          label={t("settings.connect.field.token")}
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={token}
          onChange={setToken}
          placeholder="github_pat_…"
        />
        <Field
          label={t("settings.connect.field.repo")}
          autoComplete="off"
          spellCheck={false}
          value={repo}
          onChange={setRepo}
          placeholder="owner/recipes"
        />
        <Field
          label={t("settings.connect.field.branch")}
          autoComplete="off"
          spellCheck={false}
          value={branch}
          onChange={setBranch}
          placeholder="main"
        />
        <Field
          label={t("settings.connect.field.recipes_path")}
          autoComplete="off"
          spellCheck={false}
          value={recipesPath}
          onChange={setRecipesPath}
          placeholder="recipes"
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
        {status.kind === "verifying" ? t("settings.connect.verifying") : t("settings.connect.verify")}
      </button>

      <p className="text-caption text-text-muted mt-4 max-w-prose">
        {t("settings.connect.footer")}
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
  const t = useT();
  const [status, setStatus] = useState<SyncStatus>({ kind: "idle" });
  const [overwriteOnPull, setOverwriteOnPull] = useState(false);

  const onPush = async () => {
    setStatus({ kind: "syncing" });
    try {
      const store = await loadStore(backend);
      if (store.recipes.length === 0) {
        setStatus({ kind: "idle", message: t("settings.connected.nothing") });
        return;
      }
      const result = await pushRecipes(
        store.recipes.map((r) => r.recipe),
        sync.config,
      );
      setStatus({
        kind: "idle",
        message: t("settings.connected.pushed", { count: result.written }),
      });
    } catch (err) {
      setStatus({
        kind: "idle",
        error: t("settings.connected.failed", { detail: translateError(err, t) }),
      });
    }
  };

  const onPull = async () => {
    setStatus({ kind: "syncing" });
    try {
      const store = await loadStore(backend);
      const { merged, result } = await pullRecipes(
        store.recipes as StoredRecipe[],
        sync.config,
        { overwrite: overwriteOnPull },
      );
      if (result.added > 0 || result.replaced > 0) {
        await saveStore(backend, { recipes: merged });
      }
      const total = result.added + result.replaced + result.skipped + result.failed.length;
      if (total === 0) {
        setStatus({ kind: "idle", message: t("settings.connected.nothing") });
      } else {
        const message = t("settings.connected.pulled_detail", {
          added: result.added,
          replaced: result.replaced,
          skipped: result.skipped,
        });
        const next: SyncStatus = { kind: "idle", message };
        if (result.failed.length > 0) {
          next.error = t("settings.connected.pull_failed", {
            count: result.failed.length,
            detail: result.failed.map((f) => `${f.file}: ${f.error}`).join("; "),
          });
        }
        setStatus(next);
      }
    } catch (err) {
      setStatus({
        kind: "idle",
        error: t("settings.connected.failed", { detail: translateError(err, t) }),
      });
    }
  };

  const recipesPath = sync.config.recipesPath ?? "recipes";

  return (
    <div className="rounded-xl bg-surface border border-border p-4 sm:p-6">
      <p className="text-body-sm text-text">
        {t("settings.connected.status_lead")}{" "}
        <span className="font-mono text-mono">{sync.login}</span> · {t("settings.connected.status_syncing")}{" "}
        <span className="font-mono text-mono">{sync.repoName}</span>
        {sync.config.branch && sync.config.branch !== "main" && (
          <>
            {" "}@ <span className="font-mono text-mono">{sync.config.branch}</span>
          </>
        )}
        {" "}/ <span className="font-mono text-mono">{recipesPath}/</span>
      </p>
      <p className="text-caption text-text-muted mt-2 max-w-prose">
        {t("settings.connected.footer")}
      </p>

      <label className="mt-5 flex items-center gap-2 text-body-sm text-text-muted cursor-pointer">
        <input
          type="checkbox"
          checked={overwriteOnPull}
          onChange={(e) => setOverwriteOnPull(e.target.checked)}
          className="accent-accent"
        />
        {t("settings.connected.overwrite_on_pull")}
      </label>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onPush}
          disabled={status.kind === "syncing"}
          className="px-5 py-2 rounded-lg bg-accent text-bg text-body-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {status.kind === "syncing" ? t("settings.connected.working") : t("settings.connected.push")}
        </button>
        <button
          type="button"
          onClick={onPull}
          disabled={status.kind === "syncing"}
          className="px-5 py-2 rounded-lg bg-surface-raised border border-border text-body-sm font-medium hover:border-accent hover:text-accent disabled:opacity-50 transition-colors"
        >
          {status.kind === "syncing" ? t("settings.connected.working") : t("settings.connected.pull")}
        </button>
        <button
          type="button"
          onClick={onDisconnect}
          disabled={status.kind === "syncing"}
          className="ml-auto px-4 py-2 rounded-lg text-caption text-text-muted hover:text-danger disabled:opacity-50 transition-colors"
        >
          {t("settings.connected.disconnect")}
        </button>
      </div>

      {status.message && (
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
