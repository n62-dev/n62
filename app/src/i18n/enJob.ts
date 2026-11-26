// SPDX-License-Identifier: GPL-3.0-or-later
// The lines of a row whose engine stopped under it (state/jobRun.ts, G183: our own line, never a JS error's text). A table of
// its own, loaded with that lazy chunk, so the start chunk does not carry it (R871's cut under R91's pin). English only so far.
export const enJob = {
  "job.memory": "Out of memory: the engine was restarted",
  /** G183: a wasm trap or a stack overflow stopped the engine (F122); the stored names are back. */
  "job.crashed": "The engine stopped on this input and was restarted",
} as const;

export type JobKey = keyof typeof enJob;

export const jobText = (key: JobKey): string => enJob[key];
