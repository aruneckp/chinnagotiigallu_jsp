import { useState } from "react";
import { META, FAMILIES, HAS_POLLING_PARTS, groupLabel, partLabel, houseOf, person } from "../lib/data.js";
import { relationTo, closeness } from "../lib/kin.js";
import { go } from "../lib/route.js";
import { sex } from "../lib/stats.js";
import { SHOW_VOTER_ID } from "../config.js";
import VoterCard from "./VoterCard.jsx";
import { Avatar, SecHead } from "./ui.jsx";
import Icon from "./Icon.jsx";

const HOW = { "same house": "matched at the same house", "same building": "matched in the same building", "not on list": "not on this list" };

export function CopyButton({ text, label = "Copy" }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch {}
  };
  return (
    <button type="button" className="copybtn" onClick={copy} aria-label={`${label} ${text}`}>
      <Icon name={done ? "check" : "copy"} size={14} />{done ? "Copied" : label}
    </button>
  );
}

export default function VoterPage({ voter: o, results }) {
  const i = results.indexOf(o);
  const step = (d) => go("voter", results[i + d].id, true);
  const fam = FAMILIES.get(o.fam);
  const kin = [...fam.voters, ...fam.ghosts].filter((p) => p.id !== o.id)
    .map((p) => ({ p, rel: relationTo(o.id, p.id) }))
    .sort((a, b) => closeness(a.rel) - closeness(b.rel) || (b.p.age ?? 0) - (a.p.age ?? 0));
  const house = houseOf(o);
  const housemates = house ? house.voters.filter((x) => x !== o) : [];
  const relative = o.link ? person(o.link.to) : null;

  const facts = [
    ["Relative", <><span className="reltype">{o.rel || "Not printed"}</span> <span lang="te">{o.rname || "—"}</span></>],
    ["Age", `${o.age} years`],
    ["Gender", o.gender],
    ["House no.", o.house || "Not printed on the roll"],
    [META.partLabel ? "House group" : "Block", groupLabel(o.block)],
    ["Source PDF / village", o.sourceFile || partLabel(o.part)],
    ["Serial in PDF · page", `${o.sn}${o.page ? ` · ${o.page}` : ""}`],
    ...(HAS_POLLING_PARTS ? [["Assembly constituency part · serial", `Part ${o.booth} · serial ${o.bsn}`]] : []),
    ...(SHOW_VOTER_ID ? [["Voter ID card", <><span className="mono">{o.epic}</span> <CopyButton text={o.epic} /></>]] : []),
    ["Family link", relative
      ? <>{o.link.type} <span lang="te">{relative.name}</span> · {HOW[o.link.how] || o.link.how}</>
      : "No relative printed"],
    ...(o.link?.note ? [["Check", <span className="warn"><Icon name="alert" size={14} /> {o.link.note}</span>]] : []),
    ...(o.issue ? [["Roll reading", o.issue]] : []),
  ];

  return (
    <div className="page">
      <div className="topline">
        <button type="button" className="backbtn" onClick={() => go("voters")}><Icon name="left" size={18} /> Voter list</button>
        <div className="stepper">
          {i >= 0 && <span>{i + 1} / {results.length}</span>}
          <button type="button" className="iconbtn" disabled={i <= 0} onClick={() => step(-1)} aria-label="Previous voter"><Icon name="left" /></button>
          <button type="button" className="iconbtn" disabled={i < 0 || i >= results.length - 1} onClick={() => step(1)} aria-label="Next voter"><Icon name="right" /></button>
        </div>
      </div>

      <article className={"profile " + sex(o)}>
        <Avatar o={o} size="big" photo />
        <div className="profile-main">
          <h1 lang="te">{o.name}</h1>
          <p className="profile-latin">{o.key}</p>
          <p className="profile-no">Serial no. <b>{o.sn}</b>{SHOW_VOTER_ID && <> · <span className="mono">{o.epic}</span></>}</p>
        </div>
        <div className="profile-stats">
          <span><b>{o.age}</b>years</span>
          <span><b>{o.gender}</b>gender</span>
          <span><b>{o.sn}</b>serial in PDF</span>
          {HAS_POLLING_PARTS && <span><b>{o.booth}</b>polling part</span>}
        </div>
      </article>

      <dl className="facts">
        {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>

      <button type="button" className="cta" onClick={() => go("family", o.id, true)}>
        <span className="cta-icon"><Icon name="tree" size={22} /></span>
        <span><b>View family tree</b><small>{fam.size} voter{fam.size === 1 ? "" : "s"} on the list · {fam.ghosts.length} relative{fam.ghosts.length === 1 ? "" : "s"} not on it · {fam.gens} generation{fam.gens === 1 ? "" : "s"}</small></span>
        <Icon name="right" />
      </button>

      {kin.length > 0 && (
        <>
          <SecHead icon="family" title="Family" sub="How each person is related to this voter" />
          <div className="kinlist">
            {kin.map(({ p, rel }) => (
              p.ghost ? (
                <div key={p.id} className="kinrow ghost">
                  <Avatar o={p} />
                  <span className="kbody"><b>{rel}</b><span lang="te">{p.name}</span><small>Not on the voter list</small></span>
                </div>
              ) : (
                <button key={p.id} type="button" className="kinrow" onClick={() => go("voter", p.id, true)}>
                  <Avatar o={p} photo />
                  <span className="kbody"><b>{rel}</b><span lang="te">{p.name}</span><small>{p.age} yrs · #{p.sn} · {p.house || "house not printed"}</small></span>
                  <Icon name="right" size={16} />
                </button>
              )
            ))}
          </div>
        </>
      )}

      {housemates.length > 0 && (
        <>
          <SecHead icon="house" title={`Also at house ${house.label}`} sub={`${housemates.length} more voter${housemates.length === 1 ? "" : "s"} · ${house.families} famil${house.families === 1 ? "y" : "ies"}`}>
            <button type="button" className="linkbtn" onClick={() => go("house", house.id, true)}>Open house <Icon name="right" size={14} /></button>
          </SecHead>
          <div className="list">{housemates.map((x) => <VoterCard key={x.id} o={x} note={x.fam === o.fam ? relationTo(o.id, x.id) : null} />)}</div>
        </>
      )}
    </div>
  );
}
