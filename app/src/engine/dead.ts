// SPDX-License-Identifier: GPL-3.0-or-later
// Only erasable TypeScript syntax: host.ts imports it and runs in Node.

/**
 * The message of a stack overflow, whole, in lower case (a set, not a pattern: the G88 ratchet): V8 (Chrome, Android
 * WebView, Node) and JavaScriptCore (Safari) throw a `RangeError` "Maximum call stack size exceeded", JavaScriptCore with a
 * full stop; SpiderMonkey (Firefox) an `InternalError` "too much recursion". Any other `RangeError` (toFixed's) is none.
 */
const STACK_OVERFLOW: ReadonlySet<string> = new Set(["maximum call stack size exceeded", "too much recursion"]);

/** Whether an error's message is a stack overflow's, compared in lower case without one closing full stop. */
function isStackOverflow(e: Error): boolean {
  const m = e.message.toLowerCase();
  return STACK_OVERFLOW.has(m.endsWith(".") ? m.slice(0, -1) : m);
}

/**
 * Whether a throw out of a request left the engine dead, and why (the client restarts it, G24, G183).
 * "memory" (G24): a failed allocation reaches us as a C++ exception (`WebAssembly.Exception`, from `new`) or as an abort
 * (GMP, or the heap at its cap). "crash" (G183): a wasm trap (`WebAssembly.RuntimeError`: `unreachable` F145, `memory
 * access out of bounds` G94) or a stack overflow (`STACK_OVERFLOW`, F122) unwound through Giac's frames: its stack
 * pointer and heap are not trusted after it. Null: a plain error, the engine lives on.
 */
export function deadEngine(e: unknown): "memory" | "crash" | null {
  const wasm = typeof WebAssembly !== "undefined" ? (WebAssembly as unknown as { Exception?: new () => object; RuntimeError?: new () => object }) : {};
  if (wasm.Exception && e instanceof wasm.Exception) return "memory";
  const text = e instanceof Error ? e.message : String(e);
  if (/\bOOM\b|out of memory|cannot enlarge memory|^Aborted/i.test(text)) return "memory";
  if (wasm.RuntimeError && e instanceof wasm.RuntimeError) return "crash";
  if (e instanceof Error && isStackOverflow(e)) return "crash";
  return null;
}

/** G318: a failure's text names memory: Emscripten's `OOM` and `Cannot enlarge memory`, `out of memory`, Chrome's
 *  `WebAssembly.Memory(): could not allocate memory`. */
export const namesMemory = (text = ""): boolean => /\bOOM\b|(out of|enlarge|allocate) memory/i.test(text);

/**
 * G318: why an init failed, by when it happened, not by deadEngine alone (that one classes a running engine, where any
 * abort is a heap at its cap): a trap or a stack overflow is a crash; memory when deadEngine says so of something that
 * is no abort (a C++ allocation failure) or the text names memory; else "load", a wasm or worker that did not load
 * (`Aborted(Error: ENOENT: no such file or directory, open '…/giac.wasm')`, `Aborted(both async and sync fetching of
 * the wasm failed)`).
 */
export function startDead(e: unknown): "memory" | "crash" | "load" {
  const text = e instanceof Error ? e.message : String(e);
  const dead = deadEngine(e);
  return dead === "crash" ? dead : namesMemory(text) || (dead && !text.startsWith("Aborted")) ? "memory" : "load";
}
