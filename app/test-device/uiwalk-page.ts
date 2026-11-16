// SPDX-License-Identifier: GPL-3.0-or-later
// T5 (docs/research/t5-ui): what the UI walk reads inside the WebView. Each export is a self-contained function handed to
// page.evaluate, so it may use nothing outside its own body (no imports, no closures over this module).

/** Where the user is: the place and view, the open sheets (testid and path), the overlays that change what a tap does,
 *  Shift/Alpha, results mode, the unit view, and a fingerprint of the settings (a changed setting is another state). */
export interface Sig {
  place: string;
  view: string | null;
  sheets: string[];
  ov: string[];
  layer: string;
  folded: boolean;
  unit: boolean;
  set: string;
  /** not part of the state: the line and the notice, so a typing key counts as a change while settling */
  echo?: string;
}

export function readSig(): Sig {
  const vis = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  };
  const n62 = window.n62;
  const shell = n62.shell;
  const place = shell.app ?? shell.homeView?.() ?? "home";
  const sheets = [...document.querySelectorAll("[role=menu]")].filter(vis).map((m) => {
    const tid = m.closest("[data-testid]")?.getAttribute("data-testid") ?? "?";
    const title = m.querySelector("[data-testid=sheet-title]")?.textContent?.trim() ?? m.getAttribute("aria-label") ?? "";
    return `${tid}:${title}`;
  });
  const OV = ["tips", "credits", "fold-slice", "row-actions", "matrix-grid", "matrix-menu", "unc-head", "engine-note", "update-note", "writer-note", "browser-note", "find-preview"];
  const ov = OV.filter((id) => [...document.querySelectorAll(`[data-testid="${id}"]`)].some(vis));
  for (const d of document.querySelectorAll("[role=dialog],[role=alertdialog]")) if (vis(d)) ov.push(`dialog:${d.getAttribute("aria-label") ?? d.getAttribute("data-testid") ?? "?"}`);
  const sh = document.querySelector('[data-key="shift"]');
  const al = document.querySelector('[data-key="alpha"]');
  const lk = (k: Element | null): string => (k?.getAttribute("data-locked") === "true" ? "-lock" : "");
  const layer = al?.getAttribute("aria-pressed") === "true" ? `alpha${lk(al)}` : sh?.getAttribute("aria-pressed") === "true" ? `shift${lk(sh)}` : "";
  const set = JSON.stringify((n62.session as unknown as { settings: unknown }).settings ?? null);
  let h = 0;
  for (let i = 0; i < set.length; i++) h = (Math.imul(h, 31) + set.charCodeAt(i)) | 0;
  return {
    place,
    view: shell.app ? shell.view : null,
    sheets,
    ov: ov.sort(),
    layer,
    folded: ov.includes("fold-slice"),
    unit: n62.unitView !== undefined,
    set: (h >>> 0).toString(36),
    echo: `${n62.entry.value}|${document.querySelector("[data-testid=notice]")?.textContent ?? ""}|${[...document.querySelectorAll("[data-testid=sheet-filter],[data-testid=sheet-hint],[role=menuitem][data-active=true],[data-testid=sheet-value]")].map((e) => e.textContent ?? e.getAttribute("data-id")).join("/")}`,
  };
}

/** One thing a finger can touch here: `desc` names it, `nth` tells equal names apart; `scope` is where it sits. */
export interface Target {
  desc: string;
  nth: number;
  scope: string;
  label: string;
  key?: string;
  rowId?: string;
  disabled: boolean;
  covered: boolean;
}

export function inventory(): Target[] {
  const vis = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  };
  const SEL = "button,[role=button],[role=menuitem],[role=tab],[role=switch],[role=checkbox],[role=radio],[role=option],a[href],input,select,textarea,[data-testid=result]";
  const menus = [...document.querySelectorAll("[role=menu]")].filter(vis);
  const top = menus[menus.length - 1];
  const out: Target[] = [];
  const seen = new Map<string, number>();
  for (const el of document.querySelectorAll(SEL)) {
    const inMenu = top?.contains(el) ?? false;
    // a row of a long sheet may sit below the fold: it counts (the walk scrolls it in), other things must show
    if (!vis(el) && !(inMenu && (el.getAttribute("role") === "menuitem"))) continue;
    if (el.closest("[aria-hidden=true]")) continue;
    const key = el.getAttribute("data-key") ?? undefined;
    const scope = key ? "keys" : inMenu ? "sheet" : el.closest("[data-testid=status]") ? "status" : el.closest("[role=menu]") ? "sheet-under" : el.closest("article") ? "history" : "screen";
    if (scope === "history") {
      const rows = [...document.querySelectorAll("article.item")];
      if (el.closest("article") !== rows[rows.length - 1]) continue; // the newest row stands for all rows
    }
    const tid = el.getAttribute("data-testid") ?? "";
    const aria = el.getAttribute("aria-label") ?? "";
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 24);
    const rowId = el.getAttribute("role") === "menuitem" ? (el.getAttribute("data-id") ?? undefined) : undefined;
    const desc = key ? `key:${key}` : rowId !== undefined ? `row:${rowId}` : `${scope}|${tid}|${aria}|${tid || aria ? "" : text}`;
    const nth = seen.get(desc) ?? 0;
    seen.set(desc, nth + 1);
    const r = el.getBoundingClientRect();
    const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    const covered = vis(el) && at !== null && at !== el && !el.contains(at);
    out.push({ desc, nth, scope, label: aria || text || tid, key, rowId, disabled: (el as HTMLButtonElement).disabled === true || el.getAttribute("aria-disabled") === "true", covered });
  }
  return out;
}

/** The centre of a target, scrolled into view first; null when it is gone. */
export function locate(t: { desc: string; nth: number }): { x: number; y: number; w: number; h: number } | null {
  const vis = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none";
  };
  const SEL = "button,[role=button],[role=menuitem],[role=tab],[role=switch],[role=checkbox],[role=radio],[role=option],a[href],input,select,textarea,[data-testid=result]";
  const menus = [...document.querySelectorAll("[role=menu]")].filter(vis);
  const top = menus[menus.length - 1];
  let n = 0;
  for (const el of document.querySelectorAll(SEL)) {
    if (el.closest("[aria-hidden=true]")) continue;
    const key = el.getAttribute("data-key");
    const inMenu = top?.contains(el) ?? false;
    const scope = key ? "keys" : inMenu ? "sheet" : el.closest("[data-testid=status]") ? "status" : el.closest("[role=menu]") ? "sheet-under" : el.closest("article") ? "history" : "screen";
    if (scope === "history") {
      const rows = [...document.querySelectorAll("article.item")];
      if (el.closest("article") !== rows[rows.length - 1]) continue;
    }
    const tid = el.getAttribute("data-testid") ?? "";
    const aria = el.getAttribute("aria-label") ?? "";
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 24);
    const rowId = el.getAttribute("role") === "menuitem" ? el.getAttribute("data-id") : null;
    const desc = key ? `key:${key}` : rowId !== null ? `row:${rowId}` : `${scope}|${tid}|${aria}|${tid || aria ? "" : text}`;
    if (desc !== t.desc) continue;
    if (n++ !== t.nth) continue;
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
  }
  return null;
}

/** The checks of one screen: overflow and clipping, tap targets under 48 dp, and the line's text. */
export interface Audit {
  w: number;
  h: number;
  pageScrollX: boolean;
  outside: string[];
  clipped: string[];
  ellipsed: string[];
  small: { what: string; w: number; h: number; pitchW: number; pitchH: number }[];
  line: string;
  notice: string;
  /** the history's finished rows and its undo note ("Row deleted · Undo"), so a row gesture's effect is on the edge */
  rows: number;
  undo: string;
}

export function audit(): Audit {
  const vis = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  };
  const name = (el: Element): string => {
    const tid = el.getAttribute("data-testid");
    const key = el.getAttribute("data-key");
    const aria = el.getAttribute("aria-label");
    const cls = (el.getAttribute("class") ?? "").split(/\s+/).filter((c) => c && !c.startsWith("svelte-")).slice(0, 2).join(".");
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 30);
    return key ? `key ${key}` : tid ? `#${tid}${text ? ` "${text}"` : ""}` : `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""}${aria ? ` [${aria}]` : text ? ` "${text}"` : ""}`;
  };
  // a scroller on purpose (overflow auto/scroll, or a row that scrolls sideways with a fade) is not clipping
  const scroller = (el: Element): boolean => {
    for (let e: Element | null = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (/(auto|scroll)/.test(cs.overflowX) || /(auto|scroll)/.test(cs.overflowY)) return true;
    }
    return false;
  };
  const outside: string[] = [];
  const clipped: string[] = [];
  const ellipsed: string[] = [];
  const W = innerWidth;
  const H = innerHeight;
  for (const el of document.querySelectorAll("#app *")) {
    if (!vis(el) || el.closest("[aria-hidden=true]")) continue;
    if (el instanceof SVGElement && !(el instanceof SVGSVGElement)) continue;
    const r = el.getBoundingClientRect();
    if ((r.right > W + 1 || r.left < -1) && !scroller(el.parentElement ?? el)) outside.push(`${name(el)} x ${Math.round(r.left)}..${Math.round(r.right)} of ${W}`);
    if (r.bottom > H + 1 && !scroller(el.parentElement ?? el) && (el.textContent ?? "").trim() !== "") outside.push(`${name(el)} y ..${Math.round(r.bottom)} of ${H}`);
    const cs = getComputedStyle(el);
    const hides = cs.overflowX === "hidden" || cs.overflowX === "clip" || cs.overflowY === "hidden" || cs.overflowY === "clip";
    if (!hides || (el.textContent ?? "").trim() === "") continue;
    const overW = el.scrollWidth > el.clientWidth + 1;
    const overH = el.scrollHeight > el.clientHeight + 2 && cs.overflowY !== "visible";
    if (!overW && !overH) continue;
    if (cs.textOverflow === "ellipsis" && overW) ellipsed.push(name(el));
    else if (!scroller(el)) clipped.push(`${name(el)} ${overW ? `w ${el.scrollWidth}>${el.clientWidth}` : ""}${overH ? ` h ${el.scrollHeight}>${el.clientHeight}` : ""}`.trim());
  }
  const SEL = "button,[role=button],[role=menuitem],[role=tab],[role=switch],[role=checkbox],[role=radio],a[href],input,[data-testid=result]";
  const small: Audit["small"] = [];
  const all = [...document.querySelectorAll(SEL)].filter((e) => vis(e) && !e.closest("[aria-hidden=true]"));
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width >= 48 && r.height >= 48) continue;
    // the pitch: the box grown to the nearest neighbour's edge on each side (a gap counts, as Material's target area does)
    let left = 0, right = W, up = 0, down = H;
    for (const o of all) {
      if (o === el || o.contains(el) || el.contains(o)) continue;
      const q = o.getBoundingClientRect();
      const vOverlap = q.top < r.bottom && q.bottom > r.top;
      const hOverlap = q.left < r.right && q.right > r.left;
      if (vOverlap && q.right <= r.left) left = Math.max(left, q.right);
      if (vOverlap && q.left >= r.right) right = Math.min(right, q.left);
      if (hOverlap && q.bottom <= r.top) up = Math.max(up, q.bottom);
      if (hOverlap && q.top >= r.bottom) down = Math.min(down, q.top);
    }
    const pitchW = Math.min(r.width + (r.left - left) / 2 + (right - r.right) / 2, r.width + 2 * Math.max(r.left - left, right - r.right));
    const pitchH = Math.min(r.height + (r.top - up) / 2 + (down - r.bottom) / 2, r.height + 2 * Math.max(r.top - up, down - r.bottom));
    small.push({ what: name(el), w: Math.round(r.width), h: Math.round(r.height), pitchW: Math.round(pitchW), pitchH: Math.round(pitchH) });
  }
  const root = document.scrollingElement;
  return {
    w: W,
    h: H,
    pageScrollX: root !== null && root.scrollWidth > W + 1,
    outside: outside.slice(0, 40),
    clipped: clipped.slice(0, 40),
    ellipsed: ellipsed.slice(0, 40),
    small,
    line: window.n62.entry.value,
    notice: document.querySelector("[data-testid=notice]")?.textContent?.trim() ?? "",
    rows: document.querySelectorAll("article.item").length,
    undo: document.querySelector("[data-testid=undo-note]")?.textContent?.trim() ?? "",
  };
}
