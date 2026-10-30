import { useEffect, useLayoutEffect, useState } from "react";

// Routes live in the hash (#home, #voters, #voter-104, #family-104, #house-12)
// so a static host needs no rewrite rules and the browser Back button works.
const TABS = ["home", "voters", "families", "houses", "analysis", "voter", "family", "house"];
const parse = () => {
  const m = /^#?([a-z]+)(?:-(\d+))?$/.exec(window.location.hash);
  return m && TABS.includes(m[1]) ? { tab: m[1], id: m[2] || null } : { tab: "home", id: null };
};

// Scroll position per page, so Back returns to the same spot in a long list.
// `shown` is the page on screen; it is null while one page swaps for another,
// so scrolls caused by the swap are not recorded against either page.
const scrolls = {};
let shown = null;

export function useHashRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onScroll = () => { if (shown) scrolls[shown] = window.scrollY; };
    const onHash = () => { shown = null; setRoute(parse()); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("hashchange", onHash);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("hashchange", onHash); };
  }, []);
  useLayoutEffect(() => {
    const hash = window.location.hash || "#home";
    window.scrollTo(0, scrolls[hash] || 0);
    shown = hash;
  }, [route]);
  return route;
}

export const go = (tab, id, fresh = false) => {
  const hash = id ? `${tab}-${id}` : tab;
  if (fresh) delete scrolls["#" + hash];
  if (window.location.hash === "#" + hash) window.scrollTo(0, 0);
  else window.location.hash = hash;
};
