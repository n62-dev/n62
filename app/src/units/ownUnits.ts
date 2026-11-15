// SPDX-License-Identifier: GPL-3.0-or-later
// G234: your own units (G233) in the stamped store under `units.own` (`{ units: [{ name, factor, of }] }`, ownRecord.ts):
// read once, written whole at every change, the same pattern as the unit pad cells (userCells.svelte.ts). The unit
// evaluator reads `list()` (units/calc.ts), Find lists them (find/names.svelte.ts ownUnitItem), the backup holds the key
// (state/backup.ts). Loaded with the unit view, never in the start chunk. Plain TS, not a rune store: the unit view's
// chunks are at their pin, and a sheet that lists the units reads `list()` when it is drawn (R201).
import { idbKv, type Kv } from "../state/storage.ts";
import { readRecord, UNITS_OWN, type UnitDef } from "./ownRecord.ts";

export { UNITS_OWN };

export class OwnUnits {
  /** The definitions, in the order they were made. */
  private stored: UnitDef[] = [];
  private readonly kv: Kv;
  private restoring: Promise<void> | undefined;

  constructor(kv: Kv) {
    this.kv = kv;
  }

  /** Read the stored definitions (once); until then there are none. A read that fails or finds a damaged record leaves the
   *  good ones (here: none or fewer) and writes nothing. */
  restore(): Promise<void> {
    this.restoring ??= this.kv.get<unknown>(UNITS_OWN).then(
      (v) => {
        // a definition made before the read finished stays (the record is written whole at the next change)
        const read = readRecord(v);
        this.stored = [...read.filter((d) => !this.stored.some((s) => s.name === d.name)), ...this.stored];
      },
      () => undefined,
    );
    return this.restoring;
  }

  /** The definitions as copies: a change to one changes nothing stored. */
  list(): UnitDef[] {
    return structuredClone(this.stored);
  }

  /** A new definition (its name is checked by validateDef, userUnits.ts, before; here only that it is not taken). */
  add(def: UnitDef): void {
    if (this.stored.some((d) => d.name === def.name)) throw new Error("name taken");
    this.write([...this.stored, structuredClone(def)]);
  }

  /** The definition named `name` becomes `def` (its place in the list stays; a new name is allowed: the caller has
   *  checked it with validateDef, as for `add`; no such name: nothing changes). */
  replace(name: string, def: UnitDef): void {
    this.write(this.stored.map((d) => (d.name === name ? structuredClone(def) : d)));
  }

  /** Delete a definition: a unit slot that names it is then refused in words (build.ts), never read with another value. */
  remove(name: string): void {
    this.write(this.stored.filter((d) => d.name !== name));
  }

  private write(next: UnitDef[]): void {
    this.stored = next;
    // after the read, so the record is never written without the definitions that were stored
    void this.restore().then(() => this.kv.set(UNITS_OWN, { units: this.stored }));
  }
}

/** The session's units, on the app's store. */
export const ownUnits = new OwnUnits(idbKv);
