// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (R845, 2026-11-22): the super mode's green for the owner's mock-up, measured. For N62 Dark, N62 Light and N62 Dark +
// High contrast it takes the final palette from app/scripts/theme-gen.ts, then picks `--key-super` along one OKLCH hue:
//   - floors (a value that misses one is never picked): the green as a legend ≥ 4.5:1 (7:1 in High contrast) on every key
//     ground it sits on (--panel under an empty user key, --key-ctl, --key-nav); a ring or glow ≥ 3:1 there (implied);
//     its label on a green fill (black or white, whichever reads better) ≥ the same 4.5:1 or 7:1;
//   - the colour-vision distance (app/scripts/cvd.ts: normal vision and the three deficiencies, the smallest counts) from
//     --key-shift and --key-alpha, aimed at theme-gen's LAYER_APART (0.12; 0.10 in High contrast): among the values that
//     reach it the most chromatic; where none does, the most chromatic within NEAR_TOL of the farthest, flagged;
//   - the hue: the one of 130°–150° (green; below is lime and olive, above it turns to Alpha's teal) whose worst column is
//     farthest from Shift and Alpha.
//   node tools/probes/super-mode.ts            # the hue scan and the table
//   node tools/probes/super-mode.ts --write    # also writes docs/mockups/super-mode.html (static: inline CSS, no script)
// Read-only apart from --write; no network.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { apart, CVD } from "../../app/scripts/cvd.ts";
import { cr, LAYER_APART, theme } from "../../app/scripts/theme-gen.ts";
import type { Palette } from "../../app/scripts/theme-families.ts";

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

const SEEN: [string, (typeof CVD)[string] | null][] = [["normal", null], ...Object.entries(CVD)];
/** The smallest distance over normal vision and the three deficiencies, and which one it is. */
function nearest(a: string, b: string): { d: number; by: string } {
  return SEEN.map(([by, m]) => ({ d: apart(a, b, m), by })).reduce((p, q) => (q.d < p.d ? q : p));
}
const onFill = (c: string): string => (cr("#000000", c) >= cr("#ffffff", c) ? "#000000" : "#ffffff");

export interface Column { id: string; name: string; brightness: "dark" | "light"; high: boolean; t: Palette }
export const COLUMNS: Column[] = ([
  { id: "dark", name: "N62 Dark", brightness: "dark", high: false },
  { id: "light", name: "N62 Light", brightness: "light", high: false },
  { id: "hc", name: "N62 Dark + High contrast", brightness: "dark", high: true },
] as const).map((c) => ({ ...c, t: theme({ family: "n62", brightness: c.brightness, high: c.high, plain: false }).t }) as Column);
/** The grounds a green legend, ring or glow sits on: an empty user key is see-through (--panel), the rest are --key-ctl and --key-nav. */
export const GROUNDS = ["panel", "key-ctl", "key-nav"] as const;

export interface Green { c: string; C: number; L: number; on: string; floor: number; legend: number[]; onFill: number; shift: { d: number; by: string }; alpha: { d: number; by: string }; apart: boolean }
function measure(col: Column, c: string, C: number, L: number): Green {
  const floor = col.high ? 7 : 4.5;
  const on = onFill(c);
  const shift = nearest(c, col.t["key-shift"]!);
  const alpha = nearest(c, col.t["key-alpha"]!);
  return { c, C, L, on, floor, legend: GROUNDS.map((g) => cr(c, col.t[g]!)), onFill: cr(on, c), shift, alpha, apart: Math.min(shift.d, alpha.d) >= LAYER_APART[col.high ? "high" : "normal"] };
}
/** The green of a column at hue H: every in-gamut OKLCH value (L 0.2–0.97, C 0.08–0.3) that meets the floors, then the rule in the header. */
export function pick(col: Column, H: number): Green | null {
  const ok: Green[] = [];
  for (let C = 0.08; C <= 0.3001; C += 0.005)
    for (let L = 0.2; L <= 0.9701; L += 0.0025) {
      const c = oklch(L, C, H);
      if (c === null) continue;
      const g = measure(col, c, C, L);
      if (g.legend.every((x) => x >= g.floor) && g.onFill >= g.floor) ok.push(g);
    }
  if (ok.length === 0) return null;
  const near = (g: Green): number => Math.min(g.shift.d, g.alpha.d);
  const far = ok.filter((g) => g.apart);
  const chromatic = (gs: Green[]): Green => gs.reduce((p, q) => (q.C > p.C || (q.C === p.C && near(q) > near(p)) ? q : p));
  if (far.length) return chromatic(far);
  const top = Math.max(...ok.map(near));
  return chromatic(ok.filter((g) => near(g) >= top - NEAR_TOL));
}
/** Where no green reaches the cvd floor: the most chromatic of those within this of the farthest (the farthest alone is a grey green). */
export const NEAR_TOL = 0.005;
export const HUES = [130, 135, 140, 145, 150];
/** The hue whose worst column is farthest from Shift and Alpha. */
export function bestHue(): { H: number; greens: Green[] } {
  let best: { H: number; greens: Green[]; worst: number } | null = null;
  for (const H of HUES) {
    const greens = COLUMNS.map((c) => pick(c, H));
    if (greens.some((g) => g === null)) continue;
    const gs = greens as Green[];
    const worst = Math.min(...gs.map((g) => Math.min(g.shift.d, g.alpha.d)));
    if (best === null || worst > best.worst) best = { H, greens: gs, worst };
  }
  if (best === null) throw new Error("super-mode: no hue meets the floors in every column");
  return best;
}

const f2 = (x: number): string => x.toFixed(2);
const f3 = (x: number): string => x.toFixed(3);

// --- the page ---------------------------------------------------------------------------------------------------
const V = (s: string): string => `<i class="v">${s}</i>`;
type K = [id: string, span: number, cls: string, face: string, shift: string, alpha: string];
/** The keypad as spec/keyboard.yaml draws it today, legends in R729's places (as drafts' 2026-11-17-keys/legends.html). */
const ROWS: (K | ["pad"] | ["skip"])[][] = [
  [["u1", 5, "nav user", "＋", "", ""], ["u2", 5, "nav user", "＋", "", ""], ["pad"], ["help", 5, "nav", "Help▾", "Settings▾", ""], ["esc", 5, "nav", "Esc", "Clear", ""]],
  [["u3", 5, "nav user", "＋", "", ""], ["u4", 5, "nav user", "＋", "", ""], ["skip"], ["undo", 5, "nav", "Undo", "⇤", ""], ["redo", 5, "nav", "Redo", "⇥", ""]],
  [["u5", 5, "nav user", "＋", "", ""], ["u6", 5, "nav user", "＋", "", ""], ["skip"], ["select", 5, "nav", "Select", "Copy", ""], ["deselect", 5, "nav", "Deselect", "Paste", ""]],
  [["vars", 5, "fn", "Vars▾", "Chars▾", "A"], ["math", 5, "fn", "Math▾", "Mem▾", "B"], ["tmpl", 5, "fn", "Tmpl▾", "Units", "C"], ["x", 5, "fn", V("x"), V("y"), "D"], ["frac", 5, "fn", "a b/c", "", "E"], ["bksp", 5, "ctl", "⌫", "Del", ""]],
  [["pow", 5, "fn", "xʸ", "ⁿ√", "F"], ["sin", 5, "fn", "sin", "sin⁻¹", "G"], ["cos", 5, "fn", "cos", "cos⁻¹", "H"], ["tan", 5, "fn", "tan", "tan⁻¹", "I"], ["ln", 5, "fn", "ln", "eˣ", "J"], ["log", 5, "fn", "log", "10ˣ", "K"]],
  [["sq", 5, "fn", "x²", "√", "L"], ["neg", 5, "fn", "(−)", "|x|", "M"], ["paren", 5, "op", "( )", "∥", "N"], ["comma", 5, "op", ",", "±", "O"], ["enter", 10, "enter", "Enter", "≈", ""]],
  [["emark", 6, "fn", "ᴇ", "Sto▶", "P"], ["d7", 6, "num", "7", "", "Q"], ["d8", 6, "num", "8", "{ }", "R"], ["d9", 6, "num", "9", "α∞▾", "S"], ["div", 6, "op", "÷", "x⁻¹", "T"]],
  [["alpha", 6, "ctl", "alpha", "a", "A"], ["d4", 6, "num", "4", "Matrix▾", "U"], ["d5", 6, "num", "5", "[ ]", "V"], ["d6", 6, "num", "6", "≤≠▾", "W"], ["mul", 6, "op", "×", "∡", "X"]],
  [["shift", 6, "ctl", "shift", "⇧", "SIGN"], ["d1", 6, "num", "1", "σ▾", "Y"], ["d2", 6, "num", "2", V("i"), "Z"], ["d3", 6, "num", "3", "π", "#"], ["sub", 6, "op", "−", "Base▾", ":"]],
  [["fmt", 6, "ctl", "Fmt", "SIGN", ""], ["d0", 6, "num", "0", "%", ""], ["dot", 6, "num", ".", "=", ""], ["space", 6, "num", "␣", "_", ""], ["add", 6, "op", "+", "Ans", ";"]],
];
const LETTERED = new Set(["vars", "math", "tmpl", "x", "frac", "bksp", "pow", "sin", "cos", "tan", "ln", "log", "sq", "neg", "paren", "comma", "enter", "emark", "d7", "d8", "d9", "div", "alpha", "d4", "d5", "d6", "mul", "shift", "d1", "d2", "d3", "sub", "fmt", "d0", "dot", "space", "add"]);
type State = "rest" | "once" | "held" | "heldshift";
const md = (s: string): string => s.replace("▾", '<span class="mk">▾</span>');

function keyHtml([id, span, cls, face, sh, al]: K, st: State, sign: string): string {
  const lit = st === "once" || st === "held";
  const sgn = `<span class="sg">${sign}</span>`;
  let keyCls = "";
  let faceCls = "";
  let slCls = "";
  let alCls = "";
  const shL = sh === "SIGN" ? sgn : sh;
  const alL = al === "SIGN" ? sgn : al;
  if (id === "shift") {
    keyCls = st === "once" ? " su-ring" : st === "held" || st === "heldshift" ? " su-fill" : "";
    if (st === "heldshift") faceCls = "on-ring";
  } else if (st === "heldshift") {
    // Shift pressed inside the held mode: only Shift + Fmt (the exit) has a job
    if (id === "fmt") slCls = "su-lgring";
    else {
      faceCls = "dim";
      if (sh) slCls = "dimlg";
      if (al) alCls = "dimlg";
    }
  } else if (lit) {
    if (id === "bksp" || cls.includes("user")) faceCls = "su";
    if (id === "fmt") slCls = "su";
  }
  const lt = LETTERED.has(id) ? " lt" : "";
  const slH = shL ? `<span class="sl ${slCls}">${md(shL)}</span>` : "<span></span>";
  const alH = lt ? `<span class="al ${alCls}">${alL}</span>` : "";
  return `<div class="k ${cls}${lt}${keyCls}" style="grid-column:span ${span}"><div class="lg">${slH}</div><div class="f ${faceCls}"><span>${md(face)}</span></div>${alH}</div>`;
}
function padHtml(st: State, sign: string): string {
  const glow = st === "once" || st === "held" ? " glow" : "";
  const dead = st === "rest" ? "" : " dead";
  const lr = st === "heldshift" ? " dead" : glow;
  return ROWS.flat()
    .map((k) => (k[0] === "skip" ? "" : k[0] === "pad" ? `<div class="circ"><b class="u${dead}">▲</b><b class="d${dead}">▼</b><b class="l${lr}">◀</b><b class="r${lr}">▶</b></div>` : keyHtml(k as K, st, sign)))
    .join("");
}
const STATES: [State, string, string][] = [
  ["rest", "At rest", "As today with R729's legends; the super sign on Shift (bottom left) and on Fmt (top left, its Shift layer) in the green."],
  ["once", "One action (a flick down on Shift)", "Shift has a green ring. ◀ ▶ glow, ⌫ and U1–U6 are green, Fmt's sign is green; ▲ ▼ fade. The next key with a super job does it and the mode ends."],
  ["held", "Held (Shift + Fmt)", "Shift is filled green: the mode stays until Esc or Shift + Fmt. The keys as in one action."],
  ["heldshift", "Held, Shift pressed", "Shift's face gets the armed ring inside the fill; only Fmt's sign is lit (Shift + Fmt ends the mode), every other key dims."],
];
const vars = (t: Palette, g: Green): string =>
  ["panel", "key-num", "key-op", "key-fn", "key-ctl", "key-nav", "key-enter", "on-enter", "key-text", "key-text-dead", "muted", "line", "key-shift", "key-alpha", "on-key-shift", "key-edge", "bg"]
    .map((r) => `--${r}:${t[r]}`)
    .concat([`--key-super:${g.c}`, `--on-key-super:${g.on}`])
    .join(";");

function columnHtml(col: Column, g: Green, H: number): string {
  const t = col.t;
  const legend = GROUNDS.map((r, i) => `<tr><td>on <code>--${r}</code> <span class="chip" style="background:${t[r]}"></span> ${t[r]}</td><td>${f2(g.legend[i]!)}:1</td><td>≥ ${g.floor} legend, ≥ 3 ring</td></tr>`).join("");
  const cvd = (n: string, d: { d: number; by: string }, v: string): string => `<tr><td>apart from <code>--${n}</code> <span class="chip" style="background:${v}"></span> ${v}</td><td>${f3(d.d)}</td><td>${d.by}${d.d < LAYER_APART[col.high ? "high" : "normal"] ? ' <b class="miss">below ' + LAYER_APART[col.high ? "high" : "normal"] + "</b>" : ""}</td></tr>`;
  const states = STATES.map(([st, h, c]) => `<h3>${h}</h3><p class="cap">${c}</p><div class="pad">${padHtml(st, "⇟")}</div>`).join("");
  const signs = ["⇟", "▣"].map((s) => `<div class="cand"><div class="pad two">${keyHtml(ROWS[8]![0] as K, "rest", s)}${keyHtml(ROWS[9]![0] as K, "rest", s)}</div><p class="cap">${s} ${s === "⇟" ? "(U+21DF: a flick down, a page's jump)" : "(U+25A3: a block)"}</p></div>`).join("");
  return `<section class="col" style="${vars(t, g)}">
<h2>${col.name}</h2>
<p class="cap"><span class="chip big" style="background:${g.c}"></span> <code>--key-super: ${g.c}</code> (OKLCH ${f3(g.L)} ${f3(g.C)} ${H}°), label on it <code>${g.on}</code></p>
<table><tr><th>pair</th><th>measured</th><th>floor; for cvd the nearest view</th></tr>${legend}
<tr><td>label <code>${g.on}</code> on a green fill</td><td>${f2(g.onFill)}:1</td><td>≥ ${g.floor}</td></tr>
${cvd("key-shift", g.shift, t["key-shift"]!)}${cvd("key-alpha", g.alpha, t["key-alpha"]!)}</table>
${states}
<h3>The sign: two candidates (Shift and Fmt at rest)</h3><div class="signs">${signs}</div>
</section>`;
}

const CSS = `*{box-sizing:border-box}
body{margin:0;background:#1d2524;color:#e9efee;font:14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header,footer{max-width:1140px;margin:0 auto;padding:12px}
h1{font-size:19px;margin:4px 0}
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
.miss{color:var(--key-shift);font-weight:600}
.pad{display:grid;grid-template-columns:repeat(30,minmax(0,1fr));gap:4px;padding:4px;background:var(--panel)}
.pad.two{grid-template-columns:repeat(2,64px);width:max-content}
.k{position:relative;display:grid;grid-template-rows:14px 1fr;min-width:0;height:32px;border-radius:7px;background:var(--key-ctl);color:var(--key-text);font-size:14px;box-shadow:0 2px 0 var(--key-edge)}
.k.lt{grid-template-rows:12px 1fr 12px;height:42px}
.k.num{background:var(--key-num);font-size:19px}
.k.op{background:var(--key-op);font-size:19px}
.k.fn{background:var(--key-fn);font-size:16px}
.k.nav{background:var(--key-nav);font-size:12px}
.k.enter{background:var(--key-enter);color:var(--on-enter);font-size:15px}
.k.user{background:transparent;box-shadow:inset 0 0 0 1px var(--line);color:var(--muted)}
.pad.two .k{grid-column:span 1!important}
.lg{display:flex;justify-content:space-between;align-items:center;padding:0 3px;font-size:10px;line-height:12px;white-space:nowrap;overflow:hidden}
.sl{color:var(--key-shift);border-radius:3px;padding:0 2px;line-height:12px}
.k.enter .sl{color:var(--on-enter);opacity:.75}
.f{display:flex;align-items:center;justify-content:center;min-width:0;line-height:1;white-space:nowrap}
.f span{padding:1px 3px;border-radius:5px}
.al{align-self:end;justify-self:start;margin:0 0 1px 3px;padding:0 2px;border-radius:3px;font-size:10px;line-height:11px;color:var(--key-alpha);font-family:"Times New Roman",serif;font-style:italic}
i.v{font-family:"Times New Roman",serif;font-style:italic}
.mk{font-size:.7em;margin-left:1px;opacity:.85}
.sg{color:var(--key-super);font-style:normal;font-family:system-ui,sans-serif}
.k .sl .sg,.k .al .sg{font-size:12px;font-weight:600}
.circ{grid-row:1/4;grid-column:11/21;place-self:center;height:100%;aspect-ratio:1;border-radius:50%;background:var(--key-ctl);box-shadow:0 2px 0 var(--key-edge);position:relative;color:var(--key-text);font-size:12px}
.circ b{position:absolute;font-weight:400;opacity:.7;width:20px;height:20px;line-height:20px;text-align:center;border-radius:50%}
.circ .u{top:6%;left:50%;transform:translateX(-50%)}.circ .d{bottom:6%;left:50%;transform:translateX(-50%)}
.circ .l{left:7%;top:50%;transform:translateY(-50%)}.circ .r{right:7%;top:50%;transform:translateY(-50%)}
/* the super states: green is super mode's only */
.circ b.dead{color:var(--key-text-dead);opacity:1}
.circ b.glow{color:var(--key-super);opacity:1;box-shadow:inset 0 0 0 1.5px var(--key-super),0 0 7px 1px color-mix(in srgb,var(--key-super) 60%,transparent)}
.f.su{color:var(--key-super)}
.sl.su{color:var(--key-super)}
.sl.su-lgring{box-shadow:inset 0 0 0 1.5px var(--key-super)}
.k.su-ring{box-shadow:inset 0 0 0 2px var(--key-super),0 2px 0 var(--key-edge)}
.k.su-fill{background:var(--key-super);color:var(--on-key-super)}
.k.su-fill .sl,.k.su-fill .sg,.k.su-fill .al{color:var(--on-key-super)}
.f.on-ring span{box-shadow:inset 0 0 0 1.5px var(--on-key-super)}
.dim{color:var(--key-text-dead)!important}
.dimlg{color:var(--key-text-dead)!important;opacity:.8}
.signs{display:flex;gap:16px;margin:4px 8px}
.cand .pad{margin:0}
footer p,header p,footer li{color:#b9c8c6;font-size:13px}
footer b,header b{color:#fff}`;

export function page(H: number, greens: Green[]): string {
  const cols = COLUMNS.map((c, i) => columnHtml(c, greens[i]!, H)).join("\n");
  return `<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Super mode: the green look (R845)</title>
<!-- Generated by tools/probes/super-mode.ts --write from app/scripts/theme-gen.ts's final N62 palettes; edit the probe, not this page. -->
<style>
${CSS}
</style>
</head>
<body>
<header>
<h1>Super mode: the green look (R845, for R811 and R850)</h1>
<p>One green per column, all on OKLCH hue <b>${H}°</b> (R850 keeps the hue and moves the lightness per theme, as R154's ring). Every value shown meets its floor: a green legend <b>≥ 4.5:1</b> (<b>≥ 7:1</b> in High contrast) on every key ground it sits on, a ring or glow ≥ 3:1, the label on a green fill the same as a legend. The colour-vision distances (app/scripts/cvd.ts, the smallest of normal vision and the three deficiencies) are aimed at theme-gen's Shift-to-Alpha floor (0.12; 0.10 in High contrast); <b class="miss">below</b> marks where no green reaches it. The numbers are <code>node tools/probes/super-mode.ts</code>.</p>
</header>
<div class="cols">
${cols}
</div>
<footer>
<p><b>What each state means</b></p>
<ul>
<li><b>At rest:</b> super mode is off; only its sign shows, on Shift's bottom-left corner (Shift's flick down) and as Fmt's Shift legend (Shift + Fmt).</li>
<li><b>One action</b> (a flick down on Shift): the next key with a super job does it and the mode ends. Lit: ◀ ▶ (a green ring and a soft glow: the next or previous block), ⌫ (deletes the block left of the caret), U1–U6 (open the key's setup), Fmt's sign. ▲ ▼ fade: they have no super job. Every other key looks as at rest and does nothing while the mode is on.</li>
<li><b>Held</b> (Shift + Fmt): the same keys lit, Shift filled green; the mode stays until an exit.</li>
<li><b>Held, Shift pressed:</b> a lone Shift does not end the mode, it arms the chord: only Fmt's sign is lit.</li>
<li><b>The exits:</b> Esc, or Shift + Fmt again. In one action, the key that does its job ends it too.</li>
<li><b>Orange stays Shift's:</b> the green is super mode's only colour; Shift's legends, ring and fill keep their orange (R729), Alpha its teal.</li>
<li><b>The sign:</b> two candidates under each column, ⇟ and ▣; the keypads above draw ⇟. The owner picks one.</li>
</ul>
</footer>
</body>
</html>
`;
}

const { H, greens } = bestHue();
console.log("hue scan (OKLCH; per column: the pick, its smallest cvd distance from Shift or Alpha):");
for (const h of HUES) console.log(`  ${h}°  ` + COLUMNS.map((c) => { const g = pick(c, h); return g === null ? `${c.id} none` : `${c.id} ${g.c} ${f3(Math.min(g.shift.d, g.alpha.d))}`; }).join("  "));
console.log(`picked hue ${H}°`);
console.log("column | --key-super | OKLCH L C | legend on " + GROUNDS.join(", ") + " | on-fill | from shift (by) | from alpha (by) | cvd floor met");
COLUMNS.forEach((c, i) => {
  const g = greens[i]!;
  console.log(`${c.name} | ${g.c} | ${f3(g.L)} ${f3(g.C)} | ${g.legend.map(f2).join(", ")} (≥ ${g.floor}) | ${g.on} ${f2(g.onFill)} | ${f3(g.shift.d)} (${g.shift.by}) | ${f3(g.alpha.d)} (${g.alpha.by}) | ${g.apart ? "yes" : "no"}`);
});
if (process.argv.includes("--write")) {
  const out = join(dirname(fileURLToPath(import.meta.url)), "../../docs/mockups/super-mode.html");
  writeFileSync(out, page(H, greens));
  console.log(`wrote ${out}`);
}
