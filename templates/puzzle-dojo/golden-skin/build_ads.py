#!/usr/bin/env python3
"""Build the golden-skin Sewer Cap card (vector). Ads come from ad_slots.py. Fonts are embedded (SIL OFL, see fonts/)."""

from __future__ import annotations

import argparse
import base64
import random
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
INK, OX, GREEN, MUSTARD, CREAM = "#17130f", "#8c2118", "#173f32", "#d7a428", "#f4e8c6"
SERIF = "Georgia,'Times New Roman',serif"
BEBAS = "'Bebas Neue','League Gothic',Impact,'Arial Narrow',sans-serif"
SLAB = "'Alfa Slab One','Rockwell','Georgia',serif"


FACES = {
    "Bebas Neue": "BebasNeue-subset.woff",
    "Alfa Slab One": "AlfaSlabOne-subset.woff",
    "Lobster": "Lobster-Regular-subset.woff",
    "Patua One": "PatuaOne-Regular-subset.woff",
    "Stardos Stencil": "StardosStencil-Bold-subset.woff",
}
LOBSTER = "Lobster,'Brush Script MT',cursive"
PATUA = "'Patua One','Rockwell',Georgia,serif"
STENCIL = "'Stardos Stencil','Courier New',monospace"


def font_style(families=("Bebas Neue", "Alfa Slab One")) -> str:
    faces = []
    for family in families:
        name = FACES[family]
        data = base64.b64encode((HERE / "fonts" / name).read_bytes()).decode()
        faces.append(f"@font-face{{font-family:'{family}';src:url(data:font/woff;base64,{data}) format('woff');}}")
    return "<style>" + "".join(faces) + "</style>"



def wrap(w: int, h: int, title: str, body: str, families=("Bebas Neue", "Alfa Slab One")) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {w} {h}" '
        f'role="img" aria-label="{title}"><title>{title}</title>{font_style(families)}'
        '<defs><pattern id="dots" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".8" fill="#17130f" opacity=".13"/></pattern>'
        '<pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><path d="M0 0v4" stroke="#17130f" stroke-width=".8" opacity=".45"/></pattern>'
        '<linearGradient id="fy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".08" stop-color="#fff"/><stop offset=".78" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
        '<linearGradient id="fx" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".07" stop-color="#fff"/><stop offset=".93" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
        '<mask id="my" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#fy)"/></mask>'
        '<mask id="mx" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#fx)"/></mask></defs>'
        f"{body}</svg>\n"
    )






def sewer_cap() -> str:
    cx, cy = 130, 152
    R = 80
    rnd = random.Random(1991)
    specks = "".join(
        f'<circle cx="{cx + rnd.uniform(-1, 1) * 112:.1f}" cy="{cy + rnd.uniform(-1, 1) * 100:.1f}" r="{rnd.uniform(.5, 1.7):.1f}" fill="{INK}" opacity="{rnd.uniform(.25, .7):.2f}"/>'
        for _ in range(170)
        if ((rnd.random() - .5) ** 2) >= 0
    )
    spokes = [(-58, OX, 40), (-22, GREEN, 40), (24, MUSTARD, 40), (62, OX, 40), (112, GREEN, 38), (146, MUSTARD, 40), (214, OX, 40), (250, GREEN, 38)]
    import math
    lines, nodes = [], []
    for ang, col, ln in spokes:
        a = math.radians(ang - 90)
        x2, y2 = cx + math.cos(a) * ln * 1.2, cy + math.sin(a) * ln * 1.2
        lines.append(f'<path d="M{cx} {cy}L{x2:.1f} {y2:.1f}" stroke="{col}" stroke-width="3.2" stroke-linecap="round"/>')
        nodes.append(f'<circle cx="{x2:.1f}" cy="{y2:.1f}" r="4" fill="{CREAM}" stroke="{INK}" stroke-width="1.6"/>')
    return wrap(260, 280, "Portland Sewer Cap number 001", families=("Stardos Stencil",), body=f'''
<rect x="2" y="2" width="256" height="276" fill="#e6d4a6" stroke="{INK}" stroke-width="4"/>
<rect x="12" y="12" width="236" height="256" fill="url(#dots)" stroke="{OX}" stroke-width="2" stroke-dasharray="7 4"/>
<rect x="20" y="20" width="220" height="48" fill="{INK}"/>
<path d="M30 42l2.6 5.4 6 .8-4.4 4.2 1.1 5.9-5.3-2.9-5.3 2.9 1.1-5.9-4.4-4.2 6-.8z" fill="{MUSTARD}" transform="translate(-4 -12) scale(.9)"/>
<path d="M30 42l2.6 5.4 6 .8-4.4 4.2 1.1 5.9-5.3-2.9-5.3 2.9 1.1-5.9-4.4-4.2 6-.8z" fill="{MUSTARD}" transform="translate(190 -12) scale(.9)"/>
<text x="130" y="38" text-anchor="middle" font-family="{STENCIL}" font-size="15" fill="{CREAM}" letter-spacing="3" textLength="120" lengthAdjust="spacingAndGlyphs">THIS WEEK’S</text>
<text x="130" y="61" text-anchor="middle" font-family="{STENCIL}" font-size="24" fill="{CREAM}" letter-spacing="2" textLength="150" lengthAdjust="spacingAndGlyphs">SEWER CAP</text>
{specks}
<circle cx="{cx}" cy="{cy+3}" r="{R}" fill="#3a3326"/>
<circle cx="{cx}" cy="{cy}" r="{R}" fill="#6f664f" stroke="{INK}" stroke-width="6"/>
<circle cx="{cx}" cy="{cy}" r="{R}" fill="url(#hatch)"/>
<circle cx="{cx}" cy="{cy}" r="{R-12}" fill="#c9b27c" stroke="{INK}" stroke-width="2.5"/>
<circle cx="{cx}" cy="{cy}" r="{R-12}" fill="url(#dots)"/>
<path d="M{cx-60} {cy-20}H{cx+60}M{cx-60} {cy+22}H{cx+60}M{cx-24} {cy-62}V{cy+62}M{cx+26} {cy-62}V{cy+62}" stroke="{INK}" stroke-width=".8" opacity=".35"/>
{"".join(lines)}{"".join(nodes)}
<circle cx="{cx}" cy="{cy}" r="19" fill="{MUSTARD}" stroke="{INK}" stroke-width="3"/>
<path d="M{cx-9} {cy-8}L{cx+9} {cy-8} {cx} {cy+11}z" fill="#f4e8c6" stroke="{INK}" stroke-width="1.6"/><circle cx="{cx-2}" cy="{cy-3}" r="1.8" fill="{OX}"/><circle cx="{cx+3}" cy="{cy}" r="1.5" fill="{OX}"/>
<text x="{cx}" y="{cy+56}" text-anchor="middle" font-family="{STENCIL}" font-size="12" fill="{INK}" letter-spacing="1">No. 001</text>
<g transform="rotate(-4 {cx} {cy-30}) translate(0 10)"><path d="M{cx-46} {cy-30}q46 -20 92 0v-18q-46 -20 -92 0z" fill="{GREEN}" stroke="{INK}" stroke-width="2.5"/>
<text x="{cx}" y="{cy-35}" text-anchor="middle" font-family="{STENCIL}" font-size="13" fill="{CREAM}" textLength="70" lengthAdjust="spacingAndGlyphs">PORTLAND</text></g>
<text x="{cx}" y="250" text-anchor="middle" font-family="{STENCIL}" font-size="16" fill="{INK}" textLength="200" lengthAdjust="spacingAndGlyphs">CUT • COLLECT • TRADE</text>
<text x="{cx}" y="264" text-anchor="middle" font-family="{STENCIL}" font-size="11" fill="{OX}" textLength="110" lengthAdjust="spacingAndGlyphs">DO NOT FLUSH</text>
''')


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("outdir", type=Path)
    args = parser.parse_args()
    args.outdir.mkdir(parents=True, exist_ok=True)
    (args.outdir / "sewer-cap.svg").write_text(sewer_cap())
    print(args.outdir / "sewer-cap.svg")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
