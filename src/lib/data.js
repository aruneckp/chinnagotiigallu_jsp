import { MIN_BLOCK, MIN_BOOTH, MIN_SERIES } from "../config.js";

export const LABELS = {
  sn: "Serial no.", part: "Ward part", page: "Roll page", booth: "Polling part", bsn: "Polling part serial",
  name: "Name", rel: "Relation", rname: "Relative's name", age: "Age", gender: "Gender",
  house: "House no.", epic: "Voter ID card", block: "Block", issue: "Roll reading note",
};

// Filled by init() once the list is decrypted. ES module bindings are live,
// so every importer sees the loaded values.
export let META = {};
export let HAS_POLLING_PARTS = true;
export let COLS = [];
export let VOTERS = [];
export let BY_ID = new Map();     // "123" (serial no.) -> voter
export let GHOST_BY_ID = new Map(); // "g12" -> relative who is not on the list
export let FAMILIES = new Map();  // family id -> { id, voters, ghosts, root, gens, houses }
export let HOUSES = [];           // house id - 1 -> { id, key, label, block, voters, families }
export let PARTS = [];            // [[value, count]] sorted by value
export let BOOTHS = [];           // main polling parts, then "other"
export let BLOCKS = [];           // every block, largest first
export let MAIN_BLOCKS = [];      // blocks shown on their own in charts
export let SERIES = [];           // voter ID series (first three letters)

export const blockLabel = (b) => (b === "" ? "House no. not printed" : b === "?" ? "Door no. unclear" : b);
export const boothLabel = (b) => (b === "other" ? "Other parts" : `Part ${b}`);
export const seriesLabel = (s) => (s === "other" ? "Other series" : s);

const count = (list, key) => {
  const m = new Map();
  for (const o of list) m.set(key(o), (m.get(key(o)) || 0) + 1);
  return m;
};

export function init(RAW) {
  META = RAW.meta;
  HAS_POLLING_PARTS = RAW.meta.hasPollingParts !== false;
  COLS = RAW.cols;
  const n = COLS.length;
  GHOST_BY_ID = new Map(Object.entries(RAW.ghosts).map(([id, [name, g, fam, gen, key]]) =>
    [id, { id, name, g: g === "?" ? "?" : g, fam, gen, key, ghost: true, link: null }]));

  VOTERS = RAW.rows.map((r) => {
    const o = {};
    COLS.forEach((c, i) => (o[c] = r[i]));
    o.id = String(o.recordId ?? o.sn);
    o.g = o.gender === "Male" ? "M" : o.gender === "Female" ? "F" : "?";
    o.key = r[n];          // Latin sound-alike of the name, for English search
    o.rkey = r[n + 1];     // same for the relative's name
    o.fam = r[n + 2];
    o.gen = r[n + 3];
    const l = r[n + 4];
    o.link = l ? { to: String(l[0]), type: l[1], how: l[2], score: l[3], note: l[4] } : null;
    o.linkKind = !l ? "none" : String(l[0]).startsWith("g") ? "ghost" : "voter";
    o.prefix = o.epic.slice(0, 3);
    o.checks = {
      noHouse: !o.house,
      extra: /[A-Za-z]/.test(o.name + o.rname) || o.issue.includes("unplaced"),
      unsure: !!o.link?.note,
    };
    return o;
  });
  BY_ID = new Map(VOTERS.map((o) => [o.id, o]));

  // families
  FAMILIES = new Map();
  const fam = (id) => {
    if (!FAMILIES.has(id)) FAMILIES.set(id, { id, voters: [], ghosts: [] });
    return FAMILIES.get(id);
  };
  for (const o of VOTERS) fam(o.fam).voters.push(o);
  for (const g of GHOST_BY_ID.values()) fam(g.fam).ghosts.push(g);
  for (const f of FAMILIES.values()) {
    const all = [...f.voters, ...f.ghosts];
    f.root = (all.find((p) => !p.link) || all[0]).id;
    f.gens = Math.max(...all.map((p) => p.gen)) + 1;
    f.houses = [...new Set(f.voters.map((o) => o.house).filter(Boolean))];
    f.size = f.voters.length;
    f.male = f.voters.filter((o) => o.g === "M").length;
    f.linked = f.voters.filter((o) => o.linkKind === "voter").length;
    for (const o of f.voters) o.famSize = f.size;
  }

  // households: voters at the same door number however it was typed
  const byKey = new Map();
  for (const o of VOTERS) {
    if (!o.hh) { o.houseId = 0; o.hhSize = 0; continue; }
    if (!byKey.has(o.hh)) byKey.set(o.hh, { id: byKey.size + 1, key: o.hh, label: o.house, block: o.block, voters: [] });
    byKey.get(o.hh).voters.push(o);
  }
  HOUSES = [...byKey.values()];
  for (const h of HOUSES) {
    h.families = new Set(h.voters.map((o) => o.fam)).size;
    h.male = h.voters.filter((o) => o.g === "M").length;
    for (const o of h.voters) { o.houseId = h.id; o.hhSize = h.voters.length; }
  }

  PARTS = [...count(VOTERS, (o) => o.part)].sort((a, b) => a[0] - b[0]);

  if (HAS_POLLING_PARTS) {
    const booths = [...count(VOTERS, (o) => o.booth)].sort((a, b) => a[0] - b[0]);
    const mainBooths = new Set(booths.filter(([, c]) => c >= MIN_BOOTH).map(([b]) => b));
    for (const o of VOTERS) o.boothGroup = mainBooths.has(o.booth) ? String(o.booth) : "other";
    BOOTHS = [...count(VOTERS, (o) => o.boothGroup)].sort((a, b) => (a[0] === "other") - (b[0] === "other") || a[0] - b[0]);
  } else {
    for (const o of VOTERS) o.boothGroup = null;
    BOOTHS = [];
  }

  BLOCKS = [...count(VOTERS, (o) => o.block)].sort((a, b) => b[1] - a[1]);
  MAIN_BLOCKS = BLOCKS.filter(([b, c]) => c >= MIN_BLOCK && b !== "" && b !== "?").map(([b]) => b);
  const main = new Set(MAIN_BLOCKS);
  for (const o of VOTERS) o.blockGroup = main.has(o.block) || o.block === "" || o.block === "?" ? o.block : "~other";

  const series = [...count(VOTERS, (o) => o.prefix)].filter(([, c]) => c >= MIN_SERIES).map(([s]) => s);
  for (const o of VOTERS) o.series = series.includes(o.prefix) ? o.prefix : "other";
  SERIES = [...count(VOTERS, (o) => o.series)].sort((a, b) => (a[0] === "other") - (b[0] === "other") || b[1] - a[1]);
}

export const groupLabel = (b) => (b === "~other" ? "Other blocks" : blockLabel(b));
export const partLabel = (p) => META.sourceGroups?.[String(p)] || `Part ${p}`;
export const person = (id) => BY_ID.get(id) || GHOST_BY_ID.get(id);
export const houseOf = (o) => (o.houseId ? HOUSES[o.houseId - 1] : null);
