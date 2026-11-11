// SPDX-License-Identifier: GPL-3.0-or-later
// R284: the words of the engine-failed note (why, and the way on). A table of its own, loaded with the note
// (views/EngineFailed.svelte) when the engine has failed, so the start chunk does not carry it. English only so far.
export const enFail = {
  "load": "The engine could not be loaded. Check the connection and reload.",
  "memory": "This browser could not give the engine enough memory.",
  "crash": "The engine failed to start.",
  "reload": "Reload",
} as const;
