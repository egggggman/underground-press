#!/usr/bin/env python3
"""Generate the Golden Image-style page furniture for a Puzzle Dojo spread.

Text is width-locked with textLength so the layout holds on any machine,
whichever condensed display face the print operator has installed.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from xml.sax.saxutils import escape

DISPLAY = "Impact,Haettenschweiler,'Arial Narrow Bold','Liberation Sans Narrow',sans-serif"
SERIF = "Georgia,'Times New Roman',serif"
SANS = "'Arial Narrow',Arial,Helvetica,sans-serif"
MOTTO = "WE’RE ALL LOOKING FOR A PLACE TO LAND"


def seal(cx: float, cy: float, r: float) -> str:
    return (
        f'<g transform="translate({cx} {cy})"><circle r="{r}" fill="#2a2418" stroke="#171812" stroke-width="1.2"/>'
        f'<circle r="{r - 2.2}" fill="none" stroke="#c9b27c" stroke-width="0.9" stroke-dasharray="2 1.6"/>'
        f'<circle r="{r - 5}" fill="none" stroke="#c9b27c" stroke-width="0.7"/>'
        f'<text y="{r * 0.28:.1f}" text-anchor="middle" font-family="{DISPLAY}" font-size="{r * 0.85:.1f}" fill="#e9d6a4">UP</text></g>'
    )


def masthead(title: str, tagline: str, page: int, issue_label: str) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="748" height="51" viewBox="0 0 748 51">
<rect width="748" height="13" fill="#8c2118"/>
<text x="8" y="10" font-family="{SANS}" font-size="9" font-weight="bold" fill="#f4e8c6" letter-spacing="0.6">{escape(issue_label)}</text>
<text x="374" y="10" text-anchor="middle" font-family="{SANS}" font-size="9" font-weight="bold" fill="#f4e8c6" letter-spacing="1.1">{escape(MOTTO)}</text>
<text x="740" y="10" text-anchor="end" font-family="{SANS}" font-size="9" font-weight="bold" fill="#f4e8c6" letter-spacing="0.6">PAGE {page}</text>
<text x="9" y="42" font-family="{DISPLAY}" font-size="30" fill="#7a6a4a" fill-opacity="0.55" textLength="{len(title) * 15.2:.0f}" lengthAdjust="spacingAndGlyphs">{escape(title)}</text>
<text x="7" y="40" font-family="{DISPLAY}" font-size="30" fill="#171812" textLength="{len(title) * 15.2:.0f}" lengthAdjust="spacingAndGlyphs">{escape(title)}</text>
{seal(690, 28, 15)}
<text x="668" y="33" text-anchor="end" font-family="{SERIF}" font-size="10.5" font-style="italic" fill="#143f2c">{escape(tagline)}</text>
<path d="M0 46H748" stroke="#171812" stroke-width="2.4"/><path d="M0 49.5H748" stroke="#171812" stroke-width="0.8"/>
</svg>
"""


def footer(text: str) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="748" height="30" viewBox="0 0 748 30">
<rect width="748" height="30" fill="#171812"/><rect width="30" height="30" fill="#8c2118"/><rect x="718" width="30" height="30" fill="#8c2118"/>
<path d="M15 6l3 7 7 .6-5.4 4.6 1.8 7-6.4-4-6.4 4 1.8-7L5 13.600 12 13z" fill="#f4e8c6" transform="translate(0 -1)"/>
<path d="M733 6l3 7 7 .6-5.4 4.6 1.8 7-6.4-4-6.4 4 1.8-7L723 13.600 730 13z" fill="#f4e8c6" transform="translate(0 -1)"/>
<text x="374" y="20" text-anchor="middle" font-family="{DISPLAY}" font-size="14" fill="#f4e8c6" textLength="610" lengthAdjust="spacingAndGlyphs">{escape(text)}</text>
</svg>
"""


def scorecard(puzzles: list[str]) -> str:
    rows = []
    for index, name in enumerate(puzzles):
        y = 66 + index * 40
        rows.append(
            f'<rect x="16" y="{y}" width="20" height="20" fill="#f1e4bd" stroke="#171812" stroke-width="2"/>'
            f'<text x="46" y="{y + 16}" font-family="{DISPLAY}" font-size="17" fill="#171812" textLength="{len(name) * 9.4:.0f}" lengthAdjust="spacingAndGlyphs">{escape(name.upper())}</text>'
            f'<path d="M{46 + len(name) * 9.4 + 8:.0f} {y + 17}H272" stroke="#171812" stroke-width="1" stroke-dasharray="3 3"/>'
        )
    body = "\n".join(rows)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="288" height="368" viewBox="0 0 288 368">
<rect x="2" y="2" width="284" height="364" fill="#ead8ad" stroke="#171812" stroke-width="3"/>
<rect x="2" y="2" width="284" height="34" fill="#173f32"/>
<text x="144" y="26" text-anchor="middle" font-family="{DISPLAY}" font-size="19" fill="#f4e8c6" textLength="190" lengthAdjust="spacingAndGlyphs">SOLVER’S SCORECARD</text>
<text x="144" y="54" text-anchor="middle" font-family="{SERIF}" font-size="11" font-style="italic" fill="#171812">Check them off in pencil. Ink comes later.</text>
{body}
<path d="M16 {66 + len(puzzles) * 40 + 4}H272" stroke="#171812" stroke-width="2"/>
<text x="16" y="{66 + len(puzzles) * 40 + 30}" font-family="{SANS}" font-size="11" font-weight="bold" fill="#171812">TOTAL TIME ____________</text>
<text x="16" y="{66 + len(puzzles) * 40 + 56}" font-family="{SANS}" font-size="11" font-weight="bold" fill="#171812">STUCK ON ____________________</text>
<g transform="rotate(-6 214 {66 + len(puzzles) * 40 + 92})"><rect x="150" y="{66 + len(puzzles) * 40 + 74}" width="118" height="36" fill="none" stroke="#8c2118" stroke-width="3"/>
<text x="209" y="{66 + len(puzzles) * 40 + 98}" text-anchor="middle" font-family="{DISPLAY}" font-size="17" fill="#8c2118" textLength="98" lengthAdjust="spacingAndGlyphs">SOLVED IT!</text></g>
</svg>
"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("config", type=Path, help="JSON: issue_label, page_8_title, page_9_title, taglines, footers, puzzles")
    parser.add_argument("outdir", type=Path)
    args = parser.parse_args()
    cfg = json.loads(args.config.read_text(encoding="utf-8"))
    args.outdir.mkdir(parents=True, exist_ok=True)
    files = {
        "masthead-p8.svg": masthead(cfg["page_8_title"], cfg["page_8_tagline"], 8, cfg["issue_label"]),
        "masthead-p9.svg": masthead(cfg["page_9_title"], cfg["page_9_tagline"], 9, cfg["issue_label"]),
        "footer-p8.svg": footer(cfg["page_8_footer"]),
        "footer-p9.svg": footer(cfg["page_9_footer"]),
        "scorecard.svg": scorecard(cfg["puzzles"]),
    }
    for name, text in files.items():
        (args.outdir / name).write_text(text, encoding="utf-8")
        print(args.outdir / name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
