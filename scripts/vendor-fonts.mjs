/**
 * Refresh the committed font files in `app/fonts/`.
 *
 * `npm run fonts:vendor`. Needs a network connection, which is the whole
 * reason it exists as a separate step: the BUILD must not need one.
 *
 * `next/font/google` self-hosts fonts for the visitor, and its docs say so, but
 * it downloads them from fonts.gstatic.com every time the project is built.
 * Nothing in this repo held a copy, so `next build` and a cold `next dev` both
 * required internet. That is a poor property for a project whose author works
 * on planes. The files are now committed and loaded with `next/font/local`.
 *
 * Run this only when a font needs updating. The output is binary and belongs in
 * its own commit, not folded into a feature.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const OUT = "app/fonts";

/*
 * The `latin` subset is the block whose unicode-range STARTS at U+0000-00FF.
 * latin-ext does not, and neither does any of the cyrillic or greek blocks.
 *
 * Selecting it this way rather than by taking the last @font-face is
 * deliberate. Google orders the subsets consistently today, so position works
 * until the day it does not, and it would fail by silently shipping the wrong
 * alphabet rather than by erroring.
 */
const LATIN_START = "u+0000-00ff";

const FAMILIES = [
  ["Geist:wght@100..900", "Geist-latin.woff2", "Geist"],
  ["Geist+Mono:wght@100..900", "GeistMono-latin.woff2", "Geist Mono"],
  ["Source+Serif+4:wght@200..900", "SourceSerif4-latin.woff2", "Source Serif 4"],
];

/** All three fonts are SIL Open Font License 1.1, which must travel with them. */
const LICENSE_URL = "https://raw.githubusercontent.com/vercel/geist-font/main/OFL.txt";

async function get(url, asText = false) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return asText ? res.text() : Buffer.from(await res.arrayBuffer());
}

await mkdir(OUT, { recursive: true });

for (const [query, filename, label] of FAMILIES) {
  const css = await get(
    `https://fonts.googleapis.com/css2?family=${query}&display=swap`,
    true
  );

  let picked = null;
  for (const block of css.match(/@font-face\s*\{[^}]*\}/gs) ?? []) {
    const range = block.match(/unicode-range:\s*([^;]+);/)?.[1]?.trim().toLowerCase();
    if (!range?.startsWith(LATIN_START)) continue;
    picked = block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/)?.[1] ?? null;
    break;
  }
  if (!picked) throw new Error(`${label}: no latin subset in the stylesheet`);

  const data = await get(picked);
  await writeFile(join(OUT, filename), data);
  console.log(
    `  ${label.padEnd(16)} ${filename.padEnd(26)} ${(data.length / 1024).toFixed(1).padStart(6)} KB`
  );
}

const ofl = await get(LICENSE_URL, true);
await writeFile(join(OUT, "OFL.txt"), ofl);
console.log(`  ${"OFL 1.1".padEnd(16)} ${"OFL.txt".padEnd(26)} ${(ofl.length / 1024).toFixed(1).padStart(6)} KB`);
console.log("\nFonts refreshed. Commit the binaries on their own.");
