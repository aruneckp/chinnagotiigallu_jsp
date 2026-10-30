import { useState } from "react";
import { THEME_KEY } from "../config.js";

// "system" follows the device; "light" / "dark" are stamped on <html data-theme>.
const read = () => { try { return localStorage.getItem(THEME_KEY) || "system"; } catch { return "system"; } };

export function useTheme() {
  const [theme, setTheme] = useState(read);
  const set = (t) => {
    setTheme(t);
    if (t === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    try { localStorage.setItem(THEME_KEY, t); } catch {}
  };
  const next = { system: "dark", dark: "light", light: "system" };
  return [theme, () => set(next[theme])];
}
