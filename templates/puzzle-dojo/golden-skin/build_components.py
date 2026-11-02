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


def scorecard_compact(puzzles: list[str], width: int, height: int) -> str:
    cells = []
    for index, name in enumerate(puzzles):
        x = 12 + (index % 2) * (width // 2 - 4)
        y = 44 + (index // 2) * 26
        cells.append(
            f'<rect x="{x}" y="{y}" width="14" height="14" fill="#f1e4bd" stroke="#171812" stroke-width="1.6"/>'
            f'<text x="{x + 20}" y="{y + 12}" font-family="{DISPLAY}" font-size="11.5" fill="#171812" textLength="{min(len(name) * 6.2, width // 2 - 34):.0f}" lengthAdjust="spacingAndGlyphs">{escape(name.upper())}</text>'
        )
    body = "\n".join(cells)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
<rect x="1.5" y="1.5" width="{width - 3}" height="{height - 3}" fill="#ead8ad" stroke="#171812" stroke-width="3"/>
<rect x="1.5" y="1.5" width="{width - 3}" height="28" fill="#173f32"/>
<text x="{width / 2}" y="21" text-anchor="middle" font-family="{DISPLAY}" font-size="15" fill="#f4e8c6" textLength="150" lengthAdjust="spacingAndGlyphs">SOLVER’S SCORECARD</text>
{body}
<path d="M12 {height - 30}H{width - 12}" stroke="#171812" stroke-width="1.5"/>
<text x="12" y="{height - 12}" font-family="{SANS}" font-size="9.5" font-weight="bold" fill="#171812">TIME ________   STUCK ON ______________</text>
</svg>
"""


def scorecard(puzzles: list[str], width: int = 368, height: int = 287) -> str:
    if height < 150:
        return scorecard_compact(puzzles, width, height)
    rows = []
    gap = (height - 150) / max(len(puzzles), 1)
    for index, name in enumerate(puzzles):
        y = 66 + index * gap
        label_w = len(name) * 9.6
        rows.append(
            f'<rect x="18" y="{y:.0f}" width="22" height="22" fill="#f1e4bd" stroke="#171812" stroke-width="2"/>'
            f'<text x="52" y="{y + 18:.0f}" font-family="{DISPLAY}" font-size="18" fill="#171812" textLength="{label_w:.0f}" lengthAdjust="spacingAndGlyphs">{escape(name.upper())}</text>'
            f'<path d="M{52 + label_w + 10:.0f} {y + 19:.0f}H{width - 18}" stroke="#171812" stroke-width="1" stroke-dasharray="3 3"/>'
        )
    body = "\n".join(rows)
    base = 66 + len(puzzles) * gap
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
<rect x="2" y="2" width="{width - 4}" height="{height - 4}" fill="#ead8ad" stroke="#171812" stroke-width="3"/>
<rect x="2" y="2" width="{width - 4}" height="36" fill="#173f32"/>
<text x="{width / 2}" y="27" text-anchor="middle" font-family="{DISPLAY}" font-size="20" fill="#f4e8c6" textLength="200" lengthAdjust="spacingAndGlyphs">SOLVER’S SCORECARD</text>
<text x="{width / 2}" y="55" text-anchor="middle" font-family="{SERIF}" font-size="11.5" font-style="italic" fill="#171812">Check them off in pencil. Ink comes later.</text>
{body}
<path d="M18 {base:.0f}H{width - 18}" stroke="#171812" stroke-width="2"/>
<text x="18" y="{base + 24:.0f}" font-family="{SANS}" font-size="11.5" font-weight="bold" fill="#171812">TOTAL TIME ____________</text>
<text x="18" y="{base + 46:.0f}" font-family="{SANS}" font-size="11.5" font-weight="bold" fill="#171812">STUCK ON ______________________</text>
<g transform="rotate(-6 {width - 74} {base + 36:.0f})"><rect x="{width - 140}" y="{base + 16:.0f}" width="120" height="38" fill="none" stroke="#8c2118" stroke-width="3"/>
<text x="{width - 80}" y="{base + 42:.0f}" text-anchor="middle" font-family="{DISPLAY}" font-size="18" fill="#8c2118" textLength="100" lengthAdjust="spacingAndGlyphs">SOLVED IT!</text></g>
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
