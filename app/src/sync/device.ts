// SPDX-License-Identifier: GPL-3.0-or-later
// The device's name in the sync folder (R128; owner, 2026-11-12, must-have B decision 6): the model (Android's
// Build.MODEL, A100's folderModel) and four random hex digits, made once per install and kept in the page's record
// (sync/record.ts, per install: a restore on another device never takes this one's name). Every file the app
// writes into the folder starts `n62-<device>-`, so two devices in one folder never write one name (G218). R183's row on the
// sync page edits it (renameDevice). Lazy: reached from the sync code and that page only.
import type { Kv } from "../state/storage.ts";
import { patchSync, readSync } from "./record.ts";

/** The longest device part of a name, in UTF-8 bytes: the name stays far under folderWrite's 246. */
const DEVICE_BYTES = 64;

/** The device name as it goes into a file name: a character a file name or Windows refuses (`/ \ : * ? " < > |`, a
 *  control character, a space) becomes `-`, runs of `-` become one, none at either end; cut to 64 UTF-8 bytes on a
 *  whole character (`bytes`); `device` when nothing is left. */
export function deviceSlug(device: string, bytes: number = DEVICE_BYTES): string {
  const s = device.replace(/[\s/\\:*?"<>|\p{Cc}]+/gu, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
  let out = "";
  for (const ch of s) {
    if (new TextEncoder().encode(out + ch).length > bytes) break;
    out += ch;
  }
  out = out.replace(/[-.]+$/, "");
  return out === "" ? "device" : out;
}

/** Four hex digits from `random` (0 ≤ r < 1). */
const hex4 = (random: () => number): string => Math.floor(random() * 0x10000).toString(16).padStart(4, "0");

/** A new name: the model's slug, cut so the digits always fit, and four hex digits (`Pixel-7-0a3f`). */
export function newDeviceName(model: string | undefined, random: () => number): string {
  return `${deviceSlug(model ?? "", DEVICE_BYTES - 5)}-${hex4(random)}`;
}

/**
 * The kept name, or a new one made and kept. `taken`: the names already in the folder (when it can be listed): a new
 * name no file in it starts with, so the app never writes a name it did not make. A kept name that is not a slug (an
 * edit gone wrong) is made again.
 */
export async function deviceName(kv: Kv, model: () => Promise<string | undefined>, random: () => number = Math.random, taken: readonly string[] = []): Promise<string> {
  const kept = (await readSync(kv)).device;
  if (kept !== undefined && deviceSlug(kept) === kept) return kept;
  const m = await model();
  let name = newDeviceName(m, random);
  for (let i = 0; i < 16 && taken.some((f) => f.startsWith(`n62-${name}-`)); i++) name = newDeviceName(m, random);
  await patchSync(kv, { device: name });
  return name;
}

/** The name as the user edits it (R183): sanitised as a made one is (deviceSlug) and kept in the page's record, so the
 *  next file the sync writes carries it. A blank edit keeps the old name (or leaves none: one is made at the first
 *  write). Returns the name kept, or "" when there is none yet. */
export async function renameDevice(kv: Kv, input: string): Promise<string> {
  if (input.trim() === "") return (await readSync(kv)).device ?? "";
  const name = deviceSlug(input);
  await patchSync(kv, { device: name });
  return name;
}
