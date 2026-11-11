// SPDX-License-Identifier: GPL-3.0-or-later
// Where a function sits on the keypad (G230; docs/04 3.3). spec/keyboard.yaml holds every insert of every key layer and every
// palette cell; a Find item whose function one of them inserts gets `where`: the key's name for a tap ("sin"), Shift or Alpha
// in front of it for a layer ("Shift sin"), the key that opens the palette for a palette cell ("Tmpl"). A key's places come
// first, then the palettes', joined with ", " ("Shift x², Tmpl"). Names are the key labels' own i18n texts (app/src/i18n/en.ts,
// enKeyNames.ts), so a renamed key renames its place. A pure function over parsed data, so the unit test needs no index.

const LAYERS = ["primary", "shift", "alpha"];
/** The palette sections of spec/keyboard.yaml and the `special` that opens each. */
const PALETTES = [["templates", "tmpl"], ["relations", "relations"], ["symbols", "symbols"]];

/** The text of a keyboard legend: "$key.x" is a message of the English table, anything else is shown as is. */
function legendText(label, msgs) {
  if (typeof label !== "string" || !label.startsWith("$")) return label;
  if (label.startsWith("$$")) return label.slice(1);
  const text = msgs[label.slice(1)];
  if (text === undefined) throw new Error(`where: missing message ${label.slice(1)}`);
  return text;
}

/** The `"a.b": "text"` pairs of an English message file (en.ts, enKeyNames.ts), read without importing TypeScript. */
export function messages(...sources) {
  const out = {};
  for (const src of sources) for (const m of src.matchAll(/^\s*"([\w.]+)":\s*"((?:[^"\\]|\\.)*)"/gm)) out[m[1]] = JSON.parse(`"${m[2]}"`);
  return out;
}

/** Find id → where. `links`: insert LaTeX → Find id (a key's and a palette cell's insert that is a function Find lists). */
export function whereMap(kb, msgs, links) {
  const name = (key) => legendText(key.label?.primary ?? key.id, msgs);
  const place = (key, layer) => (layer === "primary" ? name(key) : `${msgs[`layer.${layer}`] ?? layer} ${name(key)}`);
  const byKey = new Map(kb.keys.map((k) => [k.id, k]));
  const keyPlaces = new Map(); // id → places of keys
  const palettePlaces = new Map();
  const add = (map, insert, where) => {
    const id = links.get(insert);
    if (id === undefined) return;
    if (!map.has(id)) map.set(id, []);
    if (!map.get(id).includes(where)) map.get(id).push(where);
  };
  for (const k of kb.keys) for (const l of LAYERS) if (k[l]?.insert) add(keyPlaces, k[l].insert, place(k, l));
  for (const [section, special] of PALETTES) {
    let opener;
    for (const k of kb.keys) for (const l of LAYERS) if (k[l]?.special === special && !opener) opener = place(k, l);
    if (!opener) continue;
    for (const cell of kb[section]?.items ?? []) {
      const insert = cell.insert ?? byKey.get(cell.key)?.[cell.layer]?.insert;
      if (insert) add(palettePlaces, insert, opener);
    }
  }
  const out = new Map();
  for (const id of new Set([...keyPlaces.keys(), ...palettePlaces.keys()])) {
    out.set(id, [...new Set([...(keyPlaces.get(id) ?? []), ...(palettePlaces.get(id) ?? [])])].join(", "));
  }
  return out;
}

/** The inserts that stand for a Find function: a curated function's own insert, `find/where.yaml` (the keys whose insert is
 *  no \name\left( call), and the \operatorname{NAME} cells of the palettes (AND, NOT, …) when Find has that function. */
export function insertLinks(kb, curated, extra, hasId) {
  const links = new Map();
  for (const f of curated) if (f.insert) links.set(f.insert, f.id);
  for (const [id, insert] of Object.entries(extra ?? {})) links.set(String(insert), id);
  const inserts = [
    ...kb.keys.flatMap((k) => LAYERS.map((l) => k[l]?.insert)),
    ...PALETTES.flatMap(([s]) => (kb[s]?.items ?? []).map((c) => c.insert)),
  ];
  for (const ins of inserts) {
    const m = /^\\operatorname\{([A-Za-z]+)\}/.exec(ins ?? "");
    if (m && !links.has(ins) && hasId(`fn:${m[1].toLowerCase()}`)) links.set(ins, `fn:${m[1].toLowerCase()}`);
  }
  return links;
}
