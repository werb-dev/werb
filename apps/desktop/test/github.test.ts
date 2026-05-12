import { describe, it, expect, vi } from "vitest";
import {
  gitHubBackend,
  verifyGitHubAccess,
  type GitHubBackendConfig,
} from "../src/storage/github.ts";
import { describeBackend } from "./storage-contract.ts";

/**
 * Tiny in-memory mock of the GitHub Contents API. Enough surface to
 * exercise the GitHubBackend through the standard StorageBackend
 * contract tests — no real network, no real repo, but the adapter
 * behaviors (URL shape, SHA round-trip, base64 round-trip, 404 → null)
 * all flow through it.
 */
function makeMockFetch(initialFiles: Record<string, string> = {}): typeof fetch {
  // Path → { sha, base64Content }
  const store = new Map<string, { sha: string; content: string }>();
  let shaCounter = 0;
  const nextSha = () => `sha-${++shaCounter}`;
  const utf8ToB64 = (s: string) => {
    const bytes = new TextEncoder().encode(s);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
    return btoa(bin);
  };

  for (const [path, content] of Object.entries(initialFiles)) {
    store.set(path, { sha: nextSha(), content: utf8ToB64(content) });
  }

  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : (input as URL).toString();
    const u = new URL(url);
    const method = (init?.method ?? "GET").toUpperCase();

    // /repos/{owner}/{repo}/contents/{path}
    const match = u.pathname.match(/^\/repos\/[^/]+\/[^/]+\/contents(.*)$/);
    if (!match) return new Response("Not a contents URL", { status: 400 });
    const path = decodeURIComponent(match[1]!.replace(/^\//, ""));

    if (method === "GET") {
      // Directory listing — return everything that starts with path/.
      const prefix = path ? `${path}/` : "";
      const direct = store.get(path);
      if (direct) {
        return jsonResponse({
          name: path.split("/").pop(),
          path,
          sha: direct.sha,
          size: direct.content.length,
          type: "file",
          content: direct.content,
          encoding: "base64",
        });
      }
      const children: unknown[] = [];
      for (const [storedPath, entry] of store.entries()) {
        if (!storedPath.startsWith(prefix)) continue;
        const rest = storedPath.slice(prefix.length);
        if (rest.includes("/")) continue; // not a direct child
        children.push({
          name: rest,
          path: storedPath,
          sha: entry.sha,
          size: entry.content.length,
          type: "file",
        });
      }
      if (children.length === 0) return new Response("Not Found", { status: 404 });
      return jsonResponse(children);
    }

    if (method === "PUT") {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      const existing = store.get(path);
      if (existing && existing.sha !== body.sha) {
        return new Response("SHA mismatch", { status: 422 });
      }
      const sha = nextSha();
      store.set(path, { sha, content: body.content });
      return jsonResponse({
        content: { name: path.split("/").pop(), path, sha },
      });
    }

    if (method === "DELETE") {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      const existing = store.get(path);
      if (!existing) return new Response("Not Found", { status: 404 });
      if (existing.sha !== body.sha) {
        return new Response("SHA mismatch", { status: 422 });
      }
      store.delete(path);
      return jsonResponse({ commit: { sha: nextSha() } });
    }

    return new Response("Not Allowed", { status: 405 });
  }) as typeof fetch;

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}

const baseConfig: GitHubBackendConfig = {
  token: "test-token",
  repo: "owner/repo",
  branch: "main",
  basePath: "werb",
};

// ─── Contract: GitHubBackend must satisfy the same shape every other
// adapter does. Re-uses the reusable storage-contract suite — same
// tests that already run against MemoryBackend / localStorageBackend /
// opfsBackend.
describeBackend("gitHubBackend (mocked Contents API)", () => {
  const fetchImpl = makeMockFetch();
  return gitHubBackend(baseConfig, fetchImpl);
});

// ─── GitHub-specific specs ────────────────────────────────────────────────

describe("gitHubBackend specifics", () => {
  it("includes the bearer token on every request", async () => {
    const fetchImpl = vi.fn(makeMockFetch());
    const backend = gitHubBackend(baseConfig, fetchImpl as unknown as typeof fetch);
    await backend.write("werb.recipes", "{}");
    const headers = (fetchImpl.mock.calls[0]![1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBe("Bearer test-token");
  });

  it("targets the configured branch in the read URL", async () => {
    const fetchImpl = vi.fn(makeMockFetch({ "werb/werb.recipes": "{}" }));
    const backend = gitHubBackend(
      { ...baseConfig, branch: "experimental" },
      fetchImpl as unknown as typeof fetch,
    );
    await backend.read("werb.recipes");
    const url = fetchImpl.mock.calls[0]![0] as string;
    expect(url).toContain("ref=experimental");
  });

  it("places files under the configured basePath", async () => {
    const fetchImpl = vi.fn(makeMockFetch());
    const backend = gitHubBackend(
      { ...baseConfig, basePath: "data/werb" },
      fetchImpl as unknown as typeof fetch,
    );
    await backend.write("werb.recipes", "{}");
    const lastPut = fetchImpl.mock.calls.find(
      (c) => ((c[1] as RequestInit).method ?? "GET").toUpperCase() === "PUT",
    );
    expect(lastPut?.[0]).toContain("/contents/data/werb/werb.recipes");
  });

  it("survives a round-trip through base64 with non-ASCII content", async () => {
    const fetchImpl = makeMockFetch();
    const backend = gitHubBackend(baseConfig, fetchImpl);
    const payload = JSON.stringify({ name: "Hefeweizen — Bavarian classic 🍺" });
    await backend.write("werb.recipes", payload);
    expect(await backend.read("werb.recipes")).toBe(payload);
  });
});

// ─── verifyGitHubAccess ───────────────────────────────────────────────────

describe("verifyGitHubAccess", () => {
  function fakeFetch(handler: (url: string) => Response): typeof fetch {
    return ((url: RequestInfo | URL) =>
      Promise.resolve(handler(typeof url === "string" ? url : url.toString()))) as typeof fetch;
  }

  it("returns the login + repo when both calls succeed", async () => {
    const fetchImpl = fakeFetch((url) => {
      if (url.endsWith("/user")) {
        return jsonResponse({ login: "alice" });
      }
      return jsonResponse({
        full_name: "alice/recipes",
        permissions: { push: true },
      });
    });

    const r = await verifyGitHubAccess(
      { token: "tk", repo: "alice/recipes" },
      fetchImpl,
    );
    expect(r.login).toBe("alice");
    expect(r.repoName).toBe("alice/recipes");
  });

  it("throws a clear error on 401 from /user", async () => {
    const fetchImpl = fakeFetch(() => new Response("", { status: 401 }));
    await expect(
      verifyGitHubAccess({ token: "bad", repo: "alice/recipes" }, fetchImpl),
    ).rejects.toThrow(/github\.invalid_token/);
  });

  it("throws a helpful error on 404 from the repo lookup", async () => {
    const fetchImpl = fakeFetch((url) => {
      if (url.endsWith("/user")) return jsonResponse({ login: "alice" });
      return new Response("", { status: 404 });
    });
    await expect(
      verifyGitHubAccess({ token: "tk", repo: "alice/private" }, fetchImpl),
    ).rejects.toThrow(/github\.repo_not_found/);
  });

  it("rejects read-only access for a token that can't push", async () => {
    const fetchImpl = fakeFetch((url) => {
      if (url.endsWith("/user")) return jsonResponse({ login: "alice" });
      return jsonResponse({
        full_name: "alice/recipes",
        permissions: { push: false },
      });
    });
    await expect(
      verifyGitHubAccess({ token: "tk", repo: "alice/recipes" }, fetchImpl),
    ).rejects.toThrow(/github\.no_write_access/);
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
