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
ap.add_argument("--page-data", help="csv-family-tree page_data.json matching the updated polling CSV")
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


def prepare_polling_csv(rows, page_data, out_path):
    """Map the enriched polling-station CSV and its matching family page data."""
    people = page_data.get("P", [])
    voters = [p for p in people if not p[15]]
    if len(rows) != len(voters):
        sys.exit(f"page_data has {len(voters)} voter nodes but CSV has {len(rows)} rows")

    required = {"file", "serial_no", "ac_no", "ac_part_no", "ac_serial_no", "voter_name", "age", "gender",
                "house_no", "epic_no", "pdf_page", "mptc_constituency", "gram_panchayat",
                "polling_station_no", "polling_station_building", "polling_station_locality",
                "ps_house_no_from", "ps_house_no_to", "ps_serial_from", "ps_serial_to",
                "ps_total_voters", "ps_voters_for", "ps_match_check"}
    missing = required - set(rows[0]) if rows else required
    if missing:
        sys.exit(f"updated polling CSV is missing columns: {', '.join(sorted(missing))}")

    people_by_id = {str(p[0]): p for p in people}
    row_by_graph_id = {}
    for index, (row, person) in enumerate(zip(rows, voters), start=1):
        age = int(row["age"]) if str(row.get("age", "")).strip().isdigit() else None
        if ((row.get("voter_name") or "") != person[1] or age != person[3]
                or (row.get("house_no") or "") != str(person[4] or "")):
            sys.exit(f"page_data and updated CSV do not align at row {index}; regenerate page_data.json from this CSV")
        row_by_graph_id[str(person[0])] = index

    sidecar_path = os.path.join(fam_dir, "family_out", "family_links.csv")
    sidecar = []
    if os.path.exists(sidecar_path):
        with open(sidecar_path, newline="", encoding="utf-8-sig") as fh:
            candidate = list(csv.DictReader(fh))
        if len(candidate) == len(rows) and all(candidate[i].get("voter_name") == rows[i].get("voter_name") for i in range(len(rows))):
            sidecar = candidate

    gp_values = sorted({(r.get("gram_panchayat") or "").strip() for r in rows})
    gp_index = {name: i + 1 for i, name in enumerate(gp_values)}
    ghosts, ghost_source, links = {}, {}, {}
    review_notes = {}
    parent = {f"v:{i}": f"v:{i}" for i in range(1, len(rows) + 1)}
    excluded_cross_gp = 0

    def find(value):
        parent.setdefault(value, value)
        while parent[value] != value:
            parent[value] = parent[parent[value]]
            value = parent[value]
        return value

    def union(a, b):
        a, b = find(a), find(b)
        if a != b:
            parent[a] = b

    for index, (row, person) in enumerate(zip(rows, voters), start=1):
        target = person[11]
        if target is None:
            continue
        if isinstance(target, int):
            target_index = row_by_graph_id.get(str(target))
            if target_index is None:
                continue
            target_row = rows[target_index - 1]
            if (row.get("gram_panchayat") or "").strip() != (target_row.get("gram_panchayat") or "").strip():
                excluded_cross_gp += 1
                review_notes[index] = "Automated family match crossed Gram Panchayats; verify the printed relative manually."
                continue
            target_id = str(target_index)
            union(f"v:{index}", f"v:{target_index}")
        else:
            ghost = people_by_id.get(str(target))
            if ghost is None:
                continue
            gp = (row.get("gram_panchayat") or "").strip()
            key = (str(target), gp)
            if key not in ghosts:
                ghost_id = f"g{len(ghosts) + 1}_gp{gp_index[gp]}"
                ghosts[key] = ghost_id
                ghost_source[ghost_id] = ghost
                parent[f"g:{ghost_id}"] = f"g:{ghost_id}"
            target_id = ghosts[key]
            union(f"v:{index}", f"g:{target_id}")
        detail = sidecar[index - 1] if sidecar else {}
        how = detail.get("match_basis") or ("not on list" if target_id.startswith("g") else "same house")
        links[index] = [target_id, person[12] or row.get("relation_type", ""), how, person[16], person[13] or detail.get("check_note", "")]

    components = {}
    for index in range(1, len(rows) + 1):
        components.setdefault(find(f"v:{index}"), {"voters": [], "ghosts": []})["voters"].append(index)
    for ghost_id in ghost_source:
        components.setdefault(find(f"g:{ghost_id}"), {"voters": [], "ghosts": []})["ghosts"].append(ghost_id)
    components = sorted(components.values(), key=lambda c: min(c["voters"]) if c["voters"] else 10**12)
    family_by_node, generation_by_node = {}, {}
    for family_id, component in enumerate(components, start=1):
        members = [*(f"v:{i}" for i in component["voters"]), *(f"g:{g}" for g in component["ghosts"])]
        generations = [int(voters[int(m[2:]) - 1][8] or 0) if m.startswith("v:") else int(ghost_source[m[2:]][8] or 0) for m in members]
        offset = min(generations) if generations else 0
        for member, generation in zip(members, generations):
            family_by_node[member] = family_id
            generation_by_node[member] = max(0, generation - offset)

    source_files = sorted({(r.get("file") or "").strip() for r in rows})
    station_labels = {}
    for row in rows:
        ps = str(row.get("polling_station_no", ""))
        label = f"PS {ps} · {row.get('gram_panchayat', '')} · {os.path.splitext(row.get('file', ''))[0]}"
        if ps in station_labels and station_labels[ps] != label:
            sys.exit(f"polling station number {ps} maps to multiple station labels")
        station_labels[ps] = label

    extras = ["sourceFile", "recordId", "mptcConstituency", "gramPanchayat", "pollingStationNo",
              "pollingStationBuilding", "pollingStationLocality", "psHouseNoFrom", "psHouseNoTo",
              "psSerialFrom", "psSerialTo", "psTotalVoters", "psVotersFor", "psMatchCheck", "familyLinkNote"]
    columns = COLS + extras
    out_rows = []
    for index, (row, person) in enumerate(zip(rows, voters), start=1):
        house = (row.get("house_no") or "").strip()
        normalized_house = house_key(house)
        pieces = normalized_house.split("-") if normalized_house else []
        gp = (row.get("gram_panchayat") or "").strip()
        local_block = "-".join(pieces[:2]) if len(pieces) > 1 else (pieces[0] if pieces else "")
        block = f"{gp} · {local_block}" if local_block else ""
        age = int(row["age"]) if str(row.get("age", "")).strip().isdigit() else 0
        name, relative = clean(row.get("voter_name", "")), clean(row.get("relation_name", ""))
        extras_values = [
            (row.get("file") or "").strip(), index, row.get("mptc_constituency", ""), gp,
            int(row["polling_station_no"]) if str(row.get("polling_station_no", "")).isdigit() else 0,
            row.get("polling_station_building", ""), row.get("polling_station_locality", ""),
            row.get("ps_house_no_from", ""), row.get("ps_house_no_to", ""),
            int(row["ps_serial_from"]) if str(row.get("ps_serial_from", "")).isdigit() else 0,
            int(row["ps_serial_to"]) if str(row.get("ps_serial_to", "")).isdigit() else 0,
            int(row["ps_total_voters"]) if str(row.get("ps_total_voters", "")).isdigit() else 0,
            row.get("ps_voters_for", ""), row.get("ps_match_check", ""), review_notes.get(index, ""),
        ]
        out_rows.append([
            int(row.get("serial_no") or index), extras_values[4], int(row.get("pdf_page") or 0),
            int(row.get("ac_part_no") or 0), int(row.get("ac_serial_no") or 0),
            name, row.get("relation_type", ""), relative, age, row.get("gender", "?"),
            house, (row.get("epic_no") or "").strip().upper(), block, f"{gp}|{normalized_house}" if normalized_house else "", row.get("issues", ""),
            *extras_values, person[14] or search_key(name), search_key(relative), family_by_node[f"v:{index}"],
            generation_by_node[f"v:{index}"], links.get(index),
        ])

    ghost_rows = {
        ghost_id: [clean(person[1]), person[2], family_by_node[f"g:{ghost_id}"], generation_by_node[f"g:{ghost_id}"], person[14] or search_key(person[1])]
        for ghost_id, person in ghost_source.items()
    }
    meta = {
        "place": a.place, "ward": "", "ac": next(iter({r.get("ac_no") for r in rows if r.get("ac_no")})),
        "source": os.path.basename(csv_path), "generated": date.today().isoformat(),
        "hasPollingParts": True, "partLabel": "Polling station", "sourceFiles": source_files,
        "sourceGroups": station_labels,
        "mptcConstituencies": sorted({(r.get("mptc_constituency") or "").strip() for r in rows}),
        "gramPanchayats": sorted({(r.get("gram_panchayat") or "").strip() for r in rows}),
        "pollingStationCount": len(station_labels), "excludedCrossGramPanchayatFamilyLinks": excluded_cross_gp,
    }
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(dict(meta=meta, cols=columns, rows=out_rows, ghosts=ghost_rows), fh, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(out_rows)} voters, {len(ghost_rows)} scoped unlisted relatives, {len(station_labels)} polling stations -> {out_path}")
    print(f"Excluded {excluded_cross_gp} family links crossing Gram Panchayats")


# ------------------------------------------------------------------- load
rows = list(csv.DictReader(open(csv_path, encoding="utf-8-sig")))
COLS = ["sn", "part", "page", "booth", "bsn", "name", "rel", "rname", "age", "gender",
        "house", "epic", "block", "hh", "issue"]

if rows and {"mptc_constituency", "gram_panchayat", "polling_station_no", "ps_match_check"}.issubset(rows[0]):
    page_data_path = a.page_data or os.path.join(fam_dir, "family_out", "page_data.json")
    if not os.path.exists(page_data_path):
        sys.exit(f"updated polling CSV needs matching --page-data file: {page_data_path}")
    prepare_polling_csv(rows, json.load(open(page_data_path, encoding="utf-8")), a.out)
    raise SystemExit(0)

g = json.load(open(graph_path, encoding="utf-8"))
nodes = {n["id"]: n for n in g["nodes"]}
edges = {e["s"]: e for e in g["edges"]}
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
