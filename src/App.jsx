import { useEffect, useMemo, useState } from "react";
import { init, BY_ID, HOUSES, VOTERS } from "./lib/data.js";
import { resume, lock } from "./lib/crypto.js";
import { applyFilters, EMPTY } from "./lib/filters.js";
import { useHashRoute, go } from "./lib/route.js";
import { useTheme } from "./lib/theme.js";
import { DEFAULT_PAGE_SIZE } from "./config.js";
import Login from "./components/Login.jsx";
import Overview from "./components/Overview.jsx";
import VotersPage from "./components/VotersPage.jsx";
import VoterPage from "./components/VoterPage.jsx";
import FamiliesPage from "./components/FamiliesPage.jsx";
import FamilyPage from "./components/FamilyPage.jsx";
import HousesPage from "./components/HousesPage.jsx";
import HousePage from "./components/HousePage.jsx";
import Analysis from "./components/Analysis.jsx";
import Icon from "./components/Icon.jsx";

export default function App() {
  const [state, setState] = useState("checking");
  useEffect(() => {
    resume().then((raw) => { if (raw) init(raw); setState(raw ? "ready" : "locked"); });
  }, []);

  if (state === "checking") return <div className="splash"><span className="spinner big" /></div>;
  if (state === "locked") return <Login onUnlock={(raw) => { init(raw); setState("ready"); }} />;
  return <Main onLogout={() => { lock(); setState("locked"); go("home"); }} />;
}

const NAV = [
  { id: "home", label: "Overview", icon: "home" },
  { id: "voters", label: "Voters", icon: "users" },
  { id: "families", label: "Families", icon: "tree" },
  { id: "houses", label: "Houses", icon: "house" },
  { id: "analysis", label: "Analysis", icon: "chart" },
];
const SECTION = { voter: "voters", family: "families", house: "houses" };
const THEME_ICON = { system: "monitor", dark: "moon", light: "sun" };

const wide = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1100px)").matches;

function Main({ onLogout }) {
  const route = useHashRoute();
  const [theme, cycleTheme] = useTheme();
  const [filters, setFilters] = useState(EMPTY);
  const [list, setList] = useState({ page: 1, size: DEFAULT_PAGE_SIZE, view: wide() ? "table" : "cards", panel: wide() });
  const [famState, setFamState] = useState({ q: "", block: "", size: "2+", sort: "size", page: 1 });
  const [houseState, setHouseState] = useState({ q: "", block: "", size: "", sort: "size", page: 1 });
  const results = useMemo(() => applyFilters(VOTERS, filters), [filters]);
  useEffect(() => setList((l) => ({ ...l, page: 1 })), [filters]);

  // fresh: start from all voters (overview); otherwise narrow the current slice (analysis)
  const openList = (patch, fresh = false) => {
    setFilters((f) => ({ ...(fresh ? EMPTY : f), ...patch }));
    go("voters", null, true);
  };

  const voter = route.id && (route.tab === "voter" || route.tab === "family") ? BY_ID.get(route.id) : null;
  const house = route.tab === "house" && route.id ? HOUSES[+route.id - 1] : null;
  let tab = route.tab;
  if ((tab === "voter" || tab === "family") && !voter) tab = "voters";
  if (tab === "house" && !house) tab = "houses";
  const section = SECTION[tab] || tab;

  const navButtons = NAV.map((n) => (
    <button key={n.id} type="button" className="navbtn" aria-current={section === n.id ? "page" : undefined}
      onClick={() => go(n.id)}>
      <Icon name={n.icon} size={20} /><span>{n.label}</span>
    </button>
  ));

  return (
    <div className="app">
      <header className="appbar">
        <button type="button" className="brand" onClick={() => go("home")}>
          <span className="logo">CG</span>
          <span><b>Chinnagottigallu · ZPTC</b><small>Voter analytics</small></span>
        </button>
        <nav className="topnav" aria-label="Sections">{navButtons}</nav>
        <div className="appbar-tools">
          <button type="button" className="iconbtn" onClick={cycleTheme} aria-label={`Theme: ${theme}. Change theme`} title={`Theme: ${theme}`}>
            <Icon name={THEME_ICON[theme]} size={18} />
          </button>
          <button type="button" className="signout" onClick={onLogout}>
            <Icon name="logout" size={18} /><span>Sign out</span>
          </button>
        </div>
      </header>

      <main>
        {tab === "home" && <Overview openList={openList} />}
        {tab === "voters" && <VotersPage filters={filters} setFilters={setFilters} results={results} list={list} setList={setList} />}
        {tab === "voter" && <VoterPage key={voter.id} voter={voter} results={results} />}
        {tab === "families" && <FamiliesPage state={famState} setState={setFamState} />}
        {tab === "family" && <FamilyPage key={voter.fam} voter={voter} />}
        {tab === "houses" && <HousesPage state={houseState} setState={setHouseState} />}
        {tab === "house" && <HousePage house={house} />}
        {tab === "analysis" && <Analysis filters={filters} setFilters={setFilters} results={results} openList={openList} />}
      </main>

      <nav className="bottomnav" aria-label="Sections">{navButtons}</nav>
    </div>
  );
}
