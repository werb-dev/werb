#!/usr/bin/env node
/**
 * Regenerates TypeScript types from JSON Schemas under schemas/.
 * Output goes to packages/types/src/generated/.
 *
 * Usage: pnpm gen:types
 */
import { compileFromFile } from "json-schema-to-typescript";
import { readdir, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, basename, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const SCHEMAS_DIR = join(ROOT, "schemas");
const OUT_DIR = join(ROOT, "packages/types/src/generated");

// Schemas to compile. We deliberately skip schemas/beerjson/ (vendored upstream)
// at this stage — BeerJSON types will be generated from beer.json once we wire
// the recipe view (later step). Werb-owned schemas come first.
const TARGETS = [
  "werb-equipment.schema.json",
  "tools/ibu.input.schema.json",
  "tools/ibu.output.schema.json",
  "tools/water.input.schema.json",
  "tools/water.output.schema.json",
];

const compileOpts = {
  bannerComment:
    "/* eslint-disable */\n/**\n * Auto-generated from schemas/. DO NOT EDIT.\n * Run `pnpm gen:types` to regenerate.\n */",
  style: { singleQuote: false, semi: true },
  additionalProperties: false,
};

async function main() {
  if (!existsSync(OUT_DIR)) {
    await mkdir(OUT_DIR, { recursive: true });
  }

  const indexLines = [];
  for (const rel of TARGETS) {
    const src = join(SCHEMAS_DIR, rel);
    if (!existsSync(src)) {
      console.error(`✗ Missing schema: ${rel}`);
      process.exitCode = 1;
      continue;
    }
    const stem = basename(rel, extname(rel)).replace(/\.schema$/, "");
    const outName = `${stem}.d.ts`;
    const outPath = join(OUT_DIR, outName);
    const ts = await compileFromFile(src, compileOpts);
    await writeFile(outPath, ts);
    indexLines.push(`export * from "./${stem}.js";`);
    console.log(`✓ ${rel}  →  packages/types/src/generated/${outName}`);
  }

  await writeFile(join(OUT_DIR, "index.ts"), indexLines.join("\n") + "\n");
  console.log(`\nWrote ${TARGETS.length} type files to ${relative(ROOT, OUT_DIR)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
