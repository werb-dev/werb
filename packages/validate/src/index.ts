/**
 * BeerJSON 2.x validator.
 *
 * Wraps Ajv with the 20 vendored schema files and exposes a single
 * `validateBeerJson` function. Schemas are eager-glob-imported at module
 * load so the validator is ready to call synchronously.
 *
 * Environment: works in Vite-based consumers (apps/desktop) and in Vitest
 * (which uses Vite for transforms). For pure-Node use, prefer the
 * `scripts/validate-beerjson.mjs` CLI which does the same job via fs.
 */

import Ajv, { type ErrorObject } from "ajv";

const schemaModules = import.meta.glob("../../../schemas/beerjson/*.json", {
  eager: true,
}) as Record<string, { default: object }>;

const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });

// Register every BeerJSON schema under its filename so $refs like
// "measureable_units.json#/definitions/VolumeType" resolve.
for (const [path, mod] of Object.entries(schemaModules)) {
  const filename = path.split("/").pop()!;
  ajv.addSchema(mod.default, filename);
}

const _rootValidator = ajv.getSchema("beer.json#");
if (!_rootValidator) {
  throw new Error(
    "BeerJSON root schema (beer.json) failed to load — check schemas/beerjson/ vendoring",
  );
}
const rootValidator = _rootValidator;

export interface ValidationError {
  /** JSON pointer into the data, e.g. "/beerjson/recipes/0/style". */
  path: string;
  /** Human-readable message from Ajv. */
  message: string;
  /** Ajv-specific params (missing property name, allowed values, etc.). */
  params: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export function validateBeerJson(data: unknown): ValidationResult {
  const ok = rootValidator(data);
  if (ok) {
    return { valid: true, errors: [] };
  }
  return {
    valid: false,
    errors: (rootValidator.errors ?? []).map(formatError),
  };
}

function formatError(err: ErrorObject): ValidationError {
  return {
    path: err.instancePath || "/",
    message: err.message ?? "validation failed",
    params: err.params as Record<string, unknown>,
  };
}
