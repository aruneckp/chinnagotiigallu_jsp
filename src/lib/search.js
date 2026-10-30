// Search in Telugu or English spellings, by serial no., house no. or voter ID card.
// Several serial numbers or voter IDs can be pasted at once, separated by commas or spaces.

export const SEARCH_FIELDS = [
  ["any", "Everything"],
  ["name", "Name"],
  ["rel", "Relative's name"],
  ["epic", "Voter ID card"],
  ["house", "House no."],
  ["sn", "Serial no."],
];

export const PLACEHOLDER = {
  any: "Name, relative, voter ID, house no. or serial no.",
  name: "Voter name in Telugu or English",
  rel: "Father, husband or mother name",
  epic: "Voter ID card no. (paste several at once)",
  house: "Door no., e.g. 20-48-S8-520",
  sn: "Serial no., several, or a range like 100-150",
};

// Latin spellings of Telugu names vary a lot (Sandhya, Sandya, Samdya); reduce them to a sound key.
export function normLatin(s) {
  s = String(s || "").toLowerCase().replace(/[^a-z ]+/g, " ");
  const reps = [["naidu", "nayudu"], ["chh", "c"], ["ch", "c"], ["kh", "k"], ["gh", "g"], ["jh", "j"],
    ["th", "t"], ["dh", "d"], ["ph", "p"], ["bh", "b"], ["sh", "s"], ["aa", "a"], ["ee", "i"], ["ii", "i"],
    ["oo", "u"], ["uu", "u"], ["ow", "au"], ["w", "v"], ["z", "j"], ["q", "k"], ["x", "ks"], ["f", "p"]];
  for (const [a, b] of reps) s = s.split(a).join(b);
  s = s.replace(/ru/g, "ri")                        // ృ is keyed "ru", typed "ri": krishna == krushna
    .replace(/([^aeiou ])y\b/g, "$1i")              // reddy -> reddi
    .replace(/m(?=[kgcjtdnszyrlvh])/g, "n")         // anusvara before a consonant
    .replace(/(.)\1+/g, "$1");
  return s.replace(/\s+/g, "");
}

export const squash = (s) => String(s || "").toUpperCase().replace(/[\s.,]+/g, "").replace(/\//g, "-");
const TELUGU = /[ఀ-౿]/;

const keyCache = new WeakMap();
const keys = (o) => {
  if (!keyCache.has(o)) keyCache.set(o, { name: normLatin(o.key), rel: normLatin(o.rkey) });
  return keyCache.get(o);
};

// Builds a test function once per query, so filtering 4,000 voters stays instant.
export function compileQuery(query, field = "any") {
  const q = String(query || "").trim();
  if (!q) return null;
  const parts = q.split(/[\s,;]+/).filter(Boolean);

  // serial numbers: one, several, or a range
  const range = /^(\d+)\s*[-–]\s*(\d+)$/.exec(q);
  if (field === "sn" || (field === "any" && (range || parts.every((p) => /^\d+$/.test(p)) && parts.length > 1))) {
    if (range) { const a = +range[1], b = +range[2]; return (o) => o.sn >= Math.min(a, b) && o.sn <= Math.max(a, b); }
    const set = new Set(parts.filter((p) => /^\d+$/.test(p)).map(Number));
    return (o) => set.has(o.sn);
  }
  // voter IDs: letters followed by digits, one or many
  const epics = parts.map((p) => p.toUpperCase()).filter((p) => /^[A-Z]{2,4}\d{3,}$/.test(p));
  if (field === "epic" || (field === "any" && epics.length && epics.length === parts.length)) {
    const list = field === "epic" ? parts.map((p) => p.toUpperCase()) : epics;
    return (o) => list.some((t) => o.epic.includes(t));
  }
  if (field === "house") {
    const t = squash(q);
    return (o) => squash(o.house).includes(t);
  }
  const telugu = TELUGU.test(q);
  const tokens = telugu ? parts.map(squash) : parts.map(normLatin).filter((t) => t.length >= 2);
  const textHit = (o, which) => {
    if (telugu) {
      const s = squash(which === "name" ? o.name : o.rname);
      return tokens.every((t) => s.includes(t));
    }
    const k = keys(o)[which];
    return tokens.length > 0 && tokens.every((t) => k.includes(t));
  };
  if (field === "name") return (o) => textHit(o, "name");
  if (field === "rel") return (o) => textHit(o, "rel");

  // everything: a number is a serial no. or the start of a door number
  if (/^\d+$/.test(q)) return (o) => o.sn === +q || squash(o.house).startsWith(q);
  if (/\d/.test(q) && !telugu) {
    const t = squash(q);
    return (o) => squash(o.house).includes(t) || o.epic.includes(t);
  }
  const up = q.toUpperCase().replace(/\s+/g, "");
  return (o) => textHit(o, "name") || textHit(o, "rel") || (up.length >= 3 && o.epic.includes(up));
}
