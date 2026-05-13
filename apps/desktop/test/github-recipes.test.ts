import { describe, it, expect, vi } from "vitest";
import type { BeerJsonRecipe } from "@werb/adapters";
import {
  pushRecipes,
  pullRecipes,
  type GitHubRecipesConfig,
} from "../src/storage/github-recipes.ts";
import { type StoredRecipe } from "../src/data/recipes.ts";

/**
 * Mock of the GitHub Contents API at the per-file granularity the
 * recipes archive uses. Each test gets a fresh in-memory store keyed
 * by repo path. Initial files seed the store; pushes/pulls mutate it.
 *
 * The mock is intentionally permissive about everything except the
 * shapes the module under test actually consumes — SHA round-trip,
 * branch query string, base64 encoding, 404 on missing paths.
 */
function makeMockFetch(initialFiles: Record<string, string> = {}): {
  fetchImpl: typeof fetch;
  store: Map<string, { sha: string; content: string }>;
  calls: { url: string; method: string; body?: unknown }[];
} {
  const store = new Map<string, { sha: string; content: string }>();
  const calls: { url: string; method: string; body?: unknown }[] = [];
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

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : (input as URL).toString();
    const u = new URL(url);
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ url, method, body });

    const match = u.pathname.match(/^\/repos\/[^/]+\/[^/]+\/contents(.*)$/);
    if (!match) return new Response("Not a contents URL", { status: 400 });
    const path = decodeURIComponent(match[1]!.replace(/^\//, ""));

    if (method === "GET") {
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
      // Directory listing for any path that is a direct-child prefix.
      const prefix = path ? `${path}/` : "";
      const children: unknown[] = [];
      for (const [storedPath, entry] of store.entries()) {
        if (!storedPath.startsWith(prefix)) continue;
        const rest = storedPath.slice(prefix.length);
        if (rest.includes("/")) continue;
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
      const existing = store.get(path);
      if (existing && existing.sha !== body.sha) {
        return new Response("SHA mismatch", { status: 422 });
      }
      const sha = nextSha();
      store.set(path, { sha, content: body.content });
      return jsonResponse({ content: { name: path.split("/").pop(), path, sha } });
    }

    return new Response("Not Allowed", { status: 405 });
  }) as typeof fetch;

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return { fetchImpl, store, calls };
}

const baseConfig: GitHubRecipesConfig = {
  token: "test-token",
  repo: "owner/beer-recipes",
  branch: "main",
  recipesPath: "recipes",
};

/** Minimal valid BeerJSON 2.x recipe — passes the vendored schema. */
function buildRecipe(name: string): BeerJsonRecipe {
  return {
    name,
    type: "all grain",
    author: "Werb tests",
    batch_size: { value: 20, unit: "l" },
    efficiency: { brewhouse: { value: 75, unit: "%" } },
    ingredients: {
      fermentable_additions: [
        {
          name: "Pale 2-Row",
          type: "grain",
          amount: { value: 4.5, unit: "kg" },
          yield: { fine_grind: { value: 80, unit: "%" } },
          color: { value: 2, unit: "SRM" },
        },
      ],
    },
  };
}

/** Decode a stored base64 file back to its JSON content. */
function readStored(
  store: Map<string, { content: string }>,
  path: string,
): unknown {
  const entry = store.get(path);
  if (!entry) throw new Error(`expected stored file at ${path}`);
  const bin = atob(entry.content);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
}

// ─── pushRecipes ──────────────────────────────────────────────────────────

describe("pushRecipes", () => {
  it("writes one .beerjson file per recipe under the configured folder", async () => {
    const { fetchImpl, store } = makeMockFetch();
    const result = await pushRecipes(
      [buildRecipe("Hazy IPA"), buildRecipe("Blanche")],
      baseConfig,
      fetchImpl,
    );

    expect(result.written).toBe(2);
    expect(result.failed).toEqual([]);
    expect(store.has("recipes/hazy-ipa.beerjson")).toBe(true);
    expect(store.has("recipes/blanche.beerjson")).toBe(true);
  });

  it("wraps each recipe in the BeerJSON document envelope", async () => {
    const { fetchImpl, store } = makeMockFetch();
    await pushRecipes([buildRecipe("Saison")], baseConfig, fetchImpl);

    const doc = readStored(store, "recipes/saison.beerjson") as {
      beerjson?: { version: number; recipes: { name: string }[] };
    };
    expect(doc.beerjson?.version).toBe(2.06);
    expect(doc.beerjson?.recipes).toHaveLength(1);
    expect(doc.beerjson?.recipes[0]?.name).toBe("Saison");
  });

  it("slugifies non-ASCII names", async () => {
    const { fetchImpl, store } = makeMockFetch();
    await pushRecipes([buildRecipe("Bière de Garde")], baseConfig, fetchImpl);
    expect(store.has("recipes/biere-de-garde.beerjson")).toBe(true);
  });

  it("passes the existing SHA on a re-push (update, not 422)", async () => {
    const recipe = buildRecipe("Stout");
    const seedDoc = JSON.stringify(
      { beerjson: { version: 2.06, recipes: [recipe] } },
      null,
      2,
    );
    const { fetchImpl, calls } = makeMockFetch({
      "recipes/stout.beerjson": seedDoc,
    });
    const result = await pushRecipes([recipe], baseConfig, fetchImpl);
    expect(result.written).toBe(1);
    expect(result.failed).toEqual([]);
    const put = calls.find((c) => c.method === "PUT");
    const putBody = put?.body as { sha?: string };
    expect(putBody.sha).toBeDefined();
  });

  it("respects a nested recipesPath like 'cellar/recipes'", async () => {
    const { fetchImpl, store } = makeMockFetch();
    await pushRecipes(
      [buildRecipe("Helles")],
      { ...baseConfig, recipesPath: "cellar/recipes" },
      fetchImpl,
    );
    expect(store.has("cellar/recipes/helles.beerjson")).toBe(true);
  });

  it("sends the bearer token on every request", async () => {
    const fetchImpl = vi.fn(makeMockFetch().fetchImpl);
    await pushRecipes([buildRecipe("Pale Ale")], baseConfig, fetchImpl as unknown as typeof fetch);
    for (const call of fetchImpl.mock.calls) {
      const headers = (call[1] as RequestInit).headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer test-token");
    }
  });
});

// ─── pullRecipes ──────────────────────────────────────────────────────────

const NOW = "2026-05-13T12:00:00.000Z";

function storedRecipe(name: string, id = `id-${name.toLowerCase()}`): StoredRecipe {
  return { id, recipe: buildRecipe(name), createdAt: NOW, updatedAt: NOW };
}

function seedFolder(records: Record<string, BeerJsonRecipe>): Record<string, string> {
  const seed: Record<string, string> = {};
  for (const [slug, recipe] of Object.entries(records)) {
    seed[`recipes/${slug}.beerjson`] = JSON.stringify(
      { beerjson: { version: 2.06, recipes: [recipe] } },
      null,
      2,
    );
  }
  return seed;
}

describe("pullRecipes", () => {
  it("adds new recipes that don't exist locally", async () => {
    const { fetchImpl } = makeMockFetch(
      seedFolder({
        blanche: buildRecipe("Blanche"),
        "hazy-ipa": buildRecipe("Hazy IPA"),
      }),
    );

    const local = [storedRecipe("Stout")];
    const { merged, result } = await pullRecipes(local, baseConfig, { overwrite: false }, fetchImpl);

    expect(result.added).toBe(2);
    expect(result.replaced).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.failed).toEqual([]);
    expect(merged).toHaveLength(3);
    const names = merged.map((r) => r.recipe.name).sort();
    expect(names).toEqual(["Blanche", "Hazy IPA", "Stout"]);
  });

  it("skips same-named local recipes when overwrite is false", async () => {
    const { fetchImpl } = makeMockFetch(
      seedFolder({ blanche: buildRecipe("Blanche") }),
    );
    const local = [storedRecipe("Blanche", "local-blanche")];
    const { merged, result } = await pullRecipes(local, baseConfig, { overwrite: false }, fetchImpl);

    expect(result.added).toBe(0);
    expect(result.skipped).toBe(1);
    expect(merged[0]!.id).toBe("local-blanche");
  });

  it("overwrites same-named local recipes when overwrite is true, preserving id + createdAt", async () => {
    const seedRecipe = { ...buildRecipe("Blanche"), notes: "from-github" };
    const { fetchImpl } = makeMockFetch(seedFolder({ blanche: seedRecipe }));
    const original = storedRecipe("Blanche", "local-blanche");
    const local = [original];
    const { merged, result } = await pullRecipes(local, baseConfig, { overwrite: true }, fetchImpl);

    expect(result.replaced).toBe(1);
    expect(result.added).toBe(0);
    expect(merged[0]!.id).toBe("local-blanche");
    expect(merged[0]!.createdAt).toBe(NOW);
    expect(merged[0]!.recipe.notes).toBe("from-github");
    expect(merged[0]!.updatedAt).not.toBe(NOW); // bumped
  });

  it("ignores non-.beerjson files in the folder", async () => {
    const { fetchImpl, store } = makeMockFetch(
      seedFolder({ blanche: buildRecipe("Blanche") }),
    );
    // Drop a stray README into the folder — should be skipped without failure.
    store.set("recipes/README.md", { sha: "sha-readme", content: btoa("# notes") });

    const { result } = await pullRecipes([], baseConfig, { overwrite: false }, fetchImpl);
    expect(result.added).toBe(1);
    expect(result.failed).toEqual([]);
  });

  it("records the file in `failed` when its BeerJSON doesn't validate", async () => {
    const { fetchImpl, store } = makeMockFetch();
    const badDoc = JSON.stringify({ beerjson: { version: 2.06, recipes: [{ name: "Bad" }] } });
    store.set("recipes/bad.beerjson", {
      sha: "sha-bad",
      content: btoa(badDoc),
    });

    const { result, merged } = await pullRecipes([], baseConfig, { overwrite: false }, fetchImpl);
    expect(result.added).toBe(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]!.file).toBe("bad.beerjson");
    expect(merged).toEqual([]);
  });

  it("returns an empty result when the folder doesn't exist (404)", async () => {
    const { fetchImpl } = makeMockFetch();
    const local = [storedRecipe("Stout")];
    const { merged, result } = await pullRecipes(local, baseConfig, { overwrite: false }, fetchImpl);
    expect(result.added).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.failed).toEqual([]);
    expect(merged).toBe(local); // pass-through identity
  });
});
