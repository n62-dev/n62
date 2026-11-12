// SPDX-License-Identifier: GPL-3.0-or-later
// R276: a history row's gestures, the swipe (rowSwipe.ts) and the hold (apps/longpress.ts, the app's one long-press
// code), come in their own chunk (rowGesturesCode.ts), fetched when the browser is idle after the first row is drawn:
// the start chunk is pinned (size-check.ts). A row drawn before it is in gets them once it arrives; until then a tap
// works, and a drag across or a hold does nothing (the row's touch-action keeps the drag from the browser).
type Code = typeof import("./rowGesturesCode.ts");
type Action<P> = { update(p: P): void; destroy(): void };
let code: Code | undefined;
let loading: Promise<Code | undefined> | undefined;

function load(): Promise<Code | undefined> {
  return (loading ??= new Promise<void>((r) => ("requestIdleCallback" in window ? requestIdleCallback(() => r(), { timeout: 2000 }) : setTimeout(r, 500)))
    .then(() => import("./rowGesturesCode.ts"))
    .then((m) => (code = m), () => ((loading = undefined), undefined))); // (a failed load is tried again by the next row)
}

/** A Svelte action whose code is `pick(code)`, attached once the chunk is in. */
function lazy<P>(pick: (m: Code) => (node: HTMLElement, p: P) => Action<P>) {
  return (node: HTMLElement, p: P): Action<P> => {
    let now = p;
    let gone = false;
    let inner = code && pick(code)(node, now);
    if (!inner) void load().then((m) => void (m && !gone && (inner = pick(m)(node, now))));
    return {
      update(q) {
        now = q;
        inner?.update(q);
      },
      destroy() {
        gone = true;
        inner?.destroy();
      },
    };
  };
}

/** The swipe that deletes (rowSwipe.ts). */
export const rowSwipe = lazy((m) => m.rowSwipe);
/** The hold that copies (apps/longpress.ts). */
export const rowHold = lazy((m) => m.longpress);
