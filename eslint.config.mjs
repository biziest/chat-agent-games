import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Bundles emitted by `trigger dev` / `trigger deploy` — generated code, and
    // linting it buries real findings under ~1900 warnings.
    ".trigger/**",
    // Vendored, pre-minified third-party bundle (see scripts/bundle-three.mjs)
    // — not source we own, and linting it buries real findings the same way.
    "public/vendor/**",
  ]),
]);

export default eslintConfig;
