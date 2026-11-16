// SPDX-License-Identifier: GPL-3.0-or-later
// R201 (docs/05 3.4): Settings › Your keys › Your units, the way to make a unit of your own (G233's model, G234's store,
// units/ownUnits.ts). The level lists your units (name, `factor unit`, and the line when Find has since gained the name) and
// New. A form (a sheet of its own) holds a draft: Name, Factor and Made of are each typed in the entry line under their label
// as a preset's name is (presetsView.svelte.ts askName), and the form comes back with the value; Save checks the draft
// (userUnits.ts: factorText, validateDef for a new unit, checkDef for a changed one: its name may be Find's now) and says why
// not in its own row; a good one is stored and the sheet closes. A unit's row opens the same form (its name stays), with
// Delete, which asks once (MenuItem.confirm). Loaded when the row opens (ownUnitsRow.svelte.ts), never in the start chunk.
import type { MenuItem } from "../apps/types.ts";
import { loadIndex } from "../find/finder.ts";
import { unitText } from "../i18n/enUnits.ts";
import type { DecimalMark } from "../state/session.svelte.ts";
import { factorTable, type FactorTable } from "../units/factors.ts";
import { ownUnits } from "../units/ownUnits.ts";
import { goodName } from "../units/ownRecord.ts";
import { slotCatalogue, type SlotCatalogue } from "../units/slot.ts";
import type { UnitSlot } from "../units/types.ts";
import { checkDef, clashNote, factorText, findNames, validateDef, type FindNames, type UnitDef } from "../units/userUnits.ts";
import { ofText, readOf, unitFrom } from "./ownUnitsText.ts";
import { askName } from "./presetsView.svelte.ts";
import type { SettingsEnv } from "./yourKeys.ts";

interface Tables { table: FactorTable; names: FindNames; cat: SlotCatalogue }
let tables: Promise<Tables> | undefined;
const load = (): Promise<Tables> =>
  (tables ??= loadIndex(true).then(
    (ix) => ({ table: factorTable(ix.items), names: findNames(ix.items), cat: slotCatalogue(ix.items) }),
    (e: unknown) => {
      tables = undefined; // (the next call tries again)
      throw e;
    },
  ));

/** What the rows read: Find's tables once they are in, and a counter that a change bumps (the list is plain TS). */
const held = $state<{ tables: Tables | null; version: number }>({ tables: null, version: 0 });

/** The stored units and Find's tables are read; the rows are drawn from then on. */
export async function ready(): Promise<void> {
  await ownUnits.restore();
  held.tables = await load();
}

export const count = (): number => (void held.version, ownUnits.list().length);

/** A factor as drawn with the session's decimal mark (stored with a point). */
const shown = (factor: string, mark: DecimalMark): string => (mark === "comma" ? factor.split(".").join(",") : factor);

interface Draft {
  /** The stored name this draft changes; null for a new unit. */
  orig: string | null;
  name: string;
  factor: string;
  ofText: string;
  /** The slot `ofText` was read as (a stored unit's own, until its text is changed); read again at Save otherwise. */
  of: UnitSlot | undefined;
  refusal: string | undefined;
}

const say = (env: SettingsEnv, message: string): void => env.data?.((c) => c.say(message));

/** The level: New, then your units. */
export function ownUnitsRows(env: SettingsEnv, mark: () => DecimalMark): MenuItem[] {
  void held.version;
  const names = held.tables?.names;
  return [
    {
      id: "new",
      label: unitText("units.sheet.new"),
      keep: true,
      run: () => openForm(env, mark, { orig: null, name: "", factor: "", ofText: "", of: undefined, refusal: undefined }),
    },
    ...ownUnits.list().map(
      (def): MenuItem => {
        const note = names ? clashNote(def, names) : undefined;
        return {
          id: `u:${def.name}`,
          label: def.name,
          value: `${shown(def.factor, mark())} ${ofText(def.of)}`,
          ...(note !== undefined ? { hint: note } : {}),
          keep: true,
          run: () => openForm(env, mark, { orig: def.name, name: def.name, factor: shown(def.factor, mark()), ofText: ofText(def.of), of: def.of, refusal: undefined }),
        };
      },
    ),
  ];
}

function openForm(env: SettingsEnv, mark: () => DecimalMark, start: Draft): void {
  const d = $state<Draft>(start);
  const title = d.orig ?? unitText("units.sheet.new");
  const show = (): void => env.shell?.showMenu?.(title, rows, { remember: false });
  const field = (id: string, label: string, entry: string, get: () => string, set: (v: string) => void, read?: (latex: string) => string, hint?: string): MenuItem => ({
    id,
    label,
    get value() {
      return get() || unitText("units.sheet.none");
    },
    ...(hint !== undefined ? { hint } : {}),
    run: () =>
      askName(
        env,
        get(),
        (v) => {
          set(v);
          d.refusal = undefined;
          queueMicrotask(show); // the form comes back, with the value, once the line has its own text again
        },
        () => "",
        entry,
        read,
      ),
  });
  const fail = (message: string): void => void (d.refusal = message);
  const commit = async (): Promise<void> => {
    const t = held.tables ?? (await load());
    if (!goodName(d.name)) return fail(unitText("units.own.name"));
    if (d.factor.trim() === "") return fail(unitText("units.own.factor", { factor: unitText("units.sheet.none") }));
    const f = factorText(d.factor, mark());
    if (!f.ok) return fail(f.message);
    let of = d.of === undefined ? undefined : $state.snapshot(d.of); // (a plain copy: the store clones it)
    if (!of) {
      const r = readOf(d.ofText, t.cat);
      if (!r.ok) return fail(r.empty ? unitText("units.own.ofEmpty") : unitText("units.own.unknown", { unit: r.unit }));
      of = r.of;
    }
    const def: UnitDef = { name: d.name, factor: f.text, of };
    await ownUnits.restore();
    const orig = d.orig;
    // a changed unit keeps its name (and a name Find has gained since is no reason to refuse its new factor)
    const c = orig !== null && orig === def.name ? checkDef(def, t.table) : validateDef(def, t.table, t.names, ownUnits.list().filter((u) => u.name !== orig));
    if (!c.ok) return fail(c.message);
    try {
      if (orig === null) ownUnits.add(def);
      else ownUnits.replace(orig, def);
    } catch {
      return fail(unitText("units.own.twice", { name: def.name }));
    }
    held.version++;
    env.shell?.closeSheet?.();
    say(env, unitText("units.sheet.saved", { name: def.name }));
  };
  const orig = d.orig;
  const rows: MenuItem[] = [
    orig === null
      ? field("name", unitText("units.sheet.name"), unitText("units.sheet.entry.name"), () => d.name, (v) => (d.name = v))
      : { id: "name", label: unitText("units.sheet.name"), value: d.name, keep: true },
    field("factor", unitText("units.sheet.factor"), unitText("units.sheet.entry.factor"), () => d.factor, (v) => (d.factor = v)),
    field(
      "of",
      unitText("units.sheet.of"),
      unitText("units.sheet.entry.of"),
      () => d.ofText,
      (v) => {
        d.ofText = v;
        d.of = undefined;
      },
      unitFrom,
      unitText("units.sheet.of.hint"),
    ),
    {
      id: "save",
      label: unitText("units.sheet.save"),
      keep: true,
      get hint() {
        return d.refusal;
      },
      run: () => void commit(),
    },
    ...(orig === null
      ? []
      : [
          {
            id: "delete",
            label: unitText("units.sheet.delete"),
            confirm: { cell: "", note: unitText("units.sheet.delete.again", { name: orig }) },
            run: () => {
              ownUnits.remove(orig);
              held.version++;
              say(env, unitText("units.sheet.deleted", { name: orig }));
            },
          } satisfies MenuItem,
        ]),
  ];
  show();
}
