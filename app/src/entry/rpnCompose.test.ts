// SPDX-License-Identifier: GPL-3.0-or-later
// R251 (mh-D1, mh-D3): an RPN operation is one ordinary row. compose builds its LaTeX from `\res` chips, read from the
// key's own action; applyOp hands it to Session.submit (or, with a unit, to the unit view) through a port and changes
// the stack only when the row is done with a chip.
import { describe, expect, it } from "vitest";
import type { Chip, ChipTable } from "../input/chips.ts";
import { keyboard, type ActionBody, type Layer } from "../keyboard/keyboard.ts";
import type { HistoryItem, ItemStatus } from "../state/session.svelte.ts";
import { arityOf, RpnStack, type RpnLevel } from "./rpn.ts";
import { applyOp, compose, RPN_NOT_UNARY, type ComposePort } from "./rpnCompose.ts";

/** A level of row `uid` worth `value`: an exact chip, drawn as its value (as R250's L). */
const L = (uid: string, value = "1", inputs: string[] = [], chip: Partial<Chip> = {}): RpnLevel => ({
  uid,
  chip: { value, exact: true, ...chip },
  shown: value,
  inputs,
});
/** A σ level: an inexact chip with `unc`, resting on its own row. */
const S = (uid: string, value: string, unc: string, inputs = [`row:${uid}`]): RpnLevel => L(uid, value, inputs, { exact: false, unc });
const stackOf = (...top: RpnLevel[]): RpnStack => {
  const s = new RpnStack();
  for (const l of [...top].reverse()) s.push(l);
  return s;
};
/** The key's action in the layer, as the keypad hands it (the 2D form, never `line:`). */
const act = (id: string, layer: Layer = "primary"): ActionBody => {
  const a = keyboard.byId.get(id)?.actions[layer];
  if (!a) throw new Error(`${id}.${layer}: no action`);
  return a;
};
const run = (levels: readonly RpnLevel[], id: string, layer: Layer = "primary") => compose(levels, id, layer, act(id, layer));

describe("compose: the forms of the binary keys", () => {
  const two = [L("u2", "3"), L("u1", "2")];
  it("add numbers A (level 2) and B (level 1) in operand order", () => {
    const c = run(two, "add");
    expect(c?.latex).toBe("\\res{1}{2}+\\res{2}{3}");
    expect(c?.chips).toEqual({ "res:1": { value: "2", exact: true }, "res:2": { value: "3", exact: true } });
    expect(c?.units).toBe(false);
  });
  it("sub, mul, div and pow", () => {
    expect(run(two, "sub")?.latex).toBe("\\res{1}{2}-\\res{2}{3}");
    expect(run(two, "mul")?.latex).toBe("\\res{1}{2}\\times\\res{2}{3}");
    expect(run(two, "div")?.latex).toBe("\\frac{\\res{1}{2}}{\\res{2}{3}}");
    expect(run(two, "pow")?.latex).toBe("\\res{1}{2}^{\\res{2}{3}}");
  });
  it("two rows with equal shown values are two keys; so is one uid with two values", () => {
    expect(Object.keys(run([L("u2", "3"), L("u1", "3")], "add")?.chips ?? {})).toEqual(["res:1", "res:2"]);
    const c = run([L("u7", "5"), L("u7", "6")], "add");
    expect(c?.latex).toBe("\\res{1}{6}+\\res{2}{5}");
    expect(Object.keys(c?.chips ?? {})).toEqual(["res:1", "res:2"]);
  });
  it("mul after dup is one chip used twice: one key", () => {
    const s = stackOf(L("u7", "x"));
    s.dup();
    const c = run(s.levels, "mul");
    expect(c?.latex).toBe("\\res{1}{x}\\times\\res{1}{x}");
    expect(Object.keys(c?.chips ?? {})).toEqual(["res:1"]);
  });
  it("a negative base takes the whole chip, no bracket", () => {
    expect(run([L("u2", "2"), L("u1", "-3")], "pow")?.latex).toBe("\\res{1}{-3}^{\\res{2}{2}}");
  });
});

describe("compose: the unary keys", () => {
  const one = [L("u4", "5"), L("u1", "9")];
  it("fills #@ or #0 with level 1 only", () => {
    expect(run(one, "sq")?.latex).toBe("\\res{1}{5}^{2}");
    expect(run(one, "div", "shift")?.latex).toBe("\\res{1}{5}^{-1}");
    expect(run(one, "sin")?.latex).toBe("\\sin\\left(\\res{1}{5}\\right)");
    expect(run(one, "sq", "shift")?.latex).toBe("\\sqrt{\\res{1}{5}}");
    expect(run(one, "enter", "shift")?.latex).toBe("\\operatorname{approx}\\left(\\res{1}{5}\\right)");
    expect(Object.keys(run(one, "sin")?.chips ?? {})).toEqual(["res:1"]);
  });
  it("a key of arity 0, or too few levels: none", () => {
    expect(run(one, "frac")).toBeNull();
    expect(run(one, "emark")).toBeNull();
    expect(run([L("u1")], "add")).toBeNull();
    expect(compose([], "sin", "primary", act("sin"))).toBeNull();
  });
  it("a unit on an operand marks the line for the unit view", () => {
    const unit = { text: "m", dim: "m1", slot: { tokens: [{ unit: "m" }] } };
    expect(run([L("u2", "3", [], { unit }), L("u1", "2")], "mul")?.units).toBe(true);
  });
});

describe("compose: every key of keyboard.yaml is classified", () => {
  const SLOT = /#[0@]/g;
  it("each insert with #0 or #@ has an arity or is on RPN_NOT_UNARY; each unary has one slot and no #?", () => {
    const seen: string[] = [];
    for (const k of keyboard.keys)
      for (const layer of ["primary", "shift"] as const) {
        const a = k.actions[layer];
        const n = arityOf(k.id, layer);
        if (a?.kind === "insert" && a.latex.match(SLOT)) {
          const at = `${k.id}.${layer}`;
          seen.push(at);
          expect(n > 0 || at in RPN_NOT_UNARY, `${at}: classify it (arity in rpn.ts, or RPN_NOT_UNARY)`).toBe(true);
          expect(n > 0 && at in RPN_NOT_UNARY, `${at}: both`).toBe(false);
        }
        if (n === 1) {
          expect(a?.kind, `${k.id}.${layer}`).toBe("insert");
          const t = a?.kind === "insert" ? a.latex : "";
          expect(t.match(SLOT)?.length, `${k.id}.${layer}: one slot`).toBe(1);
          expect(t.includes("#?"), `${k.id}.${layer}: no #?`).toBe(false);
        }
        if (n > 0) expect(compose([L("u2", "3"), L("u1", "2")], k.id, layer, a as ActionBody), `${k.id}.${layer}`).not.toBeNull();
      }
    // the list names only keys that exist with such a slot (no stale entries)
    for (const at of Object.keys(RPN_NOT_UNARY)) expect(seen, at).toContain(at);
  });
});

/** A fake port: `answer` decides what the submitted row ends as; `null` = refused (busy). */
function fakePort(answer: { status: ItemStatus; chip?: Chip } | null) {
  const rows: HistoryItem[] = [];
  const calls: { via: "submit" | "units"; latex: string; chips: ChipTable }[] = [];
  let id = 1;
  const rowFor = (latex: string, chips: ChipTable) => {
    const row: HistoryItem = { id, uid: `new-${id++}`, view: "home", latex, status: "pending", resultLatex: "", text: "", approximate: false, chips, startedAt: 0 };
    rows.push(row);
    return Promise.resolve().then(() => {
      if (answer) row.status = answer.status;
      if (answer?.chip) row.resultLatex = answer.chip.value;
    });
  };
  const port: ComposePort = {
    submit: (latex, _giac, chips = {}) => {
      calls.push({ via: "submit", latex, chips });
      return answer ? rowFor(latex, chips) : undefined;
    },
    submitUnits: (latex, chips) => {
      calls.push({ via: "units", latex, chips });
      return answer ? rowFor(latex, chips) : undefined;
    },
    newest: () => rows[rows.length - 1],
    chipFor: (item) => (item.status === "done" ? answer?.chip : undefined),
    shownOf: (item) => `\\text{${item.resultLatex}}`,
  };
  return { port, calls, rows };
}

describe("applyOp: the binding to a row", () => {
  it("done with a chip: the operands go, one level with the row's uid and the inputs' union", async () => {
    const s = stackOf(S("u2", "3", "0.1"), S("u1", "2", "0.2", ["const:G", "row:u1"]), L("u0", "9"));
    const f = fakePort({ status: "done", chip: { value: "5", exact: false, unc: "0.22" } });
    expect(await applyOp(s, f.port, "add", "primary", act("add"))).toBe("done");
    expect(f.calls).toEqual([{ via: "submit", latex: "\\res{1}{2}+\\res{2}{3}", chips: { "res:1": S("u1", "2", "0.2").chip, "res:2": S("u2", "3", "0.1").chip } }]);
    expect(s.levels).toHaveLength(2);
    expect(s.levels[0]).toEqual({ uid: "new-1", chip: { value: "5", exact: false, unc: "0.22" }, shown: "\\text{5}", inputs: ["const:G", "row:u1", "row:u2"] });
    expect(s.levels[1]).toEqual(L("u0", "9"));
  });
  for (const status of ["error", "cancelled"] as const)
    it(`${status}: the levels are unchanged`, async () => {
      const s = stackOf(L("u2", "3"), L("u1", "2"));
      const before = s.levels;
      expect(await applyOp(s, fakePort({ status }).port, "div", "primary", act("div"))).toBe(status);
      expect(s.levels).toBe(before);
    });
  it("submit refused (busy): unchanged, answer busy", async () => {
    const s = stackOf(L("u1", "2"));
    const before = s.levels;
    expect(await applyOp(s, fakePort(null).port, "sin", "primary", act("sin"))).toBe("busy");
    expect(s.levels).toBe(before);
  });
  it("done with no chip: unchanged, the row stands, answer noChip", async () => {
    const s = stackOf(L("u1", "2"));
    const before = s.levels;
    const f = fakePort({ status: "done" });
    expect(await applyOp(s, f.port, "sin", "primary", act("sin"))).toBe("noChip");
    expect(s.levels).toBe(before);
    expect(f.rows).toHaveLength(1);
  });
  it("too few levels: no call, answer depth", async () => {
    const s = stackOf(L("u1", "2"));
    const f = fakePort({ status: "done", chip: { value: "1", exact: true } });
    expect(await applyOp(s, f.port, "mul", "primary", act("mul"))).toBe("depth");
    expect(f.calls).toEqual([]);
  });
  it("a key of arity 0: no call", async () => {
    const s = stackOf(L("u2", "3"), L("u1", "2"));
    const f = fakePort({ status: "done", chip: { value: "1", exact: true } });
    expect(await applyOp(s, f.port, "frac", "primary", act("frac"))).toBe("none");
    expect(f.calls).toEqual([]);
  });
  it("the stack moved while the row ran: the row stands, the stack is left as it is", async () => {
    const s = stackOf(L("u2", "3"), L("u1", "2"));
    const f = fakePort({ status: "done", chip: { value: "5", exact: true } });
    const p = applyOp(s, f.port, "add", "primary", act("add"));
    s.swap();
    const moved = s.levels;
    expect(await p).toBe("moved");
    expect(s.levels).toBe(moved);
  });
});

describe("applyOp: units and σ (mh-D3)", () => {
  const unit = { text: "m", dim: "m1", slot: { tokens: [{ unit: "m" }] } };
  it("an operand with a unit goes to the unit view, never to submit; its unit chip with σ is pushed whole", async () => {
    const s = stackOf(L("u2", "3", [], { unit }), L("u1", "2"));
    const out: Chip = { value: "6", exact: false, unc: "0.1", unit };
    const f = fakePort({ status: "done", chip: out });
    expect(await applyOp(s, f.port, "mul", "primary", act("mul"))).toBe("done");
    expect(f.calls.map((c) => c.via)).toEqual(["units"]);
    expect(f.calls[0]?.latex).toBe("\\res{1}{2}\\times\\res{2}{3}");
    expect(f.calls[0]?.chips).toEqual(run(stackOf(L("u2", "3", [], { unit }), L("u1", "2")).levels, "mul")?.chips);
    expect(s.levels).toHaveLength(1);
    expect(s.levels[0]?.chip).toBe(out);
  });
  it("its error leaves the levels", async () => {
    const s = stackOf(L("u2", "3", [], { unit }), L("u1", "2"));
    const before = s.levels;
    expect(await applyOp(s, fakePort({ status: "error" }).port, "mul", "primary", act("mul"))).toBe("error");
    expect(s.levels).toBe(before);
  });
  it("two σ levels with no unit go to submit", async () => {
    const s = stackOf(S("u2", "3", "0.1"), S("u1", "2", "0.2"));
    const f = fakePort({ status: "done", chip: { value: "6", exact: false, unc: "0.4" } });
    expect(await applyOp(s, f.port, "mul", "primary", act("mul"))).toBe("done");
    expect(f.calls.map((c) => c.via)).toEqual(["submit"]);
  });
  it("two identities sharing an input: no call, answer shared, levels unchanged", async () => {
    for (const s of [stackOf(S("u8", "3", "0.1", ["row:u7", "row:u8"]), S("u7", "2", "0.2")), stackOf(L("u7", "5", ["row:u7"]), L("u7", "6", ["row:u7"]))]) {
      const before = s.levels;
      const f = fakePort({ status: "done", chip: { value: "1", exact: true } });
      expect(await applyOp(s, f.port, "mul", "primary", act("mul"))).toBe("shared");
      expect(f.calls).toEqual([]);
      expect(s.levels).toBe(before);
    }
  });
  it("dup then mul on a σ level is allowed: one input", async () => {
    const s = stackOf(S("u7", "2", "0.2"));
    s.dup();
    const f = fakePort({ status: "done", chip: { value: "4", exact: false, unc: "0.8" } });
    expect(await applyOp(s, f.port, "mul", "primary", act("mul"))).toBe("done");
    expect(f.calls[0]?.latex).toBe("\\res{1}{2}\\times\\res{1}{2}");
    expect(s.levels[0]?.inputs).toEqual(["row:u7"]);
  });
});
