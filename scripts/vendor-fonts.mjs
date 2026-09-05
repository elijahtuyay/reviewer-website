/**
 * Refresh the committed font files in `app/fonts/`. `npm run fonts:vendor`.
 *
 * This is the only part of the project that needs a network, which is the whole
 * reason it is a separate step rather than something the build does. See the
 * "Working offline" section of PROJECT_CONTEXT.md for why that matters and for
 * what else does and does not need a connection.
 *
 * Run it only when a font needs updating. The output is binary and belongs in
 * its own commit rather than folded into a feature.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const OUT = "app/fonts";
const TIMEOUT_MS = 30_000;

/*
 * The `latin` subset is the block whose unicode-range STARTS at U+0000-00FF.
 *
 * Selecting it that way rather than by taking the last @font-face is
 * deliberate, and it is not merely defensive: the three stylesheets have five
 * and six blocks in different orders, so position is already wrong for Geist
 * Mono and Source Serif. It would also fail by silently shipping the wrong
 * alphabet rather than by erroring. Every other subset starts elsewhere -
 * latin-ext at U+0100-02BA, cyrillic-ext at U+0460-052F, greek at U+0370-0377.
 */
const LATIN_START = "u+0000-00ff";

const FAMILIES = [
  ["Geist:wght@100..900", "Geist-latin.woff2", "Geist"],
  ["Geist+Mono:wght@100..900", "GeistMono-latin.woff2", "Geist Mono"],
  ["Source+Serif+4:wght@200..900", "SourceSerif4-latin.woff2", "Source Serif 4"],
];

/*
 * ONE LICENSE FILE PER COPYRIGHT HOLDER, NOT ONE PER LICENSE.
 *
 * All three fonts are SIL Open Font License 1.1 and the license BODY is
 * identical between them, which made it tempting to ship a single OFL.txt.
 * That is wrong, and it shipped: OFL clause 2 requires each copy of the font
 * software to carry "the above copyright notice and this license", and the
 * copyright notice is the part that differs. Geist's file opens "Copyright 2024
 * The Geist Project Authors"; Source Serif's opens "Copyright 2014 - 2023 Adobe
 * ..., with Reserved Font Name 'Source'". Shipping only the first distributed
 * Adobe's font under Vercel's copyright line.
 */
const LICENSES = [
  [
    "https://raw.githubusercontent.com/vercel/geist-font/main/OFL.txt",
    "OFL-Geist.txt",
    "Geist + Geist Mono",
  ],
  [
    "https://raw.githubusercontent.com/adobe-fonts/source-serif/release/LICENSE.md",
    "OFL-SourceSerif4.txt",
    "Source Serif 4",
  ],
];

async function get(url, asText = false) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    // Without this a hung connection hangs the script forever.
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return asText ? res.text() : Buffer.from(await res.arrayBuffer());
}

/*
 * Everything is fetched before anything is written.
 *
 * Writing each file as it arrived meant a failure partway left app/fonts/ half
 * refreshed, with some faces updated and others not. Recoverable through git,
 * but only if you notice.
 */
const pending = [];

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

  pending.push([filename, await get(picked), label]);
}

for (const [url, filename, label] of LICENSES) {
  pending.push([filename, Buffer.from(await get(url, true), "utf8"), `${label} license`]);
}

await mkdir(OUT, { recursive: true });
for (const [filename, data, label] of pending) {
  await writeFile(join(OUT, filename), data);
  console.log(
    `  ${label.padEnd(20)} ${filename.padEnd(24)} ${(data.length / 1024).toFixed(1).padStart(6)} KB`
  );
}
console.log("\nFonts refreshed. Commit the binaries on their own.");
