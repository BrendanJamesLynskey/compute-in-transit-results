#!/usr/bin/env node
/**
 * The naming rule, checked: no file the site serves or is built from names
 * the module's developer company (the series' house rule: the module is "a
 * photonic link module (arXiv:2608.21536)"). The name itself is not written
 * here, only its length and two hashes of it, lower-cased: every substring
 * of that length in every file (lower-cased, any encoding read as Latin-1)
 * is hashed with 32-bit FNV-1a, and a match is confirmed with SHA-256.
 *
 *   node scripts/check-naming.mjs .next public src     # exit 1 on a hit
 *
 * Also imported by tests/unit/naming.test.ts.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const LENGTH = 9;
const FNV = 0x85bd386f;
const SHA256 =
  "9a6e2353718bd9517827f6558f9dea09d2144c3385b351cddd6532cda589491d";
const SKIP = new Set(["node_modules", ".git", "cache"]);

/** Offsets in `text` where the name starts (case-insensitive). */
export function hits(text) {
  const s = text.toLowerCase();
  const out = [];
  for (let i = 0; i + LENGTH <= s.length; i++) {
    let h = 0x811c9dc5;
    for (let j = i; j < i + LENGTH; j++) {
      h ^= s.charCodeAt(j) & 0xff;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    if (h !== FNV) continue;
    const sub = s.slice(i, i + LENGTH);
    if (createHash("sha256").update(sub).digest("hex") === SHA256) out.push(i);
  }
  return out;
}

function* files(path) {
  const st = statSync(path);
  if (st.isFile()) {
    yield path;
    return;
  }
  for (const name of readdirSync(path)) {
    if (SKIP.has(name)) continue;
    yield* files(join(path, name));
  }
}

/** Every file under `roots` that names the company: [path, count]. */
export function scan(roots) {
  const bad = [];
  let n = 0;
  for (const root of roots)
    for (const f of files(root)) {
      n += 1;
      const h = hits(readFileSync(f).toString("latin1"));
      if (h.length) bad.push([f, h.length]);
    }
  return { files: n, bad };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const roots = process.argv.slice(2);
  if (!roots.length) {
    console.error("usage: check-naming.mjs <dir|file>...");
    process.exit(2);
  }
  const { files: n, bad } = scan(roots);
  for (const [f, c] of bad) console.error(`names the company (${c}x): ${f}`);
  console.log(`naming check: ${n} files, ${bad.length} naming the company`);
  process.exit(bad.length ? 1 : 0);
}
