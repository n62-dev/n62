// SPDX-License-Identifier: GPL-3.0-or-later
// What of spec/keyboard.yaml the built app carries (vite-plugin-yaml.ts, `vite build` only). The fields left out are
// read by tests and tools, never at run time, and they cost start-chunk bytes (R10: 4.5 kB raw, 1.2 kB gzip).
//   sample     the template filled in; the round-trip and keyboard tests read it
//   source     where a key's position was seen; keyboard.test.ts and the G2 checklist read it
//   check      a palette cell to confirm on the device; keyboard.test.ts reads it
//   desc       a palette cell's description for readers of the yaml; the app names cells through i18n
//   desktop    the desktop keys (R131): their own lazy chunk (`keyboard.yaml?desktop`, with MathLive's hwkeys.ts)
//   label.<layer>  where it is the character its layer types (the 26 letters, R142's bytes; the digits, x and y, `.` `,` `=` `_` `#` `:`
//                `;`, R864's bytes): loadKeyboard puts it back
// `shipped: true` tells loadKeyboard not to ask for them.

const DROP = new Set(["sample", "source", "check", "desc"]);

function strip(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(strip);
  if (v === null || typeof v !== "object") return v;
  return Object.fromEntries(Object.entries(v).filter(([k]) => !DROP.has(k)).map(([k, x]) => [k, strip(x)]));
}

/** The start chunk's copy: no desktop keys (R131), and no palettes (R18, R91: their own lazy chunk, `shippedPalettes`; the Tmpl
 *  palette, `templates`, is a Shift palette's neighbour in it). */
export function shippedKeyboard(doc: unknown): unknown {
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) return doc;
  const { templates: _templates, relations: _relations, symbols: _symbols, chars: _chars, desktop: _desktop, ...rest } = doc as Record<string, unknown>;
  const out = strip(rest) as { keys: (Record<string, { type?: string }> & { label: Record<string, string> })[] };
  for (const k of out.keys) for (const l of ["primary", "shift", "alpha"]) if (k[l]?.type === k.label[l]) delete k.label[l];
  return { ...out, shipped: true };
}

/** The palettes alone (`keyboard.yaml?palettes`): Tmpl, Shift + 6, Shift + 9 and Shift + Vars (R725), slimmed the same way. */
export function shippedPalettes(doc: unknown): unknown {
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) return doc;
  const { templates, relations, symbols, chars } = doc as Record<string, unknown>;
  return { ...(strip({ templates, relations, symbols, chars }) as Record<string, unknown>), shipped: true };
}

/** The desktop keys alone (`keyboard.yaml?desktop`, R131): hwkeys.ts and the help text read them. */
export function shippedDesktop(doc: unknown): unknown {
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) return doc;
  return { desktop: (doc as Record<string, unknown>)["desktop"] };
}
