// SPDX-License-Identifier: GPL-3.0-or-later
// sandra 2026-11-17: zebra rows and the picked row, WCAG 2.x contrast for the six base palettes (normal contrast, colour keys).
// Base values: app/src/style.css:121-205 (N62), app/src/theme/bw.css:3,171, app/src/theme/solarized.css:3,171 (phase-1 228bc43f).
// Rule proposed: --row-alt = the first step from --bg toward --text (0.5 % mix steps) at which bg:row-alt >= ZEBRA (1.10);
// --pick kept, then moved away from the ink until it stands PICK_ROW (1.30) from both --bg and --row-alt; --focus (the
// picked row's edge and bar) at least 3:1 on --bg, --row-alt and --pick (moved away from the ground when not).
// Usage: node probe-zebra.mjs
const P = {
  "N62 Dark": { bg: "#092726", text: "#ebf6f6", muted: "#abccca", approx: "#6ae5e2", warn: "#f3cb53", error: "#ff8e7f", pick: "#134948", focus: "#529997" },
  "N62 Light": { bg: "#cae6e5", text: "#062424", muted: "#314e4d", approx: "#005b5a", warn: "#725400", error: "#a8231b", pick: "#a9d9d8", focus: "#368281" },
  "B&W Dark": { bg: "#000000", text: "#eef2f2", muted: "#a7b4b4", approx: "#539b99", warn: "#f2c94c", error: "#ff7b72", pick: "#1c2b2b", focus: "#529997" },
  "B&W Light": { bg: "#f4f6f6", text: "#0b1213", muted: "#44504f", approx: "#286160", warn: "#725400", error: "#aa241d", pick: "#b9d6d4", focus: "#2e706e" },
  "Solarized Dark": { bg: "#2d4056", text: "#eef0e6", muted: "#c3ccce", approx: "#5fd4c8", warn: "#f7a27a", error: "#ff9f9a", pick: "#22394a", focus: "#f0c040" },
  "Solarized Light": { bg: "#ffffd6", text: "#073642", muted: "#475c63", approx: "#14625c", warn: "#9c370b", error: "#aa211d", pick: "#b6d3ec", focus: "#1a62a0" },
};
const ZEBRA = 1.1;
const PICK_ROW = 1.3;
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const toHex = (a) => "#" + a.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = (c) => { const [r, g, b] = hex(c).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
const f = (n) => n.toFixed(2);
const out = [];
for (const [name, p] of Object.entries(P)) {
  let alt = p.bg;
  for (let t = 0.005; t <= 0.5 && cr(p.bg, alt) < ZEBRA; t += 0.005) alt = mix(p.bg, p.text, t);
  const dark = lum(p.bg) < lum(p.text);
  let pick = p.pick;
  // away from the ink: lighter on a light theme? no: a dark theme's pick is lighter than bg (toward the ink), so move it further toward the ink
  for (let t = 0.02; t <= 0.6 && (cr(pick, p.bg) < PICK_ROW || cr(pick, alt) < PICK_ROW); t += 0.02) pick = mix(p.pick, dark ? p.text : p.text, t);
  let focus = p.focus;
  for (let t = 0.02; t <= 1 && Math.min(cr(focus, p.bg), cr(focus, alt), cr(focus, pick)) < 3; t += 0.02) focus = mix(p.focus, p.text, t);
  const ink = ["text", "muted", "approx", "warn", "error"];
  out.push({
    theme: name, bg: p.bg, "row-alt": alt, "bg:alt": f(cr(p.bg, alt)),
    pick: pick + (pick !== p.pick ? ` (was ${p.pick})` : ""), "pick:bg": f(cr(pick, p.bg)), "pick:alt": f(cr(pick, alt)), "pick:bg today": f(cr(p.pick, p.bg)),
    focus: focus + (focus !== p.focus ? ` (was ${p.focus})` : ""), "focus min (bg/alt/pick)": f(Math.min(cr(focus, p.bg), cr(focus, alt), cr(focus, pick))),
    "ink min on alt": ink.map((k) => `${k} ${f(cr(p[k], alt))}`).join(", "),
    "ink min on pick": ink.map((k) => `${k} ${f(cr(p[k], pick))}`).join(", "),
  });
}
for (const r of out) console.log(JSON.stringify(r));
