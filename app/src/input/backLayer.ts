// SPDX-License-Identifier: GPL-3.0-or-later
// Android back as Esc for the open layer (R21b, backlog C8). A layer (a pick sheet, Settings in it since R49) pushes
// one history entry when it opens; the platform's back (the Android WebView's goBack(), a browser's back button,
// `history.back()`) pops it and closes the layer. A layer closed any other way (Esc, ×, a pick, a tap in the viewport)
// takes its entry back, so the history never grows and back with nothing open leaves the app. Layers can overlap (R53:
// a sheet over the folded keypad): one closed under another stays on the stack, released, and its entry goes back with
// the layer above it. No dependency.

interface Layer {
  readonly close: () => void;
  /** Closed some other way while a layer lay over it: its entry waits to go back with that layer's. */
  released?: boolean;
}

const stack: Layer[] = [];
/** Our own traversal has not reached its popstate yet: that popstate is ours, not the user's back. One at a time (two
 *  in a row can merge into one popstate). */
let popping = false;
/** Layers not pushed yet: opened in this task, pushed at its end, so a layer that gives way to another in the same
 *  update (the Mode sheet to another sheet) is taken back first, whatever order the two are seen in; and while one of
 *  our own pops is pending, until it arrives (a push before it would be undone). */
const opening: Layer[] = [];

/** Take back the released layers on top, in one traversal; a pending one runs this again when it lands. */
function takeBack(): void {
  if (popping) return;
  let n = 0;
  while (stack.at(-1)?.released) {
    stack.pop();
    n++;
  }
  if (n === 0) return;
  popping = true;
  history.go(-n);
}

let due = false;
function atTaskEnd(): void {
  if (due) return;
  due = true;
  queueMicrotask(settle);
}

function settle(): void {
  due = false;
  takeBack();
  if (!popping) for (const l of opening.splice(0)) push(l);
}
let listening = false;

function push(layer: Layer): void {
  try {
    history.pushState({ n62Layer: stack.length }, "");
  } catch {
    // no history here (a sandboxed frame): the layer works, back just leaves
  }
  stack.push(layer);
}

function onPop(): void {
  if (popping) {
    popping = false;
    settle();
    return;
  }
  const top = stack.pop();
  top?.close(); // the user's back: the layer closes; its release() finds it gone and does nothing
  takeBack(); // a released layer it lay over goes too
}

/** Open a layer: `close` runs when the platform's back pops it. Returns `release`, to call when the layer closes some other way. */
export function openLayer(close: () => void): () => void {
  if (!listening && typeof window !== "undefined") {
    window.addEventListener("popstate", onPop);
    listening = true;
  }
  const layer: Layer = { close };
  opening.push(layer);
  atTaskEnd();
  return () => {
    const o = opening.indexOf(layer);
    if (o >= 0) {
      opening.splice(o, 1); // closed before it was pushed: it never had an entry
      return;
    }
    if (!stack.includes(layer)) return; // popped by back already
    layer.released = true;
    atTaskEnd(); // (two layers closed in one update: one traversal, whatever order they are seen in)
  };
}
