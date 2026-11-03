/**
 * BeerJSON 2.x validator.
 *
 * Wraps Ajv with the 20 schema files from the `vendor/beerjson/` git
 * submodule and exposes a single `validateBeerJson` function. Schemas
 * are eager-glob-imported at module load so the validator is ready to
 * call synchronously.
 *
 * Environment: works in Vite-based consumers (apps/desktop) and in Vitest
 * (which uses Vite for transforms). For pure-Node use, prefer the
 * `scripts/validate-beerjson.mjs` CLI which does the same job via fs.
 */

import Ajv, { type ErrorObject } from "ajv";

const schemaModules = import.meta.glob("../../../vendor/beerjson/json/*.json", {
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
    "BeerJSON root schema (beer.json) failed to load — run `git submodule update --init`?",
  );
}
const rootValidator = _rootValidator;

export interface ValidationError {
  /** JSON pointer into the data, e.g. "/beerjson/recipes/0/style". */
  path: string;
  /** Ajv keyword that failed: "required", "enum", "type", … */
  keyword: string;
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
    keyword: err.keyword,
    message: err.message ?? "validation failed",
    params: err.params as Record<string, unknown>,
  };
}

/**
 * Drop `null` values from objects, recursively. Some tools write `null` for
 * an optional property they have no value for; BeerJSON means "absent".
 */
export function stripNulls<T>(data: T): T {
  if (Array.isArray(data)) return data.map(stripNulls) as T;
  if (data && typeof data === "object") {
    return Object.fromEntries(
      Object.entries(data)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => [k, stripNulls(v)]),
    ) as T;
  }
  return data;
}

// Most telling first. Combinators ("must match a schema in anyOf") only
// say that a deeper error exists.
const KEYWORD_RANK = ["required", "additionalProperties", "enum", "const", "type"];
const COMBINATORS = new Set(["anyOf", "oneOf", "allOf", "if", "not"]);

function valueAt(data: unknown, pointer: string): unknown {
  if (pointer === "/" || pointer === "") return data;
  return pointer
    .split("/")
    .slice(1)
    .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"))
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined,
      data,
    );
}

/**
 * One line a brewer can forward: the most specific error, as
 * `<JSON pointer>: <what is wrong>`, naming the property, the allowed
 * values or the value found.
 */
export function describeErrors(data: unknown, errors: ValidationError[]): string {
  const candidates = errors.filter((e) => !COMBINATORS.has(e.keyword));
  const pool = candidates.length > 0 ? candidates : errors;
  const rank = (e: ValidationError) => {
    const r = KEYWORD_RANK.indexOf(e.keyword);
    return r === -1 ? KEYWORD_RANK.length : r;
  };
  const depth = (e: ValidationError) => e.path.split("/").length;
  const best = [...pool].sort((a, b) => depth(b) - depth(a) || rank(a) - rank(b))[0];
  if (!best) return "unknown";
  const value = JSON.stringify(valueAt(data, best.path));
  const p = best.params;
  switch (best.keyword) {
    case "required":
      return `${best.path}: missing required property "${String(p.missingProperty)}"`;
    case "additionalProperties":
      return `${best.path}: unknown property "${String(p.additionalProperty)}"`;
    case "enum":
      return `${best.path}: ${value} is not one of ${(p.allowedValues as unknown[])
        .map((v) => JSON.stringify(v))
        .join(", ")}`;
    case "type":
      return `${best.path}: expected ${String(p.type)}, found ${value}`;
    default:
      return `${best.path}: ${best.message}`;
  }
}
