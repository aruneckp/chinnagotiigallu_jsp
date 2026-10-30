"""Voter CSV + family graph -> src/data/voters.json for the web app.

usage: python3 scripts/prepare_data.py [--family-dir ../csv-family-tree]
                                       [--csv <voters.csv>] [--graph <family_graph.json>]

The family graph comes from csv-family-tree/make_family_tree.py; its node ids are
row numbers (1-based) in the same CSV, so rows and nodes line up one to one.
Run make_family_tree.py again first whenever the CSV changes.
"""
import argparse
import csv
import json
import os
import re
import sys
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

ap = argparse.ArgumentParser()
ap.add_argument("--family-dir", default=os.path.join(ROOT, "..", "csv-family-tree"))
ap.add_argument("--csv")
ap.add_argument("--graph")
ap.add_argument("--out", default=os.path.join(ROOT, "src", "data", "voters.json"))
ap.add_argument("--place", default="Tirupati")
a = ap.parse_args()
fam_dir = os.path.abspath(a.family_dir)
csv_path = a.csv or os.path.join(fam_dir, "combined_voter_list_ward_53.csv")
graph_path = a.graph or os.path.join(fam_dir, "family_out", "family_graph.json")

sys.path.insert(0, fam_dir)
from names import search_key  # noqa: E402  (same Latin sound key the family graph uses)

# plain-language notes for less certain links, shared with the family pipeline
_src = open(os.path.join(fam_dir, "export_page_data.py"), encoding="utf-8").read().split("P = []")[0]
_ns = {}
exec(compile(_src.replace("g = json.load(open(sys.argv[1]))", 'g = {"nodes": [], "edges": []}'),
             "export_page_data", "exec"), _ns)
readable = _ns["readable"]


# ------------------------------------------------------------ door numbers
def block_of(house):
    """Street block from a door number: '20-48-S10-755' -> '20-48-S10', '20-3-5B3-101' -> '20-3'.
    Repairs the common OCR slips in the sector ('20-48-58-516', '20-48-S10662', '2048-S9-609')."""
    s = re.sub(r"\s+", " ", house.upper()).strip()
    if not s:
        return ""
    s = re.sub(r"(?<!\d)2048(?=\s*-?\s*S)", "20-48", s)
    m = re.search(r"(?<!\d)(\d{2})\s*[-/ ]\s*0*(\d{1,2})(?!\d)(.*)", s)
    if not m:
        return "?"
    a_, b_, rest = m.groups()
    base = f"{a_}-{b_}"
    if b_ not in ("48", "49"):          # only the 20-48 / 20-49 blocks are split into sectors
        return base
    r = re.sub(r"-+", "-", re.sub(r"[\s/.]+", "-", rest))
    r = re.sub(r"(?<=S1)O", "0", r)
    p = re.match(r"-?(M|SS|0S|MS|S|F|D|SB)?-?(\d+)", r)
    if not p:
        return base
    letter, d = p.groups()
    if letter == "M":
        return f"{base}-M{d[:2]}"
    if letter == "SB":
        return f"{base}-S8"
    if letter is None:
        # 'S' read as 5 or 3 ('20-48-58-516'), or dropped ('20-48-13-1111')
        if len(d) in (2, 3) and d[0] in "53" and 1 <= int(d[1:]) <= 14 and p.end() < len(r):
            d = d[1:]
        elif not (len(d) <= 2 and re.match(r"-\d{3,4}", r[p.end():])):
            return base
    if len(d) > 2:
        d = d[:2] if 8 <= int(d[:2]) <= 14 else d[:1]
    return f"{base}-S{int(d)}"


def house_key(house):
    """Same house however the door number was typed: 'D NO 20-3-17/B5,' == '20-3-17-B5'."""
    s = house.upper()
    s = re.sub(r"^\s*(D\s*\.?\s*NO|DOOR\s*NO|H\s*\.?\s*NO|HOUSE\s*(NO|NUMBER))\s*[.:-]?\s*", "", s)
    s = re.sub(r"[\s/,.]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s


def clean(s):
    """Drop the U+FFFD marks OCR left in some names ('పీ� సంధ్యా�')."""
    return re.sub(r"\s+", " ", s.replace("�", "")).strip()


def prepare_family_export(rows, graph, edges, out_path):
    """Convert csv-family-tree's enriched family_input.csv into the app schema."""
    voters = [n for n in graph["nodes"] if not n.get("ghost")]
    if len(voters) != len(rows):
        sys.exit(f"family graph has {len(voters)} voters but family_input.csv has {len(rows)}")

    by_id = {int(n["id"]): n for n in voters}
    out_rows = []
    for r in rows:
        serial = int(r["gp_serial_no"])
        n = by_id.get(serial)
        if not n or n["name"] != r["voter_name"]:
            sys.exit(f"family graph and family_input.csv disagree at generated serial {serial}")
        edge = edges.get(serial)
        link = [str(edge["t"]), edge["type"], edge["how"], edge.get("score"), readable(edge)] if edge else None
        house = (r.get("house_no") or "").strip()
        parts = house_key(house).split("-")
        block = "-".join(parts[:2]) if len(parts) >= 2 else (parts[0] if parts else "")
        age = int(r["age"]) if str(r.get("age", "")).strip().isdigit() else 0
        name = clean(r.get("voter_name", ""))
        relative = clean(r.get("relation_name", ""))
        out_rows.append([
            serial, int(r.get("part_no") or 0), 0, None, None,
            name, r.get("relation_type", ""), relative, age, r.get("gender", "?"),
            house, (r.get("epic_no") or "").strip().upper(), block, house_key(house), "",
            n.get("key") or search_key(name), search_key(relative), int(n["fam"]), int(n["gen"]), link,
        ])

    ghost_rows = {
        str(n["id"]): [clean(n["name"]), n.get("g", "?"), int(n["fam"]), int(n["gen"]), n.get("key", "")]
        for n in graph["nodes"] if n.get("ghost")
    }
    meta = {
        "place": a.place,
        "ward": str(voters[0].get("ward", "")) if voters else "",
        "ac": None,
        "source": os.path.basename(csv_path),
        "generated": date.today().isoformat(),
        "hasPollingParts": False,
        "partLabel": "Source group",
    }
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(dict(meta=meta, cols=COLS, rows=out_rows, ghosts=ghost_rows), fh,
                  ensure_ascii=False, separators=(",", ":"))
    print(f"{len(out_rows)} voters, {len(ghost_rows)} relatives not on the list -> {out_path}")


def prepare_village_csv(rows, graph, edges, out_path):
    """Map the source roll CSV directly, keeping each source PDF as its village group."""
    voters = [n for n in graph["nodes"] if not n.get("ghost")]
    if len(voters) != len(rows):
        sys.exit(f"family graph has {len(voters)} voters but source CSV has {len(rows)}")

    nodes_by_id = {int(n["id"]): n for n in voters}
    source_ids = {}
    source_names = {}
    out_rows = []
    for index, r in enumerate(rows, start=1):
        n = nodes_by_id.get(index)
        if not n or n["name"] != r.get("voter_name"):
            sys.exit(f"family graph and source CSV disagree at row {index}")
        age = int(r["age"]) if str(r.get("age", "")).strip().isdigit() else 0
        if (n.get("age") or 0) != age or (n.get("house") or "") != (r.get("house_no") or "").strip():
            sys.exit(f"family graph and source CSV fields disagree at row {index}")

        source_file = (r.get("file") or "Unknown source").strip()
        if source_file not in source_ids:
            source_ids[source_file] = len(source_ids) + 1
            source_names[str(source_ids[source_file])] = os.path.splitext(source_file)[0]
        source_id = source_ids[source_file]
        house = (r.get("house_no") or "").strip()
        house_norm = house_key(house)
        house_parts = house_norm.split("-") if house_norm else []
        block = "-".join(house_parts[:2]) if len(house_parts) > 1 else (house_parts[0] if house_parts else "")
        name = clean(r.get("voter_name", ""))
        relative = clean(r.get("relation_name", ""))
        edge = edges.get(index)
        link = [str(edge["t"]), edge["type"], edge["how"], edge.get("score"), readable(edge)] if edge else None
        out_rows.append([
            int(r.get("serial_no") or index), source_id, int(r.get("pdf_page") or 0),
            int(r.get("ac_part_no") or 0), int(r.get("ac_serial_no") or 0),
            name, r.get("relation_type", ""), relative, age, r.get("gender", "?"),
            house, (r.get("epic_no") or "").strip().upper(), block, house_norm, r.get("issues", ""),
            source_file, index, search_key(name), search_key(relative), int(n["fam"]), int(n["gen"]), link,
        ])

    ghost_rows = {
        str(n["id"]): [clean(n["name"]), n.get("g", "?"), int(n["fam"]), int(n["gen"]), n.get("key", "")]
        for n in graph["nodes"] if n.get("ghost")
    }
    files = sorted({(r.get("file") or "Unknown source").strip() for r in rows})
    ac_values = sorted({r.get("ac_no", "") for r in rows if r.get("ac_no")})
    meta = {
        "place": a.place,
        "ward": "",
        "ac": ac_values[0] if len(ac_values) == 1 else None,
        "source": os.path.basename(csv_path),
        "generated": date.today().isoformat(),
        "hasPollingParts": True,
        "partLabel": "Village / PDF",
        "sourceFiles": files,
        "sourceGroups": source_names,
    }
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    columns = COLS + ["sourceFile", "recordId"]
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(dict(meta=meta, cols=columns, rows=out_rows, ghosts=ghost_rows), fh,
                  ensure_ascii=False, separators=(",", ":"))
    print(f"{len(out_rows)} voters from {len(files)} source PDFs, {len(ghost_rows)} relatives not on the list -> {out_path}")


# ------------------------------------------------------------------- load
rows = list(csv.DictReader(open(csv_path, encoding="utf-8-sig")))
g = json.load(open(graph_path, encoding="utf-8"))
nodes = {n["id"]: n for n in g["nodes"]}
edges = {e["s"]: e for e in g["edges"]}
COLS = ["sn", "part", "page", "booth", "bsn", "name", "rel", "rname", "age", "gender",
        "house", "epic", "block", "hh", "issue"]

if rows and "gp_serial_no" in rows[0]:
    prepare_family_export(rows, g, edges, a.out)
    raise SystemExit(0)
if rows and {"file", "serial_no", "ac_part_no", "pdf_page"}.issubset(rows[0]):
    prepare_village_csv(rows, g, edges, a.out)
    raise SystemExit(0)

voter_nodes = [n for n in g["nodes"] if not n.get("ghost")]
if len(voter_nodes) != len(rows):
    sys.exit(f"family graph has {len(voter_nodes)} voters but the CSV has {len(rows)}: "
             "run csv-family-tree/make_family_tree.py on this CSV first")

sn_of = {}                               # graph id (row number) -> printed serial no.
for i, r in enumerate(rows, start=1):
    n = nodes[i]
    if n["name"] != r["voter_name"]:
        sys.exit(f"row {i}: CSV and family graph disagree ({r['voter_name']} vs {n['name']})")
    sn_of[i] = int(r["serial_no"])

out_rows = []
for i, r in enumerate(rows, start=1):
    n = nodes[i]
    e = edges.get(i)
    link = None
    if e:
        t = e["t"]
        link = [sn_of[t] if isinstance(t, int) else t, e["type"], e["how"],
                e["score"], readable(e)]
    house = r["house_no"].strip()
    out_rows.append([
        int(r["serial_no"]), int(r["Part_No"].split("_")[1]), int(r["pdf_page"] or 0),
        int(r["ac_part_no"]), int(r["ac_serial_no"]),
        clean(r["voter_name"]), r["relation_type"], clean(r["relation_name"]),
        int(r["age"]), r["gender"], house, r["epic_no"].strip().upper(),
        block_of(house), house_key(house), r["issues"].strip(),
        n["key"], search_key(clean(r["relation_name"])), n["fam"], n["gen"], link,
    ])

ghosts = {n["id"]: [clean(n["name"]), n["g"], n["fam"], n["gen"], n["key"]]
          for n in g["nodes"] if n.get("ghost")}

ward = rows[0]["Part_No"].split("_")[0]
meta = dict(place=a.place, ward=ward, ac=rows[0]["ac_no"], source=os.path.basename(csv_path),
            generated=date.today().isoformat())
os.makedirs(os.path.dirname(a.out), exist_ok=True)
json.dump(dict(meta=meta, cols=COLS, rows=out_rows, ghosts=ghosts),
          open(a.out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"{len(out_rows)} voters, {len(ghosts)} relatives not on the list, "
      f"{len({r[17] for r in out_rows})} families -> {a.out} ({os.path.getsize(a.out) // 1024} KB)")
