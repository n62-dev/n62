// SPDX-License-Identifier: GPL-3.0-or-later
// R24cf1: the unit view drops a result that arrives after a slot has changed (72 km/h → m/s, Enter, then km made into m
// while Working shows: the old 20 m/s must not show next to 72 m/h). R118: ⌫ on an empty slot steps back (dead on the
// first), and More… then Find closed without a pick leaves the view as it was.
import { describe, expect, it } from "vitest";
import type { IndexItem } from "../find/types.ts";
import { slotCatalogue, type PadAction } from "./slot.ts";
import type { Quantity, UnitError, UnitRequest } from "./types.ts";
import { UnitView, type ViewHost } from "./view.ts";

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
    view.move(-1);
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
    view.move(-1);
    view.apply(U("h"));
    expect(view.model("end")?.slot).toEqual({ tokens: [{ unit: "m" }, { unit: "s" }], per: 1 });
    expect(view.model("u1")?.slot.tokens).toHaveLength(3);
    expect(h.requests).toHaveLength(1);
  });

  it("a pick replaces the end slot, makes it active and evaluates", async () => {
    const { view, h } = await shownResult();
    view.move(-1);
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
