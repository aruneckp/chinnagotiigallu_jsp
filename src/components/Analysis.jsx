import { useMemo, useState } from "react";
import { HAS_POLLING_PARTS, PARTS, BOOTHS, MAIN_BLOCKS, SERIES, FAMILIES, boothLabel, groupLabel, partLabel, seriesLabel, person } from "../lib/data.js";
import { EMPTY, activeFilters, clearFilter, isScoped, FAM_SIZES, RELATIONS, LINKS, CHECKS } from "../lib/filters.js";
import { summarize, groupBy, AGE_BANDS, bandLabel, bandOf, fmt, pct, ratio, inBucket } from "../lib/stats.js";
import { go } from "../lib/route.js";
import FilterPanel from "./FilterPanel.jsx";
import { Pyramid, AgeColumns, StackBars, HBars, Columns, Heat } from "./charts.jsx";
import { Kpi, SecHead } from "./ui.jsx";
import Icon from "./Icon.jsx";

const blockPatch = (b) => (b === "" ? { check: "noHouse" } : { block: b });
const bandPatch = (i) => { const [a, b] = AGE_BANDS[i]; return { ageMin: String(a), ageMax: b > 150 ? "" : String(b) }; };

// Dimensions for the breakdown table: [label, key of a voter, label of a key, filter for a key, key order]
const DIMS = {
  part: ["Village / PDF", (o) => o.part, partLabel, (k) => ({ part: String(k) }), () => PARTS.map((p) => p[0])],
  booth: ["Polling part", (o) => o.boothGroup, boothLabel, (k) => ({ booth: k }), () => BOOTHS.map((b) => b[0])],
  block: ["Block", (o) => o.blockGroup, groupLabel, blockPatch, () => [...MAIN_BLOCKS, "~other", "?", ""]],
  age: ["Age group", (o) => bandOf(o.age), (k) => bandLabel(AGE_BANDS[k]), bandPatch, () => AGE_BANDS.map((_, i) => i)],
  rel: ["Relative listed as", (o) => o.rel || "none", (k) => RELATIONS.find((r) => r[0] === k)?.[1] || k, (k) => ({ rel: k }), () => RELATIONS.map((r) => r[0])],
  fam: ["Family size", (o) => FAM_SIZES.find(([b]) => inBucket(o.famSize, b))[0], (k) => FAM_SIZES.find((r) => r[0] === k)[1], (k) => ({ fam: k }), () => FAM_SIZES.map((r) => r[0])],
  series: ["Voter ID series", (o) => o.series, seriesLabel, (k) => ({ series: k }), () => SERIES.map((s) => s[0])],
};

const COLS = [
  ["Voters", (r) => r.total], ["Men", (r) => r.male], ["Women", (r) => r.female],
  ["Women / 1,000 men", (r) => (r.male ? (r.female * 1000) / r.male : -1), (r) => ratio(r.female, r.male)],
  ["Avg age", (r) => r.avgAge, (r) => r.avgAge.toFixed(1)],
  ["18–25", (r) => r.young], ["60+", (r) => r.senior], ["Homes", (r) => r.households], ["Families", (r) => r.families],
];

function Breakdown({ list, total, openList }) {
  const [dim, setDim] = useState("part");
  const [sort, setSort] = useState(null);
  const [, keyOf, labelOf, patchOf, order] = DIMS[dim];
  const rows = useMemo(() => {
    const by = groupBy(list, keyOf);
    return order().filter((k) => by.has(k)).map((k) => ({ k, label: labelOf(k), ...summarize(by.get(k)) }));
  }, [list, dim]);
  const sorted = sort == null ? rows : [...rows].sort((a, b) => COLS[sort][1](b) - COLS[sort][1](a));
  const top = Math.max(1, ...rows.map((r) => r.total));
  const all = summarize(list);

  return (
    <section className="card span2">
      <div className="cardhead">
        <h3>Breakdown table</h3>
        <span>Pick what to group by. Tap a column to sort, a row to list its voters.</span>
      </div>
      <div className="chips dimtabs">
        {Object.entries(DIMS).filter(([k]) => k !== "booth" || HAS_POLLING_PARTS).map(([k, [label]]) => (
          <button key={k} type="button" className="chip" aria-pressed={dim === k} onClick={() => { setDim(k); setSort(null); }}>{label}</button>
        ))}
      </div>
      <div className="tablewrap">
        <table className="vtable breakdown">
          <thead>
            <tr>
              <th>{DIMS[dim][0]}</th>
              <th className="sharecol">Share</th>
              {COLS.map(([label], i) => (
                <th key={label} className="num sortable" aria-sort={sort === i ? "descending" : undefined}>
                  <button type="button" onClick={() => setSort(sort === i ? null : i)}>{label}{sort === i && <Icon name="down" size={12} />}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.k} onClick={() => openList(patchOf(r.k))}>
                <td><b>{r.label}</b></td>
                <td className="sharecol"><span className="share"><span style={{ width: `${(r.total * 100) / top}%` }} /></span><small>{pct(r.total, total)}%</small></td>
                {COLS.map(([label, val, show]) => <td key={label} className="num">{show ? show(r) : fmt(val(r))}</td>)}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td><b>All in view</b></td><td className="sharecol" />
              {COLS.map(([label, val, show]) => <td key={label} className="num">{show ? show(all) : fmt(val(all))}</td>)}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function TopList({ title, sub, items, empty }) {
  return (
    <section className="card">
      <div className="cardhead"><h3>{title}</h3><span>{sub}</span></div>
      {!items.length && <p className="muted">{empty}</p>}
      <ol className="toplist">
        {items.map((it) => (
          <li key={it.key}>
            <button type="button" onClick={it.open}>
              <span className="tl-n">{it.n}</span>
              <span className="tl-body"><b lang="te">{it.title}</b><small lang="te">{it.sub}</small></span>
              <Icon name="right" size={16} />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function Analysis({ filters, setFilters, results, openList }) {
  const [panel, setPanel] = useState(false);
  const list = results;
  const s = useMemo(() => summarize(list), [list]);
  const scoped = isScoped(filters);
  const active = activeFilters(filters);
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  const ages = useMemo(() => {
    const max = Math.max(85, ...list.map((o) => o.age));
    const cols = [];
    for (let a = 18; a <= max; a++) cols.push({ age: a, total: 0, male: 0, female: 0, other: 0 });
    for (const o of list) { const c = cols[o.age - 18]; if (c) { c.total++; c[o.g === "M" ? "male" : o.g === "F" ? "female" : "other"]++; } }
    return cols;
  }, [list]);

  const blocks = useMemo(() => {
    const by = groupBy(list, (o) => o.blockGroup);
    return [...MAIN_BLOCKS, "~other", "?", ""].filter((b) => by.has(b))
      .map((b) => ({ key: b, label: groupLabel(b), ...summarize(by.get(b)) }));
  }, [list]);

  const matrix = useMemo(() => {
    const m = {};
    for (const o of list) m[o.part + "|" + o.boothGroup] = (m[o.part + "|" + o.boothGroup] || 0) + 1;
    return m;
  }, [list]);

  const famRows = useMemo(() => {
    const by = groupBy(list, (o) => Math.min(o.famSize, 6));
    return [1, 2, 3, 4, 5, 6].map((n) => {
      const vs = by.get(n) || [];
      return { key: n, label: n === 6 ? "6+" : String(n), n: vs.length,
        extra: [["families", fmt(new Set(vs.map((o) => o.fam)).size)]] };
    });
  }, [list]);
  const hhRows = useMemo(() => {
    const B = [[0, 0, "Not printed"], [1, 1, "1"], [2, 2, "2"], [3, 3, "3"], [4, 4, "4"], [5, 6, "5–6"], [7, 9, "7–9"], [10, 999, "10+"]];
    return B.map(([a, b, label]) => {
      const vs = list.filter((o) => o.hhSize >= a && o.hhSize <= b);
      return { key: label, label, n: vs.length, a, b, extra: [["houses", fmt(new Set(vs.map((o) => o.houseId)).size)]] };
    }).filter((r) => r.n || r.a > 0);
  }, [list]);

  const count = (fn) => list.reduce((t, o) => t + (fn(o) ? 1 : 0), 0);
  const linkRows = LINKS.map(([k, label]) => ({ key: k, label, n: count((o) => o.linkKind === k) }));
  const relRows = RELATIONS.map(([k, label]) => ({ key: k, label, n: count((o) => (k === "none" ? !o.rel : o.rel === k)) }));
  const seriesRows = SERIES.map(([k]) => ({ key: k, label: seriesLabel(k), n: count((o) => o.series === k),
    hint: k === "other" ? `${new Set(list.filter((o) => o.series === "other").map((o) => o.prefix)).size} prefixes` : null }));
  const checkRows = CHECKS.map(([k, label]) => ({ key: k, label, n: count((o) => o.checks[k]) }));

  const bigFams = useMemo(() => {
    const ids = [...new Set(list.map((o) => o.fam))].map((id) => FAMILIES.get(id)).filter((f) => f.size > 1);
    return ids.sort((a, b) => b.size - a.size || b.gens - a.gens).slice(0, 8).map((f) => ({
      key: f.id, n: f.size, title: person(f.root).name,
      sub: `${f.gens} generations · ` + f.voters.map((o) => o.name).join(", "),
      open: () => go("family", f.voters[0].id, true),
    }));
  }, [list]);
  const bigHomes = useMemo(() => [...groupBy(list.filter((o) => o.houseId), (o) => o.houseId).values()]
    .sort((a, b) => b.length - a.length).slice(0, 8).map((vs) => ({
      key: vs[0].houseId, n: vs.length, title: `House ${vs[0].house}`,
      sub: vs.map((o) => o.name).join(", "), open: () => go("house", vs[0].houseId, true),
    })), [list]);

  const scopeSelect = (key, label, options) => (
    <label className="scopesel">
      <span>{label}</span>
      <select value={filters[key]} onChange={set(key)}>
        <option value="">All</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );

  return (
    <div className="page wide">
      <SecHead icon="chart" title="Analysis" sub="Every chart below uses the same voters: change the scope here or filter the voter list, then tap any bar, cell or row to list those voters." />

      <section className="scope">
        {scopeSelect("part", "Village / PDF", PARTS.map(([p]) => [String(p), partLabel(p)]))}
        {HAS_POLLING_PARTS && scopeSelect("booth", "Polling part", BOOTHS.map(([b]) => [b, boothLabel(b)]))}
        {scopeSelect("block", "Block", [...MAIN_BLOCKS.map((b) => [b, b]), ["~other", "Other blocks"], ["?", "Door no. unclear"]])}
        {scopeSelect("gen", "Gender", [["Male", "Men"], ["Female", "Women"]])}
        <button type="button" className={"filterbtn" + (panel ? " on" : "")} onClick={() => setPanel(!panel)} aria-expanded={panel}>
          <Icon name="sliders" size={18} /><span>More filters</span>{active.length > 0 && <b>{active.length}</b>}
        </button>
      </section>
      {panel && <div className="scope-panel"><FilterPanel filters={filters} setFilters={setFilters} total={list.length} showSort={false} /></div>}

      {scoped && (
        <div className="activechips">
          <span className="scopelabel">Analysing</span>
          {filters.q && <button type="button" className="achip" onClick={() => setFilters((f) => ({ ...f, q: "" }))}><span>“{filters.q}”</span><Icon name="x" size={14} /></button>}
          {active.map(([k, label]) => (
            <button key={k} type="button" className="achip" onClick={() => setFilters((f) => clearFilter(f, k))} aria-label={`Remove filter ${label}`}>
              <span>{label}</span><Icon name="x" size={14} />
            </button>
          ))}
          <button type="button" className="linkbtn" onClick={() => setFilters({ ...EMPTY, sort: filters.sort })}>Analyse all voters</button>
        </div>
      )}

      <section className="kpis">
        <Kpi icon="users" label={scoped ? "Voters in view" : "All voters"} value={fmt(s.total)} sub="tap to list them" onClick={() => go("voters")} />
        <Kpi icon="user" tone="gold" label="Men · women" value={`${fmt(s.male)} · ${fmt(s.female)}`} sub={`${pct(s.male, s.total)}% · ${pct(s.female, s.total)}%`} />
        <Kpi icon="chart" label="Women per 1,000 men" value={ratio(s.female, s.male)} sub="sex ratio" />
        <Kpi icon="id" tone="gold" label="Average age" value={s.avgAge.toFixed(1)} sub={`${fmt(s.firstTime)} first-time 18–19`} />
        <Kpi icon="house" label="Households" value={fmt(s.households)} sub={s.households ? `${(s.total / s.households).toFixed(1)} voters per door no.` : "–"} />
        <Kpi icon="tree" tone="gold" label="Families" value={fmt(s.families)} sub={`${fmt(count((o) => o.famSize > 1))} voters in families of 2+`} />
      </section>

      {!list.length ? (
        <p className="empty">No voters in this scope. <button type="button" className="linkbtn" onClick={() => setFilters(EMPTY)}>Analyse all voters</button></p>
      ) : (
        <div className="chartgrid">
          <Pyramid title="Age and gender" sub="Tap an age group to list those voters"
            rows={s.bands.map((b, i) => ({ ...b, i, label: bandLabel(AGE_BANDS[i]) }))}
            onPick={(r) => openList(bandPatch(r.i))} />
          <AgeColumns title="Voters by age" sub="Each column is one year of age" cols={ages}
            onPick={(c) => openList({ ageMin: String(c.age), ageMax: String(c.age) })} />

          <Breakdown list={list} total={s.total} openList={openList} />

          <StackBars title="Voters by block" sub="Block from the door number; small blocks grouped" rows={blocks}
            onPick={(r) => openList(blockPatch(r.key))} />
          {HAS_POLLING_PARTS && <Heat title="Village / PDF × polling part" sub="Where each source PDF's voters vote. Tap a cell to list them."
            rowLabel="Village / PDF" colLabel="Polling part"
            rows={PARTS.map(([p]) => ({ key: p, label: partLabel(p) }))}
            cols={BOOTHS.map(([b]) => ({ key: b, label: b === "other" ? "Other" : b }))}
            value={(r, c) => matrix[r.key + "|" + c.key] || 0}
            onPick={(r, c) => openList({ part: String(r.key), booth: c.key })} />}

          <Columns title="Family size" sub="Voters by how many of their family are on the list" rows={famRows}
            onPick={(r) => openList({ fam: r.key === 6 ? "6+" : String(r.key) })} />
          <Columns title="Voters per house" sub="Voters by how many voters share their door number" rows={hhRows}
            onPick={(r) => openList(r.a === 0 ? { check: "noHouse" } : { hh: r.b > 100 ? `${r.a}+` : r.a === r.b ? String(r.a) : `${r.a}-${r.b}` })} />

          <HBars title="Family links" sub="Whether the printed relative was found among the voters" rows={linkRows} total={s.total}
            onPick={(r) => openList({ link: r.key })} />
          <HBars title="Relative listed as" sub="As printed on the roll" rows={relRows} total={s.total}
            onPick={(r) => openList({ rel: r.key })} />
          <HBars title="Voter ID series" sub="First letters of the voter ID card number" rows={seriesRows} total={s.total}
            onPick={(r) => openList({ series: r.key })} />
          <HBars title="Data checks" sub="Entries worth checking against the printed roll" rows={checkRows} total={s.total}
            onPick={(r) => openList({ check: r.key })} />

          <TopList title="Largest families" sub="Most voters in one family" items={bigFams} empty="No families of two or more in this scope." />
          <TopList title="Largest households" sub="Most voters at one door number" items={bigHomes} empty="No house numbers in this scope." />
        </div>
      )}
    </div>
  );
}
