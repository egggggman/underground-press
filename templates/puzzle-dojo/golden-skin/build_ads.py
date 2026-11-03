#!/usr/bin/env python3
"""Build the golden-skin ad art: big ad, mini ads, sewer cap. Fonts are embedded (SIL OFL, see fonts/)."""

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


def chef_data(source: Path) -> str:
    """Reuse the painted cook already embedded in the issue's Crust Bucket art."""
    return re.search(r"base64,([A-Za-z0-9+/=]+)", source.read_text()).group(1)


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


def chef(x, y, w, data, ratio=475 / 935):
    return (f'<g mask="url(#my)"><image mask="url(#mx)" x="{x}" y="{y}" width="{w}" height="{w * ratio:.1f}" '
            f'preserveAspectRatio="xMidYMid slice" xlink:href="data:image/jpeg;base64,{data}" href="data:image/jpeg;base64,{data}"/></g>')


def big_ad(data: str) -> str:
    W, H = 476, 280
    return wrap(W, H, "The Crust Bucket advertisement", f'''
<rect x="2" y="2" width="{W-4}" height="{H-4}" fill="#efe2bd" stroke="{INK}" stroke-width="4"/>
<rect x="12" y="12" width="{W-24}" height="{H-24}" fill="url(#dots)" stroke="{OX}" stroke-width="2.5" stroke-dasharray="9 5"/>
<path d="M16 20L300 14 456 22 440 52 22 72z" fill="{OX}"/><path d="M110 62L460 40 456 76 90 82z" fill="{GREEN}"/>
<text x="26" y="62" font-family="{SLAB}" font-size="34" fill="{CREAM}" stroke="{INK}" stroke-width="1.4" paint-order="stroke" textLength="276" lengthAdjust="spacingAndGlyphs" transform="rotate(-2 26 62)">The Crust Bucket</text>
<text x="344" y="69" font-family="{BEBAS}" font-size="26" fill="{CREAM}" letter-spacing="1.5">HOT PIE.</text>
{chef(10, 86, 284, data)}
<text x="300" y="116" font-family="{BEBAS}" font-size="38" fill="{INK}" letter-spacing="1" textLength="148" lengthAdjust="spacingAndGlyphs">LOCAL GOSSIP.</text>
<text x="300" y="142" font-family="{SERIF}" font-size="14" fill="{INK}">Rotating coupons.</text>
<text x="300" y="160" font-family="{SERIF}" font-size="14" fill="{INK}">No fixed clock.</text>
<text x="300" y="186" font-family="{SERIF}" font-size="14" font-style="italic" fill="{OX}">Ask what came out</text>
<text x="300" y="203" font-family="{SERIF}" font-size="14" font-style="italic" fill="{OX}">of the oven.</text>
<rect x="16" y="236" width="444" height="28" fill="{GREEN}" stroke="{INK}" stroke-width="2"/>
<text x="238" y="257" text-anchor="middle" font-family="{BEBAS}" font-size="22" fill="{CREAM}" letter-spacing="3">PORTLAND BENEATH PORTLAND</text>
''')


def donut(cx, cy, r):
    rnd = random.Random(7)
    sprinkles = "".join(
        f'<rect x="{cx + rnd.uniform(-.8, .8) * r * .8:.1f}" y="{cy + rnd.uniform(-.8, .8) * r * .55 - 2:.1f}" width="5" height="1.8" '
        f'fill="{rnd.choice([CREAM, MUSTARD, GREEN])}" transform="rotate({rnd.randint(0, 170)} {cx} {cy})"/>'
        for _ in range(14)
    )
    return (f'<ellipse cx="{cx}" cy="{cy+3}" rx="{r}" ry="{r*.62}" fill="#a8741c" stroke="{INK}" stroke-width="3"/>'
            f'<ellipse cx="{cx}" cy="{cy}" rx="{r}" ry="{r*.62}" fill="#e0a43a" stroke="{INK}" stroke-width="3"/>'
            f'<path d="M{cx-r+4} {cy} q{r*.3} -{r*.6} {r-4} -{r*.55} q{r*.7} 0 {r-4} {r*.55} q-{r*.4} {r*.5} -{r*.45} {r*.3} q-{r*.3} {r*.25} -{r*.55} -{r*.1} q-{r*.35} {r*.3} -{r*.55} -{r*.2}z" fill="{OX}" stroke="{INK}" stroke-width="2"/>'
            f'<ellipse cx="{cx}" cy="{cy}" rx="{r*.28}" ry="{r*.17}" fill="{GREEN}" stroke="{INK}" stroke-width="2.5"/>'
            f'<ellipse cx="{cx}" cy="{cy}" rx="{r}" ry="{r*.62}" fill="url(#hatch)"/>' + sprinkles)


def mini_ads(data: str) -> str:
    return wrap(260, 248, "Two mini advertisements", families=("Bebas Neue", "Alfa Slab One", "Lobster", "Patua One"), body=f'''
<rect x="2" y="2" width="256" height="244" fill="#efe2bd" stroke="{INK}" stroke-width="4"/>
<g transform="translate(12 12)">
 <rect width="236" height="104" fill="#f3e6c4" stroke="{OX}" stroke-width="2.5" stroke-dasharray="7 4"/><rect width="236" height="104" fill="url(#dots)"/>
 <path d="M6 6L150 3 230 8 222 28 8 38z" fill="{OX}"/><path d="M60 30L232 20 230 38 52 44z" fill="{GREEN}"/>
 <text x="12" y="31" font-family="{SLAB}" font-size="19" fill="{CREAM}" stroke="{INK}" stroke-width="1" paint-order="stroke" textLength="150" lengthAdjust="spacingAndGlyphs" transform="rotate(-2 12 31)">The Crust Bucket</text>
 <text x="178" y="38" font-family="{BEBAS}" font-size="15" fill="{CREAM}" letter-spacing="1">HOT PIE.</text>
 {chef(0, 44, 112, data)}
 <text x="122" y="64" font-family="{BEBAS}" font-size="20" fill="{INK}" letter-spacing=".8">CLIP THIS SPACE</text>
 <text x="122" y="82" font-family="{BEBAS}" font-size="20" fill="{OX}" letter-spacing=".8">FOR LUCK.</text>
 <text x="122" y="96" font-family="'Courier New',monospace" font-size="6.5" font-weight="700" fill="{INK}" textLength="106" lengthAdjust="spacingAndGlyphs">ADVERTISEMENT • CLIP &amp; SAVE</text>
</g>
<g transform="translate(12 132)">
 <rect width="236" height="104" fill="{GREEN}" stroke="{INK}" stroke-width="3"/><rect width="236" height="104" fill="url(#dots)" opacity=".5"/>
 <rect x="5" y="5" width="226" height="94" fill="none" stroke="{MUSTARD}" stroke-width="1.5" stroke-dasharray="5 3"/>
 <text x="14" y="36" font-family="{LOBSTER}" font-size="28" fill="{CREAM}" textLength="138" lengthAdjust="spacingAndGlyphs" transform="rotate(-3 14 36)">Tony’s Donuts</text>
 <text x="14" y="56" font-family="{PATUA}" font-size="14" fill="{MUSTARD}">Morning boxes.</text>
 <text x="14" y="74" font-family="{PATUA}" font-size="14" fill="{CREAM}">Warm coffee.</text>
 <text x="14" y="92" font-family="'Courier New',monospace" font-size="7" font-weight="700" fill="{MUSTARD}">ADVERTISEMENT • OPEN MORNINGS</text>
 {donut(186, 62, 40)}
</g>
''')


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
    parser.add_argument("chef_source", type=Path, help="issue Crust Bucket art holding the painted cook")
    parser.add_argument("outdir", type=Path)
    args = parser.parse_args()
    data = chef_data(args.chef_source)
    args.outdir.mkdir(parents=True, exist_ok=True)
    for name, svg in (("crust-bucket.svg", big_ad(data)), ("mini-ads.svg", mini_ads(data)), ("sewer-cap.svg", sewer_cap())):
        (args.outdir / name).write_text(svg)
        print(args.outdir / name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
