import { useEffect } from "react";
import { META, HAS_POLLING_PARTS, groupLabel, partLabel } from "../lib/data.js";
import { EMPTY, activeFilters, clearFilter, activeCount } from "../lib/filters.js";
import { SEARCH_FIELDS, PLACEHOLDER } from "../lib/search.js";
import { summarize, fmt, sex } from "../lib/stats.js";
import { toCSV, download } from "../lib/csv.js";
import { go } from "../lib/route.js";
import { PAGE_SIZES, SHOW_VOTER_ID } from "../config.js";
import FilterPanel from "./FilterPanel.jsx";
import VoterCard from "./VoterCard.jsx";
import { Pager, Empty } from "./ui.jsx";
import Icon from "./Icon.jsx";

// Table columns: [label, sort key (or [asc, desc]), cell]
const columnsFor = (hasPollingParts) => [
  ["#", "sn", (o) => o.sn],
  ["Name", "name", (o) => (
    <button type="button" className="rowlink" onClick={(e) => { e.stopPropagation(); go("voter", o.id, true); }}>
      <span lang="te">{o.name}</span><small>{o.key}</small>
    </button>
  )],
  ["Relative", null, (o) => <><small className="reltype">{o.rel || "—"}</small> <span lang="te">{o.rname}</span></>],
  ["Age", ["age", "-age"], (o) => o.age],
  ["Gender", null, (o) => <span className={"gtag " + sex(o)}>{o.g}</span>],
  ["House no.", "house", (o) => (o.house ? <span className="nowrap">{o.house}</span> : <span className="muted">not printed</span>)],
  [META.partLabel ? "House group" : "Block", null, (o) => groupLabel(o.block)],
  [META.partLabel || "Part", null, (o) => partLabel(o.part)],
  ...(hasPollingParts ? [["Polling part · sl.", "booth", (o) => `${o.booth} · ${o.bsn}`]] : []),
  ...(SHOW_VOTER_ID ? [["Voter ID", null, (o) => <span className="mono">{o.epic}</span>]] : []),
  ["Family", "-fam", (o) => (
    <button type="button" className={"fambtn" + (o.famSize > 1 ? " on" : "")} title="Open family tree"
      onClick={(e) => { e.stopPropagation(); go("family", o.id, true); }}>
      <Icon name="tree" size={13} />{o.famSize}
    </button>
  )],
];

export function exportVoters(list, name) {
  const head = ["Source PDF", "Serial no. in PDF", "Roll page", ...(HAS_POLLING_PARTS ? ["Assembly constituency part", "Assembly constituency serial"] : []), "Name", "Name (English sound)",
    "Relation", "Relative's name", "Age", "Gender", "House no.", "Block", ...(SHOW_VOTER_ID ? ["Voter ID card"] : []),
    "Family id", "Family size (voters)", "Voters at the house", "Family link", "Link note"];
  const rows = list.map((o) => [o.sourceFile || partLabel(o.part), o.sn, o.page, ...(HAS_POLLING_PARTS ? [o.booth, o.bsn] : []), o.name, o.key, o.rel, o.rname, o.age, o.gender,
    o.house, groupLabel(o.block), ...(SHOW_VOTER_ID ? [o.epic] : []), o.fam, o.famSize, o.hhSize || "",
    { voter: "Relative on the list", ghost: "Relative not on the list", none: "" }[o.linkKind], o.link?.note || ""]);
  download(name, toCSV(head, rows));
}

export default function VotersPage({ filters, setFilters, results, list, setList }) {
  const COLUMNS = columnsFor(HAS_POLLING_PARTS);
  const set = (k) => (v) => setFilters((f) => ({ ...f, [k]: v }));
  const patch = (p) => setList((l) => ({ ...l, ...p }));
  const s = summarize(results);
  const active = activeFilters(filters);
  const pages = Math.max(1, Math.ceil(results.length / list.size));
  const page = Math.min(list.page, pages);
  const rows = results.slice((page - 1) * list.size, page * list.size);
  const toPage = (n) => { patch({ page: n }); window.scrollTo(0, 0); };

  // the filter sheet covers the list on phones: close it with Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") patch({ panel: false }); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sortBy = (key) => {
    if (!key) return;
    if (Array.isArray(key)) set("sort")(filters.sort === key[0] ? key[1] : key[0]);
    else set("sort")(key);
  };
  const sortState = (key) => {
    if (!key) return undefined;
    const ks = Array.isArray(key) ? key : [key];
    return ks[0] === filters.sort ? "ascending" : ks[1] === filters.sort ? "descending" : undefined;
  };

  return (
    <div className="page wide">
      <div className="toolbar">
        <div className="searchbox">
          <select value={filters.qf} onChange={(e) => set("qf")(e.target.value)} aria-label="Search in">
            {SEARCH_FIELDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <label className="searchinput">
            <Icon name="search" size={18} />
            <input type="search" value={filters.q} onChange={(e) => set("q")(e.target.value)} enterKeyHint="search"
              autoComplete="off" placeholder={PLACEHOLDER[filters.qf]} aria-label="Search voters" />
            {filters.q && <button type="button" className="clearq" aria-label="Clear search" onClick={() => set("q")("")}><Icon name="x" size={16} /></button>}
          </label>
        </div>
        <button type="button" className={"filterbtn" + (list.panel ? " on" : "")} aria-expanded={list.panel}
          onClick={() => patch({ panel: !list.panel })}>
          <Icon name="sliders" size={18} /><span>Filters</span>{activeCount(filters) > 0 && <b>{activeCount(filters)}</b>}
        </button>
        <div className="seg" role="group" aria-label="View">
          <button type="button" aria-pressed={list.view === "table"} onClick={() => patch({ view: "table" })} title="Table"><Icon name="table" size={18} /><span>Table</span></button>
          <button type="button" aria-pressed={list.view === "cards"} onClick={() => patch({ view: "cards" })} title="Cards"><Icon name="cards" size={18} /><span>Cards</span></button>
        </div>
      </div>

      <div className={"listlayout" + (list.panel ? " withpanel" : "")}>
        {list.panel && (
          <aside className="panel" onClick={(e) => { if (e.target === e.currentTarget) patch({ panel: false }); }}>
            <FilterPanel filters={filters} setFilters={setFilters} total={results.length} onClose={() => patch({ panel: false })} />
          </aside>
        )}

        <div className="listmain">
          {(active.length > 0 || filters.q) && (
            <div className="activechips">
              {filters.q && (
                <button type="button" className="achip" onClick={() => set("q")("")} aria-label="Remove search">
                  <span>“{filters.q}”</span><Icon name="x" size={14} />
                </button>
              )}
              {active.map(([k, label]) => (
                <button key={k} type="button" className="achip" onClick={() => setFilters((f) => clearFilter(f, k))} aria-label={`Remove filter ${label}`}>
                  <span>{label}</span><Icon name="x" size={14} />
                </button>
              ))}
              <button type="button" className="linkbtn" onClick={() => setFilters({ ...EMPTY, sort: filters.sort })}>Clear all</button>
            </div>
          )}

          <div className="resultbar">
            <div className="rcount">
              <b>{fmt(results.length)}</b> voters
              <span className="rsub"><i className="dot male" />{fmt(s.male)} <i className="dot female" />{fmt(s.female)} · {fmt(s.households)} homes · {fmt(s.families)} families · avg {s.avgAge.toFixed(1)} yrs</span>
            </div>
            <div className="ractions">
              <button type="button" className="btn sm" onClick={() => go("analysis")} disabled={!results.length}><Icon name="chart" size={16} /> Analyse these</button>
              <button type="button" className="btn sm" onClick={() => exportVoters(results, `${META.place ? "chinnagottigallu" : `ward${META.ward}`}_voters.csv`)} disabled={!results.length}><Icon name="download" size={16} /> CSV</button>
              <button type="button" className="btn sm hide-sm" onClick={() => window.print()} disabled={!results.length}><Icon name="print" size={16} /> Print page</button>
            </div>
          </div>

          {!results.length && (
            <Empty text="No voters match. Try another spelling, search in a different field, or remove a filter."
              action="Clear search and filters" onAction={() => setFilters(EMPTY)} />
          )}

          {results.length > 0 && list.view === "table" && (
            <div className="tablewrap">
              <table className="vtable">
                <thead>
                  <tr>
                    {COLUMNS.map(([label, key]) => (
                      <th key={label} aria-sort={sortState(key)} className={key ? "sortable" : undefined}>
                        {key ? (
                          <button type="button" onClick={() => sortBy(key)}>
                            {label}<Icon name={sortState(key) === "descending" ? "down" : "up"} size={12} />
                          </button>
                        ) : label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.id} onClick={() => go("voter", o.id, true)}>
                      {COLUMNS.map(([label, , cell]) => <td key={label}>{cell(o)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {results.length > 0 && list.view === "cards" && (
            <div className="list">{rows.map((o) => <VoterCard key={o.id} o={o} />)}</div>
          )}

          {results.length > 0 && (
            <div className="listfoot">
              <span>
                {fmt((page - 1) * list.size + 1)}–{fmt(Math.min(page * list.size, results.length))} of {fmt(results.length)}
              </span>
              <Pager page={page} pages={pages} onPage={toPage} />
              <label className="pagesize">
                <span>Per page</span>
                <select value={list.size} onChange={(e) => patch({ size: +e.target.value, page: 1 })}>
                  {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                  <option value={100000}>All</option>
                </select>
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
