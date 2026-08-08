#!/usr/bin/env python3
"""Validate Issue 001 Page 3 reporting constraints."""
from pathlib import Path
from xml.etree import ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]; BASE=ROOT/"issues/issue_001/production/neighborhood-watch"
def main():
 errors=[]; copy=BASE/"COPY.md"; svg=BASE/"issue_001_page_3_neighborhood_watch.svg"
 if not copy.is_file() or not svg.is_file(): errors.append("Page 3 source or SVG master missing")
 else:
  text=copy.read_text(encoding="utf-8")+(BASE/"README.md").read_text(encoding="utf-8")
  for phrase in ("Foot Clan","has not confirmed","INCIDENT LEDGER","WHAT WE KNOW / WHAT WE DO NOT","in-universe reporting"):
   if phrase.lower() not in text.lower(): errors.append(f"missing constraint: {phrase}")
  try: ET.parse(svg)
  except Exception as error: errors.append(f"invalid SVG: {error}")
 if errors: print("Page 3 validation failed:\n- "+"\n- ".join(errors)); return 1
 print("Page 3 validation passed: rumor status, evidence ledger, uncertainty, and SVG master verified."); return 0
if __name__=="__main__": raise SystemExit(main())
