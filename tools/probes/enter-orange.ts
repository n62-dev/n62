// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (R842, 2026-11-22): N62 Light with an orange Enter, for the owner's mock-up (his K7, 2026-11-20). It takes the final N62
// Light palette from app/scripts/theme-gen.ts (Shift as drawn: #5b2400, R140 moved the family's #a03f00) and measures four Enters:
//   - today: the logo's teal #529997, black label;
//   - A: sandra's #c26a00, black label (drafts' 2026-11-20-owner-bugs2/DECISIONS.md item 4, outside the repo);
//   - B: on A's OKLCH hue, the lightest value (the most chromatic at that lightness) whose white label reaches 4.5:1;
//   - C: the most chromatic orange between B and A in lightness (OKLCH hue 45°–70°, L from B's to A's) that meets every floor:
//     its label (black or white, whichever reads better) ≥ 4.5:1, its fill ≥ 3:1 against every key next to it and the pad's
//     ground (WCAG 1.4.11), and ≥ LAYER_APART (0.12) from --key-shift and from --error for normal vision and the three
//     colour-vision deficiencies (app/scripts/cvd.ts, the smallest counts); ties go to the hue nearer A's.
// For each: the fill against its neighbours (--key-op, --key-fn, --key-num) and the ground (--panel), the label's contrast, the
// cvd distance from --key-shift (below 0.12: "reads as Shift") and from --error, and what theme-gen makes of it: the unit pad's
// prefix cells (--key-pfx mixes Enter into the digit key) and High contrast (the fill moves until the label reaches 7:1).
//   node tools/probes/enter-orange.ts            # the table
//   node tools/probes/enter-orange.ts --write    # also writes docs/mockups/enter-orange-light.html (static: inline CSS, no script)
// Read-only apart from --write; no network. theme-gen's family data is patched in memory only, and restored.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { apart, CVD } from "../../app/scripts/cvd.ts";
import { FAMILIES, type Palette } from "../../app/scripts/theme-families.ts";
import { cr, LAYER_APART, theme } from "../../app/scripts/theme-gen.ts";

/** #rrggbb of an OKLCH colour, or null outside sRGB. */
function oklch(L: number, C: number, H: number): string | null {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  if (rgb.some((v) => v < -1e-4 || v > 1 + 1e-4)) return null;
  const enc = (v: number): number => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
  return "#" + rgb.map((v) => Math.round(enc(Math.min(1, Math.max(0, v))) * 255).toString(16).padStart(2, "0")).join("");
}
/** OKLCH [L, C, H°] of a #rrggbb colour. */
function lch(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const s = parseInt(hex.slice(i, i + 2), 16) / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}

const SEEN: [string, (typeof CVD)[string] | null][] = [["normal", null], ...Object.entries(CVD)];
/** The smallest distance over normal vision and the three deficiencies, and which one it is. */
function nearest(a: string, b: string): { d: number; by: string } {
  return SEEN.map(([by, m]) => ({ d: apart(a, b, m), by })).reduce((p, q) => (q.d < p.d ? q : p));
}
const onFill = (c: string): string => (cr("#000000", c) >= cr("#ffffff", c) ? "#000000" : "#ffffff");

/** N62 Light as theme-gen writes it, with the family's Light Enter replaced (in memory; restored before it returns). */
function lightWith(enter: string | null, on: string | null, high: boolean): Palette {
  const fam = FAMILIES.find((f) => f.id === "n62")!;
  const keep = { e: fam.light["key-enter"], o: fam.light["on-enter"] };
  try {
    if (enter !== null) fam.light["key-enter"] = enter;
    if (on !== null) fam.light["on-enter"] = on;
    return theme({ family: "n62", brightness: "light", high, plain: false }).t;
  } finally {
    fam.light["key-enter"] = keep.e!;
    fam.light["on-enter"] = keep.o!;
  }
}
export const T0 = lightWith(null, null, false);
/** Enter's neighbours on the pad (Enter sits in row 6 beside `,` (op), under ln and log (fn), over 9 and ÷ (num, op)) and the pad's ground. */
export const AROUND = ["key-op", "key-fn", "key-num", "panel"] as const;
const FILL_MIN = 3;
const LABEL_MIN = 4.5;
const APART = LAYER_APART.normal;

export interface Cand { id: string; name: string; how: string; c: string; on: string }
export interface Measured extends Cand { lch: [number, number, number]; around: number[]; label: number; shift: { d: number; by: string }; error: { d: number; by: string }; pfx: string; hc: { c: string; on: string; label: number; around: number[]; shift: { d: number; by: string } }; t: Palette; th: Palette }
export function measure(k: Cand): Measured {
  const t = lightWith(k.c, k.on, false);
  const th = lightWith(k.c, k.on, true);
  const c = t["key-enter"]!;
  return {
    ...k, c, lch: lch(c), around: AROUND.map((r) => cr(c, t[r]!)), label: cr(t["on-enter"]!, c),
    shift: nearest(c, t["key-shift"]!), error: nearest(c, t["error"]!), pfx: t["key-pfx"]!,
    hc: { c: th["key-enter"]!, on: th["on-enter"]!, label: cr(th["on-enter"]!, th["key-enter"]!), around: AROUND.map((r) => cr(th["key-enter"]!, th[r]!)), shift: nearest(th["key-enter"]!, th["key-shift"]!) },
    t, th,
  };
}

/** B: on A's hue, the lightest value whose white label reaches 4.5:1 (at that lightness the most chromatic in sRGB). */
function findB(a: string): string {
  const [, , H] = lch(a);
  let best: { c: string; L: number; C: number } | null = null;
  for (let L = 0.3; L <= 0.9001; L += 0.0025)
    for (let C = 0.02; C <= 0.3001; C += 0.0025) {
      const c = oklch(L, C, H);
      if (c === null || cr(c, "#ffffff") < LABEL_MIN) continue;
      if (best === null || L > best.L + 1e-9 || (Math.abs(L - best.L) < 1e-9 && C > best.C)) best = { c, L, C };
    }
  if (best === null) throw new Error("enter-orange: no B");
  return best.c;
}
/** C: the rule in the header. */
function findC(a: string, b: string): string {
  const [La, , Ha] = lch(a);
  const [Lb] = lch(b);
  let best: { c: string; C: number; dh: number } | null = null;
  for (let H = 45; H <= 70; H += 1)
    for (let L = Lb; L <= La + 1e-9; L += 0.0025)
      for (let C = 0.02; C <= 0.3001; C += 0.0025) {
        const c = oklch(L, C, H);
        if (c === null) continue;
        if (cr(onFill(c), c) < LABEL_MIN || AROUND.some((r) => cr(c, T0[r]!) < FILL_MIN)) continue;
        if (nearest(c, T0["key-shift"]!).d < APART || nearest(c, T0["error"]!).d < APART) continue;
        const dh = Math.abs(H - Ha);
        if (best === null || C > best.C + 1e-9 || (Math.abs(C - best.C) < 1e-9 && dh < best.dh)) best = { c, C, dh };
      }
  if (best === null) throw new Error("enter-orange: no C");
  return best.c;
}

const A = "#c26a00";
const B = findB(A);
const C = findC(A, B);
export const CANDS: Measured[] = [
  { id: "today", name: "Today: the logo's teal", how: "N62's Enter in both brightnesses (R153).", c: "#529997", on: "#000000" },
  { id: "a", name: "A: sandra's orange", how: "Black label; sandra's candidate (2026-11-20).", c: A, on: "#000000" },
  { id: "b", name: "B: deeper, white label", how: "A's hue, the lightest value whose white label reaches 4.5:1.", c: B, on: "#ffffff" },
  { id: "c", name: "C: the most vivid between", how: "Between B and A in lightness, the most chromatic orange (hue 45°–70°) that meets every floor below.", c: C, on: onFill(C) },
].map(measure);
/** The candidate drawn in High contrast: the worker's pick (the report gives the reason). */
export const PICK = "c";

const f2 = (x: number): string => x.toFixed(2);
const f3 = (x: number): string => x.toFixed(3);

// --- the page ---------------------------------------------------------------------------------------------------
const V = (s: string): string => `<i class="v">${s}</i>`;
type K = [id: string, span: number, cls: string, face: string, shift: string, alpha: string];
/** The keypad as tools/probes/super-mode.ts draws it (spec/keyboard.yaml today, legends in R729's places, K4 on Shift and Alpha). */
const ROWS: (K | ["pad"] | ["skip"])[][] = [
  [["u1", 5, "nav user", "＋", "", ""], ["u2", 5, "nav user", "＋", "", ""], ["pad"], ["help", 5, "nav", "Help▾", "Settings▾", ""], ["esc", 5, "nav", "Esc", "Clear", ""]],
  [["u3", 5, "nav user", "＋", "", ""], ["u4", 5, "nav user", "＋", "", ""], ["skip"], ["undo", 5, "nav", "Undo", "⇤", ""], ["redo", 5, "nav", "Redo", "⇥", ""]],
  [["u5", 5, "nav user", "＋", "", ""], ["u6", 5, "nav user", "＋", "", ""], ["skip"], ["select", 5, "nav", "Select", "Copy", ""], ["deselect", 5, "nav", "Deselect", "Paste", ""]],
  [["vars", 5, "fn", "Vars▾", "Chars▾", "A"], ["math", 5, "fn", "Math▾", "Mem▾", "B"], ["tmpl", 5, "fn", "Tmpl▾", "Units", "C"], ["x", 5, "fn", V("x"), V("y"), "D"], ["frac", 5, "fn", "a b/c", "", "E"], ["bksp", 5, "ctl", "⌫", "Del", ""]],
  [["pow", 5, "fn", "xʸ", "ⁿ√", "F"], ["sin", 5, "fn", "sin", "sin⁻¹", "G"], ["cos", 5, "fn", "cos", "cos⁻¹", "H"], ["tan", 5, "fn", "tan", "tan⁻¹", "I"], ["ln", 5, "fn", "ln", "eˣ", "J"], ["log", 5, "fn", "log", "10ˣ", "K"]],
  [["sq", 5, "fn", "x²", "√", "L"], ["neg", 5, "fn", "(−)", "|x|", "M"], ["paren", 5, "op", "( )", "∥", "N"], ["comma", 5, "op", ",", "±", "O"], ["enter", 10, "enter", "Enter", "≈", ""]],
  [["emark", 6, "fn", "ᴇ", "Sto▶", "P"], ["d7", 6, "num", "7", "", "Q"], ["d8", 6, "num", "8", "{ }", "R"], ["d9", 6, "num", "9", "α∞▾", "S"], ["div", 6, "op", "÷", "x⁻¹", "T"]],
  [["alpha", 6, "ctl", "alpha", "a", "A"], ["d4", 6, "num", "4", "Matrix▾", "U"], ["d5", 6, "num", "5", "[ ]", "V"], ["d6", 6, "num", "6", "≤≠▾", "W"], ["mul", 6, "op", "×", "∡", "X"]],
  [["shift", 6, "ctl", "shift", "⇧", ""], ["d1", 6, "num", "1", "σ▾", "Y"], ["d2", 6, "num", "2", V("i"), "Z"], ["d3", 6, "num", "3", "π", "#"], ["sub", 6, "op", "−", "Base▾", ":"]],
  [["fmt", 6, "ctl", "Fmt", "", ""], ["d0", 6, "num", "0", "%", ""], ["dot", 6, "num", ".", "=", ""], ["space", 6, "num", "␣", "_", ""], ["add", 6, "op", "+", "Ans", ";"]],
];
/** The rows from Vars down carry a letter line on every key (the upper cluster has none). */
const LETTERED = new Set(ROWS.slice(3).flat().map((k) => k[0]));
const md = (s: string): string => s.replace("▾", '<span class="mk">▾</span>');

/** One key at rest or with Shift armed (R729: each Shift legend ringed, faces and letters dimmed, the Shift key ringed). */
function keyHtml([id, span, cls, face, sh, al]: K, armed: boolean): string {
  const lt = LETTERED.has(id) ? " lt" : "";
  const keyCls = (id === "shift" || id === "alpha" ? ` ${id}key` : "") + (armed && id === "shift" ? " armed" : "");
  const faceCls = armed && id !== "shift" ? " dim" : "";
  const slH = sh ? `<span class="sl${armed && id !== "shift" ? " ring" : ""}">${md(sh)}</span>` : "<span></span>";
  const alH = lt ? `<span class="al${armed ? " dim" : ""}">${al}</span>` : "";
  return `<div class="k ${cls}${lt}${keyCls}" style="grid-column:span ${span}"><div class="lg">${slH}</div><div class="f${faceCls}"><span>${md(face)}</span></div>${alH}</div>`;
}
function padHtml(armed: boolean): string {
  return ROWS.flat()
    .map((k) => (k[0] === "skip" ? "" : k[0] === "pad" ? `<div class="circ"><b class="u${armed ? " dead" : ""}">▲</b><b class="d${armed ? " dead" : ""}">▼</b><b class="l${armed ? " dead" : ""}">◀</b><b class="r${armed ? " dead" : ""}">▶</b></div>` : keyHtml(k as K, armed)))
    .join("");
}
const ROLES = ["bg", "panel", "key-num", "key-op", "key-fn", "key-ctl", "key-nav", "key-enter", "on-enter", "key-text", "key-text-dead", "muted", "line", "key-shift", "key-alpha", "key-edge"];
const vars = (t: Palette): string => ROLES.map((r) => `--${r}:${t[r]}`).join(";");

const chip = (c: string): string => `<span class="chip" style="background:${c}"></span> ${c}`;
function rows(around: number[], t: Palette, label: number, on: string, floor: number, shift: { d: number; by: string }, error: { d: number; by: string } | null): string {
  const fill = AROUND.map((r, i) => `<tr><td>fill on <code>--${r}</code> ${chip(t[r]!)}</td><td>${f2(around[i]!)}:1</td><td>${around[i]! < FILL_MIN ? '<b class="miss">below 3</b>' : "≥ 3"}</td></tr>`).join("");
  const cv = (n: string, d: { d: number; by: string }, v: string): string =>
    `<tr><td>apart from <code>--${n}</code> ${chip(v)}</td><td>${f3(d.d)}</td><td>${d.by}${d.d < APART ? ` <b class="miss">below ${APART}${n === "key-shift" ? ": reads as Shift" : ""}</b>` : ""}</td></tr>`;
  return `<table><tr><th>pair</th><th>measured</th><th>floor; for cvd the nearest view</th></tr>${fill}
<tr><td>label <code>${on}</code> on the fill</td><td>${f2(label)}:1</td><td>${label < floor ? `<b class="miss">below ${floor}</b>` : `≥ ${floor}`}</td></tr>
${cv("key-shift", shift, t["key-shift"]!)}${error ? cv("error", error, t["error"]!) : ""}</table>`;
}
function columnHtml(k: Measured): string {
  const [L, Cc, H] = k.lch;
  return `<section class="col" style="${vars(k.t)}">
<h2>${k.name}</h2>
<p class="cap"><span class="chip big" style="background:${k.c}"></span> <code>--key-enter: ${k.c}</code> (OKLCH ${f3(L)} ${f3(Cc)} ${H.toFixed(0)}°), label <code>${k.on}</code>. ${k.how}</p>
${rows(k.around, k.t, k.label, k.on, LABEL_MIN, k.shift, k.error)}
<p class="cap">The unit pad's prefix cells (<code>--key-pfx</code>, Enter mixed into the digit key): ${chip(k.pfx)}</p>
<h3>At rest</h3><div class="pad">${padHtml(false)}</div>
<h3>Shift armed (R729: Shift's legends ringed, the rest dimmed)</h3><div class="pad">${padHtml(true)}</div>
</section>`;
}
function hcHtml(k: Measured): string {
  return `<section class="col" style="${vars(k.th)}">
<h2>${k.name.split(":")[0]} in N62 Light + High contrast</h2>
<p class="cap"><span class="chip big" style="background:${k.hc.c}"></span> <code>--key-enter: ${k.hc.c}</code>, label <code>${k.hc.on}</code>: theme-gen moves the fill from ${k.c} until the label reaches 7:1.</p>
${rows(k.hc.around, k.th, k.hc.label, k.hc.on, 7, k.hc.shift, null)}
<h3>At rest</h3><div class="pad">${padHtml(false)}</div>
<h3>Shift armed</h3><div class="pad">${padHtml(true)}</div>
</section>`;
}

const CSS = `*{box-sizing:border-box}
body{margin:0;background:#1d2524;color:#e9efee;font:14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header,footer{max-width:1140px;margin:0 auto;padding:12px}
h1{font-size:19px;margin:4px 0}
h2.part{max-width:1140px;margin:8px auto;padding:0 12px;font-size:16px}
.cols{display:flex;flex-wrap:wrap;justify-content:center;gap:24px;padding:0 0 12px}
.col{width:360px;flex:0 0 360px;background:var(--bg);color:var(--key-text);padding:0 0 10px}
.col h2{font-size:15px;margin:0;padding:8px 8px 2px}
.col h3{font-size:13px;margin:12px 8px 0}
.cap{margin:2px 8px 4px;font-size:12px;color:var(--muted)}
table{border-collapse:collapse;margin:4px 8px;font-size:11px;width:344px;color:var(--key-text)}
td,th{border-top:1px solid var(--line);padding:2px 3px;text-align:left;vertical-align:top}
th{font-weight:600}
code{font-size:10.5px}
.chip{display:inline-block;width:10px;height:10px;border-radius:2px;vertical-align:-1px;box-shadow:0 0 0 1px var(--line)}
.chip.big{width:16px;height:16px;vertical-align:-3px}
.miss{color:#a8231b;font-weight:600}
.pad{display:grid;grid-template-columns:repeat(30,minmax(0,1fr));gap:4px;padding:4px;background:var(--panel)}
.k{position:relative;display:grid;grid-template-rows:14px 1fr;min-width:0;height:32px;border-radius:7px;background:var(--key-ctl);color:var(--key-text);font-size:14px;box-shadow:0 2px 0 var(--key-edge)}
.k.lt{grid-template-rows:12px 1fr 12px;height:42px}
.k.num{background:var(--key-num);font-size:19px}
.k.op{background:var(--key-op);font-size:19px}
.k.fn{background:var(--key-fn);font-size:16px}
.k.nav{background:var(--key-nav);font-size:12px}
.k.enter{background:var(--key-enter);color:var(--on-enter);font-size:15px}
.k.user{background:transparent;box-shadow:inset 0 0 0 1px var(--line);color:var(--muted)}
.lg{display:flex;justify-content:space-between;align-items:center;padding:0 3px;font-size:10px;line-height:12px;white-space:nowrap;overflow:hidden}
.sl{color:var(--key-shift);border-radius:3px;padding:0 2px;line-height:12px}
.sl.ring{box-shadow:inset 0 0 0 1.5px var(--key-shift)}
.k.enter .sl{color:var(--on-enter)}
.k.enter .sl.ring{box-shadow:inset 0 0 0 1.5px var(--on-enter)}
.f{display:flex;align-items:center;justify-content:center;min-width:0;line-height:1;white-space:nowrap}
.f span{padding:1px 3px;border-radius:5px}
.al{align-self:end;justify-self:start;margin:0 0 1px 3px;padding:0 2px;border-radius:3px;font-size:10px;line-height:11px;color:var(--key-alpha);font-family:"Times New Roman",serif;font-style:italic}
i.v{font-family:"Times New Roman",serif;font-style:italic}
.mk{font-size:.7em;margin-left:1px;opacity:.85}
.circ{grid-row:1/4;grid-column:11/21;place-self:center;height:100%;aspect-ratio:1;border-radius:50%;background:var(--key-ctl);box-shadow:0 2px 0 var(--key-edge);position:relative;color:var(--key-text);font-size:12px}
.circ b{position:absolute;font-weight:400;opacity:.7;width:20px;height:20px;line-height:20px;text-align:center;border-radius:50%}
.circ .u{top:6%;left:50%;transform:translateX(-50%)}.circ .d{bottom:6%;left:50%;transform:translateX(-50%)}
.circ .l{left:7%;top:50%;transform:translateY(-50%)}.circ .r{right:7%;top:50%;transform:translateY(-50%)}
.circ b.dead{color:var(--key-text-dead);opacity:1}
/* the Shift and Alpha keys' faces in their layer's colour (Keypad.svelte) */
.k.shiftkey .f{color:var(--key-shift)}
.k.alphakey .f{color:var(--key-alpha)}
/* Shift armed (R729): the Shift key's face in its orange and a ring round the key; the other faces and letters dimmed */
.k.armed{box-shadow:inset 0 0 0 2px var(--key-shift),0 2px 0 var(--key-edge)}
.k.armed .f{color:var(--key-shift);font-weight:600}
.dim{color:var(--key-text-dead)!important}
.k.enter .dim{color:var(--on-enter)!important;opacity:.6}
footer p,header p,footer li{color:#b9c8c6;font-size:13px}
footer b,header b{color:#fff}`;

/** Every candidate in High contrast, numbers only: what theme-gen makes of it (the fill moves until the label reaches 7:1). */
function hcAll(cands: Measured[]): string {
  const row = (k: Measured): string => {
    const fill = Math.min(...k.hc.around);
    const near = k.hc.shift.d < APART;
    return `<tr><td>${k.name.split(":")[0]}</td><td>${chip(k.hc.c)}</td><td>${k.hc.on} ${f2(k.hc.label)}:1</td><td>${fill < FILL_MIN ? `<b class="miss">${f2(fill)}:1</b>` : `${f2(fill)}:1`}</td><td>${near ? `<b class="miss">${f3(k.hc.shift.d)}: reads as Shift</b>` : f3(k.hc.shift.d)} (${k.hc.shift.by})</td></tr>`;
  };
  const th = cands[0]!.th;
  return `<section class="col" style="${vars(th)}">
<h2>Every candidate in High contrast (numbers)</h2>
<p class="cap">Shift is <code>${th["key-shift"]}</code> here, the keys round Enter <code>${th["key-op"]}</code> and <code>${th["key-num"]}</code>. Fill: the smallest against them and the ground.</p>
<table><tr><th>Enter</th><th>fill</th><th>label</th><th>fill vs keys</th><th>from Shift</th></tr>${cands.map(row).join("")}</table>
</section>`;
}

export function page(cands: Measured[]): string {
  const pick = cands.find((k) => k.id === PICK)!;
  const sh = T0["key-shift"]!;
  const today = cands.find((k) => k.id === "today")!;
  return `<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>N62 Light: an orange Enter (R842)</title>
<!-- Generated by tools/probes/enter-orange.ts --write from app/scripts/theme-gen.ts's final N62 Light palette; edit the probe, not this page. -->
<style>
${CSS}
</style>
</head>
<body>
<header>
<h1>N62 Light: an orange Enter (R842, the owner's K7; R843 builds the pick)</h1>
<p>Four Enters on N62 Light's keypad at 360 px, each at rest and with Shift armed, so Enter stands beside Shift's orange in both states. Dark keeps its teal Enter (orange there is armed Shift). Shift's orange as drawn in Light is <b>${sh}</b> (R140 moved the family's #a03f00 away from Alpha's teal). Floors: Enter's fill <b>≥ 3:1</b> against every key next to it and the pad's ground (WCAG 1.4.11), its label <b>≥ 4.5:1</b> (<b>≥ 7:1</b> in High contrast), and <b>≥ ${APART}</b> from Shift (app/scripts/cvd.ts, the smallest of normal vision and the three colour-vision deficiencies; theme-gen's Shift-to-Alpha floor), else the candidate is marked "reads as Shift". <b class="miss">Below</b> marks a missed floor. The numbers are <code>node tools/probes/enter-orange.ts</code>.</p>
</header>
<div class="cols">
${cands.map(columnHtml).join("\n")}
</div>
<h2 class="part">High contrast, for the worker's pick (${pick.name.split(":")[0]})</h2>
<div class="cols">
${hcHtml(pick)}
${hcAll(cands)}
</div>
<footer>
<p><b>Reading the page</b></p>
<ul>
<li><b>Today:</b> the logo's teal, the same Enter as Dark; its fill stands ${f2(Math.min(...today.around))}–${f2(Math.max(...today.around))}:1 from the keys round it and the ground, under the 3:1 floor already.</li>
<li><b>A</b> is sandra's candidate; <b>B</b> is the deepest step: a white label at 4.5:1 on A's hue; <b>C</b> lies between them in lightness and is the most vivid orange that meets every floor.</li>
<li><b>Shift armed</b> follows R729 (not merged yet): Shift's legends get a ring in Shift's orange, the faces and letters dim, the Shift key is ringed; Enter's ≈ is ringed in its own label colour.</li>
<li><b>The prefix cells</b> of the unit pad take a little of Enter's colour (theme-gen's <code>--key-pfx</code>); an orange Enter tints them peach. R843 keeps or changes that.</li>
<li><b>The choice:</b> A, B, C or none (Enter stays teal). R843 starts on the answer.</li>
</ul>
</footer>
</body>
</html>
`;
}

console.log(`N62 Light: --key-shift ${T0["key-shift"]} (family ${FAMILIES.find((f) => f.id === "n62")!.light["shift"]}), --error ${T0["error"]}, neighbours ${AROUND.map((r) => `${r} ${T0[r]}`).join(", ")}`);
console.log("candidate | --key-enter | OKLCH L C H | label | fill on " + AROUND.join(", ") + " | from --key-shift (by) | from --error (by) | --key-pfx | HC: enter, label, fill on " + AROUND.join(", ") + ", from shift");
for (const k of CANDS)
  console.log(`${k.id} | ${k.c} | ${f3(k.lch[0])} ${f3(k.lch[1])} ${k.lch[2].toFixed(1)} | ${k.on} ${f2(k.label)} | ${k.around.map(f2).join(", ")} | ${f3(k.shift.d)} (${k.shift.by}) | ${f3(k.error.d)} (${k.error.by}) | ${k.pfx} | ${k.hc.c} ${k.hc.on} ${f2(k.hc.label)}, ${k.hc.around.map(f2).join(", ")}, ${f3(k.hc.shift.d)} (${k.hc.shift.by})`);
if (process.argv.includes("--write")) {
  const out = join(dirname(fileURLToPath(import.meta.url)), "../../docs/mockups/enter-orange-light.html");
  writeFileSync(out, page(CANDS));
  console.log(`wrote ${out}`);
}
