#!/usr/bin/env node
/**
 * Regenerates TypeScript types from JSON Schemas under schemas/.
 * Output goes to packages/types/src/generated/.
 *
 * Usage: pnpm gen:types
 *
 * Type names are explicitly mapped per target so they remain stable and
 * decoupled from the schema's `title` (which is used for human-readable
 * rendering, e.g. SwaggerUI-style views).
 */
import { compile } from "json-schema-to-typescript";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, basename, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const SCHEMAS_DIR = join(ROOT, "schemas");
const OUT_DIR = join(ROOT, "packages/types/src/generated");

// Schemas to compile. We deliberately skip schemas/beerjson/ at this stage —
// BeerJSON types will be wired in a later step.
//
// `name` is the root TypeScript interface name produced by the generator.
const TARGETS = [
  { schema: "werb-equipment.schema.json", name: "WerbEquipmentProfile" },
  { schema: "tools/ibu.input.schema.json", name: "IbuInput" },
  { schema: "tools/ibu.output.schema.json", name: "IbuOutput" },
  { schema: "tools/water.input.schema.json", name: "WaterInput" },
  { schema: "tools/water.output.schema.json", name: "WaterOutput" },
];

const compileOpts = {
  bannerComment:
    "/* eslint-disable */\n/**\n * Auto-generated. DO NOT EDIT.\n * Run `pnpm gen:types` to regenerate.\n */",
  style: { singleQuote: false, semi: true },
  additionalProperties: false,
};

function outName(rel) {
  return basename(rel, extname(rel)).replace(/\.schema$/, "");
}

async function main() {
  if (!existsSync(OUT_DIR)) {
    await mkdir(OUT_DIR, { recursive: true });
  }

  const indexLines = [];
  for (const { schema: rel, name } of TARGETS) {
    const src = join(SCHEMAS_DIR, rel);
    if (!existsSync(src)) {
      console.error(`✗ Missing schema: ${rel}`);
      process.exitCode = 1;
      continue;
    }
    const stem = outName(rel);
    const outPath = join(OUT_DIR, `${stem}.d.ts`);
    const json = JSON.parse(await readFile(src, "utf8"));
    const ts = await compile(json, name, compileOpts);
    await writeFile(outPath, ts);
    indexLines.push(`export * from "./${stem}.js";`);
    console.log(`✓ ${rel}  →  ${name}  →  packages/types/src/generated/${stem}.d.ts`);
  }

  await writeFile(join(OUT_DIR, "index.ts"), indexLines.join("\n") + "\n");
  console.log(`\nWrote ${TARGETS.length} type files to ${relative(ROOT, OUT_DIR)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
