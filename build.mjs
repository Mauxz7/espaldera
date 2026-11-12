// node build.mjs → genera la carpeta dist/ que publica GitHub Pages.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12); // AAAAMMDDhhmm
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
cpSync("public", "dist", { recursive: true });
writeFileSync("dist/sw.js", readFileSync("public/sw.js", "utf8").replaceAll("__BUILD__", stamp));
writeFileSync("dist/.nojekyll", "");
await build({
  entryPoints: ["src/main.jsx"], bundle: true, minify: true, format: "iife", target: "es2019",
  outfile: "dist/app.js", loader: { ".jsx": "jsx" }, jsx: "automatic",
  define: { __BUILD__: JSON.stringify(stamp), "process.env.NODE_ENV": '"production"' }, logLevel: "warning",
});
execFileSync("npx", ["tailwindcss", "-i", "src/app.css", "-o", "dist/app.css", "--minify"], { stdio: ["ignore", "ignore", "inherit"] });
console.log("ok", stamp);
