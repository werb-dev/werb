import { useState } from "react";
import {
  copyKeysToBackend,
  gitHubBackend,
  useStorage,
  usePersistedJson,
  verifyGitHubAccess,
  type GitHubBackendConfig,
} from "../storage/index.ts";

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
      <main className="mx-auto max-w-2xl px-8 py-12">
        <header className="mb-10">
          <p className="text-caption uppercase tracking-widest text-text-muted">
            Werb · settings
          </p>
          <h1 className="text-h1 font-semibold mt-3">Sync &amp; storage</h1>
          <p className="text-body text-text-muted mt-2 max-w-2xl">
            Keep recipes, equipment profiles, and brew sessions in sync
            across devices via a private GitHub repo. Manual push / pull
            in v1 — no background sync.
          </p>
        </header>

        <Section title="GitHub sync">
          {sync ? (
            <Connected backend={backend} sync={sync} onDisconnect={() => setSync(null)} />
          ) : (
            <Connect onConnected={setSync} />
          )}
        </Section>
      </main>
    </div>
  );
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
    <div className="rounded-xl bg-surface border border-border p-6">
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
    <div className="rounded-xl bg-surface border border-border p-6">
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
