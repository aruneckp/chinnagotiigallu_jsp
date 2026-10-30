import { useMemo } from "react";
import { FAMILIES, BLOCKS, blockLabel, person } from "../lib/data.js";
import { compileQuery, normLatin, squash } from "../lib/search.js";
import { fmt, sex } from "../lib/stats.js";
import { go } from "../lib/route.js";
import { Chips, Pager, Empty, SecHead } from "./ui.jsx";
import Icon from "./Icon.jsx";

const PER_PAGE = 30;
const SIZES = [["2+", "2+ voters"], ["3+", "3+"], ["4+", "4+"], ["5+", "5+"], ["1", "Single voter"]];
const SORTS = [["size", "Largest first"], ["gens", "Most generations"], ["sn", "Roll order"]];

const ghostHit = (q) => {
  const t = q.trim();
  if (!t || /\d/.test(t)) return () => false;
  if (/[ఀ-౿]/.test(t)) { const s = squash(t); return (g) => squash(g.name).includes(s); }
  const k = normLatin(t);
  return (g) => k.length >= 2 && normLatin(g.key).includes(k);
};

export default function FamiliesPage({ state, setState }) {
  const set = (p) => setState((s) => ({ ...s, page: 1, ...p }));
  const all = useMemo(() => [...FAMILIES.values()], []);

  const list = useMemo(() => {
    const vq = compileQuery(state.q, "any"), gq = ghostHit(state.q);
    // "3+" is at least three voters, "3" exactly three
    const min = parseInt(state.size || "1", 10);
    const max = state.size && !state.size.endsWith("+") ? min : Infinity;
    const out = all.filter((f) => f.size >= min && f.size <= max
      && (!state.block || f.voters.some((o) => o.block === state.block))
      && (!vq || f.voters.some(vq) || f.ghosts.some(gq)));
    const by = {
      size: (a, b) => b.size - a.size || b.gens - a.gens || a.id - b.id,
      gens: (a, b) => b.gens - a.gens || b.size - a.size || a.id - b.id,
      sn: (a, b) => a.voters[0].sn - b.voters[0].sn,
    }[state.sort];
    return out.sort(by);
  }, [all, state.q, state.block, state.size, state.sort]);

  const dist = useMemo(() => {
    const m = new Map();
    for (const f of all) m.set(f.size, (m.get(f.size) || 0) + 1);
    return [...m].sort((a, b) => a[0] - b[0]);
  }, [all]);
  const distMax = Math.max(...dist.map((d) => d[1]));
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const page = Math.min(state.page, pages);
  const voters = list.reduce((t, f) => t + f.size, 0);

  return (
    <div className="page">
      <SecHead icon="tree" title="Families" sub="Voters linked through the father, husband or mother printed against them. Tap a family to see its tree." />

      <section className="card">
        <div className="cardhead"><h3>Family sizes</h3><span>Voters on the list per family · tap to filter</span></div>
        <div className="sizebars">
          {dist.map(([n, c]) => (
            <button key={n} type="button" className="sizebar" aria-pressed={state.size === String(n)}
              onClick={() => set({ size: state.size === String(n) ? "" : String(n) })}>
              <span className="sb-n">{fmt(c)}</span>
              <span className="sb-track"><span style={{ height: `${Math.max(4, (c * 100) / distMax)}%` }} /></span>
              <span className="sb-label">{n} voter{n === 1 ? "" : "s"}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="toolbar">
        <div className="searchbox">
          <label className="searchinput">
            <Icon name="search" size={18} />
            <input type="search" value={state.q} onChange={(e) => set({ q: e.target.value })} enterKeyHint="search"
              placeholder="Any member's name, voter ID, house no. or serial no." aria-label="Search families" />
            {state.q && <button type="button" className="clearq" aria-label="Clear search" onClick={() => set({ q: "" })}><Icon name="x" size={16} /></button>}
          </label>
        </div>
        <select className="blocksel" value={state.block} onChange={(e) => set({ block: e.target.value })} aria-label="Block">
          <option value="">All blocks</option>
          {BLOCKS.filter(([b]) => b).map(([b, n]) => <option key={b} value={b}>{blockLabel(b)} ({fmt(n)})</option>)}
        </select>
      </div>
      <div className="row-controls">
        <Chips value={state.size} options={SIZES} onChange={(v) => set({ size: v })} all="All sizes" />
        <Chips value={state.sort} options={SORTS} onChange={(v) => set({ sort: v || "size" })} all={null} />
      </div>

      <div className="resultbar">
        <div className="rcount"><b>{fmt(list.length)}</b> families<span className="rsub">{fmt(voters)} voters</span></div>
      </div>

      {!list.length && <Empty text="No family matches. Try another spelling or remove a filter." action="Show all families"
        onAction={() => set({ q: "", block: "", size: "" })} />}

      <div className="famlist">
        {list.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((f) => {
          const root = person(f.root);
          const first = f.voters[0];
          return (
            <button key={f.id} type="button" className="famcard" onClick={() => go("family", first.id, true)}>
              <span className="fam-size"><b>{f.size}</b><small>voter{f.size === 1 ? "" : "s"}</small></span>
              <span className="fam-body">
                <span className="fam-title"><span lang="te">{root.name}</span>{root.ghost && <small>not on list</small>}</span>
                <span className="fam-meta">
                  {f.gens} generation{f.gens === 1 ? "" : "s"} · {f.houses.length ? `House ${f.houses.slice(0, 2).join(", ")}${f.houses.length > 2 ? ` +${f.houses.length - 2}` : ""}` : "House not printed"}
                  {f.ghosts.length > 0 && ` · ${f.ghosts.length} not on list`}
                </span>
                <span className="fam-members">
                  {f.voters.slice(0, 8).map((o) => (
                    <span key={o.id} className="mchip"><i className={"dot " + sex(o)} /><span lang="te">{o.name}</span> {o.age}</span>
                  ))}
                  {f.voters.length > 8 && <span className="mchip">+{f.voters.length - 8}</span>}
                </span>
              </span>
              <Icon name="right" size={18} />
            </button>
          );
        })}
      </div>
      <div className="listfoot"><Pager page={page} pages={pages} onPage={(n) => { setState((s) => ({ ...s, page: n })); window.scrollTo(0, 0); }} /></div>
    </div>
  );
}
