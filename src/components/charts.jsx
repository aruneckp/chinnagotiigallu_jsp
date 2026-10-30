import { fmt, pct } from "../lib/stats.js";
import { useTip, TipRows } from "./ui.jsx";

// Every mark is a button: hover or focus shows the numbers, a click lists those voters.

export function Legend({ items }) {
  return (
    <div className="chart-legend">
      {items.map(([cls, label]) => <span key={label}><i className={"swatch " + cls} />{label}</span>)}
    </div>
  );
}

export function ChartCard({ title, sub, legend, children, wide, tip }) {
  return (
    <section className={"card chart" + (wide ? " span2" : "")} ref={tip?.box}>
      <div className="cardhead"><h3>{title}</h3>{sub && <span>{sub}</span>}</div>
      {legend && <Legend items={legend} />}
      {children}
      {tip?.el}
    </section>
  );
}

const mfRows = (r) => [["men", fmt(r.male), "male"], ["women", fmt(r.female), "female"], ...(r.other ? [["third gender", fmt(r.other), "other"]] : [])];

// Age pyramid: men to the left of the age labels, women to the right.
export function Pyramid({ rows, onPick, title, sub }) {
  const tip = useTip();
  const side = Math.max(1, ...rows.flatMap((r) => [r.male, r.female]));
  const total = rows.reduce((t, r) => t + r.total, 0);
  return (
    <ChartCard title={title} sub={sub} tip={tip} legend={[["male", "Men"], ["female", "Women"]]}>
      <div className="pyr">
        {rows.map((r) => (
          <button key={r.label} type="button" className="pyr-row" onClick={() => onPick(r)}
            {...tip.bind(<TipRows title={`Age ${r.label}`} rows={[["voters", `${fmt(r.total)} · ${pct(r.total, total)}%`], ...mfRows(r)]} />)}>
            <span className="pyr-side left"><em>{fmt(r.male)}</em><span className="bar male" style={{ width: `${(r.male * 100) / side}%` }} /></span>
            <span className="pyr-label">{r.label}</span>
            <span className="pyr-side"><span className="bar female" style={{ width: `${(r.female * 100) / side}%` }} /><em>{fmt(r.female)}</em></span>
          </button>
        ))}
      </div>
    </ChartCard>
  );
}

const niceMax = (v) => {
  if (v <= 5) return 5;
  const p = 10 ** Math.floor(Math.log10(v)), m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
};

// Single-year columns, one series. Ticks every ten years.
export function AgeColumns({ cols, onPick, title, sub }) {
  const tip = useTip();
  const top = niceMax(Math.max(1, ...cols.map((c) => c.total)));
  const peak = cols.reduce((a, c) => (c.total > a.total ? c : a), cols[0]);
  return (
    <ChartCard title={title} sub={sub} tip={tip}>
      <div className="colchart">
        <div className="yaxis"><span>{fmt(top)}</span><span>{fmt(top / 2)}</span><span>0</span></div>
        <div className="plot">
          <div className="grid"><i /><i /><i /></div>
          <div className="cols">
            {cols.map((c) => (
              <button key={c.age} type="button" className="col" onClick={() => onPick(c)}
                aria-label={`Age ${c.age}: ${c.total} voters`}
                {...tip.bind(<TipRows title={`Age ${c.age}`} rows={[["voters", fmt(c.total)], ...mfRows(c)]} />)}>
                <span className="colbar" style={{ height: `${(c.total * 100) / top}%` }} />
                {c === peak && c.total > 0 && <span className="peak" style={{ bottom: `${(c.total * 100) / top}%` }}>{c.total} at {c.age}</span>}
              </button>
            ))}
          </div>
          <div className="xaxis">
            {cols.map((c) => <span key={c.age}>{c.age % 10 === 0 ? c.age : ""}</span>)}
          </div>
        </div>
      </div>
    </ChartCard>
  );
}

// Horizontal bars split into men and women, value at the tip.
export function StackBars({ rows, onPick, title, sub }) {
  const tip = useTip();
  const top = Math.max(1, ...rows.map((r) => r.total));
  const all = rows.reduce((t, r) => t + r.total, 0);
  return (
    <ChartCard title={title} sub={sub} tip={tip} legend={[["male", "Men"], ["female", "Women"]]}>
      <div className="sbars">
        {rows.map((r) => (
          <button key={r.key} type="button" className="sbar" onClick={() => onPick(r)} disabled={!r.total}
            {...tip.bind(<TipRows title={r.label} rows={[["voters", `${fmt(r.total)} · ${pct(r.total, all)}%`], ...mfRows(r)]} />)}>
            <span className="sbar-label">{r.label}</span>
            <span className="sbar-track">
              <span className="sbar-fill" style={{ width: `${(r.total * 100) / top}%` }}>
                {r.male > 0 && <span className="sseg male" style={{ flexGrow: r.male }} />}
                {r.female > 0 && <span className="sseg female" style={{ flexGrow: r.female }} />}
                {r.other > 0 && <span className="sseg other" style={{ flexGrow: r.other }} />}
              </span>
              <em>{fmt(r.total)}</em>
            </span>
          </button>
        ))}
      </div>
    </ChartCard>
  );
}

// One-series horizontal bars with share of the scope.
export function HBars({ rows, onPick, title, sub, total }) {
  const tip = useTip();
  const top = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ChartCard title={title} sub={sub} tip={tip}>
      <div className="hbars">
        {rows.map((r) => (
          <button key={r.key} type="button" className="hbar" onClick={() => onPick && onPick(r)} disabled={!onPick || !r.n}
            {...tip.bind(<TipRows title={r.label} rows={[["voters", fmt(r.n)], ["of the voters in view", `${pct(r.n, total)}%`]]} />)}>
            <span className="hbar-label">{r.label}{r.hint && <small>{r.hint}</small>}</span>
            <span className="hbar-track"><span style={{ width: `${(r.n * 100) / top}%` }} /><em>{fmt(r.n)}<small> · {pct(r.n, total)}%</small></em></span>
          </button>
        ))}
      </div>
    </ChartCard>
  );
}

// Vertical columns for small ordered distributions (family size, voters per house).
export function Columns({ rows, onPick, title, sub, unit = "voters" }) {
  const tip = useTip();
  const top = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ChartCard title={title} sub={sub} tip={tip}>
      <div className="sizebars">
        {rows.map((r) => (
          <button key={r.key} type="button" className="sizebar" onClick={() => onPick(r)} disabled={!r.n}
            {...tip.bind(<TipRows title={r.label} rows={[[unit, fmt(r.n)], ...(r.extra || [])]} />)}>
            <span className="sb-n">{fmt(r.n)}</span>
            <span className="sb-track"><span style={{ height: `${Math.max(r.n ? 3 : 0, (r.n * 100) / top)}%` }} /></span>
            <span className="sb-label">{r.label}</span>
          </button>
        ))}
      </div>
    </ChartCard>
  );
}

// Count matrix on a one-hue ramp; the number is always printed in the cell.
export function Heat({ rows, cols, value, onPick, title, sub, rowLabel, colLabel }) {
  const tip = useTip();
  const max = Math.max(1, ...rows.flatMap((r) => cols.map((c) => value(r, c))));
  return (
    <ChartCard title={title} sub={sub} tip={tip}>
      <div className="tablewrap">
        <table className="heat">
          <thead>
            <tr><th>{rowLabel} \ {colLabel}</th>{cols.map((c) => <th key={c.key}>{c.label}</th>)}<th>Total</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const tot = cols.reduce((t, c) => t + value(r, c), 0);
              return (
                <tr key={r.key}>
                  <th>{r.label}</th>
                  {cols.map((c) => {
                    const n = value(r, c), t = n / max;
                    return (
                      <td key={c.key}>
                        {n > 0 ? (
                          <button type="button" className={"hcell" + (t > 0.55 ? " deep" : "")} style={{ "--t": 0.08 + t * 0.92 }}
                            onClick={() => onPick(r, c)}
                            {...tip.bind(<TipRows title={`${r.label} · ${c.label}`} rows={[["voters", fmt(n)], [`of ${r.label}`, `${pct(n, tot)}%`]]} />)}>
                            {fmt(n)}
                          </button>
                        ) : <span className="hcell none">–</span>}
                      </td>
                    );
                  })}
                  <td className="htotal">{fmt(tot)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="heatscale"><span>fewer</span><i /><span>more voters</span></div>
    </ChartCard>
  );
}
