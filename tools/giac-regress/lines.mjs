// SPDX-License-Identifier: GPL-3.0-or-later
// G188f2: the line runner of run.mjs, apart so a test can drive it with a stand-in engine. A line that traps the engine (an exception
// from eval, `RuntimeError: memory access out of bounds` on stock Giac at the g188-int-* lines of n62-patched.cas) counts as failed;
// the run goes on in a fresh engine that has run the file's preamble (its lines without a pc id) again, so every later line is counted.

/** The case id of a line (`pc("<id>",…)`), or undefined for a preamble line. */
export const lineId = (line) => /pc\("([^"]*)"/.exec(line)?.[1];

/** The lines of a .cas text that are run: no blank lines, comments or print calls. */
export const runLinesOf = (text) => text.split("\n").filter((l) => !(l.trim() === "" || l.startsWith("//") || l.startsWith("print(")));

/**
 * Runs a .cas text line by line on `giac` ({ eval(s): string }); `load()` gives a fresh engine (already set up, e.g. its timeout).
 * Returns each case line's result ({ id, ok, out, trapped }) and the engine to go on with (a fresh one after a trap).
 */
export async function runLines(text, giac, load) {
  const preamble = [];
  const results = [];
  let engine = giac;
  for (const line of runLinesOf(text)) {
    const id = lineId(line);
    let out;
    let trapped = false;
    try {
      out = engine.eval(line);
    } catch (e) {
      trapped = true;
      out = `trapped: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`;
      engine = await load();
      for (const p of preamble) engine.eval(p);
    }
    if (id === undefined) {
      if (!trapped) preamble.push(line);
      continue;
    }
    const ok = !trapped && out.trim().split(",").pop() === "1"; // `Digits:=P:;` answers "Done" first
    results.push({ id, ok, out, trapped });
  }
  return { results, engine };
}

/** The whole text as one eval on a fresh engine, the way icas reads a file: pasn and pasfail, or the trap's message. */
export async function runWhole(text, load) {
  const engine = await load();
  try {
    engine.eval(text);
    return { n: Number(engine.eval("pasn").trim()), failed: Number(engine.eval("pasfail").trim()) };
  } catch (e) {
    return { trapped: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
}
