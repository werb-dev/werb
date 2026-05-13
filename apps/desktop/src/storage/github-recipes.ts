/**
 * GitHub-backed recipes archive — one .beerjson file per recipe.
 *
 * Companion to [`github.ts`], but with a different on-disk shape:
 * instead of one opaque blob, every recipe lives in its own
 * `<recipesPath>/<slug>.beerjson` file. The repo browses like a
 * curated cookbook on github.com and produces legible diffs on
 * commit — the file-driven story Werb's README opens with.
 *
 * The functions here drive the manual Push / Pull buttons in the
 * Settings screen. Auto-sync, change watching, and delete propagation
 * are deliberately out of scope until the manual flow proves out.
 */

import type { BeerJsonRecipe, BeerJsonFile } from "@werb/adapters";
import { validateBeerJson } from "@werb/validate";
import type { GitHubBackendConfig } from "./github.ts";
import { slugify } from "../data/recipe-export.ts";
import {
  generateId,
  type StoredRecipe,
} from "../data/recipes.ts";
import { WerbError } from "../data/errors.ts";

/** Config = the existing GitHub access bundle + the folder to use. */
export interface GitHubRecipesConfig extends GitHubBackendConfig {
  /**
   * Repo-relative folder where `<slug>.beerjson` files live. Defaults
   * to `"recipes"`. May contain slashes for nested folders.
   */
  recipesPath?: string;
}

/** Outcome of a [`pushRecipes`] call. */
export interface PushResult {
  /** How many recipe files were written. */
  written: number;
  /** Files we tried to write but the API rejected. */
  failed: Array<{ slug: string; error: string }>;
}

/** Outcome of a [`pullRecipes`] call. */
export interface PullResult {
  /** Recipes added to the local list because no same-named one existed. */
  added: number;
  /** Recipes that overwrote a same-named local entry. Only > 0 when `overwrite` is true. */
  replaced: number;
  /** Recipes skipped because a same-named local entry exists and `overwrite` is false. */
  skipped: number;
  /** Files we couldn't parse as valid BeerJSON. */
  failed: Array<{ file: string; error: string }>;
}

interface GitHubItem {
  name: string;
  path: string;
  sha: string;
  type: "file" | "dir";
  content?: string;
  encoding?: string;
}

function buildHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    Authorization: `Bearer ${token}`,
  };
}

function recipesPathOf(config: GitHubRecipesConfig): string {
  return (config.recipesPath ?? "recipes").replace(/^\/+|\/+$/g, "");
}

function fileUrl(config: GitHubRecipesConfig, slug: string): string {
  const folder = recipesPathOf(config);
  const segments = (folder ? `${folder}/${slug}.beerjson` : `${slug}.beerjson`)
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return `https://api.github.com/repos/${config.repo}/contents/${segments}`;
}

function folderUrl(config: GitHubRecipesConfig): string {
  const folder = recipesPathOf(config);
  const segments = folder
    ? folder.split("/").map(encodeURIComponent).join("/")
    : "";
  return `https://api.github.com/repos/${config.repo}/contents${segments ? "/" + segments : ""}`;
}

function branchQuery(config: GitHubRecipesConfig): string {
  return `?ref=${encodeURIComponent(config.branch ?? "main")}`;
}

/**
 * Write every recipe in `recipes` to the configured folder, one file
 * per recipe. Uses the recipe's name as the filename slug — renaming a
 * recipe and pushing again creates a NEW file; the old slug is left
 * orphaned in the repo until the user removes it manually. (V1
 * tradeoff: lossless on the local side, no surprise deletes on the
 * remote side.)
 *
 * If two recipes slug to the same string, the later one in `recipes`
 * overwrites the earlier — same as how the recipe list itself behaves.
 */
export async function pushRecipes(
  recipes: BeerJsonRecipe[],
  config: GitHubRecipesConfig,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<PushResult> {
  const result: PushResult = { written: 0, failed: [] };
  const branch = config.branch ?? "main";

  for (const recipe of recipes) {
    const slug = slugify(recipe.name);
    const url = fileUrl(config, slug);
    const branchedUrl = `${url}${branchQuery(config)}`;

    // Need the current SHA for an update; a 404 means we're creating.
    let existingSha: string | undefined;
    const headRes = await fetchImpl(branchedUrl, {
      headers: buildHeaders(config.token),
    });
    if (headRes.ok) {
      const item = (await headRes.json()) as GitHubItem | GitHubItem[];
      if (!Array.isArray(item)) existingSha = item.sha;
    } else if (headRes.status !== 404) {
      result.failed.push({
        slug,
        error: `read failed (${headRes.status})`,
      });
      continue;
    }

    const document: BeerJsonFile = {
      beerjson: { version: 2.06, recipes: [recipe] },
    };
    const body: Record<string, string> = {
      message: existingSha
        ? `werb: update ${slug}.beerjson`
        : `werb: add ${slug}.beerjson`,
      content: utf8ToB64(JSON.stringify(document, null, 2) + "\n"),
      branch,
    };
    if (existingSha) body.sha = existingSha;

    const putRes = await fetchImpl(url, {
      method: "PUT",
      headers: { ...buildHeaders(config.token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!putRes.ok) {
      result.failed.push({
        slug,
        error: `write failed (${putRes.status})`,
      });
      continue;
    }
    result.written++;
  }

  if (result.written === 0 && result.failed.length > 0) {
    throw new WerbError("github.write_failed", {
      status: 0,
      detail: result.failed.map((f) => `${f.slug}: ${f.error}`).join("; "),
    });
  }
  return result;
}

/**
 * Read every `.beerjson` file under the configured folder, parse it as
 * BeerJSON, and merge the contained recipe into `localRecipes`.
 *
 * Merge key is the **recipe name** (not slug, not id — names are what
 * the user sees and edits). When a remote recipe's name matches a
 * local one:
 *
 *  - `overwrite: true`  — local entry's `recipe` field is replaced
 *    with the remote one, `updatedAt` bumped, `id` and `createdAt`
 *    preserved.
 *  - `overwrite: false` — the remote recipe is skipped entirely.
 *
 * Returns the merged list along with a [`PullResult`] tally.
 */
export async function pullRecipes(
  localRecipes: StoredRecipe[],
  config: GitHubRecipesConfig,
  options: { overwrite: boolean },
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<{ merged: StoredRecipe[]; result: PullResult }> {
  const result: PullResult = { added: 0, replaced: 0, skipped: 0, failed: [] };

  // 1. List the folder.
  const listUrl = `${folderUrl(config)}${branchQuery(config)}`;
  const listRes = await fetchImpl(listUrl, { headers: buildHeaders(config.token) });
  if (listRes.status === 404) {
    // No folder yet → nothing to pull, no error.
    return { merged: localRecipes, result };
  }
  if (!listRes.ok) {
    throw new WerbError("github.list_failed", {
      status: listRes.status,
      detail: await listRes.text(),
    });
  }
  const entries = (await listRes.json()) as GitHubItem | GitHubItem[];
  const files = (Array.isArray(entries) ? entries : [entries]).filter(
    (item) => item.type === "file" && item.name.endsWith(".beerjson"),
  );

  // 2. Fetch each file's contents in parallel — small folders today,
  //    GitHub's REST API has no batch read so this is the best we can
  //    do without dropping to the Git Trees API.
  const fetched = await Promise.all(
    files.map(async (file) => {
      try {
        const url = `https://api.github.com/repos/${config.repo}/contents/${file.path
          .split("/")
          .map(encodeURIComponent)
          .join("/")}${branchQuery(config)}`;
        const res = await fetchImpl(url, { headers: buildHeaders(config.token) });
        if (!res.ok) {
          result.failed.push({ file: file.name, error: `read failed (${res.status})` });
          return null;
        }
        const item = (await res.json()) as GitHubItem;
        if (!item.content || item.encoding !== "base64") {
          result.failed.push({ file: file.name, error: "unexpected response shape" });
          return null;
        }
        const raw = b64ToUtf8(item.content.replace(/\n/g, ""));
        return { file: file.name, raw };
      } catch (err) {
        result.failed.push({ file: file.name, error: (err as Error).message });
        return null;
      }
    }),
  );

  // 3. Validate each blob against the BeerJSON 2.x schema, extract its
  //    recipes, merge by name.
  const merged: StoredRecipe[] = [...localRecipes];
  const indexByName = new Map<string, number>();
  merged.forEach((r, i) => indexByName.set(r.recipe.name, i));

  for (const entry of fetched) {
    if (!entry) continue;
    let parsed: BeerJsonFile;
    try {
      parsed = JSON.parse(entry.raw) as BeerJsonFile;
    } catch (err) {
      result.failed.push({ file: entry.file, error: `JSON parse: ${(err as Error).message}` });
      continue;
    }
    const validation = validateBeerJson(parsed);
    if (!validation.valid) {
      const first = validation.errors[0];
      result.failed.push({
        file: entry.file,
        error: first ? `${first.path}: ${first.message}` : "schema invalid",
      });
      continue;
    }
    const incoming = parsed.beerjson?.recipes ?? [];
    for (const recipe of incoming) {
      const existingIdx = indexByName.get(recipe.name);
      if (existingIdx !== undefined) {
        if (options.overwrite) {
          merged[existingIdx] = {
            ...merged[existingIdx]!,
            recipe,
            updatedAt: new Date().toISOString(),
          };
          result.replaced++;
        } else {
          result.skipped++;
        }
      } else {
        const now = new Date().toISOString();
        const stored: StoredRecipe = {
          id: generateId(),
          recipe,
          createdAt: now,
          updatedAt: now,
        };
        indexByName.set(recipe.name, merged.length);
        merged.push(stored);
        result.added++;
      }
    }
  }

  return { merged, result };
}

// ─── base64 helpers (UTF-8 safe) ─────────────────────────────────────────
// Duplicated from github.ts so the modules stay independently testable
// without coupling. Both copies are tiny and identical.

function utf8ToB64(s: string): string {
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
