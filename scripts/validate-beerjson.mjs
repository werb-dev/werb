#!/usr/bin/env node
/**
 * Validate a .beerjson file against the BeerJSON 2.x schemas vendored
 * as a git submodule at vendor/beerjson/.
 *
 * Usage: node scripts/validate-beerjson.mjs <file.beerjson>
 *
 * Will become @werb/validate when we extract it into a proper package.
 */
import Ajv from "ajv";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SCHEMAS_DIR = join(ROOT, "vendor/beerjson/json");

// BeerJSON 2.x schemas declare draft-07; default Ajv supports draft-07.
const ajv = new Ajv.default({ allErrors: true, strict: false, allowUnionTypes: true });

const files = (await readdir(SCHEMAS_DIR)).filter((f) => f.endsWith(".json"));
for (const f of files) {
  const schema = JSON.parse(await readFile(join(SCHEMAS_DIR, f), "utf8"));
  ajv.addSchema(schema, f);
}

const validate = ajv.getSchema("beer.json#");
if (!validate) {
  console.error("Could not load beer.json root schema");
  process.exit(2);
}

const target = process.argv[2] ?? join(ROOT, "examples/double-ipa-mandarina.beerjson");
const data = JSON.parse(await readFile(target, "utf8"));
const ok = validate(data);
if (ok) {
  console.log(`✓ ${target} validates against BeerJSON 2.x`);
} else {
  console.log(`✗ ${target} has ${validate.errors.length} validation errors:`);
  for (const e of validate.errors.slice(0, 40)) {
    console.log(`  ${e.instancePath || "/"} — ${e.message} ${JSON.stringify(e.params)}`);
  }
  process.exit(1);
}
