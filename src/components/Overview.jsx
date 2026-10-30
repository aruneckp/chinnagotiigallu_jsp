import { useMemo, useState } from "react";
import { VOTERS, META, HAS_POLLING_PARTS, PARTS, BOOTHS, FAMILIES, GHOST_BY_ID, MAIN_BLOCKS, boothLabel, groupLabel, partLabel } from "../lib/data.js";
import { summarize, groupBy, fmt, pct, ratio } from "../lib/stats.js";
import { SEARCH_FIELDS, PLACEHOLDER } from "../lib/search.js";
import { go } from "../lib/route.js";
import { GenderBar, Kpi, SecHead } from "./ui.jsx";
import Icon from "./Icon.jsx";

const range = (nums) => {
  const a = Math.min(...nums), b = Math.max(...nums);
  return a === b ? `${a}` : `${a}–${b}`;
};

export default function Overview({ openList }) {
  const [q, setQ] = useState("");
  const [qf, setQf] = useState("any");
  const s = useMemo(() => summarize(VOTERS), []);

  const parts = useMemo(() => {
    const by = groupBy(VOTERS, (o) => o.part);
    return PARTS.map(([p]) => {
      const list = by.get(p);
      const printedPages = list.map((o) => o.page).filter(Boolean);
      return { p, ...summarize(list), pages: printedPages.length ? range(printedPages) : null,
        booths: [...new Set(list.map((o) => o.boothGroup))].filter((b) => b !== "other").sort() };
    });
  }, []);
  const booths = useMemo(() => {
    const by = groupBy(VOTERS, (o) => o.boothGroup);
    return BOOTHS.map(([b]) => {
      const list = by.get(b);
      return { b, ...summarize(list), parts: [...new Set(list.map((o) => o.part))].sort(),
        serials: b === "other" ? `${new Set(list.map((o) => o.booth)).size} parts` : `serial ${range(list.map((o) => o.bsn))}` };
    });
  }, []);
  // "" (house no. not printed) cannot be a block filter value, so it opens the data check instead
  const blocks = useMemo(() => {
    const by = groupBy(VOTERS, (o) => o.blockGroup);
    return [...MAIN_BLOCKS, "~other", "?", ""].filter((b) => by.has(b))
      .map((b) => ({ b, ...summarize(by.get(b)), open: b === "" ? { check: "noHouse" } : { block: b } }));
  }, []);
  const fams = useMemo(() => {
    const all = [...FAMILIES.values()];
    const multi = all.filter((f) => f.size >= 2);
    return { multi: multi.length, inMulti: multi.reduce((t, f) => t + f.size, 0),
      biggest: Math.max(...all.map((f) => f.size)), threeGen: all.filter((f) => f.gens >= 3).length,
      linked: VOTERS.filter((o) => o.linkKind === "voter").length };
  }, []);
  const topBlock = Math.max(...blocks.map((b) => b.total));

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-row">
          <div>
            <p className="eyebrow">{META.partLabel ? "Local voter register" : `Tirupati assembly constituency ${META.ac} · Municipal ward ${META.ward}`}</p>
            <h1>{META.partLabel ? `${META.place} voters` : `Ward ${META.ward} voters`}</h1>
            <p className="hero-te" lang="te">{META.partLabel ? `${META.place} voter register` : `వార్డు ${META.ward} ఓటర్ల జాబితా · తిరుపతి`}</p>
          </div>
          <div className="hero-total"><b>{fmt(s.total)}</b><span>voters on the list</span></div>
        </div>
        <div className="hero-split">
          <GenderBar m={s.male} f={s.female} o={s.other} />
          <div className="legend">
            <span><i className="dot male" /> Men <b>{fmt(s.male)}</b> · {pct(s.male, s.total)}%</span>
            <span><i className="dot female" /> Women <b>{fmt(s.female)}</b> · {pct(s.female, s.total)}%</span>
          </div>
        </div>
        <form className="hero-search" onSubmit={(e) => { e.preventDefault(); openList({ q, qf }, true); }}>
          <select value={qf} onChange={(e) => setQf(e.target.value)} aria-label="Search in">
            {SEARCH_FIELDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <span className="hero-input">
            <Icon name="search" size={18} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search"
              placeholder={PLACEHOLDER[qf]} aria-label="Search voters" />
          </span>
          <button type="submit">Search</button>
        </form>
        <div className="hero-actions">
          <button type="button" onClick={() => openList({}, true)}><Icon name="table" size={16} /> All {fmt(s.total)} voters</button>
          <button type="button" onClick={() => go("families")}><Icon name="tree" size={16} /> Family trees</button>
          <button type="button" onClick={() => go("houses")}><Icon name="house" size={16} /> Households</button>
          <button type="button" onClick={() => go("analysis")}><Icon name="chart" size={16} /> Full analysis</button>
        </div>
      </section>

      <section className="kpis">
        <Kpi icon="house" label="Households" value={fmt(s.households)} sub={`${(s.total / s.households).toFixed(1)} voters per door no.`} onClick={() => go("houses")} />
        <Kpi icon="tree" label="Families" value={fmt(s.families)} sub={`${fmt(fams.multi)} with 2+ voters`} onClick={() => go("families")} />
        <Kpi icon="user" label="Average age" value={s.avgAge.toFixed(1)} sub="years" />
        <Kpi icon="users" tone="gold" label="Women per 1,000 men" value={ratio(s.female, s.male)} sub={`${fmt(s.female - s.male)} more women`} />
        <Kpi icon="id" label="First-time 18–19" value={fmt(s.firstTime)} sub={`${pct(s.firstTime, s.total)}% of voters`} tone="t1"
          onClick={() => openList({ ageMin: "18", ageMax: "19" }, true)} />
        <Kpi icon="users" label="Youth 18–25" value={fmt(s.young)} sub={`${pct(s.young, s.total)}% of voters`} tone="t1"
          onClick={() => openList({ ageMin: "18", ageMax: "25" }, true)} />
        <Kpi icon="user" label="Seniors 60+" value={fmt(s.senior)} sub={`${pct(s.senior, s.total)}% of voters`} tone="t2"
          onClick={() => openList({ ageMin: "60" }, true)} />
        <Kpi icon="user" label="Aged 80+" value={fmt(s.elder)} sub={`${pct(s.elder, s.total)}% of voters`} tone="t2"
          onClick={() => openList({ ageMin: "80" }, true)} />
      </section>

      <SecHead icon="layers" title={META.partLabel || "Ward parts"} sub="Each group is mapped from its source PDF. Tap one to list its voters." />
      <section className="tiles">
        {parts.map((p) => (
          <button key={p.p} type="button" className="tile" onClick={() => openList({ part: String(p.p) }, true)}>
            <span className="tile-top"><b>{partLabel(p.p)}</b>{p.pages && <span className="tile-tag">pages {p.pages}</span>}</span>
            <span className="tile-count"><b>{fmt(p.total)}</b> voters · {pct(p.total, s.total)}%</span>
            <GenderBar m={p.male} f={p.female} o={p.other} />
            <span className="tile-meta">
              <span><i className="dot male" />{fmt(p.male)}</span>
              <span><i className="dot female" />{fmt(p.female)}</span>
              <span><Icon name="house" size={13} />{fmt(p.households)}</span>
              <span>avg {p.avgAge.toFixed(0)} yrs</span>
            </span>
            {HAS_POLLING_PARTS && <span className="tile-foot">Polling part {p.booths.join(", ")}</span>}
          </button>
        ))}
      </section>

      {HAS_POLLING_PARTS && <>
      <SecHead icon="booth" title="Polling parts" sub={`Assembly constituency ${META.ac} part numbers printed against each voter.`} />
      <section className="tiles">
        {booths.map((b) => (
          <button key={b.b} type="button" className="tile" onClick={() => openList({ booth: b.b }, true)}>
            <span className="tile-top"><b>{boothLabel(b.b)}</b><span className="tile-tag">{b.serials}</span></span>
            <span className="tile-count"><b>{fmt(b.total)}</b> voters · {pct(b.total, s.total)}%</span>
            <GenderBar m={b.male} f={b.female} o={b.other} />
            <span className="tile-meta">
              <span><i className="dot male" />{fmt(b.male)}</span>
              <span><i className="dot female" />{fmt(b.female)}</span>
              <span><Icon name="house" size={13} />{fmt(b.households)}</span>
              <span>avg {b.avgAge.toFixed(0)} yrs</span>
            </span>
            <span className="tile-foot">Village / PDF {b.parts.map(partLabel).join(", ")}</span>
          </button>
        ))}
      </section>
      </>}

      <SecHead icon="pin" title={META.partLabel ? "House groups" : "Blocks"}
        sub={META.partLabel ? "Address groups derived from house-number prefixes. Tap to list." : "Street block from the door number (20-48-S10-755 → 20-48-S10). Tap to list."} />
      <section className="blocks">
        {blocks.map((b) => (
          <button key={b.b} type="button" className={"block" + (b.b === "" || b.b === "?" ? " muted" : "")}
            onClick={() => openList(b.open, true)}>
            <span className="block-name">{groupLabel(b.b)}</span>
            <span className="block-n"><b>{fmt(b.total)}</b><small>{pct(b.total, s.total)}%</small></span>
            <span className="meter"><span style={{ width: `${(b.total * 100) / topBlock}%` }} /></span>
            <span className="block-meta">
              <i className="dot male" />{b.male} <i className="dot female" />{b.female}
              {b.households > 0 && <> · {fmt(b.households)} homes</>}
            </span>
          </button>
        ))}
      </section>

      <SecHead icon="tree" title="Families" sub="Worked out from the printed father, husband or mother names at the same house." />
      <section className="kpis small">
        <Kpi icon="tree" label="Families with 2+ voters" value={fmt(fams.multi)} sub={`${fmt(fams.inMulti)} voters in them`} onClick={() => go("families")} />
        <Kpi icon="family" tone="gold" label="Relative found on the list" value={fmt(fams.linked)} sub="voters linked to a voter" onClick={() => openList({ link: "voter" }, true)} />
        <Kpi icon="user" label="Relatives not on the list" value={fmt(GHOST_BY_ID.size)} sub="named, but not voters here" />
        <Kpi icon="layers" tone="gold" label="Three generations or more" value={fmt(fams.threeGen)} sub={`largest family: ${fams.biggest} voters`} onClick={() => go("families")} />
      </section>

      <p className="source">
        Source: {META.source} ({fmt(s.total)} voters, read from the printed roll). Family links from
        csv-family-tree. Prepared {META.generated}.
      </p>
    </div>
  );
}
