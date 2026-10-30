import { useMemo } from "react";
import { HOUSES, BLOCKS, blockLabel } from "../lib/data.js";
import { compileQuery } from "../lib/search.js";
import { fmt, sex } from "../lib/stats.js";
import { go } from "../lib/route.js";
import { Chips, Pager, Empty, SecHead, GenderBar } from "./ui.jsx";
import Icon from "./Icon.jsx";

const PER_PAGE = 40;
const SIZES = [["1", "1 voter"], ["2+", "2+"], ["4+", "4+"], ["7+", "7+"]];
const SORTS = [["size", "Most voters"], ["fams", "Most families"], ["door", "Door no."]];
const BUCKETS = [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 9], [10, 999]];

export default function HousesPage({ state, setState }) {
  const set = (p) => setState((s) => ({ ...s, page: 1, ...p }));

  const list = useMemo(() => {
    const t = state.q.trim();
    const vq = t ? compileQuery(t, /\d/.test(t) && !/^[A-Z]{2,4}\d+$/i.test(t) ? "house" : "any") : null;
    const min = parseInt(state.size || "1", 10);
    const max = state.size && !state.size.endsWith("+") ? min : Infinity;
    const out = HOUSES.filter((h) => h.voters.length >= min && h.voters.length <= max
      && (!state.block || h.block === state.block)
      && (!vq || h.voters.some(vq)));
    const by = {
      size: (a, b) => b.voters.length - a.voters.length || b.families - a.families || a.id - b.id,
      fams: (a, b) => b.families - a.families || b.voters.length - a.voters.length || a.id - b.id,
      door: (a, b) => a.label.localeCompare(b.label, "en", { numeric: true }),
    }[state.sort];
    return out.sort(by);
  }, [state.q, state.block, state.size, state.sort]);

  const dist = useMemo(() => BUCKETS.map(([a, b]) => [a, b, HOUSES.filter((h) => h.voters.length >= a && h.voters.length <= b).length]), []);
  const distMax = Math.max(...dist.map((d) => d[2]));
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const page = Math.min(state.page, pages);
  const voters = list.reduce((t, h) => t + h.voters.length, 0);

  return (
    <div className="page">
      <SecHead icon="house" title="Households" sub="Voters grouped by door number, however it was typed on the roll. Useful for door-to-door visits." />

      <section className="card">
        <div className="cardhead"><h3>Voters per house</h3><span>{fmt(HOUSES.length)} door numbers · tap to filter</span></div>
        <div className="sizebars">
          {dist.map(([a, b, c]) => {
            const v = a === b ? String(a) : `${a}+`;
            return (
              <button key={a} type="button" className="sizebar" aria-pressed={state.size === v} onClick={() => set({ size: state.size === v ? "" : v })}>
                <span className="sb-n">{fmt(c)}</span>
                <span className="sb-track"><span style={{ height: `${Math.max(4, (c * 100) / distMax)}%` }} /></span>
                <span className="sb-label">{a === b ? a : b > 100 ? `${a}+` : `${a}–${b}`}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="toolbar">
        <div className="searchbox">
          <label className="searchinput">
            <Icon name="search" size={18} />
            <input type="search" value={state.q} onChange={(e) => set({ q: e.target.value })} enterKeyHint="search"
              placeholder="Door no. (20-48-S8-520) or a resident's name" aria-label="Search houses" />
            {state.q && <button type="button" className="clearq" aria-label="Clear search" onClick={() => set({ q: "" })}><Icon name="x" size={16} /></button>}
          </label>
        </div>
        <select className="blocksel" value={state.block} onChange={(e) => set({ block: e.target.value })} aria-label="Block">
          <option value="">All blocks</option>
          {BLOCKS.filter(([b]) => b).map(([b, n]) => <option key={b} value={b}>{blockLabel(b)} ({fmt(n)})</option>)}
        </select>
      </div>
      <div className="row-controls">
        <Chips value={state.size} options={SIZES} onChange={(v) => set({ size: v })} all="Any size" />
        <Chips value={state.sort} options={SORTS} onChange={(v) => set({ sort: v || "size" })} all={null} />
      </div>

      <div className="resultbar">
        <div className="rcount"><b>{fmt(list.length)}</b> houses<span className="rsub">{fmt(voters)} voters</span></div>
      </div>
      {!list.length && <Empty text="No house matches. Try part of the door number, like S8-520." action="Show all houses"
        onAction={() => set({ q: "", block: "", size: "" })} />}

      <div className="houselist">
        {list.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((h) => (
          <button key={h.id} type="button" className="housecard" onClick={() => go("house", h.id, true)}>
            <span className="hc-n"><b>{h.voters.length}</b><small>voter{h.voters.length === 1 ? "" : "s"}</small></span>
            <span className="hc-body">
              <span className="hc-title">{h.label}</span>
              <span className="hc-meta">{blockLabel(h.block)} · {h.families} famil{h.families === 1 ? "y" : "ies"} · <i className="dot male" />{h.male} <i className="dot female" />{h.voters.length - h.male}</span>
              <GenderBar m={h.male} f={h.voters.length - h.male} />
              <span className="fam-members">
                {h.voters.slice(0, 6).map((o) => <span key={o.id} className="mchip"><i className={"dot " + sex(o)} /><span lang="te">{o.name}</span> {o.age}</span>)}
                {h.voters.length > 6 && <span className="mchip">+{h.voters.length - 6}</span>}
              </span>
            </span>
            <Icon name="right" size={18} />
          </button>
        ))}
      </div>
      <div className="listfoot"><Pager page={page} pages={pages} onPage={(n) => { setState((s) => ({ ...s, page: n })); window.scrollTo(0, 0); }} /></div>
    </div>
  );
}
