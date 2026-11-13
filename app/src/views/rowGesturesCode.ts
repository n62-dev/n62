// SPDX-License-Identifier: GPL-3.0-or-later
// R276: the chunk of a history row's gestures (rowGestures.ts loads it when idle).
import { rowSwipe as swipe } from "./rowSwipe.ts";
import { longpress as hold } from "../apps/longpress.ts";

/** R196 fix round 2: `data-gestures` on a row's node once its gesture is attached. Until then a hold is a tap (rowGestures.ts:
 *  the chunk comes when idle), so a touch step of the e2e tests waits for it rather than racing the chunk under load. */
const mark = (node: HTMLElement): void => void (node.dataset["gestures"] = "");
export const rowSwipe: typeof swipe = (node, p) => (mark(node), swipe(node, p));
export const longpress: typeof hold = (node, run) => (mark(node), hold(node, run));
