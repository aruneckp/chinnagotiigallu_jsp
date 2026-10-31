import { PARTS, BOOTHS, BLOCKS, SERIES, MPTCS, GRAM_PANCHAYATS, POLLING_STATIONS,
  blockLabel, boothLabel, seriesLabel, groupLabel, partLabel } from "./data.js";
import { compileQuery } from "./search.js";
import { inBucket } from "./stats.js";

export const EMPTY = {
  q: "", qf: "any", part: "", booth: "", block: "", mptc: "", gp: "", ps: "", gen: "", ageMin: "", ageMax: "",
  rel: "", fam: "", hh: "", link: "", series: "", check: "", sort: "sn",
};

export const RELATIONS = [["Father", "Father"], ["Husband", "Husband"], ["Mother", "Mother"], ["none", "Not printed"]];
export const FAM_SIZES = [["1", "Alone"], ["2", "2"], ["3-4", "3–4"], ["5+", "5+"]];
export const HH_SIZES = [["1", "1"], ["2-3", "2–3"], ["4-6", "4–6"], ["7+", "7+"]];
export const LINKS = [["voter", "Relative found on the list"], ["ghost", "Relative not on the list"],
  ["review", "Family match needs review"], ["none", "No relative printed"]];
export const CHECKS = [["noHouse", "House no. not printed"], ["extra", "Extra text in name"], ["unsure", "Family link to check"]];

// Every filter on the voter list, in the order the filter panel shows them. To add a
// filter: add its key to EMPTY and an entry here; the panel, the chips and the
// analysis scope pick it up from this list.
export const FACETS = [
  { key: "part", label: "Village / PDF", chips: true,
    options: () => PARTS.map(([p, n]) => [String(p), partLabel(p), n]),
    test: (o, v) => String(o.part) === v, chipLabel: (v) => partLabel(v) },
  { key: "mptc", label: "MPTC Constituency", chips: true,
    options: () => MPTCS.map(([v, n]) => [v, v, n]),
    test: (o, v) => o.mptcConstituency === v },
  { key: "gp", label: "Gram Panchayat / Ward", chips: true,
    options: () => GRAM_PANCHAYATS.map(([v, n]) => [v, v, n]),
    test: (o, v) => o.gramPanchayat === v },
  { key: "ps", label: "Polling Station (PS)", chips: true,
    options: () => POLLING_STATIONS.map(([v, n]) => [String(v), `PS ${v}`, n]),
    test: (o, v) => String(o.pollingStationNo) === v, chipLabel: (v) => `PS ${v}` },
  { key: "booth", label: "Polling part (AC 167)", chips: true,
    options: () => BOOTHS.map(([b, n]) => [b, boothLabel(b), n]),
    test: (o, v) => o.boothGroup === v, chipLabel: (v) => (v === "other" ? "Other polling parts" : `Polling part ${v}`) },
  { key: "block", label: "Block (from door no.)", select: true,
    options: () => [...BLOCKS.map(([b, n]) => [b, blockLabel(b), n]), ["~other", "All small blocks"]],
    test: (o, v) => (v === "~other" ? o.blockGroup === "~other" : o.block === v),
    chipLabel: (v) => groupLabel(v) },
  { key: "gen", label: "Gender", chips: true,
    options: () => [["Male", "Men"], ["Female", "Women"]],
    test: (o, v) => o.gender === v },
  { key: "rel", label: "Relative listed as", chips: true,
    options: () => RELATIONS,
    test: (o, v) => (v === "none" ? !o.rel : o.rel === v) },
  { key: "fam", label: "Family size on the list", chips: true,
    options: () => FAM_SIZES,
    test: (o, v) => inBucket(o.famSize, v), chipLabel: (v) => (v === "1" ? "Alone in family" : `Family of ${v.replace("-", "–")}`) },
  { key: "hh", label: "Voters at the same house", chips: true,
    options: () => HH_SIZES,
    test: (o, v) => inBucket(o.hhSize, v), chipLabel: (v) => `${v.replace("-", "–")} at the house` },
  { key: "link", label: "Family link", chips: true,
    options: () => LINKS,
    test: (o, v) => o.linkKind === v },
  { key: "series", label: "Voter ID series", chips: true,
    options: () => SERIES.map(([s, n]) => [s, seriesLabel(s), n]),
    test: (o, v) => o.series === v, chipLabel: (v) => `ID ${seriesLabel(v)}` },
  { key: "check", label: "Data checks", chips: true,
    options: () => CHECKS,
    test: (o, v) => o.checks[v] },
];

export const SORTS = {
  sn: ["Serial no.", (a, b) => a.sn - b.sn],
  name: ["Name", (a, b) => a.name.localeCompare(b.name, "te")],
  age: ["Youngest first", (a, b) => a.age - b.age || a.sn - b.sn],
  "-age": ["Oldest first", (a, b) => b.age - a.age || a.sn - b.sn],
  house: ["House no.", (a, b) => (!a.house) - (!b.house) || a.house.localeCompare(b.house, "en", { numeric: true }) || a.sn - b.sn],
  "-fam": ["Largest family", (a, b) => b.famSize - a.famSize || a.fam - b.fam || a.sn - b.sn],
  "-hh": ["Largest household", (a, b) => b.hhSize - a.hhSize || a.houseId - b.houseId || a.sn - b.sn],
  booth: ["Polling part", (a, b) => a.booth - b.booth || a.bsn - b.bsn],
};

const ageTest = (f) => {
  if (f.ageMin === "" && f.ageMax === "") return null;
  const min = f.ageMin === "" ? 0 : +f.ageMin, max = f.ageMax === "" ? 999 : +f.ageMax;
  return (o) => o.age >= min && o.age <= max;
};

export function filterList(list, f) {
  const tests = FACETS.filter((x) => f[x.key]).map((x) => (o) => x.test(o, f[x.key]));
  const q = compileQuery(f.q, f.qf);
  if (q) tests.push(q);
  const age = ageTest(f);
  if (age) tests.push(age);
  return tests.length ? list.filter((o) => tests.every((t) => t(o))) : list.slice();
}

export const applyFilters = (list, f) => filterList(list, f).sort(SORTS[f.sort]?.[1] || SORTS.sn[1]);

// For each filter, how many voters each option would give with the other filters kept.
export function facetCounts(list, f) {
  const out = {};
  for (const x of FACETS) {
    const base = filterList(list, { ...f, [x.key]: "" });
    out[x.key] = Object.fromEntries(x.options().map(([v]) => [v, base.reduce((n, o) => n + (x.test(o, v) ? 1 : 0), 0)]));
  }
  return out;
}

const ageText = (f) => (f.ageMin && f.ageMin === f.ageMax ? `Age ${f.ageMin}`
  : `Age ${f.ageMin || 18}${f.ageMax ? "–" + f.ageMax : "+"}`);

// [key, label] for each filter in use, for the removable chips above the results.
export function activeFilters(f) {
  const out = FACETS.filter((x) => f[x.key]).map((x) => {
    const opt = x.options().find((o) => o[0] === f[x.key]);
    return [x.key, x.chipLabel ? x.chipLabel(f[x.key]) : opt?.[1] || f[x.key]];
  });
  if (f.ageMin || f.ageMax) out.push(["age", ageText(f)]);
  return out;
}

export const clearFilter = (f, k) => (k === "age" ? { ...f, ageMin: "", ageMax: "" } : { ...f, [k]: "" });
export const activeCount = (f) => activeFilters(f).length;
export const isScoped = (f) => !!f.q.trim() || activeCount(f) > 0;
