// node build.mjs → genera la carpeta docs/ que publica GitHub Pages.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12); // AAAAMMDDhhmm
rmSync("docs", { recursive: true, force: true });
mkdirSync("docs");
cpSync("public", "docs", { recursive: true });
writeFileSync("docs/sw.js", readFileSync("public/sw.js", "utf8").replace("__BUILD__", stamp));
writeFileSync("docs/.nojekyll", "");
await build({
  entryPoints: ["src/main.jsx"], bundle: true, minify: true, format: "iife", target: "es2019",
  outfile: "docs/app.js", loader: { ".jsx": "jsx" }, jsx: "automatic",
  define: { __BUILD__: JSON.stringify(stamp), "process.env.NODE_ENV": '"production"' }, logLevel: "warning",
});
execFileSync("npx", ["tailwindcss", "-i", "src/app.css", "-o", "docs/app.css", "--minify"], { stdio: ["ignore", "ignore", "inherit"] });
console.log("ok", stamp);
