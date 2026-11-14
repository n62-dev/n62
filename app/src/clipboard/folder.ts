// SPDX-License-Identifier: GPL-3.0-or-later
// The sync folder (A65): on Android the user picks a folder once (the system folder picker, ACTION_OPEN_DOCUMENT_TREE) and
// our local plugin N62Files keeps the grant across restarts, so the app writes and reads files there with no dialog (a
// folder Syncthing syncs, say). No storage permission. On the web, with no folder picked, or after the user revoked the
// grant or removed the folder, every call answers "unavailable". Never throws. Load lazily (never in the start chunk).
// A100: folderAppend adds text to the end of a file ("wa"), never rewriting it, so a crash can't lose its earlier lines.

export type Unavailable = "unavailable";
export interface FolderFile {
  name: string;
  /** bytes */
  size: number;
  /** ms since the epoch; 0 when the provider does not say */
  modified: number;
}
export type PickResult = { name: string } | "cancelled" | Unavailable;
export type WriteResult = "written" | "failed" | Unavailable;
export type ReadResult = { text: string } | "missing" | "failed" | Unavailable;
/** The file's size in bytes before and after the append, as the provider reports it; -1 when it does not say. */
export type AppendResult = { result: "appended"; before: number; after: number } | "failed" | Unavailable;

type Answer<T extends string, X = object> = Promise<({ result: T } & X) | { result: "unavailable" }>;
interface N62FolderPlugin {
  pickFolder(): Answer<"picked" | "cancelled", { name?: string }>;
  folder(): Answer<"ok", { name: string }>;
  forget(): Promise<{ result: "ok" }>;
  write(o: { name: string; text: string }): Answer<"written">;
  read(o: { name: string }): Answer<"ok" | "missing", { text?: string }>;
  list(): Answer<"ok", { files: FolderFile[] }>;
  append(o: { name: string; text: string }): Answer<"appended", { before?: number; after?: number }>;
  deviceModel(): Answer<"ok", { model?: string }>;
}

/** A plain file name directly in the folder: the same rule as android/.../FolderNames.java. */
export function validName(name: string): boolean {
  if (name === "" || name === "." || name === ".." || /[/\\\0]/.test(name)) return false;
  return new TextEncoder().encode(name).length <= 255;
}

/** An APK from before A65 has the plugin but not these methods: Capacitor rejects with code UNIMPLEMENTED. */
function failure(e: unknown): "failed" | Unavailable {
  return (e as { code?: unknown } | null)?.code === "UNIMPLEMENTED" ? "unavailable" : "failed";
}

async function plugin(): Promise<N62FolderPlugin | undefined> {
  try {
    const { Capacitor, registerPlugin } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("N62Files")) return undefined;
    return registerPlugin<N62FolderPlugin>("N62Files");
  } catch {
    return undefined;
  }
}

/** Opens the system folder picker; on a pick the folder is kept (replacing an earlier one) and its name returned. */
export async function pickFolder(): Promise<PickResult> {
  const p = await plugin();
  if (!p) return "unavailable";
  try {
    const r = await p.pickFolder();
    if (r.result === "picked") return { name: typeof r.name === "string" ? r.name : "" };
    return r.result === "cancelled" ? "cancelled" : "unavailable";
  } catch {
    return "unavailable";
  }
}

/** The kept folder's name for Settings, or "unavailable" (none picked, the grant revoked, the folder gone). */
export async function folderName(): Promise<{ name: string } | Unavailable> {
  const p = await plugin();
  if (!p) return "unavailable";
  try {
    const r = await p.folder();
    return r.result === "ok" && typeof r.name === "string" ? { name: r.name } : "unavailable";
  } catch {
    return "unavailable";
  }
}

/** Drops the kept folder and gives its grant back. */
export async function forgetFolder(): Promise<void> {
  try {
    await (await plugin())?.forget();
  } catch {
    // nothing kept
  }
}

/** Creates `name` in the folder or replaces its content with `text` (UTF-8). */
export async function folderWrite(name: string, text: string): Promise<WriteResult> {
  const p = await plugin();
  if (!p) return "unavailable";
  if (!validName(name)) return "failed";
  try {
    const r = await p.write({ name, text });
    return r.result === "written" ? "written" : "unavailable";
  } catch (e) {
    return failure(e);
  }
}

/** Appends `text` (UTF-8) to the end of `name`, creating the file when absent; the earlier content is never rewritten. */
export async function folderAppend(name: string, text: string): Promise<AppendResult> {
  const p = await plugin();
  if (!p) return "unavailable";
  if (!validName(name)) return "failed";
  const size = (n: unknown): number => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : -1);
  try {
    const r = await p.append({ name, text });
    return r.result === "appended" ? { result: "appended", before: size(r.before), after: size(r.after) } : "unavailable";
  } catch (e) {
    return failure(e);
  }
}

/** The device's model name (Android's Build.MODEL), or "unavailable" on the web or with an older APK. */
export async function folderModel(): Promise<string | Unavailable> {
  const p = await plugin();
  if (!p) return "unavailable";
  try {
    const r = await p.deviceModel();
    return r.result === "ok" && typeof r.model === "string" ? r.model : "unavailable";
  } catch {
    return "unavailable";
  }
}

/** The text of `name` in the folder; "missing" when the folder has no such file. */
export async function folderRead(name: string): Promise<ReadResult> {
  const p = await plugin();
  if (!p) return "unavailable";
  if (!validName(name)) return "failed";
  try {
    const r = await p.read({ name });
    if (r.result === "ok") return typeof r.text === "string" ? { text: r.text } : "failed";
    return r.result === "missing" ? "missing" : "unavailable";
  } catch (e) {
    return failure(e);
  }
}

/** The files directly in the folder (sub-folders left out). */
export async function folderList(): Promise<FolderFile[] | Unavailable> {
  const p = await plugin();
  if (!p) return "unavailable";
  try {
    const r = await p.list();
    if (r.result !== "ok" || !Array.isArray(r.files)) return "unavailable";
    return r.files
      .filter((f) => typeof f?.name === "string")
      .map((f) => ({ name: f.name, size: Number(f.size) || 0, modified: Number(f.modified) || 0 }));
  } catch {
    return "unavailable";
  }
}
