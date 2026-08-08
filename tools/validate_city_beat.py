#!/usr/bin/env python3
"""Validate locked Issue 001 City Beat production requirements."""
from __future__ import annotations
import hashlib, sys
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
COPY=ROOT/"issues/issue_001/production/city-beat/COPY.md"
SVG=ROOT/"issues/issue_001/production/city-beat/issue_001_page_2_city_beat.svg"
BENCHMARK=ROOT/"issues/issue_001/production/page-one/issue_001_page_one_polished_press_v3.png"
EXPECTED="07d4e8332880a23b947d49ea4ea813ae558f4ada220529d63e5d37cd5bc43691"

def main():
    errors=[]
    for path in (COPY,SVG,BENCHMARK):
        if not path.is_file(): errors.append(f"missing {path.relative_to(ROOT)}")
    if errors: print("City Beat validation failed:\n- "+"\n- ".join(errors)); return 1
    text=COPY.read_text(encoding="utf-8")+"\n"+SVG.read_text(encoding="utf-8")
    required=["WHEN THE FOG MOVES IN, THE BLOCK LISTENS","WEATHER DESK","TRANSIT WATCH","COMMUNITY CALENDAR","NEIGHBORHOOD NOTES","not a real Portland forecast","Foot Clan"]
    for value in required:
        if value.lower() not in text.lower(): errors.append(f"missing required copy: {value}")
    for forbidden in ("[[","{{","TODO","TBD"):
        if forbidden in text: errors.append(f"unresolved marker: {forbidden}")
    if hashlib.sha256(BENCHMARK.read_bytes()).hexdigest()!=EXPECTED: errors.append("Page One benchmark SHA-256 mismatch")
    try:
        tree=ET.parse(SVG)
        if "WE'RE ALL LOOKING FOR A PLACE TO LAND." not in " ".join(tree.getroot().itertext()): errors.append("exact motto missing from SVG")
    except Exception as error: errors.append(f"invalid SVG: {error}")
    if errors: print("City Beat validation failed:\n- "+"\n- ".join(errors)); return 1
    print("City Beat validation passed: benchmark, copy modules, disclaimer, motto, and SVG master verified."); return 0
if __name__=="__main__": sys.exit(main())
