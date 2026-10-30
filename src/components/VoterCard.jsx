import { go } from "../lib/route.js";
import { sex } from "../lib/stats.js";
import { SHOW_VOTER_ID } from "../config.js";
import { partLabel } from "../lib/data.js";
import { Avatar } from "./ui.jsx";
import Icon from "./Icon.jsx";

export default function VoterCard({ o, note }) {
  return (
    <button type="button" className="vcard" onClick={() => go("voter", o.id, true)}>
      <Avatar o={o} />
      <span className="vbody">
        <span className="vname" lang="te">{o.name}</span>
        <span className="vlatin">{o.key}</span>
        <span className="vrel"><span>{o.rel || "Relative"}:</span> <span lang="te">{o.rname || "—"}</span></span>
        <span className="vtags">
          {note && <span className="tag strong">{note}</span>}
          <span className="tag">{o.age} yrs</span>
          <span className={`tag ${sex(o)}`}>{o.gender}</span>
          <span className="tag">{o.house ? `H ${o.house}` : "House not printed"}</span>
          <span className="tag">{partLabel(o.part)}{o.page ? ` · p${o.page}` : ""}</span>
          {SHOW_VOTER_ID && <span className="tag mono">{o.epic}</span>}
        </span>
      </span>
      <span className="vno">#{o.sn}<Icon name="right" size={16} /></span>
    </button>
  );
}
