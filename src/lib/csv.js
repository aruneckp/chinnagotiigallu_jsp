const esc = (v) => {
  v = v == null ? "" : String(v);
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
};

// A byte-order mark first, so Excel opens the Telugu text correctly.
export function toCSV(header, rows) {
  return "﻿" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
}

export function download(name, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
