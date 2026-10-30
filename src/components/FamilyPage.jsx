import { useEffect, useRef } from "react";
import { FAMILIES, person } from "../lib/data.js";
import { familyTree, relationTo, closeness } from "../lib/kin.js";
import { go } from "../lib/route.js";
import { sex } from "../lib/stats.js";
import { SHOW_VOTER_ID } from "../config.js";
import { Avatar } from "./ui.jsx";
import Icon from "./Icon.jsx";

function Node({ id, focus }) {
  const p = person(id);
  const rel = relationTo(focus, id);
  const note = p.link?.note;
  const body = (
    <>
      <span className="tn-rel">{rel === "Selected" ? "Selected voter" : rel}</span>
      <Avatar o={p} photo />
      <span className="tn-name" lang="te">{p.name}</span>
      <span className="tn-meta">
        {p.ghost ? "Not on the list" : `${p.age} yrs · #${p.sn}`}
        {note && <span className="tn-warn" title={note}><Icon name="alert" size={12} /></span>}
      </span>
    </>
  );
  if (p.ghost) return <div className="tnode ghost">{body}</div>;
  return (
    <button type="button" className={"tnode " + sex(p) + (id === focus ? " focus" : "") + (note ? " unsure" : "")}
      onClick={() => go("family", id)} title="Show relations to this voter" data-id={id}>
      {body}
    </button>
  );
}

function Branch({ node, focus }) {
  return (
    <li>
      <div className={"unit" + (node.spouses.length ? " couple" : "")}>
        <Node id={node.id} focus={focus} />
        {node.spouses.map((s) => <Node key={s} id={s} focus={focus} />)}
      </div>
      {node.children.length > 0 && <ul>{node.children.map((c) => <Branch key={c.id} node={c} focus={focus} />)}</ul>}
    </li>
  );
}

const HOW = { "same house": "same house", "same building": "same building", "not on list": "not on list" };

export default function FamilyPage({ voter }) {
  const fam = FAMILIES.get(voter.fam);
  const tree = familyTree(voter.fam);
  const root = person(fam.root);
  const focus = voter.id;
  const wrap = useRef(null);

  // keep the selected voter in view when the tree is wider than the screen
  useEffect(() => {
    const el = wrap.current?.querySelector(`[data-id="${focus}"]`);
    if (el && wrap.current.scrollWidth > wrap.current.clientWidth) {
      const w = wrap.current, r = el.getBoundingClientRect(), wr = w.getBoundingClientRect();
      w.scrollLeft += r.left - wr.left - wr.width / 2 + r.width / 2;
    }
  }, [focus]);

  const members = [...fam.voters, ...fam.ghosts]
    .map((p) => ({ p, rel: relationTo(focus, p.id) }))
    .sort((a, b) => closeness(a.rel) - closeness(b.rel) || (b.p.age ?? 0) - (a.p.age ?? 0));

  return (
    <div className="page wide">
      <div className="topline">
        <button type="button" className="backbtn" onClick={() => go("voter", focus)}><Icon name="left" size={18} /> Voter #{voter.sn}</button>
        <button type="button" className="backbtn" onClick={() => go("families")}><Icon name="tree" size={16} /> All families</button>
      </div>

      <section className="card famhead">
        <div>
          <p className="eyebrow">Family {fam.id}</p>
          <h1>Family of <span lang="te">{root.name}</span></h1>
          <p className="muted">Tap anyone in the tree to see how the others are related to them.</p>
        </div>
        <div className="famstats">
          <span><b>{fam.size}</b>on the list</span>
          <span><b>{fam.ghosts.length}</b>not on list</span>
          <span><b>{fam.gens}</b>generation{fam.gens === 1 ? "" : "s"}</span>
          <span><b>{fam.houses.length || "–"}</b>house{fam.houses.length === 1 ? "" : "s"}</span>
        </div>
      </section>

      <div className="treelegend">
        <span><i className="dot male" /> Man</span>
        <span><i className="dot female" /> Woman</span>
        <span><i className="swatch ghost" /> Relative not on the list</span>
        <span><i className="swatch focus" /> Selected voter</span>
        <span><Icon name="alert" size={12} /> Link to check</span>
      </div>

      <div className="treewrap" ref={wrap}>
        <ul className="tree">{tree.map((n) => <Branch key={n.id} node={n} focus={focus} />)}</ul>
      </div>

      <section className="card">
        <div className="cardhead">
          <h3>Members</h3>
          <span>Relation to <b lang="te">{voter.name}</b></span>
        </div>
        <div className="tablewrap">
          <table className="vtable compact">
            <thead>
              <tr><th>Relation</th><th>Name</th><th>Age</th><th>House no.</th>{SHOW_VOTER_ID && <th>Voter ID</th>}<th>#</th><th>Printed relative</th></tr>
            </thead>
            <tbody>
              {members.map(({ p, rel }) => (
                <tr key={p.id} className={p.ghost ? "ghostrow" : p.id === focus ? "focusrow" : undefined}
                  onClick={p.ghost ? undefined : () => go("voter", p.id, true)}>
                  <td><b>{rel === "Selected" ? "Selected" : rel}</b></td>
                  <td><span lang="te">{p.name}</span>{p.ghost && <small className="muted"> · not on list</small>}</td>
                  <td>{p.age ?? "–"}</td>
                  <td>{p.house || "–"}</td>
                  {SHOW_VOTER_ID && <td className="mono">{p.epic || "–"}</td>}
                  <td>{p.sn || "–"}</td>
                  <td className="nowrap">{p.link ? <>{p.link.type} · {HOW[p.link.how] || p.link.how}{p.link.note && <span className="warn" title={p.link.note}> <Icon name="alert" size={12} /></span>}</> : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {members.some((m) => m.p.link?.note) && (
          <ul className="notes">
            {members.filter((m) => m.p.link?.note).map(({ p }) => (
              <li key={p.id}><Icon name="alert" size={12} /> <span lang="te">{p.name}</span>: {p.link.note}</li>
            ))}
          </ul>
        )}
        <p className="source">
          Links come from the father, husband or mother name printed against each voter, matched by name to a voter
          at the same house (or the same building), with age and gender checks. Check them locally before relying on them.
        </p>
      </section>
    </div>
  );
}
