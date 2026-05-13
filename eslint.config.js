// Workspace-wide ESLint config — flat-config style (ESLint 9).
//
// Conservative baseline: catches real bugs (unused vars, react-hook
// rules) without scolding stylistic preferences. Generated types,
// build output, and Rust target dirs are excluded so lint never has
// to walk them.

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/target/**",
      "**/pkg/**",
      "**/generated/**",
      "**/node_modules/**",
      "**/coverage/**",
      // Git submodule. Upstream owns its lint posture; we should never
      // try to enforce ours on a third-party schema repo.
      "vendor/**",
      // mdBook build output — themed JS we don't author or maintain.
      "docs/book/**",
      // The schema-driven type generator is auto-written; lint feedback
      // there is just noise.
      "packages/types/src/generated/**",
      // Workbox + PWA service-worker output.
      "**/sw.js",
      "**/workbox-*.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      // React hooks rules — these catch real bugs (deps array mismatches,
      // conditional hook calls) so they stay strict.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // Unused vars are warnings, not errors, to keep lint runnable on
      // the WIP code that ships with a refactor.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // We use `any` deliberately at a few system boundaries (Tauri
      // dynamic imports, OPFS iterator types not in lib.dom).
      "@typescript-eslint/no-explicit-any": "warn",
      // The schema-generated types use `interface` with optional props.
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
  {
    // Tests can be looser — assertion utilities legitimately access
    // private-ish internals and the type assertions are deliberate.
    files: ["**/test/**/*.{ts,tsx}", "**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
);
