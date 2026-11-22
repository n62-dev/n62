// SPDX-License-Identifier: GPL-3.0-or-later
// G16: the unit view's messages (docs/04 4.3). A table of its own, loaded with the unit view (units/messages.ts), so
// the start chunk does not carry it. English only so far. {dims}, {a}, {b} are dimensions ("L·T⁻¹"), {unit} a symbol.
// The slot model (units/slot.ts, R24a) uses it too.
export const enUnits = {
  "units.mismatch": "Units don't match: {dims}",
  "units.mismatchSep": " vs ",
  "units.cycle.rpm": "{unit} counts turns: write tr/min for an angular speed",
  "units.cycle.rev": "{unit} counts turns: write tr for an angle",
  "units.power": "VA, var and W differ by the power factor",
  "units.temperature": "Use K or Δ°C for a temperature difference",
  // G370: T1 − T2 of two temperature scales; {a}, {b} their symbols as typed ("K", "°C")
  "units.scales": "{a} and {b} are two scales: write both temperatures in one",
  "units.logarithmic": "{unit} converts only",
  "units.level": "A level needs a positive value",
  "units.belowzero": "Below absolute zero",
  "units.nofactor": "No exact factor for {unit} yet",
  "units.function": "A function takes a pure number (sin, cos and tan also an angle)",
  "units.divzero": "Not defined: a division by 0",
  "units.uncpower": "A power of a unit can't carry ±",
  "units.sigma": "The result after ± must be a real number, 0 or more",
  "units.sigmadim": "The result after ± doesn't fit the value's unit: {dims}",
  "units.minus": "Put the minus on the number, not before the bracket around {unit}",
  "units.symbolic": "Not a number: {detail}",
  // G390: a store on the unit view's line (R353: the way the view stores)
  "units.store": "The unit view stores from its result: Eval, then Store ▶",
  // R353: Store ▶ in the view (the key, the button beside the result, Tools › Store in a name)
  "units.store.button": "▶ Store",
  // R349: the button on the panel that puts the end slot on (→ Check) and takes it off (✕ Check), with what it says aloud
  "units.check.on": "→ Check",
  "units.check.off": "✕ Check",
  "units.check.onLabel": "Check against a unit",
  "units.check.offLabel": "Remove the check",
  "units.step.prev": "←",
  "units.step.next": "→",
  "units.step.prevLabel": "Previous unit slot",
  "units.step.nextLabel": "Next unit slot",
  "units.store.first": "Eval first, then Store ▶",
  "units.store.noUnit": "This result cannot be stored with its unit",
  "units.engine": "The unit view could not evaluate this",
  // G40: the notes under a result (decisions.md "Angles in the unit view").
  "units.note.radDropped": "rad = 1 dropped",
  "units.note.cycle": "{unit} counts turns: the speed at radius r is 2π·r·n",
  // R121: the names a result read as pure numbers ({names}: at most three, then …).
  "units.note.name": "{names} has no unit: a Home value",
  "units.note.names": "{names} have no unit: Home values",
  // G41: the why-line of a σ shown with ⚠ (docs/04 4.3).
  "units.why.order2": "first order does not hold here",
  "units.why.singular": "the interval reaches a singular point",
  "units.why.jump": "the interval reaches a jump",
  // R24a: the slot model's refusals (a pad press that cannot go into the slot) and the reading in words. {u} is a
  // unit's name in words ("kilometer"), {p} a power ("−1/2").
  "units.slot.prefixAlone": "A prefix needs a unit after it",
  "units.slot.rootAlone": "√ needs a unit after it",
  "units.slot.perEmpty": "÷ needs a unit after it",
  "units.slot.secondPer": "One ÷ per unit: the rest is already below it",
  "units.slot.powerAlone": "A power needs a unit before it",
  "units.slot.unknown": "{unit} is not in Find's unit list",
  // R313: letters typed on a hardware keyboard that read as no unit (units/slot.ts readSymbol); {letters} as typed
  "units.slot.notUnit": "{letters} is not a unit",
  "units.read.per": "per",
  "units.read.square": "{u} squared",
  "units.read.cube": "{u} cubed",
  "units.read.fourth": "{u} to the fourth",
  "units.read.power": "{u} to the power {p}",
  "units.read.root": "square root of {u}",
  // R352, R349: the reading of the end slot while it is active and empty (it is there only after → Check)
  "units.read.endEmpty": "Check against a unit: the result is converted to it, or refused if it does not fit",
  // G37: °C or °F inside a compound unit or with a power is a temperature interval ("per degree Celsius (difference)").
  "units.read.interval": "{u} (difference)",
  // R24b: the pad's own keys (Math is Find in a slot, Enter goes to the next slot, a flick up on Enter evaluates).
  "units.pad.find": "Find",
  "units.pad.enter": "Enter",
  "units.pad.evaluate": "Eval",
  // R24c: the unit view while Calc.units() runs.
  "units.view.working": "Working…",
  // R62: the result (units/result.ts): the value and σ under the value line, the alternatives row.
  "units.result.sub": "{value} · σ {sigma}",
  "units.result.alts": "Show in another unit",
  "units.result.more": "More…",
  "units.result.moreLabel": "More units for this quantity",
  // R24d: Find in a slot (Math): the units menu of the empty query (spec/units-menu.yaml), the second job of a unit row,
  // and the cell it lands in.
  "units.menu.prefixes": "Prefixes",
  "units.find.put": "Put on the unit pad",
  "units.find.cell": "Which cell?",
  "units.cell.tap": "Tap",
  "units.cell.up": "Flick up",
  "units.cell.down": "Flick down",
  "units.cell.empty": "Empty",
  "units.cat.Length": "Length",
  "units.cat.Area": "Area",
  "units.cat.Volume": "Volume",
  "units.cat.Time": "Time",
  "units.cat.Speed": "Speed",
  "units.cat.Mass": "Mass",
  "units.cat.Acceleration": "Acceleration",
  "units.cat.Force": "Force",
  "units.cat.Energy": "Energy",
  "units.cat.Power": "Power",
  "units.cat.Pressure": "Pressure",
  "units.cat.Temperature": "Temperature",
  "units.cat.Electricity": "Electricity",
  "units.cat.Light": "Light",
  "units.cat.Angle": "Angle",
  "units.cat.Viscosity": "Viscosity",
  "units.cat.Radiation": "Radiation",
  "units.cat.Torque": "Torque",
  "units.cat.Flow": "Flow",
  "units.cat.Density": "Density",
  "units.cat.Amount": "Amount",
  "units.cat.Data": "Data",
  "units.cat.Ratio": "Ratio",
  // R92: the units menu's last two rows (spec/units-menu.yaml `constants`, `tools`): the constant lists, Math's three
  // (Home's own e, π, i), and the unit view's places as tools, with the reason a tool cannot run yet.
  "units.menu.constants": "Constants",
  "units.menu.tools": "Tools",
  "units.const.Math": "Math",
  "units.const.Chemistry": "Chemistry",
  "units.const.Physics": "Physics",
  "units.const.Quantum": "Quantum",
  "units.const.More": "More",
  "units.const.e": "Euler's number",
  "units.const.pi": "Pi",
  "units.const.i": "Imaginary unit",
  "units.tool.end": "The end slot",
  "units.tool.si": "The SI form",
  "units.tool.alts": "The alternatives",
  "units.tool.unit": "The unit alone",
  "units.tool.number": "The number into Home",
  "units.tool.store": "Store in a name",
  "units.tool.needsResult": "needs a result first",
  "units.tool.needsUnit": "needs a result with a unit",
  "units.tool.isSI": "the result is in its SI form",
  "units.tool.notBuilt": "not built yet",
  // G233: a unit of your own refused (units/userUnits.ts): {name} as given, {unit} and {prefix} Find's symbols
  "units.own.name": "A name is letters, digits and _, a letter first (at most 24)",
  "units.own.clash": "Find already has {name} ({unit})",
  "units.own.pair": "{name} reads as {prefix} and {unit} in Find",
  "units.own.gone": "Your unit {name} is not defined (any more)",
  "units.own.nowFind": "{name} is now also Find's {unit}; yours keeps its value",
  "units.own.twice": "You already have a unit {name}",
  "units.own.factor": "{factor} is not a number (one decimal mark, no group separator)",
  "units.own.zero": "The factor must be above 0",
  "units.own.ofEmpty": "Give the units it is made of",
  "units.own.unknown": "{unit} is not in Find's unit list",
  "units.own.ofOwn": "Build it from Find's units ({unit} is your own)",
  "units.own.ofKind": "{unit} has rules of its own (an offset, a level, turns, a kind of power or no factor)",
  // R201: Settings › Your keys › Your units (views/ownUnitsSheet.svelte.ts)
  "units.sheet.new": "New unit",
  "units.sheet.name": "Name",
  "units.sheet.factor": "Factor",
  "units.sheet.of": "Made of",
  "units.sheet.of.hint": "Find's units: m, km/h, kg*m^2",
  "units.sheet.entry.name": "Unit name",
  "units.sheet.entry.factor": "Factor",
  "units.sheet.entry.of": "Made of",
  "units.sheet.none": "—",
  "units.sheet.save": "Save",
  "units.sheet.delete": "Delete",
  "units.sheet.delete.again": "Tap Delete again to remove {name}",
  "units.sheet.saved": "Saved {name}",
  "units.sheet.deleted": "Deleted {name}",
} as const satisfies Record<string, string>;

export type UnitMessageKey = keyof typeof enUnits;

/** A unit-view message; `{name}` placeholders are filled from `vars`. */
export function unitText(key: UnitMessageKey, vars?: Readonly<Record<string, string>>): string {
  const m: string = enUnits[key];
  return vars ? m.replace(/\{(\w+)\}/g, (all, k: string) => vars[k] ?? all) : m;
}
