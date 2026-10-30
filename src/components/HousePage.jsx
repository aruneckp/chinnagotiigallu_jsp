import { FAMILIES, blockLabel, person } from "../lib/data.js";
import { relationTo } from "../lib/kin.js";
import { summarize, groupBy, fmt } from "../lib/stats.js";
import { go } from "../lib/route.js";
import { exportVoters } from "./VotersPage.jsx";
import VoterCard from "./VoterCard.jsx";
import { GenderBar } from "./ui.jsx";
import Icon from "./Icon.jsx";

export default function HousePage({ house: h }) {
  const s = summarize(h.voters);
  // families at this door, largest first; within a family the eldest leads and the
  // others are labelled by their relation to that voter
  const groups = [...groupBy(h.voters, (o) => o.fam)].map(([fam, list]) => {
    const sorted = [...list].sort((a, b) => b.age - a.age);
    return { fam, list: sorted, head: sorted[0] };
  }).sort((a, b) => b.list.length - a.list.length || a.head.sn - b.head.sn);

  return (
    <div className="page">
      <div className="topline">
        <button type="button" className="backbtn" onClick={() => go("houses")}><Icon name="left" size={18} /> Households</button>
        <button type="button" className="btn sm" onClick={() => exportVoters(h.voters, `house_${h.key}.csv`)}><Icon name="download" size={16} /> CSV</button>
      </div>

      <section className="card famhead">
        <div>
          <p className="eyebrow">{blockLabel(h.block)}</p>
          <h1>House {h.label}</h1>
          <GenderBar m={s.male} f={s.female} o={s.other} />
        </div>
        <div className="famstats">
          <span><b>{s.total}</b>voters</span>
          <span><b>{groups.length}</b>famil{groups.length === 1 ? "y" : "ies"}</span>
          <span><b>{fmt(s.male)} / {fmt(s.female)}</b>men / women</span>
          <span><b>{s.avgAge.toFixed(0)}</b>avg age</span>
        </div>
      </section>

      {groups.map(({ fam, list, head }) => {
        const f = FAMILIES.get(fam);
        const root = person(f.root);
        return (
          <section key={fam} className="card">
            <div className="cardhead">
              <h3>Family of <span lang="te">{root.name}</span></h3>
              <button type="button" className="linkbtn" onClick={() => go("family", head.id, true)}>
                <Icon name="tree" size={14} /> Family tree{f.size > list.length ? ` · ${f.size - list.length} more elsewhere` : ""}
              </button>
            </div>
            <div className="list">
              {list.map((o) => <VoterCard key={o.id} o={o} note={o === head ? null : relationTo(head.id, o.id) + " of the eldest"} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
