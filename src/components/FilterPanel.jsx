import { useMemo } from "react";
import { VOTERS } from "../lib/data.js";
import { EMPTY, FACETS, SORTS, facetCounts } from "../lib/filters.js";
import { AGE_BANDS, bandLabel, fmt } from "../lib/stats.js";
import Icon from "./Icon.jsx";

// All filters in one place. Each option shows how many voters it would give with
// the other filters kept, so dead ends are visible before tapping.
export default function FilterPanel({ filters, setFilters, total, onClose, showSort = true }) {
  const counts = useMemo(() => facetCounts(VOTERS, filters), [filters]);
  const set = (k) => (v) => setFilters((f) => ({ ...f, [k]: v }));
  const band = AGE_BANDS.findIndex(([a, b]) => String(a) === filters.ageMin && (b > 150 ? "" : String(b)) === filters.ageMax);

  return (
    <section className="filters" aria-label="Filters">
      <div className="filters-head">
        <h3><Icon name="sliders" size={16} /> Filters</h3>
        <button type="button" className="linkbtn" onClick={() => setFilters({ ...EMPTY, q: filters.q, qf: filters.qf, sort: filters.sort })}>Reset</button>
        {onClose && <button type="button" className="iconbtn sm" onClick={onClose} aria-label="Close filters"><Icon name="x" size={16} /></button>}
      </div>

      <div className="fgroup">
        <h4>Age</h4>
        <div className="chips">
          {AGE_BANDS.map(([a, b], i) => (
            <button key={a} type="button" className="chip" aria-pressed={band === i}
              onClick={() => setFilters((f) => band === i ? { ...f, ageMin: "", ageMax: "" }
                : { ...f, ageMin: String(a), ageMax: b > 150 ? "" : String(b) })}>
              {bandLabel([a, b])}
            </button>
          ))}
        </div>
        <div className="agerange">
          <input type="number" inputMode="numeric" min="18" max="120" placeholder="From" aria-label="Minimum age"
            value={filters.ageMin} onChange={(e) => set("ageMin")(e.target.value)} />
          <span>to</span>
          <input type="number" inputMode="numeric" min="18" max="120" placeholder="To" aria-label="Maximum age"
            value={filters.ageMax} onChange={(e) => set("ageMax")(e.target.value)} />
        </div>
      </div>

      {FACETS.map((x) => {
        const c = counts[x.key];
        const opts = x.options();
        return (
          <div key={x.key} className="fgroup">
            <h4>{x.label}</h4>
            {x.select ? (
              <select value={filters[x.key]} onChange={(e) => set(x.key)(e.target.value)}>
                <option value="">All</option>
                {opts.map(([v, label]) => (
                  <option key={v} value={v} disabled={!c[v] && filters[x.key] !== v}>{label} ({fmt(c[v])})</option>
                ))}
              </select>
            ) : (
              <div className="chips">
                {opts.map(([v, label]) => (
                  <button key={v} type="button" className="chip" aria-pressed={filters[x.key] === v}
                    disabled={!c[v] && filters[x.key] !== v}
                    onClick={() => set(x.key)(filters[x.key] === v ? "" : v)}>
                    {label}<small>{fmt(c[v])}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {showSort && (
        <div className="fgroup">
          <h4>Sort by</h4>
          <div className="chips">
            {Object.entries(SORTS).map(([k, [label]]) => (
              <button key={k} type="button" className="chip" aria-pressed={filters.sort === k} onClick={() => set("sort")(k)}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {onClose && (
        <div className="factions">
          <button type="button" className="btn primary block" onClick={onClose}>Show {fmt(total)} voters</button>
        </div>
      )}
    </section>
  );
}
