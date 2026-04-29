// Auto-sync sw.js STATIC[] from index.html script/link tags.
// Run: node scripts/sync-sw.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const SW_PATH = path.join(ROOT, "sw.js");
const SW = fs.readFileSync(SW_PATH, "utf8");

// Match: <link href="cockpit/styles*.css?v=N">, <script src="cockpit/*.js[x]?v=N">
const re = /(?:href|src)="(cockpit\/[^"]+|sw\.js|manifest\.json)"/g;
const found = new Set();
let m;
while ((m = re.exec(HTML))) found.add(m[1]);

// Always include the html shell + manifest
const STATIC = [
  "/",
  "/index.html",
  "/manifest.json",
  ...[...found].filter(p => !p.startsWith("manifest")).map(p => "/" + p),
].sort();

// Bump CACHE version
const cacheMatch = SW.match(/const CACHE = "cockpit-v(\d+)";/);
const newVersion = cacheMatch ? Number(cacheMatch[1]) + 1 : 1;

const newStatic = "const STATIC = [\n" +
  STATIC.map(p => `  ${JSON.stringify(p)},`).join("\n") + "\n];";

let next = SW.replace(/const CACHE = "cockpit-v\d+";/,
  `const CACHE = "cockpit-v${newVersion}";`);
next = next.replace(/const STATIC = \[[\s\S]*?\];/, newStatic);

fs.writeFileSync(SW_PATH, next, "utf8");
console.log(`[sync-sw] CACHE → cockpit-v${newVersion}, STATIC → ${STATIC.length} entries`);
