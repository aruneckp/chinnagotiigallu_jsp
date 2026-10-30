import { FAMILIES, person } from "./data.js";

// Each voter names one relative (father, husband or mother), so a family is a tree.
// A "unit" is a man (or a relative not on the list) together with the wives who name
// him; children hang below the unit whether they name the father or the mother.

const unitOf = (id) => {
  const l = person(id)?.link;
  return l && l.type === "Husband" ? l.to : id;
};
const parentUnit = (u) => {
  const l = person(u)?.link;
  return l && l.type !== "Husband" ? unitOf(l.to) : null;
};
const lineage = (u) => {
  const out = [];
  for (let x = u; x && out.length < 12 && !out.includes(x); x = parentUnit(x)) out.push(x);
  return out;
};

const word = (g, male, female, either) => (g === "M" ? male : g === "F" ? female : either);

// How `id` is related to `focus`, in plain words ("Father", "Sister-in-law", ...).
export function relationTo(focus, id) {
  if (focus === id) return "Selected";
  const uf = unitOf(focus), um = unitOf(id);
  const up = lineage(uf), down = lineage(um);
  const a = up.findIndex((u) => down.includes(u));
  if (a < 0) return "Relative";
  const b = down.indexOf(up[a]);
  const fWife = uf !== focus, mWife = um !== id;
  const g = person(id).g;

  if (a === 0 && b === 0) return fWife && mWife ? "Same husband" : mWife ? "Wife" : "Husband";
  if (b === 0) {                         // the other person is in an older generation of this line
    if (fWife) return a === 1 ? word(g, "Father-in-law", "Mother-in-law", "Parent-in-law")
      : `Husband's ${a === 2 ? "grand" : "great-grand"}${word(g, "father", "mother", "parent")}`;
    return a === 1 ? word(g, "Father", "Mother", "Parent")
      : `${a === 2 ? "Grand" : "Great-grand"}${word(g, "father", "mother", "parent")}`;
  }
  if (a === 0) {                         // a younger generation of this line
    if (mWife) return b === 1 ? "Daughter-in-law" : b === 2 ? "Grandson's wife" : "Relative";
    return b === 1 ? word(g, "Son", "Daughter", "Child")
      : `${b === 2 ? "Grand" : "Great-grand"}${word(g, "son", "daughter", "child")}`;
  }
  if (a === 1 && b === 1) {
    if (mWife) return "Sister-in-law";
    return fWife ? word(g, "Brother-in-law", "Sister-in-law", "Sibling-in-law") : word(g, "Brother", "Sister", "Sibling");
  }
  if (a === 1 && b === 2) return mWife ? "Nephew's wife" : word(g, "Nephew", "Niece", "Nephew / niece");
  if (a === 2 && b === 1) return mWife ? "Aunt" : word(g, "Uncle", "Aunt", "Uncle / aunt");
  if (a === 2 && b === 2) return mWife ? "Cousin's wife" : "Cousin";
  return "Relative";
}

// Closest relatives first in member lists.
const ORDER = ["Selected", "Husband", "Wife", "Same husband", "Father", "Mother", "Parent", "Son", "Daughter", "Child",
  "Brother", "Sister", "Sibling", "Father-in-law", "Mother-in-law", "Daughter-in-law", "Brother-in-law",
  "Sister-in-law", "Grandfather", "Grandmother", "Grandson", "Granddaughter"];
export const closeness = (rel) => { const i = ORDER.indexOf(rel); return i < 0 ? ORDER.length : i; };

// Nested tree for drawing: { id, spouses: [id], children: [node] }
export function familyTree(famId) {
  const fam = FAMILIES.get(famId);
  const ids = [...fam.voters.map((o) => o.id), ...fam.ghosts.map((g) => g.id)];
  const inFam = new Set(ids);
  const wives = new Map(), kids = new Map();
  const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  for (const id of ids) {
    const l = person(id).link;
    if (l && inFam.has(l.to)) push(l.type === "Husband" ? wives : kids, l.to, id);
  }
  const age = (id) => person(id).age ?? 999;
  const seen = new Set();
  const node = (id) => {
    seen.add(id);
    const spouses = (wives.get(id) || []).filter((s) => !seen.has(s));
    spouses.forEach((s) => seen.add(s));
    // a "husband" link to a wife is a roll error; such entries hang below the couple
    const children = [id, ...spouses].flatMap((p) => [...(kids.get(p) || []), ...(p === id ? [] : wives.get(p) || [])])
      .filter((k, i, a) => a.indexOf(k) === i && !seen.has(k))
      .sort((x, y) => age(y) - age(x));
    children.forEach((k) => seen.add(k));
    return { id, spouses, children: children.map(node) };
  };
  const roots = ids.filter((id) => { const l = person(id).link; return !l || !inFam.has(l.to); });
  const out = roots.map(node);
  // nobody is ever dropped: anyone the walk missed is drawn as a separate branch
  for (const id of ids) if (!seen.has(id)) out.push(node(id));
  return out;
}
