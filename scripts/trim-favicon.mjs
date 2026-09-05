/**
 * Rewrite `app/favicon.ico` keeping only the sizes a browser tab uses.
 *
 * One-off, kept because the next person to regenerate an icon will produce the
 * same file. An .ico is a container: the browser downloads ALL of it and picks
 * one image, so a four-size icon costs every visitor the bytes of the three
 * they will never see. Measured here: 25.3 KB, of which the 48x48 was 11.3 KB
 * and the 256x256 another 7.6 KB, on every page load of a site whose audience
 * is mostly on mobile data.
 *
 * 16 and 32 are what a tab and a retina tab use. The larger sizes are for OS
 * shortcuts and pinned tiles, which this site does not ask to be.
 *
 * Pure byte surgery on the container, so the pixels are untouched — no image
 * library, no re-encoding, and nothing to disagree with the original.
 */
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "app/favicon.ico";
const KEEP = new Set([16, 32]);

const src = readFileSync(PATH);
if (src.readUInt16LE(0) !== 0 || src.readUInt16LE(2) !== 1) {
  throw new Error(`${PATH} is not an ICO`);
}

const count = src.readUInt16LE(4);
const entries = [];
for (let i = 0; i < count; i++) {
  const o = 6 + i * 16;
  entries.push({
    width: src[o] || 256,
    height: src[o + 1] || 256,
    dir: src.subarray(o, o + 16),
    data: src.subarray(src.readUInt32LE(o + 12), src.readUInt32LE(o + 12) + src.readUInt32LE(o + 8)),
  });
}

const kept = entries.filter((e) => KEEP.has(e.width));
if (kept.length === 0) throw new Error("no 16 or 32 px image in the icon");

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(kept.length, 4);

let offset = 6 + kept.length * 16;
const dirs = [];
for (const e of kept) {
  const dir = Buffer.from(e.dir);
  dir.writeUInt32LE(e.data.length, 8);
  dir.writeUInt32LE(offset, 12);
  dirs.push(dir);
  offset += e.data.length;
}

const out = Buffer.concat([header, ...dirs, ...kept.map((e) => e.data)]);
writeFileSync(PATH, out);

const kb = (n) => (n / 1024).toFixed(1);
console.log(
  `${PATH}: ${entries.length} sizes (${entries.map((e) => e.width).join(", ")}) ` +
    `${kb(src.length)} KB  ->  ${kept.length} sizes (${kept.map((e) => e.width).join(", ")}) ${kb(out.length)} KB`
);
