// SPDX-License-Identifier: GPL-3.0-or-later
// R703 (F383): Android's WebView draws every font at the system font scale times its CSS size, the sizes fit.ts writes too,
// and getComputedStyle reports the zoomed size. A small model of that page (no layout engine here): a face's width is its
// characters times 0.6 em as drawn, a ▾ mark adds its own fixed size, also zoomed. On phase-1 the fit wrote the zoomed size
// back as CSS, so the WebView zoomed it again and the face stayed wider than its key.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MIN_FACE_PX, fitLegends, textZoom } from "./fit.ts";

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
  removeAttribute(a: string): void {
    this.attrs.delete(a);
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
  body: new El("body", 16),
  querySelector: () => null, // (no bar in the model)
  getElementById: () => ({}), // (the cut rule is in)
};

beforeEach(() => {
  const g = globalThis as Record<string, unknown>;
  g["document"] = doc;
  g["getComputedStyle"] = (e: El) => ({
    fontSize: `${e.drawnPx}px`,
    lineHeight: `${e.drawnPx * 1.1}px`,
    paddingTop: "0px",
    paddingBottom: "2px",
    // (the key's side padding; a face or legend has none in this model, R729: its scrollWidth is its text)
    paddingLeft: e.cls === "key" ? "4px" : "0px",
    paddingRight: e.cls === "key" ? "4px" : "0px",
    marginLeft: "0px",
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

/** A fit, and its second pass once the zoom's chunk is in (a macrotask: the import and its callback have run). */
const fit = async (pad: El): Promise<void> => {
  fitLegends(pad as unknown as HTMLElement);
  await import("./zoomFit.ts");
  await new Promise((r) => setTimeout(r, 0));
};
const inner = 50 - 8;

describe("fitLegends under the WebView's text zoom (R703)", () => {
  it("reads the zoom off the body's 16 px", () => {
    zoom = 1.5;
    expect(textZoom(doc as unknown as Document)).toBe(1.5);
  });

  for (const z of [1.5, 2])
    it(`brings a face back inside its key at font scale ${z}`, async () => {
      zoom = z;
      const { pad, face } = key("Select");
      await fit(pad);
      expect(face.scrollWidth).toBeLessThanOrEqual(inner);
      expect(face.drawnPx).toBeGreaterThanOrEqual(MIN_FACE_PX);
      expect(face.hasAttribute("data-cut")).toBe(false);
    });

  it("fits a face and its ▾ mark, whose size does not follow the face's", async () => {
    zoom = 2;
    const { pad, face } = key("Tmpl", { opens: true });
    await fit(pad);
    expect(face.scrollWidth).toBeLessThanOrEqual(inner + 6 + 1);
  });

  it("ellipses a face that does not fit at the floor as drawn, its text kept", async () => {
    zoom = 2;
    const { pad, face } = key("Deselected!");
    await fit(pad);
    expect(face.drawnPx).toBeCloseTo(MIN_FACE_PX, 1);
    expect(face.hasAttribute("data-cut")).toBe(true);
    expect(face.text).toBe("Deselected!");
    // the next fit, the text short enough now, takes the cut back (the zoom stays: the WebView keeps it while the app runs)
    face.text = "x";
    await fit(pad);
    expect(face.hasAttribute("data-cut")).toBe(false);
  });

  it("reads a zoom of 1 where the body's size cannot be read, and writes no NaN (a page without style.css)", async () => {
    const g = globalThis as Record<string, unknown>;
    const styles = g["getComputedStyle"] as (e: El) => Record<string, string>;
    g["getComputedStyle"] = (e: El) => (e === doc.body ? { ...styles(e), fontSize: "" } : styles(e));
    expect(textZoom(doc as unknown as Document)).toBe(1);
    const { pad, face } = key("Select");
    await fit(pad);
    expect(face.style["fontSize"]).toBe("11.3px");
  });

  it("writes the same sizes as before without a zoom", async () => {
    const { pad, face } = key("Select");
    await fit(pad);
    // 6 × 0.6 × 20 = 72 px wide in 42: 20 × 41 / 72 = 11.38…, floored to a tenth
    expect(face.style["fontSize"]).toBe("11.3px");
  });
});
