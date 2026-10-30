export const AGE_BANDS = [[18, 19], [20, 29], [30, 39], [40, 49], [50, 59], [60, 69], [70, 79], [80, 200]];
export const bandLabel = ([a, b]) => (b > 150 ? `${a}+` : `${a}–${b}`);
export const bandOf = (age) => AGE_BANDS.findIndex(([a, b]) => age >= a && age <= b);

export const fmt = (n) => Number(n).toLocaleString("en-IN");
export const pct = (n, d) => {
  const p = d ? Math.round((n * 100) / d) : 0;
  return n > 0 && p === 0 ? "<1" : p;
};
// Women per 1,000 men, the way the Census reports the sex ratio.
export const ratio = (f, m) => (m ? fmt(Math.round((f * 1000) / m)) : "–");
export const sex = (o) => (o.g === "M" ? "male" : o.g === "F" ? "female" : "other");

export function summarize(list) {
  const s = { total: list.length, male: 0, female: 0, other: 0, firstTime: 0, young: 0, senior: 0, elder: 0,
    bands: AGE_BANDS.map(() => ({ male: 0, female: 0, other: 0, total: 0 })) };
  const hh = new Set(), fam = new Set();
  let ages = 0;
  for (const o of list) {
    const g = sex(o);
    s[g]++;
    ages += o.age;
    if (o.houseId) hh.add(o.houseId);
    fam.add(o.fam);
    if (o.age <= 19) s.firstTime++;
    if (o.age <= 25) s.young++;
    if (o.age >= 60) s.senior++;
    if (o.age >= 80) s.elder++;
    const i = bandOf(o.age);
    if (i >= 0) { s.bands[i][g]++; s.bands[i].total++; }
  }
  return { ...s, households: hh.size, families: fam.size, avgAge: list.length ? ages / list.length : 0 };
}

export function groupBy(list, key) {
  const m = new Map();
  for (const o of list) {
    const k = key(o);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(o);
  }
  return m;
}

// "3-4" -> 3..4, "5+" -> 5..∞, "1" -> 1..1
export function inBucket(n, bucket) {
  const m = /^(\d+)(?:-(\d+)|(\+))?$/.exec(bucket);
  if (!m) return false;
  const lo = +m[1], hi = m[3] ? Infinity : m[2] ? +m[2] : lo;
  return n >= lo && n <= hi;
}
