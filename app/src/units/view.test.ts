// SPDX-License-Identifier: GPL-3.0-or-later
// R24cf1: the unit view drops a result that arrives after a slot has changed (72 km/h → m/s, Enter, then km made into m
// while Working shows: the old 20 m/s must not show next to 72 m/h). R118: ⌫ on an empty slot steps back (dead on the
// first), and More… then Find closed without a pick leaves the view as it was.
import { describe, expect, it } from "vitest";
import type { IndexItem } from "../find/types.ts";
import { slotCatalogue, type PadAction } from "./slot.ts";
import type { Quantity, UnitError, UnitRequest } from "./types.ts";
import { UnitView, type ViewHost } from "./view.ts";
import { filledLatex } from "../input/unitFormula.ts";
import { unitLatex } from "../input/chipUnit.ts";

const unit = (id: string, title: string, si: string, dim: string): IndexItem =>
  ({ id: `unit:${id}`, kind: "unit", names: [id], title, tier: 0, insert: `\\unit{${id}}{\\mathrm{${id}}}`, si, dim });
const CAT = slotCatalogue([
  unit("m", "Meter", "1", "m1"), unit("km", "Kilometer", "1000", "m1"), unit("s", "Second", "1", "s1"), unit("h", "Hour", "3600", "s1"),
  { id: "pfx:k", kind: "pfx", names: ["k"], title: "Kilo (10^3)", tier: 0, insert: "\\pfx{k}{\\mathrm{k}}", si: "1000" },
]);
const U = (id: string): PadAction => ({ do: "unit", id });

/** A host whose evaluations resolve only when the test says so. */
function host(): { host: ViewHost; requests: UnitRequest[]; answer: (q: Quantity | UnitError) => void; dead: () => number; finds: (string | undefined)[] } {
  const requests: UnitRequest[] = [];
  const pending: ((q: Quantity | UnitError) => void)[] = [];
  const finds: (string | undefined)[] = [];
  let dead = 0;
  return {
    requests,
    finds,
    dead: () => dead,
    answer: (q) => pending.shift()?.(q),
    host: {
      write: () => {},
      evaluate: (req) => {
        requests.push(req);
        return new Promise((resolve) => pending.push(resolve));
      },
      find: (_into, dim) => void finds.push(dim),
      format: () => ({ format: "STD", digits: 12 }),
      alternatives: () => Promise.resolve([]),
      remember: () => Promise.resolve(),
      dead: () => void dead++,
      changed: () => {},
    },
  };
}

const RESULT = { value: { display: "20", approximate: false }, unit: "m/s" } as unknown as Quantity;

/** 72 km/h → m/s (R349: → Check turns the end slot on), Enter in the end slot: the evaluation is running. */
async function running(): Promise<{ view: UnitView; h: ReturnType<typeof host>; done: Promise<void> }> {
  const h = host();
  const view = new UnitView(CAT, "72", {}, h.host);
  view.start();
  for (const e of [U("km"), { do: "per" } as const, U("h")]) view.apply(e);
  view.setChecking(true);
  for (const e of [U("m"), { do: "per" } as const, U("s")]) view.apply(e);
  expect(view.activeId).toBe("end");
  const done = view.next();
  expect(view.shown).toEqual({ kind: "working" });
  expect(h.requests).toHaveLength(1);
  return { view, h, done };
}

describe("UnitView: a result that arrives after a slot changed", () => {
  it("shows the result when nothing changed while it ran", async () => {
    const { view, h, done } = await running();
    h.answer(RESULT);
    await done;
    expect(view.shown).toMatchObject({ kind: "result", text: "20", unit: "m/s" });
  });

  it("shows nothing when a slot changed while Working showed (km made into m)", async () => {
    const { view, h, done } = await running();
    view.step(-1); // (R808: ◀ would first walk the end slot's m ÷ s; the button crosses at once)
    expect(view.activeId).toBe("u1");
    view.apply({ do: "delete" });
    view.apply({ do: "delete" });
    view.apply({ do: "delete" });
    view.apply(U("m"));
    view.apply({ do: "per" });
    view.apply(U("h"));
    expect(view.model("u1")?.latex).not.toContain("km");
    h.answer(RESULT);
    await done;
    expect(view.shown).toEqual({ kind: "none" });
  });

  it("shows nothing when the first slot change is a pick from Find", async () => {
    const { view, h, done } = await running();
    view.apply(U("km")); // a pick from Find comes back through apply's default branch
    h.answer(RESULT);
    await done;
    expect(view.shown).toEqual({ kind: "none" });
  });

  it("shows nothing when a refused press changed what is shown while it ran", async () => {
    const { view, h, done } = await running();
    view.apply({ do: "power", n: 2 });
    view.apply({ do: "power", n: 2 });
    h.answer(RESULT);
    await done;
    expect(view.shown.kind).not.toBe("result");
  });
});

describe("UnitView: ⌫ on an empty slot steps back, as ⌫ at the start of a box on the entry line (R118, bu-11)", () => {
  const P = (id: string): PadAction => ({ do: "prefix", id });
  const DEL = { do: "delete" } as const;
  /** "1 + 2" with k m typed in the first slot, Enter: the second slot is active and empty. */
  function second(): { view: UnitView; h: ReturnType<typeof host> } {
    const h = host();
    const view = new UnitView(CAT, "1+2", {}, h.host);
    view.start();
    for (const e of [P("k"), U("m"), { do: "next" } as const]) view.apply(e);
    expect(view.activeId).toBe("u2");
    return { view, h };
  }

  it("on an empty slot that is not the first: to the slot before, which keeps its tokens; the next ⌫ removes its last", () => {
    const { view, h } = second();
    view.apply(DEL);
    expect(view.activeId).toBe("u1");
    expect(view.model("u1")?.slot).toEqual({ tokens: [{ prefix: "k", unit: "m" }] });
    expect(h.dead()).toBe(0);
    view.apply(DEL);
    expect(view.model("u1")?.slot).toEqual({ tokens: [] });
    expect(view.model("u1")?.armed).toEqual({ prefix: "k", sqrt: false });
    expect(view.reading.text).toBe("");
  });

  it("from the empty end slot too (R349: it removes the end slot)", () => {
    const { view } = second();
    view.setChecking(true);
    expect(view.activeId).toBe("end");
    view.apply(DEL);
    expect(view.activeId).toBe("u2");
    expect(view.ids).toEqual(["u1", "u2"]);
    view.apply(DEL);
    expect(view.activeId).toBe("u1");
  });

  it("on the first slot, empty: a dead key (the pulse), and nothing else changes", () => {
    const { view, h } = second();
    view.apply(DEL);
    view.apply(DEL);
    view.apply(DEL); // the armed k
    expect(view.model("u1")?.empty).toBe(true);
    expect(h.dead()).toBe(0);
    const shown = view.shown;
    view.apply(DEL);
    expect(h.dead()).toBe(1);
    expect(view.activeId).toBe("u1");
    expect(view.shown).toBe(shown);
  });

  it("a step back does not drop a running evaluation (no slot changed)", async () => {
    const h = host();
    const view = new UnitView(CAT, "72", {}, h.host);
    view.start();
    for (const e of [U("km"), { do: "per" } as const, U("h")]) view.apply(e);
    view.setChecking(true);
    const done = view.evaluate();
    view.apply(DEL); // the end slot is empty: it goes (the request is the same), u1 is active
    expect(view.activeId).toBe("u1");
    h.answer(RESULT);
    await done;
    expect(view.shown).toMatchObject({ kind: "result", text: "20" });
  });
});

describe("UnitView: More… keeps the result until a unit is picked (R118, vr-8)", () => {
  async function shownResult(): Promise<{ view: UnitView; h: ReturnType<typeof host> }> {
    const { view, h, done } = await running();
    h.answer(RESULT);
    await done;
    expect(view.shown.kind).toBe("result");
    return { view, h };
  }

  it("opens Find on the dimension and leaves the value line, the end slot and the active slot as they were", async () => {
    const { view, h } = await shownResult();
    const shown = view.shown;
    view.more("m1s-1");
    expect(h.finds).toEqual(["m1s-1"]);
    expect(view.shown).toBe(shown);
    expect(view.model("end")?.slot).toEqual({ tokens: [{ unit: "m" }, { unit: "s" }], per: 1 });
    expect(view.activeId).toBe("end");
  });

  it("Find closed without a pick: the next pad press is an ordinary press, not a pick (the end slot is not cleared)", async () => {
    const { view, h } = await shownResult();
    view.more("m1s-1");
    view.step(-1);
    view.apply(U("h"));
    expect(view.model("end")?.slot).toEqual({ tokens: [{ unit: "m" }, { unit: "s" }], per: 1 });
    expect(view.model("u1")?.slot.tokens).toHaveLength(3);
    expect(h.requests).toHaveLength(1);
  });

  it("a pick replaces the end slot, makes it active and evaluates", async () => {
    const { view, h } = await shownResult();
    view.step(-1);
    view.more("m1s-1");
    view.pickMore(U("km"));
    expect(view.activeId).toBe("end");
    expect(view.model("end")?.slot).toEqual({ tokens: [{ unit: "km" }] });
    expect(h.requests).toHaveLength(2);
    expect(view.shown).toEqual({ kind: "working" });
  });

  it("a pick of a prefix and a unit evaluates once the slot is whole", async () => {
    const { view, h } = await shownResult();
    view.more("m1s-1");
    view.pickMore({ do: "prefix", id: "k" });
    expect(view.model("end")?.empty).toBe(false);
    expect(h.requests).toHaveLength(1);
    view.pickMore(U("m"));
    expect(view.model("end")?.slot).toEqual({ tokens: [{ prefix: "k", unit: "m" }] });
    expect(h.requests).toHaveLength(2);
  });
});

describe("R258: a stored value of more than one letter in the unit view", () => {
  it("is read as the name when the session holds it, and refused as not stored when it does not", () => {
    const h = host();
    const view = new UnitView(CAT, "2\\operatorname{rate}", {}, { ...h.host, values: () => new Set(["rate"]) });
    expect(view.request().formula).toBe("2*rate");
    const gone = new UnitView(CAT, "2\\operatorname{rate}", {}, { ...h.host, values: () => new Set() });
    expect(() => gone.request()).toThrow("rate is not a stored name");
  });
});

describe("R352: the reading of an empty end slot says what it does", () => {
  const END_EMPTY = "Check against a unit: the result is converted to it, or refused if it does not fit";
  /** "5" with kg-like m in the first slot, → Check (R349): the end slot is active. */
  function atEnd(): UnitView {
    const view = new UnitView(CAT, "5", {}, host().host);
    view.start();
    view.apply(U("km"));
    view.setChecking(true);
    expect(view.activeId).toBe("end");
    return view;
  }

  it("an active, empty end slot reads the line", () => {
    const view = atEnd();
    expect(view.reading.text).toBe(END_EMPTY);
    expect(view.reading.marked).toBe(false);
  });

  it("an active, filled end slot reads the unit in words, as before (control)", () => {
    const view = atEnd();
    view.apply(U("km"));
    expect(view.reading.text).toBe("kilometer");
  });

  it("the end slot emptied again reads the line; an empty number slot reads nothing (control)", () => {
    const view = atEnd();
    view.apply(U("km"));
    view.apply({ do: "delete" });
    expect(view.reading.text).toBe(END_EMPTY);
    view.move(-1);
    expect(view.activeId).toBe("u1");
    expect(view.reading.text).toBe("kilometer");
    view.apply({ do: "delete" });
    expect(view.reading.text).toBe("");
  });
});

describe("R349: the end slot only after → Check", () => {
  /** A host that records what the field is set to (the formula with or without the end prompt) and the prompts written. */
  function field(): { h: ReturnType<typeof host>; values: string[]; locked: string[][] } {
    const h = host();
    const values: string[] = [];
    const locked: string[][] = [];
    h.host.reset = (latex, ids) => {
      values.push(latex);
      locked.push([...ids]);
    };
    return { h, values, locked };
  }
  const END_EMPTY = "Check against a unit: the result is converted to it, or refused if it does not fit";

  it("by default there is no end slot: Enter in the last slot evaluates, the request has no end (the result in its own unit)", () => {
    const { h } = field();
    const view = new UnitView(CAT, "5", {}, h.host);
    view.start();
    expect(view.checking).toBe(false);
    expect(view.ids).toEqual(["u1"]);
    expect(view.formula.latex).toBe("5\\placeholder[u1]{}");
    view.apply(U("km"));
    view.apply({ do: "next" });
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]?.formula).toBe("5*pasu1");
    expect(h.requests[0]?.end).toBeUndefined();
    expect(view.shown).toEqual({ kind: "working" });
  });

  it("Enter in a slot that is not the last still goes to the next slot (control)", () => {
    const { h } = field();
    const view = new UnitView(CAT, "1+2", {}, h.host);
    view.start();
    view.apply({ do: "next" });
    expect(view.activeId).toBe("u2");
    expect(h.requests).toHaveLength(0);
  });

  it("→ Check turns the end slot on, active and empty, with its reading; ✕ Check takes it off again", () => {
    const { h, values, locked } = field();
    const view = new UnitView(CAT, "72", {}, h.host);
    view.start();
    view.apply(U("km"));
    view.setChecking(true);
    expect(view.checking).toBe(true);
    expect(view.ids).toEqual(["u1", "end"]);
    expect(view.activeId).toBe("end");
    expect(view.model("end")?.empty).toBe(true);
    expect(view.reading.text).toBe(END_EMPTY);
    expect(values.at(-1)).toBe("72\\placeholder[u1]{}\\to\\placeholder[end]{}");
    expect(locked.at(-1)).toEqual(["u1", "end"]);
    view.apply(U("m"));
    view.setChecking(false);
    expect(view.checking).toBe(false);
    expect(view.ids).toEqual(["u1"]);
    expect(view.activeId).toBe("u1");
    expect(view.model("u1")?.slot).toEqual({ tokens: [{ unit: "km" }] });
    expect(values.at(-1)).toBe("72\\placeholder[u1]{}");
    expect(view.filled()).toEqual({ u1: { tokens: [{ unit: "km" }] } });
    // on again: empty, not the unit it held
    view.setChecking(true);
    expect(view.model("end")?.empty).toBe(true);
  });

  it("with the end slot on and filled, Enter there evaluates against it", () => {
    const { h } = field();
    const view = new UnitView(CAT, "72", {}, h.host);
    view.start();
    for (const e of [U("km"), { do: "per" } as const, U("h")]) view.apply(e);
    view.setChecking(true);
    for (const e of [U("m"), { do: "per" } as const, U("s"), { do: "next" } as const]) view.apply(e);
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]?.end).toEqual({ tokens: [{ unit: "m" }, { unit: "s" }], per: 1 });
  });

  it("⌫ in the empty end slot removes it; in a filled one it takes a token (control)", () => {
    const { h } = field();
    const view = new UnitView(CAT, "72", {}, h.host);
    view.start();
    view.setChecking(true);
    view.apply(U("m"));
    view.apply({ do: "delete" });
    expect(view.checking).toBe(true);
    expect(view.model("end")?.empty).toBe(true);
    view.apply({ do: "delete" });
    expect(view.checking).toBe(false);
    expect(view.activeId).toBe("u1");
    expect(h.dead()).toBe(0);
  });

  it("a picked row whose slots hold end opens with the end slot on and filled; one without, off", () => {
    const seed = { u1: { tokens: [{ unit: "km" }] }, end: { tokens: [{ unit: "m" }] } };
    const on = new UnitView(CAT, "5", {}, field().h.host, seed);
    expect(on.checking).toBe(true);
    expect(on.ids).toEqual(["u1", "end"]);
    expect(on.model("end")?.slot).toEqual({ tokens: [{ unit: "m" }] });
    const off = new UnitView(CAT, "5", {}, field().h.host, { u1: { tokens: [{ unit: "km" }] } });
    expect(off.checking).toBe(false);
    expect(off.ids).toEqual(["u1"]);
  });

  it("Tools › the end slot turns it on and makes it active", () => {
    const { h } = field();
    const view = new UnitView(CAT, "1+2", {}, h.host);
    view.start();
    view.toEnd();
    expect(view.checking).toBe(true);
    expect(view.activeId).toBe("end");
  });

  it("More… and an alternatives chip turn it on with their unit", async () => {
    const { h } = field();
    const view = new UnitView(CAT, "72", {}, h.host);
    view.start();
    for (const e of [U("km"), { do: "per" } as const, U("h"), { do: "next" } as const]) view.apply(e);
    h.answer(RESULT);
    await new Promise((r) => setTimeout(r, 0));
    expect(view.shown.kind).toBe("result");
    expect(view.checking).toBe(false);
    view.more("m1s-1");
    expect(view.checking).toBe(false); // (Find closed without a pick leaves the view as it was, R118)
    view.pickMore(U("km"));
    expect(view.checking).toBe(true);
    expect(view.activeId).toBe("end");
    expect(view.model("end")?.slot).toEqual({ tokens: [{ unit: "km" }] });

    const b = field();
    const v2 = new UnitView(CAT, "72", {}, b.h.host);
    v2.start();
    for (const e of [U("km"), { do: "per" } as const, U("h"), { do: "next" } as const]) v2.apply(e);
    const alt = { text: "m/s", kind: "si", slot: { tokens: [{ unit: "m" }, { unit: "s" }], per: 1 } };
    const q = { ...RESULT, dimension: "m1s-1" } as unknown as Quantity;
    b.h.host.alternatives = () => Promise.resolve([alt] as never);
    b.h.answer(q);
    await new Promise((r) => setTimeout(r, 0));
    expect(v2.shown.kind).toBe("result");
    const done = v2.pickAlt((v2.shown as { alts: readonly unknown[] }).alts[0] as never);
    expect(v2.checking).toBe(true);
    expect(v2.model("end")?.slot).toEqual(alt.slot);
    await new Promise((r) => setTimeout(r, 0)); // (the chip is remembered first)
    expect(b.h.requests.at(-1)?.end).toEqual(alt.slot);
    b.h.answer(q);
    await done;
  });

  it("a formula with no number has no slot to leave: the end slot stays on, ✕ Check is dead", () => {
    const { h } = field();
    const view = new UnitView(CAT, "x", {}, h.host);
    view.start();
    expect(view.canCheck).toBe(false);
    expect(view.checking).toBe(true);
    expect(view.ids).toEqual(["end"]);
    view.setChecking(false);
    expect(view.checking).toBe(true);
    expect(h.dead()).toBe(1);
  });
});

// R801: a tap on a slot makes it the active slot, as ◀ ▶ would reach it, with their refusal
describe("R801: goTo(id), a tap on a slot", () => {
  /** A host that records the prompts written (a draw is one write). */
  function drawn(): { h: ReturnType<typeof host>; writes: string[] } {
    const h = host();
    const writes: string[] = [];
    h.host.write = (id) => void writes.push(id);
    return { h, writes };
  }

  it("from u1 to u2 makes u2 active and draws both", () => {
    const { h, writes } = drawn();
    const view = new UnitView(CAT, "1+2", {}, h.host);
    view.start();
    writes.length = 0;
    view.goTo("u2");
    expect(view.activeId).toBe("u2");
    expect(writes.sort()).toEqual(["u1", "u2"]);
    expect(h.dead()).toBe(0);
    view.goTo("u1"); // and back: any slot, not only the next
    expect(view.activeId).toBe("u1");
  });

  it("a tap on the active slot changes nothing: nothing is drawn", () => {
    const { h, writes } = drawn();
    const view = new UnitView(CAT, "1+2", {}, h.host);
    view.start();
    writes.length = 0;
    view.goTo("u1");
    expect(view.activeId).toBe("u1");
    expect(writes).toEqual([]);
    expect(h.dead()).toBe(0);
  });

  it("with a prefix armed in u1 it is refused as ▶ refuses it: the message, a dead key, the slot unchanged", () => {
    const { h, writes } = drawn();
    const view = new UnitView(CAT, "1+2", {}, h.host);
    view.start();
    view.apply({ do: "prefix", id: "k" } as PadAction);
    writes.length = 0;
    view.goTo("u2");
    expect(view.activeId).toBe("u1");
    expect(writes).toEqual([]);
    expect(h.dead()).toBe(1);
    const shown = view.shown;
    expect(shown.kind).toBe("message");
    const b = drawn();
    const same = new UnitView(CAT, "1+2", {}, b.h.host);
    same.start();
    same.apply({ do: "prefix", id: "k" } as PadAction);
    same.move(1);
    expect(same.shown).toEqual(shown); // ◀ ▶'s own refusal
  });

  it("an id that is no slot is ignored; the end slot is reached while Check is on", () => {
    const { h } = drawn();
    const view = new UnitView(CAT, "1+2", {}, h.host);
    view.start();
    view.goTo("end");
    expect(view.activeId).toBe("u1");
    expect(h.dead()).toBe(0);
    view.setChecking(true);
    view.goTo("u2");
    view.goTo("end");
    expect(view.activeId).toBe("end");
  });
});

// R853 (owner, 2026-11-22): ← and → beside → Check move one whole slot, as a tap on that slot would (R801)
describe("R853: step(by), the ← and → buttons", () => {
  it("→ makes the next slot active, ← the one before, and both draw their slots", () => {
    const h = host();
    const writes: string[] = [];
    h.host.write = (id) => void writes.push(id);
    const view = new UnitView(CAT, "1+2+3", {}, h.host);
    view.start();
    view.apply(U("km")); // a filled slot is left like an empty one
    writes.length = 0;
    view.step(1);
    expect(view.activeId).toBe("u2");
    expect(writes.sort()).toEqual(["u1", "u2"]);
    view.step(1);
    expect(view.activeId).toBe("u3");
    view.step(-1);
    view.step(-1);
    expect(view.activeId).toBe("u1");
    expect(h.dead()).toBe(0);
  });

  it("is refused with a prefix armed: the message of ▶, a dead press, the slot and the prefix kept", () => {
    const h = host();
    const view = new UnitView(CAT, "1+2", {}, h.host);
    view.start();
    view.apply({ do: "prefix", id: "k" } as PadAction);
    view.step(1);
    expect(view.activeId).toBe("u1");
    expect(h.dead()).toBe(1);
    expect(view.shown.kind).toBe("message");
    const b = host();
    const same = new UnitView(CAT, "1+2", {}, b.host);
    same.start();
    same.apply({ do: "prefix", id: "k" } as PadAction);
    same.move(1);
    expect(view.shown).toEqual(same.shown);
    view.apply(U("m"));
    expect(view.model("u1")?.slot.tokens).toEqual([{ prefix: "k", unit: "m" }]);
  });

  it("is a dead press at the first and the last slot (the end slot while Check is on), and nothing changes", () => {
    const h = host();
    const writes: string[] = [];
    h.host.write = (id) => void writes.push(id);
    const view = new UnitView(CAT, "1+2", {}, h.host);
    view.start();
    writes.length = 0;
    view.step(-1);
    expect(view.activeId).toBe("u1");
    expect(h.dead()).toBe(1);
    view.step(1);
    view.step(1);
    expect(view.activeId).toBe("u2");
    expect(h.dead()).toBe(2);
    view.setChecking(true); // (the end slot comes active)
    view.step(-1);
    view.step(1);
    expect(view.activeId).toBe("end");
    expect(h.dead()).toBe(2);
    view.step(1);
    expect(h.dead()).toBe(3);
    expect(view.shown).toEqual({ kind: "none" });
  });

  it("from the chip row it leaves the row first, then moves", async () => {
    const h = host();
    const view = new UnitView(CAT, "72", {}, h.host);
    view.start();
    view.apply(U("km"));
    view.setChecking(true);
    view.apply(U("m"));
    const done = view.next();
    h.answer({ ...RESULT, dimension: "m1" } as unknown as Quantity);
    await done;
    expect(view.shown.kind).toBe("result");
    view.down();
    expect(view.row).toBe(0);
    view.step(-1);
    expect(view.row).toBe(-1);
    expect(view.activeId).toBe("u1");
  });
});

describe("R929: a constant's own unit after its chip, in the field only", () => {
  const own = (id: string): string | undefined => ({ planck: "J·s", k_B: "J/K" })[id];
  /** The view on `line` with the label (the host names the constants' units) and without, and the field's values. */
  function both(line: string): { on: UnitView; off: UnitView; values: string[] } {
    const values: string[] = [];
    const on = new UnitView(CAT, line, {}, { ...host().host, constUnit: own, reset: (latex) => void values.push(latex) });
    const off = new UnitView(CAT, line, {}, host().host);
    return { on, off, values };
  }

  it("the field shows h with J·s after it, 2h as 2[ ] h J·s, k_B with J/K, α with none; the line and the formula hold no label", () => {
    expect(both("\\const{planck}{h}").on.fieldLatex).toBe(`\\const{planck}{h}${unitLatex("J·s")}\\to\\placeholder[end]{}`);
    const two = both("2\\const{planck}{h}").on;
    expect(two.fieldLatex).toBe(`2\\placeholder[u1]{}\\const{planck}{h}${unitLatex("J·s")}`);
    expect(two.ids).toEqual(["u1"]);
    expect(two.line).toBe("2\\const{planck}{h}");
    expect(two.formula.latex).not.toContain("htmlStyle");
    expect(both("3\\const{k_B}{k_{\\mathrm{B}}}").on.fieldLatex).toContain(unitLatex("J/K"));
    expect(both("2\\const{alpha}{\\alpha}").on.fieldLatex).toBe("2\\placeholder[u1]{}\\const{alpha}{\\alpha}");
  });

  it("filledLatex and the request are the same with and without the label", () => {
    for (const line of ["\\const{planck}{h}", "2\\const{planck}{h}", "2\\const{planck}{h}\\times3\\const{k_B}{k_{\\mathrm{B}}}"]) {
      const { on, off } = both(line);
      on.start();
      off.start();
      on.apply(U("m"));
      off.apply(U("m"));
      expect(on.fieldLatex, line).not.toBe(off.formula.latex);
      expect(filledLatex(on.formula, () => true), line).toBe(filledLatex(off.formula, () => true));
      expect(on.request(), line).toEqual(off.request());
      expect(JSON.stringify(on.request()), line).not.toMatch(/htmlStyle|J·s|J\/K/);
    }
  });

  it("→ Check sets the field again with the label (the end slot after it)", () => {
    const { on, values } = both("2\\const{planck}{h}");
    on.start();
    on.setChecking(true);
    expect(values.at(-1)).toBe(`2\\placeholder[u1]{}\\const{planck}{h}${unitLatex("J·s")}\\to\\placeholder[end]{}`);
  });
});

describe("R807: the active slot draws its caret, no other LaTeX holds it", () => {
  /** The last LaTeX written to each prompt. */
  function written(line: string): { view: UnitView; got: Record<string, string> } {
    const h = host();
    const got: Record<string, string> = {};
    h.host.write = (id, latex) => void (got[id] = latex);
    const view = new UnitView(CAT, line, {}, h.host);
    view.start();
    return { view, got };
  }
  const count = (s: string | undefined): number => (s?.match(/pas-caret/g) ?? []).length;

  it("after the last factor of the active slot, one mark; the other slot has none", () => {
    const { view, got } = written("5+6");
    view.apply(U("km"));
    expect(count(got["u1"])).toBe(1);
    expect(got["u1"]?.indexOf("pas-caret")).toBeGreaterThan(got["u1"]?.indexOf("km") ?? 99);
    expect(count(got["u2"])).toBe(0);
    view.next();
    expect(count(got["u1"])).toBe(0); // the slot left is drawn again, without it
    expect(count(got["u2"])).toBe(1);
  });

  it("in the middle: before the factor at the caret (R806's setter), and an empty slot has it before its □", () => {
    const { view, got } = written("5");
    expect(count(got["u1"])).toBe(1);
    expect(got["u1"]).toContain("square");
    for (const e of [U("km"), U("s")]) view.apply(e);
    (view.model("u1") as NonNullable<ReturnType<UnitView["model"]>>).caretAtForTest("num", 1);
    view.apply({ do: "prefix", id: "k" }); // (a draw at the caret: the armed prefix stands there)
    const latex = got["u1"] as string;
    expect(count(latex)).toBe(1);
    expect(latex.indexOf("km")).toBeLessThan(latex.indexOf("pas-caret"));
    expect(latex.indexOf("pas-caret")).toBeLessThan(latex.lastIndexOf("mathrm{s}"));
  });

  it("in an empty denominator the caret stands before its □; the model's LaTeX, the row's and Copy's never hold it", () => {
    const { view, got } = written("5");
    for (const e of [U("m"), { do: "per" } as const]) view.apply(e);
    expect(count(got["u1"])).toBe(1);
    expect(got["u1"]).toContain("pas-empty");
    const m = view.model("u1") as NonNullable<ReturnType<UnitView["model"]>>;
    expect(m.latex).not.toContain("pas-caret");
    view.apply(U("s"));
    expect(view.drawn()).not.toContain("pas-caret");
    expect(m.latex).not.toContain("pas-caret");
    expect(m.latex).toBe(m.latexWith());
  });
});

describe("R808: ◀ ▶ ▲ ▼ walk a slot's factors before they cross to another slot", () => {
  /** "1+2": u1 holds nothing, u2 holds m s ÷ h (the caret at its end); the second slot is active. */
  function two(): { view: UnitView; h: ReturnType<typeof host>; written: Record<string, string> } {
    const h = host();
    const written: Record<string, string> = {};
    const view = new UnitView(CAT, "1+2", {}, { ...h.host, write: (id, latex) => void (written[id] = latex) });
    view.start();
    view.apply(U("km"));
    view.apply({ do: "next" });
    for (const e of [U("m"), U("s"), { do: "per" } as const, U("h")]) view.apply(e);
    expect(view.activeId).toBe("u2");
    return { view, h, written };
  }
  const caret = (view: UnitView, id = view.activeId) => (view.model(id) as NonNullable<ReturnType<UnitView["model"]>>).caret;

  it("◀ in a slot with factors moves the caret first, and crosses only at the slot's start, landing at the end of the slot before", () => {
    const { view, h } = two();
    expect(caret(view)).toEqual({ side: "den", i: 1 });
    view.move(-1);
    expect(caret(view)).toEqual({ side: "den", i: 0 });
    view.move(-1);
    expect(caret(view)).toEqual({ side: "num", i: 2 });
    view.move(-1); view.move(-1);
    expect(caret(view)).toEqual({ side: "num", i: 0 });
    expect(view.activeId).toBe("u2");
    view.move(-1); // the slot's start: crosses
    expect(view.activeId).toBe("u1");
    expect(caret(view)).toEqual({ side: "num", i: 1 });
    view.move(-1); view.move(-1); // the first slot's start: a dead key
    expect(view.activeId).toBe("u1");
    expect(h.dead()).toBe(1);
  });

  it("▶ walks to the end and crosses to the start of the slot after", () => {
    const { view } = two();
    view.step(-1);
    expect(caret(view)).toEqual({ side: "num", i: 1 });
    view.move(1);
    expect(view.activeId).toBe("u2");
    expect(caret(view)).toEqual({ side: "num", i: 0 });
    for (let i = 0; i < 4; i++) view.move(1);
    expect(caret(view)).toEqual({ side: "den", i: 1 });
    expect(view.activeId).toBe("u2");
  });

  it("a move draws the caret where it went; the reading and the slot stay", () => {
    const { view, written } = two();
    const before = [view.reading.text, JSON.stringify(view.model("u2")?.slot)];
    view.move(-1);
    expect(written["u2"]?.indexOf("pas-caret")).toBeLessThan(written["u2"]?.indexOf("mathrm{h}") as number);
    expect([view.reading.text, JSON.stringify(view.model("u2")?.slot)]).toEqual(before);
  });

  it("▲ and ▼ go between the numerator and the denominator; ▼ in a slot without ÷ keeps its job (the chips), ▲ with no row is dead", async () => {
    const { view, h } = two();
    view.arrowUp();
    expect(caret(view)).toEqual({ side: "num", i: 2 });
    view.arrowDown();
    expect(caret(view)).toEqual({ side: "den", i: 1 });
    expect(h.dead()).toBe(0);
    view.arrowDown(); // (the denominator, no result shown: dead as before)
    expect(h.dead()).toBe(1);
    // a slot with no ÷: ▼ enters the chips of a result
    const h2 = host();
    const v = new UnitView(CAT, "72", {}, h2.host);
    v.start();
    v.apply(U("km"));
    v.setChecking(true);
    v.apply(U("m"));
    const done = v.next();
    h2.answer({ ...RESULT, dimension: "m1" } as unknown as Quantity);
    await done;
    expect(v.shown.kind).toBe("result");
    v.arrowDown();
    expect(v.row).toBe(0);
    v.arrowUp();
    expect(v.row).toBe(-1);
  });

  it("a move with a prefix armed shows the refusal and leaves the caret; ⌫ at the denominator's start with units says so", () => {
    const { view, h } = two();
    view.apply({ do: "prefix", id: "k" });
    view.move(-1);
    expect(view.shown).toMatchObject({ kind: "message", text: "A prefix needs a unit after it" });
    expect(caret(view)).toEqual({ side: "den", i: 1 });
    expect(h.dead()).toBe(1);
    view.apply({ do: "delete" }); // the armed k
    view.move(-1);
    view.apply({ do: "delete" });
    expect(view.shown).toMatchObject({ kind: "message", text: "The denominator still has units" });
    expect(h.dead()).toBe(2);
    expect(view.model("u2")?.slot).toEqual({ tokens: [{ unit: "m" }, { unit: "s" }, { unit: "h" }], per: 2 });
  });

  it("a slot reached by ◀ from the next one takes ⌫ at its end (control)", () => {
    const { view } = two();
    view.step(-1);
    expect(caret(view)).toEqual({ side: "num", i: 1 });
    view.apply({ do: "delete" });
    expect(view.model("u1")?.empty).toBe(true);
  });
});
