import type { StorageBackend } from "./backend.ts";

/**
 * StorageBackend backed by a GitHub repository, via the REST Contents
 * API. Each StorageBackend key becomes one file under
 * `<basePath>/<key>` on the target branch. Writes generate commits.
 *
 * Not wired as the live backend — too slow for active editing
 * (every write is a 200-400 ms round-trip). Used for opt-in sync:
 * the Settings screen exposes Push / Pull buttons that diff this
 * backend against the local one via the shared `migrateBackend`
 * helper.
 *
 * Auth is a Personal Access Token with `Contents: read+write` on the
 * target repo (fine-grained) or `repo` scope (classic). The token
 * lives in localStorage and is sent as a Bearer header on every API
 * call. No OAuth yet — paste-the-token UX is the v1.
 */

export interface GitHubBackendConfig {
  /** Personal access token. Treated as an opaque secret. */
  token: string;
  /** "owner/repo" coordinates. */
  repo: string;
  /** Branch to read/write. Defaults to "main". */
  branch?: string;
  /** Directory within the repo where keys live. Defaults to "werb". */
  basePath?: string;
}

interface GitHubContentItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: "file" | "dir";
  content?: string;
  encoding?: string;
}

/**
 * Build a GitHubBackend. `fetchImpl` is injectable so tests can drive
 * the adapter without a real network — pass a `vi.fn()` that returns
 * pre-canned Response objects.
 */
export function gitHubBackend(
  config: GitHubBackendConfig,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): StorageBackend {
  const { token, repo } = config;
  const branch = config.branch ?? "main";
  const basePath = (config.basePath ?? "werb").replace(/\/+$/, "");
  const base = `https://api.github.com/repos/${repo}/contents`;

  function pathFor(key: string): string {
    return basePath ? `${basePath}/${key}` : key;
  }

  function urlFor(key: string): string {
    // Each path segment must be URL-encoded individually so directory
    // slashes survive. Our keys contain dots, no slashes, but the
    // basePath might.
    const parts = pathFor(key).split("/").map(encodeURIComponent).join("/");
    return `${base}/${parts}`;
  }

  function authHeaders(): Record<string, string> {
    return {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${token}`,
    };
  }

  async function request(url: string, init?: RequestInit): Promise<Response> {
    return fetchImpl(url, {
      ...init,
      headers: { ...authHeaders(), ...(init?.headers ?? {}) },
    });
  }

  /** Fetch a file's metadata + content. Returns null for 404. */
  async function readContent(key: string): Promise<GitHubContentItem | null> {
    const res = await request(`${urlFor(key)}?ref=${encodeURIComponent(branch)}`);
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`GitHub read failed (${res.status}): ${await res.text()}`);
    }
    const data = (await res.json()) as GitHubContentItem | GitHubContentItem[];
    // The Contents API returns an array when the path resolves to a
    // directory, an object when it's a file. We always call this for
    // file-shaped keys, so an array means GitHub thinks the file is a
    // dir (shouldn't happen with our flat-key layout).
    if (Array.isArray(data)) return null;
    return data;
  }

  return {
    async read(key) {
      const item = await readContent(key);
      if (!item || item.encoding !== "base64" || item.content === undefined) {
        return null;
      }
      // GitHub wraps the base64 at 60 chars; strip newlines before decode.
      return b64ToUtf8(item.content.replace(/\n/g, ""));
    },

    async write(key, value) {
      // Fetch current SHA so updates don't fail with 422. Cheap
      // 404-or-200 GET; a dedicated SHA cache would save a round-trip
      // per write but complicates conflict handling. Worth doing once
      // the manual-push flow proves out, not before.
      const existing = await readContent(key);
      const body: Record<string, string> = {
        message: existing ? `werb: update ${key}` : `werb: create ${key}`,
        content: utf8ToB64(value),
        branch,
      };
      if (existing?.sha) body.sha = existing.sha;

      const res = await request(urlFor(key), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`GitHub write failed (${res.status}): ${await res.text()}`);
      }
    },

    async delete(key) {
      const existing = await readContent(key);
      if (!existing) return; // already absent
      const res = await request(urlFor(key), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `werb: delete ${key}`,
          sha: existing.sha,
          branch,
        }),
      });
      if (!res.ok && res.status !== 404) {
        throw new Error(`GitHub delete failed (${res.status}): ${await res.text()}`);
      }
    },

    async list(prefix) {
      const dirUrl = basePath
        ? `${base}/${basePath.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(branch)}`
        : `${base}?ref=${encodeURIComponent(branch)}`;
      const res = await request(dirUrl);
      if (res.status === 404) return [];
      if (!res.ok) {
        throw new Error(`GitHub list failed (${res.status}): ${await res.text()}`);
      }
      const items = (await res.json()) as GitHubContentItem | GitHubContentItem[];
      const list = Array.isArray(items) ? items : [items];
      return list
        .filter((item) => item.type === "file")
        .map((item) => item.name)
        .filter((name) => name.startsWith(prefix));
    },
  };
}

/**
 * Quick "does this token + repo work?" probe. Returns the
 * authenticated user's login on success, or throws with a
 * human-readable message. Used by the Settings UI to validate
 * credentials before the user wires up sync.
 */
export async function verifyGitHubAccess(
  config: GitHubBackendConfig,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<{ login: string; repoName: string }> {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    Authorization: `Bearer ${config.token}`,
  };

  // 1. Token must auth as a user.
  const userRes = await fetchImpl("https://api.github.com/user", { headers });
  if (userRes.status === 401) {
    throw new Error("Invalid token. Check that it hasn't expired or been revoked.");
  }
  if (!userRes.ok) {
    throw new Error(`Couldn't reach GitHub (${userRes.status}). Check your network.`);
  }
  const user = (await userRes.json()) as { login: string };

  // 2. Token must have Contents:read+write on the named repo.
  const repoRes = await fetchImpl(
    `https://api.github.com/repos/${config.repo}`,
    { headers },
  );
  if (repoRes.status === 404) {
    throw new Error(
      `Repo "${config.repo}" not found, or the token doesn't have access. ` +
        `For fine-grained tokens, make sure Contents: read+write is enabled.`,
    );
  }
  if (!repoRes.ok) {
    throw new Error(`Couldn't reach the repo (${repoRes.status}).`);
  }
  const repo = (await repoRes.json()) as { full_name: string; permissions?: { push?: boolean } };
  if (repo.permissions && !repo.permissions.push) {
    throw new Error(`The token has read but not write access to "${config.repo}".`);
  }
  return { login: user.login, repoName: repo.full_name };
}

// ─── base64 helpers (UTF-8 safe) ─────────────────────────────────────────

function utf8ToB64(s: string): string {
  // btoa requires latin-1, so route through TextEncoder + binary string.
  const bytes = new TextEncoder().encode(s);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function b64ToUtf8(b: string): string {
  const binary = atob(b);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
