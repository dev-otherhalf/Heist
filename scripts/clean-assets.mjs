// Removes stale Vite build artifacts from assets/.
// Vite uses content-hashed filenames and the project keeps emptyOutDir: false
// (assets/ also holds hand-authored Horizon files), so old vite-* outputs
// accumulate on every rebuild. This keeps only files referenced by the current
// manifest and never touches non-vite assets.
import fs from "node:fs";
import path from "node:path";

const assetsDir = "assets";
const manifestPath = "assets/.vite/manifest.json";

if (!fs.existsSync(manifestPath)) {
  console.warn("No manifest found; skipping asset clean.");
  process.exit(0);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const keep = new Set(
  Object.values(manifest)
    .flatMap((entry) => [entry.file, ...(entry.css ?? [])])
    .map((file) => path.basename(file)),
);

let removed = 0;
for (const file of fs.readdirSync(assetsDir)) {
  if (file.startsWith("vite-") && !keep.has(file)) {
    fs.rmSync(path.join(assetsDir, file));
    removed += 1;
  }
}

console.log(`Pruned ${removed} stale vite asset(s).`);
