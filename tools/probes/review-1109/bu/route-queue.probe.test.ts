// SPDX-License-Identifier: GPL-3.0-or-later
// bu: keys pressed before MathLive's field is up: does an operator after a queued digit see an "empty" line?
const A = new URL("../../../../app/src", import.meta.url).pathname;
const { EntryController } = await import(`${A}/entry/controller.ts`);
const route = await import(`${A}/keyboard/route.ts`);
const { keyboard } = await import(`${A}/keyboard/keyboard.ts`);
const { latexToGiac } = await import(`${A}/input/latex-to-giac.ts`);
function ctx(hasResult: boolean) {
  const entry = new EntryController();
  const session = { shift: false, alpha: false, shiftLock: false, settings: { entry: "textbook" }, items: [{ id: 1, status: "done", latex: "7" }], taps: { tap() {} }, clearModifiers() {}, hasResult: () => hasResult, undoRemoved: () => false, cycleForm: async () => { log.push("cycleForm"); return true; }, clearHistory: async () => { log.push("clearHistory"); return true; } };
  const log: string[] = [];
  const shell = { app: null, sheet: null, sheetPending: null, loading: null, prompt: null, opening: Promise.resolve(), showsEntry: true };
  const c = { session, shell, entry, picked: null, sheetLoad: null, waiting: [], casKeys: false, enter() {}, insertResult() {}, recallRow() {}, goTo() {}, clearKey() { if (entry.value === "") void session.clearHistory(); else entry.clear(); }, openSettings() {}, openMode() {}, openTemplates() {}, openShiftPalette() {}, openFind() {}, openNames() {}, withClip() {}, loadClip() {}, dead() { log.push("dead"); }, unfold: () => false };
  return { c, entry, log };
}
const press = (c: unknown, id: string, layer?: "primary" | "shift" | "alpha") => route.press(c as never, keyboard.byId.get(id), layer);
test("2 + 3 before the field: what will the line hold?", () => {
  const { c, entry } = ctx(true);
  press(c, "d2"); press(c, "add"); press(c, "d3");
  const e = entry as unknown as { pendingValue?: string; queue: { kind: string; text?: string; latex?: string }[] };
  console.log("PENDING", e.pendingValue, "QUEUE", JSON.stringify(e.queue.map((a) => a.text ?? a.latex)));
});
test("2 a b/c 3 before the field", () => {
  const { c, entry, log } = ctx(true);
  press(c, "d2"); press(c, "frac"); press(c, "d3");
  const e = entry as unknown as { pendingValue?: string; queue: { kind: string; text?: string; latex?: string }[] };
  console.log("PENDING", e.pendingValue, "QUEUE", JSON.stringify(e.queue.map((a) => a.text ?? a.latex)), "LOG", log.join(","));
});
test("the parser on what results", () => {
  const chips = { ans: { value: "7", exact: true } };
  for (const l of ["\\ans2+3", "3{,}\\frac{5^{2}}{2}", "3{,}\\left(5^{2}\\right)^{2}", "3{,}\\left(5^{2}\\right)^{-1}", "3.5^{2}"]) {
    let out: string;
    try { out = latexToGiac(l, { chips }); } catch (e) { out = "ERROR " + (e instanceof Error ? e.message : String(e)); }
    console.log("PARSE", l, "=>", out);
  }
});
