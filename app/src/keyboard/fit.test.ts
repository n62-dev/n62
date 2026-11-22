// SPDX-License-Identifier: GPL-3.0-or-later
// R703 (F383): Android's WebView draws every font at the system font scale times its CSS size, the sizes fit.ts writes too,
// and getComputedStyle reports the zoomed size. A small model of that page (no layout engine here): a face's width is its
// characters times 0.6 em as drawn, a ▾ mark adds its own fixed size, also zoomed. On phase-1 the fit wrote the zoomed size
// back as CSS, so the WebView zoomed it again and the face stayed wider than its key.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MIN_FACE_PX, fitLegends, shrinkToFit, textZoom } from "./fit.ts";

let zoom = 1;

class El {
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  children: El[] = [];
  attrs = new Set<string>();
  constructor(
    public cls: string,
    /** The stylesheet's size (px), before the zoom. */
    public sheetPx = 16,
    public text = "",
    /** A fixed-size part that does not follow the element's font (the ▾ mark at its own CSS size), before the zoom. */
    public markPx = 0,
    public box = { w: 0, h: 0 },
  ) {}
  get specPx(): number {
    return this.style["fontSize"] ? parseFloat(this.style["fontSize"]) : this.sheetPx;
  }
  get drawnPx(): number {
    return this.specPx * zoom;
  }
  get scrollWidth(): number {
    return Math.ceil(this.text.length * 0.6 * this.drawnPx + this.markPx * zoom);
  }
  get scrollHeight(): number {
    return Math.ceil(this.drawnPx * 1.1);
  }
  get clientWidth(): number {
    return this.box.w;
  }
  get clientHeight(): number {
    return this.box.h;
  }
  getBoundingClientRect(): { height: number } {
    return { height: this.box.h };
  }
  querySelectorAll(sel: string): El[] {
    const all: El[] = [];
    const walk = (e: El): void => {
      for (const c of e.children) {
        all.push(c);
        walk(c);
      }
    };
    walk(this);
    if (sel === ".key") return all.filter((e) => e.cls === "key");
    if (sel === "[data-fit]") return all.filter((e) => e.dataset["fit"] !== undefined);
    const m = /^\[data-fit='(\w+)'\]$/.exec(sel);
    if (m) return all.filter((e) => e.dataset["fit"] === m[1]);
    throw new Error(`no selector ${sel} in the model`);
  }
  hasAttribute(a: string): boolean {
    return this.attrs.has(a);
  }
  toggleAttribute(a: string, on: boolean): void {
    if (on) this.attrs.add(a);
    else this.attrs.delete(a);
  }
  remove(): void {}
  append(): void {}
  get ownerDocument(): unknown {
    return doc;
  }
}

const doc = {
  createElement: () => {
    const e = new El("probe");
    Object.defineProperty(e.style, "cssText", { set: (v: string) => (e.sheetPx = parseFloat(/font-size:(\d+)px/.exec(v)?.[1] ?? "16")) });
    return e;
  },
  body: new El("body"),
};

beforeEach(() => {
  const g = globalThis as Record<string, unknown>;
  g["document"] = doc;
  g["getComputedStyle"] = (e: El) => ({
    fontSize: `${e.drawnPx}px`,
    lineHeight: `${e.drawnPx * 1.1}px`,
    paddingTop: "0px",
    paddingBottom: "2px",
    paddingLeft: "4px",
    paddingRight: "4px",
  });
});
afterEach(() => {
  zoom = 1;
  const g = globalThis as Record<string, unknown>;
  delete g["document"];
  delete g["getComputedStyle"];
});

/** A key 50 × 64 px with a legend line (12 px) above the face and one below it. */
function key(face: string, opts: { opens?: boolean; facePx?: number } = {}): { pad: El; face: El } {
  const pad = new El("pad");
  const k = new El("key", 20, "", 0, { w: 50, h: 64 });
  k.dataset["letters"] = "true";
  const sh = new El("shiftlegend", 11, "", 0, { w: 0, h: 12 });
  sh.dataset["fit"] = "legend";
  const f = new El("main", opts.facePx ?? 20, face, opts.opens ? 8 : 0);
  f.dataset["fit"] = "face";
  if (opts.opens) f.dataset["opens"] = "true";
  const al = new El("alphalegend", 11, "", 0, { w: 0, h: 12 });
  al.dataset["fit"] = "legend";
  k.children.push(sh, f, al);
  pad.children.push(k);
  return { pad, face: f };
}

const fit = (pad: El): void => fitLegends(pad as unknown as HTMLElement);
const inner = 50 - 8;

describe("fitLegends under the WebView's text zoom (R703)", () => {
  it("reads the zoom from a probe", () => {
    zoom = 1.5;
    expect(textZoom(doc as unknown as Document)).toBe(1.5);
  });

  for (const z of [1.5, 2])
    it(`brings a face back inside its key at font scale ${z}`, () => {
      zoom = z;
      const { pad, face } = key("Select");
      fit(pad);
      expect(face.scrollWidth).toBeLessThanOrEqual(inner);
      expect(face.drawnPx).toBeGreaterThanOrEqual(MIN_FACE_PX);
      expect(face.hasAttribute("data-cut")).toBe(false);
    });

  it("fits a face and its ▾ mark, whose size does not follow the face's", () => {
    zoom = 2;
    const { pad, face } = key("Tmpl", { opens: true });
    fit(pad);
    expect(face.scrollWidth).toBeLessThanOrEqual(inner + 6 + 1);
  });

  it("ellipses a face that does not fit at the floor as drawn, its text kept", () => {
    zoom = 2;
    const { pad, face } = key("Deselected!");
    fit(pad);
    expect(face.drawnPx).toBeCloseTo(MIN_FACE_PX, 1);
    expect(face.hasAttribute("data-cut")).toBe(true);
    expect(face.style["textOverflow"]).toBe("ellipsis");
    expect(face.text).toBe("Deselected!");
    // the next fit (a wider key) takes the cut back
    zoom = 1;
    face.text = "x";
    fit(pad);
    expect(face.hasAttribute("data-cut")).toBe(false);
  });

  it("writes the same sizes as before without a zoom", () => {
    const { pad, face } = key("Select");
    fit(pad);
    // 6 × 0.6 × 20 = 72 px wide in 42: 20 × 41 / 72 = 11.38…, floored to a tenth
    expect(face.style["fontSize"]).toBe("11.3px");
  });
});

describe("shrinkToFit (R703: the bar's and the rows' text)", () => {
  it("shrinks a text to its box under the zoom, then ellipses it at the floor", () => {
    zoom = 2;
    const e = new El("nm", 12, "Home", 0, { w: 40, h: 28 });
    expect(shrinkToFit(e as unknown as HTMLElement, 2, 8)).toBeGreaterThan(0);
    expect(e.scrollWidth).toBeLessThanOrEqual(40);
    const long = new El("nm", 12, "Significant digits", 0, { w: 40, h: 28 });
    shrinkToFit(long as unknown as HTMLElement, 2, 8);
    expect(long.drawnPx).toBe(8);
    expect(long.hasAttribute("data-cut")).toBe(true);
  });
  it("leaves a text that fits alone", () => {
    const e = new El("nm", 12, "Home", 0, { w: 60, h: 28 });
    expect(shrinkToFit(e as unknown as HTMLElement, 1, 8)).toBe(0);
    expect(e.style["fontSize"]).toBeUndefined();
  });
});
