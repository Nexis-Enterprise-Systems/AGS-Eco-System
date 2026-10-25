#!/usr/bin/env python3
"""Regenerates docs/ROADMAP.md from src/roadmap/modules.json (the one source of truth)."""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
data = json.loads((root / "src/roadmap/modules.json").read_text())
names = {m["id"]: m["name"] for g in data["groups"] for m in g["modules"]}
label = {"built": "Built", "in_progress": "In progress", "planned": "Planned"}
total = sum(len(g["modules"]) for g in data["groups"])
count = {k: sum(1 for g in data["groups"] for m in g["modules"] if m["status"] == k) for k in label}
out = ["# AGS Eco System: Roadmap", "",
       f"Last updated {data['updated']}. Generated from `src/roadmap/modules.json`; edit that file, then run `python3 tools/make_roadmap_md.py`.", "",
       f"**{count['built']} built, {count['in_progress']} in progress, {count['planned']} planned ({total} modules).**", ""]
for g in data["groups"]:
    out += [f"## {g['name']}", "", g["description"], "", "| Module | Status | What it covers | Depends on |", "| --- | --- | --- | --- |"]
    for m in g["modules"]:
        deps = ", ".join(names.get(d, d) for d in m.get("dependsOn", [])) or "-"
        out.append(f"| {m['name']} | {label[m['status']]} | {m['summary']} | {deps} |")
    out.append("")
(root / "docs/ROADMAP.md").write_text("\n".join(out))
print("wrote docs/ROADMAP.md")
