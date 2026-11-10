// SPDX-License-Identifier: GPL-3.0-or-later
// R157: the N62 mark as the app draws it (Home's tile, the empty history): public/n62-mark.svg, cropped from the logo file
// logo/monochrome/n62_monochrome.svg (its path unchanged, its 108 × 108 canvas cut to the mark so it fills its box) with a
// black fill and an SPDX line (rules-core). Written here, never by hand; the test (mark.test.ts) fails when the file differs from what this writes.
//   node scripts/gen-mark.ts           # write (npm run mark)
//   node scripts/gen-mark.ts --check   # exit 1 when the file is out of date
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const LOGO_FILE = fileURLToPath(new URL("../../logo/monochrome/n62_monochrome.svg", import.meta.url));
export const MARK_FILE = fileURLToPath(new URL("../public/n62-mark.svg", import.meta.url));
/** The mark fills x 31.85–76.15, y 31–77 of the logo's canvas; this box is that with half a unit round it. */
export const MARK_VIEWBOX = "31.35 30.5 45.3 47";

/** The logo file's one path's `d`. */
export function logoPath(logo: string): string {
  const paths = [...logo.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)];
  if (paths.length !== 1) throw new Error(`gen-mark: ${LOGO_FILE} must hold exactly one path (found ${paths.length})`);
  return paths[0]?.[1] as string;
}

/** The mark file's content for a logo file's text. */
export function markSvg(logo: string): string {
  return `<!-- SPDX-License-Identifier: GPL-3.0-or-later -->\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}"><path fill="#000000" d="${logoPath(logo)}"/></svg>\n`;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const want = markSvg(readFileSync(LOGO_FILE, "utf8"));
  if (process.argv[2] === "--check") {
    let have = "";
    try {
      have = readFileSync(MARK_FILE, "utf8");
    } catch {
      /* missing: out of date */
    }
    if (have !== want) {
      console.error("gen-mark: public/n62-mark.svg is out of date (run npm run mark)");
      process.exitCode = 1;
    } else console.log("gen-mark: up to date");
  } else {
    writeFileSync(MARK_FILE, want);
    console.log("gen-mark: wrote public/n62-mark.svg");
  }
}
