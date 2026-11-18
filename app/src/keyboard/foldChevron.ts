// SPDX-License-Identifier: GPL-3.0-or-later
// R724 (decisions.md P16): ⌄ on the entry field's lower-left corner, half on its outline; a tap folds the keypad as the
// line's swipe does (App.svelte counts it `fold.tap`). Plain DOM in the fold's chunk (keyboard/Fold.svelte puts it in the
// entry line's box and takes it out), so the start chunk carries none of it; its look is Fold.svelte's `.fold-chevron`.

/** Put ⌄ into `line` (the entry line's box); returns the remover. */
export function foldChevron(line: HTMLElement, label: string, onfold: () => void): () => void {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "fold-chevron";
  b.dataset["testid"] = "fold-chevron";
  b.setAttribute("aria-label", label);
  // our own markup, no user text
  b.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5.5 8 10.5l5-5"/></svg>';
  b.addEventListener("pointerdown", (e) => e.preventDefault()); // a tap keeps the caret in the line
  b.addEventListener("click", onfold);
  line.append(b);
  return () => b.remove();
}
