// Bundles the installed `three` package into a single, dependency-free file
// exposing a global `THREE` — public/vendor/three.min.js.
//
// Why this exists: custom games run in a `sandbox="allow-scripts"` iframe
// with no `allow-same-origin`, so it has no reliable, guaranteed way to load
// a CDN script (opaque-origin CORS behavior varies by host and isn't worth
// depending on). The frontend instead fetches this same-origin static file
// once and inlines its contents directly into the iframe's srcDoc — see
// app/components/custom-game-board.tsx.
//
// three.js dropped its old global/UMD build; only an ES module build ships
// now (`build/three.module.js`), so this re-bundles it into an IIFE with
// esbuild instead of trying to load the module build as a plain script.
//
// Re-run this (`npm run bundle:three`) after bumping the `three` version.

import { build } from "esbuild";
import { mkdirSync } from "node:fs";

mkdirSync(new URL("../public/vendor/", import.meta.url), { recursive: true });

await build({
  entryPoints: ["three"],
  bundle: true,
  minify: true,
  format: "iife",
  globalName: "THREE",
  platform: "browser",
  outfile: "public/vendor/three.min.js",
});

console.log("Wrote public/vendor/three.min.js");
