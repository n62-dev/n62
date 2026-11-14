// SPDX-License-Identifier: GPL-3.0-or-later
// author (night review 2026-11-14, vr-1): before MathLive's field is up a key waits in EntryController's queue, while an
// insert (Paste, a result chip, a Find constant, the store sheet's name) is appended to pendingValue; the field takes
// pendingValue first and replays the queue after it (controller.ts create). Prints what the field will hold.
const A = new URL("../../../../app/src", import.meta.url).pathname;
const { EntryController } = await import(`${A}/entry/controller.ts`);
const route = await import(`${A}/keyboard/route.ts`);
const { keyboard } = await import(`${A}/keyboard/keyboard.ts`);
type Q = { pendingValue?: string; queue: { kind: string; text?: string; latex?: string; insert?: string }[] };
function ctx() {
  const entry = new EntryController();
  const session = { shift: false, alpha: false, shiftLock: false, settings: { entry: "textbook" }, items: [{ id: 1, status: "done", latex: "5" }], home: [], cas: [], view: "home", taps: { tap() {} }, clearModifiers() {}, hasResult: () => true, undoRemoved: () => false };
  const shell = { app: null, sheet: null, sheetPending: null, loading: null, prompt: null, opening: Promise.resolve(), showsEntry: true };
  const c = { session, shell, entry, picked: null, sheetLoad: null, waiting: [], casKeys: false, enter() {}, insertResult() {}, recallRow() {}, goTo() {}, clearKey() {}, openSettings() {}, openMode() {}, openTemplates() {}, openShiftPalette() {}, openFind() {}, openNames() {}, openHelp() {}, openMatrix() {}, openStore() {}, withClip() {}, loadClip() {}, dead() {}, unfold: () => false };
  return { c, entry };
}
const press = (c: unknown, id: string) => route.press(c as never, keyboard.byId.get(id));
const line = (e: Q): string => (e.pendingValue ?? "") + e.queue.map((a) => a.text ?? a.latex ?? a.insert ?? `<${a.kind}>`).join("");
test("2, then ☰ Paste of 3 (clipboard/actions.svelte.ts pasteNow: entry.insert), before the field", () => {
  const { c, entry } = ctx();
  press(c, "d2");
  entry.insert("3");
  const e = entry as unknown as Q;
  console.log("PENDING", JSON.stringify(e.pendingValue), "QUEUE", JSON.stringify(e.queue.map((a) => a.text ?? a.latex ?? a.kind)), "FIELD", JSON.stringify(line(e)), "PRESSED 23");
});
test("2 ×, then a result chip (insertResult), then − 1, before the field", () => {
  const { c, entry } = ctx();
  press(c, "d2"); press(c, "mul");
  entry.insertResult("5", { value: "5", exact: true });
  press(c, "sub"); press(c, "d1");
  const e = entry as unknown as Q;
  console.log("PENDING", JSON.stringify(e.pendingValue), "QUEUE", JSON.stringify(e.queue.map((a) => a.text ?? a.latex ?? a.kind)), "FIELD", JSON.stringify(line(e)));
});
