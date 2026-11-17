// SPDX-License-Identifier: GPL-3.0-or-later
// sandra 2026-11-17: variant B (the one recommended): --pick unchanged, --row-alt at ZEBRA from --bg toward --text,
// the picked row told by its --focus edge (2 px outline, 4 px bar at the start) at >= 3:1 on --bg, --row-alt and --pick.
// Usage: node probe-zebra2.mjs [zebra=1.08]
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("./probe-zebra.mjs", import.meta.url), "utf8");
const P = eval("(" + src.slice(src.indexOf("const P = ") + 10, src.indexOf("};\nconst ZEBRA") + 1) + ")");
const ZEBRA = Number(process.argv[2] ?? 1.08);
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const toHex = (a) => "#" + a.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = (c) => { const [r, g, b] = hex(c).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
const f = (n) => n.toFixed(2);
for (const [name, p] of Object.entries(P)) {
  let alt = p.bg;
  for (let t = 0.005; t <= 0.5 && cr(p.bg, alt) < ZEBRA; t += 0.005) alt = mix(p.bg, p.text, t);
  let focus = p.focus;
  for (let t = 0.02; t <= 1 && Math.min(cr(focus, p.bg), cr(focus, alt), cr(focus, p.pick)) < 3; t += 0.02) focus = mix(p.focus, p.text, t);
  const ink = ["text", "muted", "approx", "warn", "error"];
  const low = (g) => Math.min(...ink.map((k) => cr(p[k], g)));
  const worst = (g) => ink.reduce((a, k) => (cr(p[k], g) < cr(p[a], g) ? k : a), "text");
  console.log(`${name.padEnd(16)} bg ${p.bg} alt ${alt} (bg:alt ${f(cr(p.bg, alt))}) pick ${p.pick} (pick:bg ${f(cr(p.pick, p.bg))}, pick:alt ${f(cr(p.pick, alt))}) focus ${focus}${focus !== p.focus ? ` (was ${p.focus})` : ""} min ${f(Math.min(cr(focus, p.bg), cr(focus, alt), cr(focus, p.pick)))} | lowest ink: bg ${f(low(p.bg))} ${worst(p.bg)}, alt ${f(low(alt))} ${worst(alt)}, pick ${f(low(p.pick))} ${worst(p.pick)}`);
}
