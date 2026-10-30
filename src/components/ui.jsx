import { useCallback, useRef, useState } from "react";
import { fmt, sex } from "../lib/stats.js";
import { SHOW_PHOTOS, photoUrl } from "../config.js";
import Icon from "./Icon.jsx";

const seg = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("te", { granularity: "grapheme" }) : null;
export const initial = (name) => {
  const s = String(name || "?").trim();
  return seg ? seg.segment(s)[Symbol.iterator]().next().value?.segment || "?" : [...s][0];
};

// The initial stays underneath; the photo covers it only once it has loaded,
// and is dropped if it is missing or fails.
function Photo({ src }) {
  const [state, setState] = useState("loading");
  if (state === "failed") return null;
  return (
    <img className={"avatar-img" + (state === "ok" ? " on" : "")} src={src} alt="" loading="lazy" decoding="async"
      onLoad={() => setState("ok")} onError={() => setState("failed")} />
  );
}

export function Avatar({ o, size, photo }) {
  const src = photo && SHOW_PHOTOS && !o.ghost && o.epic ? photoUrl(o.epic) : null;
  return (
    <span className={`avatar ${o.ghost ? "ghost" : sex(o)}${size ? " " + size : ""}`} lang="te" aria-hidden="true">
      {o.ghost ? "?" : initial(o.name)}
      {src && <Photo key={src} src={src} />}
    </span>
  );
}

export function Chips({ value, options, onChange, all = "All", showCounts }) {
  return (
    <div className="chips">
      {all && <button type="button" className="chip" aria-pressed={!value} onClick={() => onChange("")}>{all}</button>}
      {options.map(([v, label, n]) => (
        <button key={v} type="button" className="chip" aria-pressed={value === v}
          onClick={() => onChange(value === v ? "" : v)}>
          {label}{showCounts && n != null && <small>{fmt(n)}</small>}
        </button>
      ))}
    </div>
  );
}

export function GenderBar({ m, f, o = 0, label }) {
  const t = m + f + o || 1;
  return (
    <span className="gbar" role="img" aria-label={label || `${m} men, ${f} women`}>
      {m > 0 && <span className="male" style={{ flexGrow: m / t }} />}
      {f > 0 && <span className="female" style={{ flexGrow: f / t }} />}
      {o > 0 && <span className="other" style={{ flexGrow: o / t }} />}
    </span>
  );
}

export function Kpi({ label, value, sub, onClick, tone, icon }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} className={"kpi" + (onClick ? " click" : "") + (tone ? " " + tone : "")} onClick={onClick}>
      {icon && <span className="kpi-icon"><Icon name={icon} size={18} /></span>}
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
      {onClick && <span className="kpi-go"><Icon name="right" size={14} /></span>}
    </Tag>
  );
}

export function SecHead({ icon, title, sub, children }) {
  return (
    <div className="sechead">
      <div>
        <h2>{icon && <Icon name={icon} size={18} />}{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  const nums = [...new Set([1, page - 1, page, page + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out = [];
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1] > 1) out.push(<span key={"gap" + n} className="pgap">…</span>);
    out.push(<button key={n} type="button" className="pnum" aria-current={n === page ? "page" : undefined} onClick={() => onPage(n)}>{n}</button>);
  });
  return (
    <nav className="pager" aria-label="Pages">
      <button type="button" className="pnum" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><Icon name="left" size={16} /></button>
      {out}
      <button type="button" className="pnum" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><Icon name="right" size={16} /></button>
    </nav>
  );
}

export function Empty({ text, action, onAction }) {
  return (
    <div className="empty">
      <Icon name="search" size={28} />
      <p>{text}</p>
      {action && <button type="button" className="btn" onClick={onAction}>{action}</button>}
    </div>
  );
}

// One tooltip per chart card. Marks call show(event, content) on pointer move / focus.
export function useTip() {
  const box = useRef(null);
  const [tip, setTip] = useState(null);
  const show = useCallback((e, content) => {
    const host = box.current?.getBoundingClientRect();
    if (!host) return;
    let x, y;
    if (e.type === "focus") {
      const r = e.currentTarget.getBoundingClientRect();
      x = r.left + r.width / 2 - host.left; y = r.top - host.top;
    } else { x = e.clientX - host.left; y = e.clientY - host.top; }
    setTip({ x, y, content, flip: x > host.width * 0.6 });
  }, []);
  const hide = useCallback(() => setTip(null), []);
  const el = tip && (
    <div className={"tip" + (tip.flip ? " flip" : "")} style={{ left: tip.x, top: tip.y }} role="status">{tip.content}</div>
  );
  const bind = (content) => ({
    onPointerMove: (e) => show(e, content), onPointerLeave: hide, onFocus: (e) => show(e, content), onBlur: hide,
  });
  return { box, el, bind };
}

// Tooltip body: values lead, labels follow.
export function TipRows({ title, rows }) {
  return (
    <>
      {title && <div className="tip-title">{title}</div>}
      {rows.map(([label, value, cls]) => (
        <div key={label} className="tip-row">{cls && <i className={"key " + cls} />}<b>{value}</b><span>{label}</span></div>
      ))}
    </>
  );
}
