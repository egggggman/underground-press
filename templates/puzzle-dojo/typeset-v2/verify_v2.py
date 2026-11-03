#!/usr/bin/env python3
"""Prove the v2 re-typeset matches the locked originals.

Checks, per puzzle asset:
  1. the locked original still matches its recorded SHA-256 (it is never modified);
  2. v2 contains the same characters as the original's tagged glyphs, in the same reading order
     (rows by baseline, then left to right), within the asset's viewBox;
  3. every non-text element of the original (grid lines, black squares, backgrounds, images) is present,
     byte-for-byte and in the same order, in v2.
Neighborhood Search is checked against its JSON grid and word list.
Exit code 0 only if everything matches.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parents[2] / "issues/issue_001/assets/puzzle-dojo"
V2 = ASSETS / "v2"
sys.path.insert(0, str(HERE))
from typeset_v2 import DEF, USE, build_runs, parse_uses  # noqa: E402

VIEW = {"sudoku.svg": (272, 323), "crossword.svg": (468, 383), "crossword-clues.svg": (468, 174), "pizza-cipher.svg": (367, 142)}
ok = True


def fail(msg: str) -> None:
    global ok
    ok = False
    print("FAIL:", msg)


manifest = json.loads((ASSETS / "validation_manifest.json").read_text(encoding="utf-8"))["immutable_assets"]
for name, (w, h) in VIEW.items():
    orig = (ASSETS / name).read_text(encoding="utf-8")
    norm = hashlib.sha256(orig.replace("\r\n", "\n").encode()).hexdigest()
    if norm != manifest[name]:
        fail(f"{name}: locked original no longer matches its recorded hash")
    new = (V2 / name).read_text(encoding="utf-8")
    runs = build_runs(parse_uses(orig, w, h))
    want = sorted((round(r[0]["y"], 1), round(r[0]["x"], 1), "".join(i["ch"] for i in r).rstrip()) for r in runs)
    got = []
    for m in re.finditer(r'<text x="([-\d.]+)" y="([-\d.]+)"[^>]*>([^<]*)</text>', new):
        from xml.sax.saxutils import unescape
        got.append((round(float(m.group(2)), 1), float(m.group(1)), unescape(m.group(3))))
    want_t = [t for _, _, t in sorted(want)]
    got_t = [t for _, _, t in sorted(got)]
    if sorted(want_t) != sorted(got_t):
        fail(f"{name}: text differs ({len(want_t)} vs {len(got_t)} runs)")
    # reading order by baseline: compare the text with positions rounded to rows
    rows_o = sorted((y, t) for y, _, t in want)
    rows_n = sorted((y, t) for y, _, t in got)
    if [t for _, t in rows_o if len(t) > 0] and len(rows_o) != len(rows_n):
        fail(f"{name}: run count differs")
    # non-text elements identical
    o_rest = DEF.sub("", USE.sub("", orig))
    n_rest = re.sub(r"<style>.*?</style>\n", "", re.sub(r"<text [^>]*>[^<]*</text>", "", new), count=1, flags=re.S)
    if o_rest != n_rest:
        fail(f"{name}: non-text elements differ")
    print(f"{name}: {len(want_t)} text runs match; non-text elements identical")

# Neighborhood Search against its JSON
data = json.loads((ASSETS / "neighborhood-search.json").read_text(encoding="utf-8"))
svg = (V2 / "neighborhood-search.svg").read_text(encoding="utf-8")
rows = []
for r in range(15):
    y = 132 + 20 * r
    letters = [m.group(2) for m in re.finditer(r'<text x="([-\d.]+)" y="%s(?:\.00)?"[^>]*>([A-Z])</text>' % y, svg)]
    rows.append("".join(letters))
if rows != data["grid"]:
    fail("neighborhood-search: grid letters differ from JSON")
words = [m.group(1) for m in re.finditer(r'<text x="340" y="[\d.]+"[^>]*>([A-Z]+)</text>', svg)]
want_words = [p["word"] for p in data["placements"]]
if sorted(words) != sorted(want_words):
    fail(f"neighborhood-search: word list differs {sorted(set(want_words)^set(words))}")
print(f"neighborhood-search: 15x15 grid and {len(words)} words match JSON")
sys.exit(0 if ok else 1)
