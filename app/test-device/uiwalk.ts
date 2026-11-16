// SPDX-License-Identifier: GPL-3.0-or-later
// T5 (docs/research/t5-ui/README in SUMMARY.md): the UI map and its walk on an emulator, over adb to the WebView of the test
// build (build.sh --test), the route of A32 (test-device/core.device.spec.ts). Every touch is a real touch through the WebView's
// input path (CDP Input.dispatchTouchEvent); Android's Back is the system key (adb input keyevent 4).
//
//   ANDROID_SERIAL=emulator-5560 node test-device/uiwalk.ts --profile phone --out ../tests/ui-walk [--roots home,cas] [--mode map|walk]
//
// map:  explores every state reachable from the roots (sheets, layers, overlays) and every edge out of it, and writes
//       its profile's part of ui-map.json: states (with a screenshot, an audit and the accessibility names) and edges (from, action, to,
//       ms, console errors, where Back and × lead).
// walk: replays every edge of an existing map and writes walk-<profile>.json: the state reached against the map's.
import { _android as android, type AndroidDevice, type CDPSession, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { audit, inventory, locate, readSig, type Audit, type Sig, type Target } from "./uiwalk-page.ts";

const PKG = "dev.n62.calc";
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const arg = (name: string, dflt: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] !== undefined ? (process.argv[i + 1] as string) : dflt;
};
const PROFILE = arg("profile", "phone");
const OUT = resolve(arg("out", "../tests/ui-walk"));
const MODE = arg("mode", "map");
const MAX_DEPTH = Number(arg("depth", "6"));
const MAX_EDGES = Number(arg("max-edges", "6000"));
const SAMPLE = Number(arg("sample", "1"));
const SHOTS = join(OUT, "shots", PROFILE);
mkdirSync(SHOTS, { recursive: true });

// ---- the model -----------------------------------------------------------------------------------------------------
type Action =
  | { k: "tap"; desc: string; nth: number; label: string }
  | { k: "back" }
  | { k: "outside" }
  | { k: "gesture"; name: string };

interface State {
  id: string;
  key: string;
  sig: Sig;
  root: string;
  path: Action[];
  label: string;
  shot: string;
  audit?: Audit;
  names?: { role: string; name: string; scope: string }[];
  variant?: string;
  foreign?: string;
}
interface Edge {
  from: string;
  action: Action;
  to: string;
  ms: number | null;
  line?: string;
  notice?: string;
  rows?: number;
  undo?: string;
  errors: string[];
  back?: string;
  backMs?: number | null;
  close?: string;
  closeHow?: string;
  note?: string;
}

const sigKey = (s: Sig): string => JSON.stringify({ ...s, echo: undefined });
const noSet = (s: Sig): string => JSON.stringify({ ...s, set: "", echo: undefined });
const actName = (a: Action): string =>
  a.k === "tap" ? `tap ${a.desc}${a.nth ? `#${a.nth}` : ""}` : a.k === "gesture" ? `gesture ${a.name}` : a.k;
const label = (s: Sig): string => {
  const parts = [s.view ? `${s.place}/${s.view}` : s.place];
  if (s.layer) parts.push(`[${s.layer}]`);
  if (s.folded) parts.push("[folded]");
  if (s.unit) parts.push("[unit view]");
  for (const o of s.ov) if (o !== "fold-slice" && o !== "find-preview") parts.push(`+${o}`);
  for (const m of s.sheets) parts.push(`› ${m}`);
  return parts.join(" ");
};

const states = new Map<string, State>();
const edges: Edge[] = [];
const errors: string[] = [];

// ---- the device -------------------------------------------------------------------------------------------------------
let device: AndroidDevice;
let page: Page;
let cdp: CDPSession;

let lastPid = -1;
async function attach(): Promise<void> {
  // a relaunch leaves the old WebView listed for a moment: wait for the new process's one
  const t0 = Date.now();
  let view = (await device.webViews()).find((v) => v.pkg() === PKG && v.pid() !== lastPid);
  while (!view && Date.now() - t0 < 40_000) {
    await new Promise((r) => setTimeout(r, 250));
    view = (await device.webViews()).find((v) => v.pkg() === PKG && v.pid() !== lastPid);
  }
  if (!view) view = await device.webView({ pkg: PKG }, { timeout: 10_000 });
  lastPid = view.pid();
  page = await view.page();
  cdp = await page.context().newCDPSession(page);
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 300)}`));
  await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.n62 !== undefined, undefined, { timeout: 40_000 });
  // time of the last lift and of the last change on screen outside the keypad (its press flag and pop are not the transition)
  await page.evaluate(() => {
    const w = window as unknown as { __t5?: { end: number; last: number; first: number } };
    if (w.__t5) return;
    const t = { end: 0, last: 0, first: 0 };
    w.__t5 = t;
    // a key fires on pointerup (before touchend), a status control on click (after it): the lift is the first of the two
    let down = false;
    addEventListener("touchstart", () => { down = true; }, true);
    const lift = (): void => { if (!down) return; down = false; t.end = performance.now(); t.last = 0; t.first = 0; };
    addEventListener("pointerup", lift, true);
    addEventListener("touchend", lift, true);
    new MutationObserver((list) => {
      for (const m of list) {
        const el = m.target instanceof Element ? m.target : m.target.parentElement;
        if (el && (el.closest("[data-testid=keys]") || el.closest("[data-testid=status] [data-testid=busy-status]"))) continue;
        t.last = performance.now();
        if (t.first === 0 && t.end > 0) t.first = t.last;
        return;
      }
    }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  });
}

async function launch(clear: boolean): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      // a system screen the app opened (the file picker of Restore, Save to, Share) stays on top of the app's task: close
      // it, and start the activity on a fresh task
      await device.shell("am force-stop com.android.documentsui; am force-stop com.android.intentresolver; am force-stop org.chromium.webview_shell");
      if (clear) await device.shell(`pm clear ${PKG}`);
      else await device.shell(`am force-stop ${PKG}`);
      await device.shell(`am start -S --activity-clear-task -n ${PKG}/.MainActivity`);
      await attach();
      await sleep(600);
      if (page.isClosed()) throw new Error("the page closed right after the start");
      await page.evaluate(() => document.readyState);
      return;
    } catch (e) {
      if (attempt >= 3) throw e;
      console.log(`  relaunch (${String(e).slice(0, 80)})`);
      await sleep(1500);
    }
  }
}

async function dismissTips(): Promise<void> {
  const got = page.getByTestId("tips-got-it");
  if (await got.isVisible().catch(() => false)) {
    await tapXY(...(await centre(got)));
    await sleep(300);
  }
}
async function centre(l: ReturnType<Page["getByTestId"]>): Promise<[number, number]> {
  const b = await l.boundingBox();
  if (!b) throw new Error("no box");
  return [b.x + b.width / 2, b.y + b.height / 2];
}

const touch = (type: "touchStart" | "touchMove" | "touchEnd", pts: { x: number; y: number; id?: number }[]): Promise<unknown> =>
  cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map((p, i) => ({ x: Math.round(p.x), y: Math.round(p.y), id: p.id ?? i + 1 })) });
async function tapXY(x: number, y: number): Promise<void> {
  await touch("touchStart", [{ x, y }]);
  await touch("touchEnd", []);
}
async function drag(x: number, y: number, dx: number, dy: number, ms: number, steps = 8): Promise<void> {
  await touch("touchStart", [{ x, y }]);
  for (let i = 1; i <= steps; i++) {
    await sleep(ms / steps);
    await touch("touchMove", [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps }]);
  }
  await touch("touchEnd", []);
}
async function hold(x: number, y: number, ms: number): Promise<void> {
  await touch("touchStart", [{ x, y }]);
  await sleep(ms);
  await touch("touchEnd", []);
}
const sig = async (): Promise<Sig> => page.evaluate(readSig); // async: before the first launch it rejects, never throws
const fg = async (): Promise<string> => {
  const out = await device.shell("dumpsys activity activities | grep -E 'topResumedActivity|ResumedActivity:' | head -1");
  const m = /\{[^ ]+ [^ ]+ ([^ }]+)/.exec(out.toString());
  return m?.[1] ?? "?";
};

// ---- gestures: named recipes, so an edge can be replayed --------------------------------------------------------------
const box = async (sel: string, last = true): Promise<{ x: number; y: number; w: number; h: number } | null> =>
  page.evaluate(
    ([sel, last]) => {
      const all = [...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().height > 0);
      const el = last ? all[all.length - 1] : all[0];
      if (!el) return null;
      el.scrollIntoView({ block: "nearest" });
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    },
    [sel, last] as const,
  );
const GESTURES: Record<string, () => Promise<void>> = {
  "row-hold-result": async () => { const b = await box("article.item [data-testid=result]"); if (b) await hold(b.x + b.w / 2, b.y + b.h / 2, 700); },
  "row-hold-input": async () => { const b = await box("article.item button.in"); if (b) await hold(b.x + b.w / 2, b.y + b.h / 2, 700); },
  "row-swipe-left": async () => { const b = await box("article.item"); if (b) await drag(b.x + b.w * 0.8, b.y + b.h / 2, -b.w * 0.6, 0, 200); },
  "row-swipe-right": async () => { const b = await box("article.item"); if (b) await drag(b.x + b.w * 0.2, b.y + b.h / 2, b.w * 0.6, 0, 200); },
  "row-tap-twice": async () => { const b = await box("article.item [data-testid=result]"); if (b) { await tapXY(b.x + b.w / 2, b.y + b.h / 2); await sleep(250); await tapXY(b.x + b.w / 2, b.y + b.h / 2); } },
  "line-swipe-down": async () => { const b = await box("[data-testid=entry]"); if (b) await drag(b.x + b.w / 2, b.y + b.h / 2, 0, 60, 150, 6); },
  "line-swipe-up": async () => { const b = await box("[data-testid=entry]"); if (b) await drag(b.x + b.w / 2, b.y + b.h / 2, 0, -60, 150, 6); },
  "line-hold": async () => { const b = await box("[data-testid=entry]"); if (b) await hold(b.x + b.w * 0.3, b.y + b.h / 2, 700); },
  "line-drag-side": async () => { const b = await box("[data-testid=entry]"); if (b) await drag(b.x + b.w * 0.7, b.y + b.h / 2, -120, 0, 250); },
  "slice-swipe-up": async () => { const b = await box("[data-testid=fold-slice]"); if (b) await drag(b.x + b.w / 2, b.y + b.h / 2, 0, -80, 150, 6); },
  "pad-drag-right": async () => { const b = await box("[data-testid=pad-hub]"); if (b) await drag(b.x + b.w / 2, b.y + b.h / 2, 60, 0, 300); },
  "pad-drag-up": async () => { const b = await box("[data-testid=pad-hub]"); if (b) await drag(b.x + b.w / 2, b.y + b.h / 2, 0, -60, 300); },
  "bksp-hold": async () => { const b = await box('[data-key="bksp"]'); if (b) await hold(b.x + b.w / 2, b.y + b.h / 2, 1200); },
  "mark-tap": async () => { const b = await page.evaluate(() => { const e = document.querySelector(".history .empty .faint"); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }); if (b) await tapXY(b.x, b.y); },
  "plot-pan": async () => { const b = await box(".board"); if (b) await drag(b.x + b.w / 2, b.y + b.h / 2, 80, 40, 300); },
  "plot-tap": async () => { const b = await box(".board"); if (b) await tapXY(b.x + b.w * 0.7, b.y + b.h / 2); },
  "plot-pinch-out": async () => {
    const b = await box(".board");
    if (!b) return;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    await touch("touchStart", [{ x: cx - 30, y: cy, id: 1 }, { x: cx + 30, y: cy, id: 2 }]);
    for (let i = 1; i <= 8; i++) { await sleep(30); await touch("touchMove", [{ x: cx - 30 - i * 10, y: cy, id: 1 }, { x: cx + 30 + i * 10, y: cy, id: 2 }]); }
    await touch("touchEnd", []);
  },
  "sheet-scroll": async () => { const b = await box("[role=menu] .list, [role=menu] .grid, [role=menu]"); if (b) await drag(b.x + b.w / 2, b.y + b.h * 0.8, 0, -b.h * 0.5, 300); },
};
const flick = (key: string, dir: "up" | "down"): (() => Promise<void>) => async () => {
  const b = await box(`[data-key="${key}"]`);
  if (b) await drag(b.x + b.w / 2, b.y + b.h / 2, 0, dir === "up" ? -32 : 32, 90, 4);
};

// ---- doing an action and waiting for the screen to settle -------------------------------------------------------------
async function perform(a: Action): Promise<void> {
  if (a.k === "back") {
    await device.shell("input keyevent 4");
    return;
  }
  if (a.k === "outside") {
    // a point in the view above the sheet: the status line's bottom plus a third of the room down to the sheet
    const p = await page.evaluate(() => {
      const st = document.querySelector("[data-testid=status]")?.getBoundingClientRect();
      const menus = [...document.querySelectorAll("[role=menu]")].filter((m) => m.getBoundingClientRect().height > 0);
      const m = menus[menus.length - 1]?.getBoundingClientRect();
      const top = st ? st.bottom : 0;
      const bottom = m ? m.top : innerHeight / 2;
      return { x: innerWidth / 2, y: top + Math.max(8, (bottom - top) / 3) };
    });
    await tapXY(p.x, p.y);
    return;
  }
  if (a.k === "gesture") {
    const m = /^flick-(up|down):(.+)$/.exec(a.name);
    const g = m ? flick(m[2] as string, m[1] as "up" | "down") : GESTURES[a.name];
    if (!g) throw new Error(`no gesture ${a.name}`);
    await g();
    return;
  }
  const at = await page.evaluate(locate, { desc: a.desc, nth: a.nth });
  if (!at) throw new Error(`gone: ${a.desc}#${a.nth}`);
  await tapXY(at.x, at.y);
}

/** Wait until the state stops changing; the time is from the lift to the last change on screen (keypad excluded). */
async function settle(after?: Action): Promise<{ s: Sig | null; ms: number | null; firstMs: number | null; fgName: string; notice?: string }> {
  const t0 = Date.now();
  let last = "";
  let stable = 0;
  let s: Sig | null = null;
  // a lazily loaded sheet (its chunk fetched on the first open after a start) can take a second: until something changed,
  // wait up to 1.5 s; after a change, until it holds for 4 polls
  let first = "";
  let changed = false;
  let seenNotice: string | undefined;
  while (Date.now() - t0 < 5000) {
    await sleep(40);
    const cur = await sig().catch(() => null);
    if (cur === null) break;
    const k = JSON.stringify(cur);
    if (first === "") first = k;
    const shown = /\|([^|]+)\|/.exec(cur.echo ?? "")?.[1];
    if (shown) seenNotice = shown;
    if (k !== first) changed = true;
    stable = k === last ? stable + 1 : 0;
    last = k;
    s = cur;
    if (stable >= 4 && Date.now() - t0 > (changed ? 250 : 1500)) break;
  }
  let ms: number | null = null;
  let firstMs: number | null = null;
  let hidden = true;
  if (s) {
    const t = await page.evaluate(() => { const w = window as unknown as { __t5?: { end: number; last: number; first: number } }; return { ...(w.__t5 ?? { end: 0, last: 0, first: 0 }), hidden: document.hidden || !document.hasFocus() }; }).catch(() => null);
    if (t) {
      ms = t.last > t.end && t.end > 0 ? Math.round(t.last - t.end) : null;
      firstMs = t.first > t.end && t.end > 0 ? Math.round(t.first - t.end) : null;
      hidden = t.hidden;
    }
  }
  // Back may move the app to the background a moment after the page last answered: ask Android then too
  if (after?.k === "back" && !hidden) await sleep(400);
  const fgName = hidden || after?.k === "back" ? await fg() : `${PKG}/.MainActivity`;
  return { s, ms, firstMs, fgName, notice: seenNotice };
}

// ---- states: record, screenshot, audit, accessibility names ---------------------------------------------------------
let nState = 0;
async function record(s: Sig | null, fgName: string, root: string, path: Action[]): Promise<State> {
  const foreign = s === null || !fgName.startsWith(PKG) ? fgName : undefined;
  const key = foreign ? `${root}|foreign:${foreign}` : `${root}|${sigKey(s as Sig)}`;
  const old = states.get(key);
  if (old) return old;
  const id = `${PROFILE[0]}${String(++nState).padStart(3, "0")}`;
  const variantOf = foreign ? undefined : [...states.values()].find((o) => o.root === root && !o.foreign && noSet(o.sig) === noSet(s as Sig) && o.variant === undefined);
  const st: State = {
    id,
    key,
    sig: s ? { ...s, echo: undefined } : ({ place: "?", view: null, sheets: [], ov: [], layer: "", folded: false, unit: false, set: "" } as Sig),
    root,
    path: [...path],
    label: foreign ? `Android: ${foreign}` : label(s as Sig),
    shot: `shots/${PROFILE}/${id}.${foreign ? "png" : "jpg"}`,
    foreign,
    variant: variantOf?.id,
  };
  states.set(key, st);
  if (foreign) {
    writeFileSync(join(OUT, st.shot), await device.screenshot());
    return st;
  }
  await page.screenshot({ path: join(OUT, st.shot), type: "jpeg", quality: 70, scale: "css" }).catch(() => undefined);
  st.audit = await page.evaluate(audit);
  st.names = await axNames();
  console.log(`state ${id} ${st.label}${st.variant ? ` (settings variant of ${st.variant})` : ""}`);
  return st;
}

/** Chrome's own accessible names (what TalkBack is handed) for every control on screen. */
async function axNames(): Promise<{ role: string; name: string; scope: string }[]> {
  const ROLES = new Set(["button", "menuitem", "tab", "checkbox", "switch", "radio", "link", "textbox", "combobox", "slider", "menuitemcheckbox", "menuitemradio", "option", "spinbutton"]);
  type AXNode = { ignored?: boolean; role?: { value?: string }; name?: { value?: string }; backendDOMNodeId?: number };
  const tree = (await cdp.send("Accessibility.getFullAXTree").catch(() => ({ nodes: [] }))) as { nodes: AXNode[] };
  const out: { role: string; name: string; scope: string }[] = [];
  for (const n of tree.nodes) {
    const role = n.role?.value ?? "";
    if (n.ignored || !ROLES.has(role)) continue;
    out.push({ role, name: n.name?.value ?? "", scope: "" });
  }
  return out;
}

// ---- getting back to a state ------------------------------------------------------------------------------------------
interface Root { name: string; setup: () => Promise<void>; keys: "all" | "some" | "none"; gestures: string[] }
const tapKey = async (id: string): Promise<void> => {
  const at = await page.evaluate(locate, { desc: `key:${id}`, nth: 0 });
  if (!at) throw new Error(`no key ${id}`);
  await tapXY(at.x, at.y);
  await sleep(120);
};
const keys = async (ids: string[]): Promise<void> => { for (const id of ids) await tapKey(id); };
const tapTid = async (tid: string): Promise<void> => { await tapXY(...(await centre(page.getByTestId(tid).first()))); await sleep(700); };
const openApp = async (id: string): Promise<void> => {
  await tapTid("place");
  const at = await page.evaluate(locate, { desc: `row:${id}`, nth: 0 });
  if (!at) throw new Error(`no app row ${id}`);
  await tapXY(at.x, at.y);
  await sleep(1200);
};
const rows = async (): Promise<void> => {
  await keys(["d2", "add", "d3", "enter"]);
  await sleep(800);
  await keys(["d1", "div", "d3", "enter"]);
  await sleep(800);
};
const ALL_FLICKS = ["vars", "math", "tmpl", "x", "frac", "pow", "sin", "cos", "tan", "ln", "log", "sq", "neg", "paren", "comma", "emark", "d7", "d8", "d9", "div", "d4", "d5", "d6", "mul", "d1", "d2", "d3", "sub", "d0", "dot", "space", "add", "alpha", "shift", "menu", "esc", "undo", "redo", "select", "deselect", "fmt", "enter", "bksp"];
const ROOTS: Root[] = [
  { name: "tips", setup: async () => undefined, keys: "none", gestures: [] },
  { name: "home", setup: dismissTips, keys: "all", gestures: ["mark-tap", "line-swipe-down", "pad-drag-right", "pad-drag-up", ...ALL_FLICKS.flatMap((k) => [`flick-up:${k}`, `flick-down:${k}`])] },
  { name: "home-rows", setup: async () => { await dismissTips(); await rows(); }, keys: "some", gestures: ["row-hold-result", "row-hold-input", "row-swipe-left", "row-swipe-right", "row-tap-twice", "line-swipe-down", "line-hold", "line-drag-side", "bksp-hold", "sheet-scroll"] },
  { name: "home-line", setup: async () => { await dismissTips(); await keys(["d1", "add", "d2", "mul", "d3", "add", "d4", "mul", "d5", "add", "d6"]); }, keys: "some", gestures: ["line-hold", "line-drag-side", "pad-drag-right", "bksp-hold", "line-swipe-down"] },
  { name: "cas", setup: async () => { await dismissTips(); await openApp("cas"); }, keys: "all", gestures: ["line-swipe-down", "mark-tap"] },
  { name: "function", setup: async () => { await dismissTips(); await openApp("function"); await keys(["x", "sq", "sub", "d2", "enter"]); }, keys: "all", gestures: [] },
  { name: "function-plot", setup: async () => { await dismissTips(); await openApp("function"); await keys(["x", "sq", "sub", "d2", "enter"]); await tapTid("tab-plot"); }, keys: "all", gestures: ["plot-pan", "plot-tap", "plot-pinch-out"] },
  { name: "function-num", setup: async () => { await dismissTips(); await openApp("function"); await keys(["x", "sq", "sub", "d2", "enter"]); await tapTid("tab-num"); }, keys: "all", gestures: [] },
  { name: "solve", setup: async () => { await dismissTips(); await openApp("solve"); }, keys: "all", gestures: [] },
  // the unit view's own keypad (the unit pad, P14) and the folded keypad (results mode, R53): states with no sheet, so
  // they are roots of their own
  { name: "units", setup: async () => { await dismissTips(); await keys(["d7", "d2"]); await keys(["shift", "tmpl"]); await sleep(1200); }, keys: "all", gestures: [] },
  { name: "folded", setup: async () => { await dismissTips(); await rows(); await (GESTURES["line-swipe-down"] as () => Promise<void>)(); await sleep(500); }, keys: "none", gestures: ["slice-swipe-up", "row-tap-twice", "row-hold-result", "row-swipe-left"] },
];
// the sheets that are the same from every place: the home root expands them, the other roots record the edge only
const SHARED = /^(apps:|find:|store:|menu:(Mode|Templates|Symbols and Greek|Relations and logic|Matrix|N62|Base)\b)|› (Settings|Mode)\b/;
const LETTER_KEYS = new Set(["x", "d1", "bksp", "enter", "esc", "menu", "up", "down", "left", "right", "shift", "alpha", "vars", "math", "tmpl", "sin"]);
const SOME_KEYS = new Set(["up", "down", "left", "right", "menu", "esc", "enter", "bksp", "frac", "emark", "shift", "alpha", "fmt", "select", "deselect", "undo", "redo", "vars", "math", "tmpl"]);

let current: { root: Root; at: string } | null = null;
const rootKey = new Map<string, string>();
async function hardReset(root: Root): Promise<void> {
  await launch(true);
  await root.setup();
  await sleep(300);
}
/** Back to state `st`: the cheap way first (close what is open, clear the line), else a clean start and the path. */
async function goTo(st: State, root: Root): Promise<boolean> {
  const here = await sig().catch(() => null);
  const hereKey = here ? `${root.name}|${sigKey(here)}` : "";
  if (here && hereKey === st.key) {
    await page.evaluate(() => window.n62.entry.clear()).catch(() => undefined);
    return true;
  }
  // back at the root's resting state (an edge closed what it opened): replay the path from here, no relaunch
  if (here && hereKey === rootKey.get(root.name) && st.path.length > 0 && !(await page.evaluate(() => document.hidden).catch(() => true))) {
    try {
      await page.evaluate(() => window.n62.entry.clear());
      for (const a of st.path) {
        await perform(a);
        await settle(a);
      }
      const s = await sig().catch(() => null);
      if (s && `${root.name}|${sigKey(s)}` === st.key) return true;
    } catch {
      // fall through to the clean start
    }
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await hardReset(root);
      for (const a of st.path) {
        await perform(a);
        await settle(a);
      }
    } catch (e) {
      console.log(`  reset failed (${String(e).slice(0, 80)})`);
      continue;
    }
    const s = await sig().catch(() => null);
    if (s && `${root.name}|${sigKey(s)}` === st.key) {
      current = { root, at: st.id };
      return true;
    }
  }
  console.log(`  cannot reach ${st.id} ${st.label}`);
  return false;
}

// ---- the map ------------------------------------------------------------------------------------------------------------
async function actionsAt(st: State, root: Root, depth: number): Promise<Action[]> {
  const inv: Target[] = await page.evaluate(inventory);
  const out: Action[] = [];
  const inSheet = st.sig.sheets.length > 0;
  const top = st.sig.sheets.at(-1) ?? "";
  // a sheet that takes letters (Find, Vars, Memory, Store in): every key types into its filter, so a few stand for all
  const letters = /^(find|store):/.test(top);
  // inside a Find category the rows are content (functions, units), not the interface: record, do not go deeper
  const content = letters && top.includes(" › ");
  const rowsAll = inv.filter((t) => t.rowId !== undefined);
  const keepRow = new Set(rowsAll.length > 12 ? [...rowsAll.slice(0, 10), ...rowsAll.slice(-2)].map((t) => t.desc) : rowsAll.map((t) => t.desc));
  for (const t of inv) {
    if (t.covered) continue;
    if (t.rowId !== undefined && (!keepRow.has(t.desc) || content)) continue;
    if (t.key && letters && !LETTER_KEYS.has(t.key)) continue;
    if (t.key) {
      if (root.keys === "none") continue;
      if (root.keys === "some" && !SOME_KEYS.has(t.key)) continue;
      // keys under a sheet: only the uncovered ones (a tap on one closes the sheet); in a sheet below depth 1, two of them
      if (inSheet && depth > 1 && !["menu", "esc", "up"].includes(t.key)) continue;
    }
    out.push({ k: "tap", desc: t.desc, nth: t.nth, label: t.label });
  }
  if (!st.foreign) out.push({ k: "back" });
  if (inSheet) out.push({ k: "outside" });
  if (st.path.length === 0) for (const g of root.gestures) out.push({ k: "gesture", name: g });
  return out;
}

const isOpen = (s: State): boolean => s.sig.sheets.length > 0 || s.sig.ov.some((o) => !["fold-slice"].includes(o));
async function explore(root: Root): Promise<void> {
  console.log(`== root ${root.name}`);
  await hardReset(root);
  const s0 = await settle();
  const r = await record(s0.s, s0.fgName, root.name, []);
  rootKey.set(root.name, r.key);
  const queue: { st: State; depth: number }[] = [{ st: r, depth: 0 }];
  const done = new Set<string>();
  while (queue.length && edges.length < MAX_EDGES) {
    const { st, depth } = queue.shift() as { st: State; depth: number };
    if (done.has(st.id) || st.foreign || st.variant) continue;
    done.add(st.id);
    if (!(await goTo(st, root))) continue;
    const acts = await actionsAt(st, root, depth).catch(() => [] as Action[]);
    console.log(` expand ${st.id} (${acts.length} actions) ${st.label}`);
    for (const a of acts) {
      if (!(await goTo(st, root))) break;
      errors.length = 0;
      try {
        await perform(a);
      } catch (e) {
        edges.push({ from: st.id, action: a, to: st.id, ms: null, errors: [], note: `not done: ${String(e).slice(0, 120)}` });
        continue;
      }
      try {
        const res = await settle(a);
        if (res.s === null || !res.fgName.startsWith(PKG)) await sleep(800);
        const to = await record(res.s, res.fgName, root.name, [...st.path, a]);
        const au = to.foreign ? null : await page.evaluate(audit).catch(() => null);
        const e: Edge = { from: st.id, action: a, to: to.id, ms: res.ms, errors: [...errors], line: au?.line || undefined, notice: au?.notice || res.notice || undefined, rows: au?.rows, undo: au?.undo || undefined };
        edges.push(e);
        if (to.id !== st.id && !to.foreign && !to.variant && (st.path.length + 1 <= MAX_DEPTH) && isOpen(to) && !done.has(to.id) && to.root === root.name && (root.name === "home" || !SHARED.test(to.sig.sheets[0] ?? "")) && !(to.sig.layer !== "" && to.sig.sheets.length > 0)) queue.push({ st: to, depth: depth + 1 });
        // Back and close: from a new place, does Back (and the sheet's ×) lead to where we came from?
        // only where the action opened something (a sheet, a level, an overlay, a layer): an edge that closed one has nothing to go back from
        const opened = to.sig.sheets.length > st.sig.sheets.length || to.sig.ov.length > st.sig.ov.length || (to.sig.layer !== "" && st.sig.layer === "") || (to.sig.unit && !st.sig.unit) || (to.sig.sheets.length > 0 && to.sig.sheets.length === st.sig.sheets.length && to.sig.sheets.join() !== st.sig.sheets.join());
        if (to.id !== st.id && !to.foreign && a.k !== "back" && opened) {
          errors.length = 0;
          await perform({ k: "back" });
          const b = await settle({ k: "back" });
          const bs = await record(b.s, b.fgName, root.name, [...st.path, a, { k: "back" }]);
          e.back = bs.id;
          e.backMs = b.ms;
          if (errors.length) e.errors.push(...errors.map((x) => `after Back: ${x}`));
          if (to.sig.sheets.length > 0 && (await goTo(st, root))) {
            await perform(a);
            const again = await settle(a);
            const closeAt = again.s === null || `${root.name}|${sigKey(again.s)}` !== to.key ? null : await page.evaluate(() => {
              const menus = [...document.querySelectorAll("[role=menu]")].filter((m) => m.getBoundingClientRect().height > 0);
              const m = menus[menus.length - 1];
              const btns = m ? [...m.querySelectorAll(".head button")] : [];
              const x = btns[btns.length - 1];
              if (!x) return null;
              const r = x.getBoundingClientRect();
              return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: x.getAttribute("aria-label") ?? x.textContent ?? "" };
            });
            if (closeAt) {
              await tapXY(closeAt.x, closeAt.y);
              const c = await settle();
              const cs = await record(c.s, c.fgName, root.name, [...st.path, a, { k: "tap", desc: "close", nth: 0, label: closeAt.label }]);
              e.close = cs.id;
              e.closeHow = closeAt.label;
            }
          }
        }
      } catch (err) {
        console.log(`  edge ${st.id} ${actName(a)} failed: ${String(err).slice(0, 160)}`);
        edges.push({ from: st.id, action: a, to: st.id, ms: null, errors: [...errors], note: `walk failed: ${String(err).slice(0, 120)}` });
      }
      if (edges.length % 25 === 0) save();
    }
  }
}

function save(): void {
  // one file for every profile (ui-map.json); this run replaces its own profile's part only
  const file = join(OUT, "ui-map.json");
  const all = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as { profiles: Record<string, unknown> }) : { profiles: {} };
  const any = [...states.values()].find((s) => s.audit)?.audit;
  all.profiles[PROFILE] = { made: new Date().toISOString(), viewport: any ? { w: any.w, h: any.h } : null, states: [...states.values()], edges };
  writeFileSync(file, JSON.stringify(all));
}

// ---- the walk: replay every edge of a map ---------------------------------------------------------------------------
async function walk(): Promise<void> {
  const file = join(OUT, "ui-map.json");
  const all = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as { profiles: Record<string, { states: State[]; edges: Edge[] } | undefined> }) : { profiles: {} };
  const map = all.profiles[PROFILE];
  if (!map) throw new Error(`no ${PROFILE} map in ${file}: run --mode map first`);
  for (const s of map.states) {
    states.set(s.key, s);
    if (s.path.length === 0 && !s.foreign) rootKey.set(s.root, s.key); // so an edge back at the root's rest replays, no relaunch
  }
  const byId = new Map(map.states.map((s) => [s.id, s]));
  const results: { edge: number; from: string; action: string; expect: string; got: string; ok: boolean; ms: number | null; firstMs?: number | null; errors: string[]; notice?: string; rows?: number; undo?: string; line?: string }[] = [];
  const only = arg("roots", "");
  for (const root of ROOTS) {
    if (only && !only.split(",").includes(root.name)) continue;
    if (!map.edges.some((e) => byId.get(e.from)?.root === root.name)) continue;
    await hardReset(root);
    for (const [i, e] of map.edges.entries()) {
      const from = byId.get(e.from);
      const want = byId.get(e.to);
      if (!from || !want || from.root !== root.name) continue;
      // --sample N: every Nth edge, and every edge whose map record holds a console error, a note or a Back elsewhere
      const marked = e.errors.length > 0 || e.note !== undefined || (e.back !== undefined && e.back !== e.from);
      if (SAMPLE > 1 && i % SAMPLE !== 0 && !marked) continue;
      if (!(await goTo(from, root))) { results.push({ edge: i, from: e.from, action: actName(e.action), expect: e.to, got: "unreachable", ok: false, ms: null, errors: [] }); continue; }
      errors.length = 0;
      try { await perform(e.action); } catch (err) { results.push({ edge: i, from: e.from, action: actName(e.action), expect: e.to, got: `not done: ${String(err)}`, ok: false, ms: null, errors: [] }); continue; }
      const r = await settle(e.action);
      const gotKey = r.s && r.fgName.startsWith(PKG) ? `${root.name}|${sigKey(r.s)}` : `${root.name}|foreign:${r.fgName}`;
      const got = states.get(gotKey)?.id ?? `new ${r.s ? label(r.s) : r.fgName}`;
      const au = await page.evaluate(audit).catch(() => null);
      results.push({ edge: i, from: e.from, action: actName(e.action), expect: e.to, got, ok: got === e.to, ms: r.ms, firstMs: r.firstMs, errors: [...errors], notice: r.notice ?? au?.notice, rows: au?.rows, undo: au?.undo || undefined, line: au?.line || undefined });
      if (results.length % 50 === 0) writeFileSync(join(OUT, `walk-${PROFILE}.json`), JSON.stringify(results, null, 1));
    }
  }
  writeFileSync(join(OUT, `walk-${PROFILE}.json`), JSON.stringify(results, null, 1));
  const bad = results.filter((r) => !r.ok);
  console.log(`WALK ${PROFILE}: ${results.length - bad.length}/${results.length} edges as mapped`);
}

// ---- main ---------------------------------------------------------------------------------------------------------------
const serial = process.env["ANDROID_SERIAL"];
if (!serial) throw new Error("ANDROID_SERIAL is not set");
const found = (await android.devices()).find((d) => d.serial() === serial);
if (!found) throw new Error(`device ${serial} not attached`);
device = found;
await device.shell("settings put system screen_off_timeout 1800000; svc power stayon true");
try {
  if (MODE === "walk") await walk();
  else {
    // --append: keep this profile's states and edges and add the roots run now (a root that stopped, run again)
    if (process.argv.includes("--append") && existsSync(join(OUT, "ui-map.json"))) {
      const old = (JSON.parse(readFileSync(join(OUT, "ui-map.json"), "utf8")) as { profiles: Record<string, { states: State[]; edges: Edge[] } | undefined> }).profiles[PROFILE];
      const only = arg("roots", "").split(",");
      for (const st of old?.states ?? []) if (!only.includes(st.root)) states.set(st.key, st);
      const kept = new Set([...states.values()].map((x) => x.id));
      for (const e of old?.edges ?? []) if (kept.has(e.from)) edges.push(e);
      nState = Math.max(0, ...(old?.states ?? []).map((x) => Number(x.id.slice(1))));
    }
    const only = arg("roots", "");
    for (const root of ROOTS) {
      if (only && !only.split(",").includes(root.name)) continue;
      try { await explore(root); } catch (e) { console.log(`root ${root.name} stopped: ${String(e).slice(0, 300)}`); }
      save();
    }
    save();
    console.log(`MAP ${PROFILE}: ${states.size} states, ${edges.length} edges`);
  }
} finally {
  await device.shell(`am force-stop ${PKG}`).catch(() => undefined);
  await device.close().catch(() => undefined);
}
