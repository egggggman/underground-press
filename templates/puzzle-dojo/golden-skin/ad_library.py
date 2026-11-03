#!/usr/bin/env python3
"""Rotating ad library for Puzzle Dojo pages 8-9.

Every ad shares the paper's frame (ink border, dashed accent rule, paper dots, house palette,
"ADVERTISEMENT" footer) but keeps its own lettering and art, like real local businesses.
Ads are data: edit ADS, then pick which ones run in an issue with an ads rotation file.

  python ad_library.py chef_source.svg outdir                       # all ads to outdir/ads/
  python ad_library.py chef_source.svg outdir --rotation rot.json   # also writes ad + mini-ads slot files
"""

from __future__ import annotations

import argparse
import base64
import json
import random
import re
from functools import lru_cache
from pathlib import Path

from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
INK, OX, GREEN, MUSTARD, CREAM, PAPER = "#17130f", "#8c2118", "#173f32", "#d7a428", "#f4e8c6", "#efe2bd"

# family -> (css stack, subset file). One entry per typeface; ads pick by key.
FONTS = {
    "slab": ("'Alfa Slab One',Rockwell,Georgia,serif", "AlfaSlabOne-subset.woff", "Alfa Slab One"),
    "bebas": ("'Bebas Neue','Arial Narrow',Impact,sans-serif", "BebasNeue-subset.woff", "Bebas Neue"),
    "lobster": ("Lobster,'Brush Script MT',cursive", "Lobster-Regular-subset.woff", "Lobster"),
    "patua": ("'Patua One',Rockwell,Georgia,serif", "PatuaOne-Regular-subset.woff", "Patua One"),
    "stencil": ("'Stardos Stencil','Courier New',monospace", "StardosStencil-Bold-subset.woff", "Stardos Stencil"),
    "rye": ("Rye,Georgia,serif", "Rye-Regular-subset.woff", "Rye"),
    "bungee": ("Bungee,Impact,sans-serif", "Bungee-Regular-subset.woff", "Bungee"),
    "righteous": ("Righteous,'Arial Rounded MT Bold',sans-serif", "Righteous-Regular-subset.woff", "Righteous"),
    "pirata": ("'Pirata One','Old English Text MT',serif", "PirataOne-Regular-subset.woff", "Pirata One"),
    "limelight": ("Limelight,Georgia,serif", "Limelight-Regular-subset.woff", "Limelight"),
    "playball": ("Playball,'Brush Script MT',cursive", "Playball-Regular-subset.woff", "Playball"),
    "anton": ("Anton,Impact,'Arial Narrow',sans-serif", "Anton-Regular-subset.woff", "Anton"),
    "fell": ("'IM Fell DW Pica',Georgia,serif", "IMFePIit28P-subset.woff", "IM Fell DW Pica"),
}
SERIF = "Georgia,'Times New Roman',serif"
MONO = "'Courier New',monospace"


@lru_cache(maxsize=None)
def _font(key: str):
    f = TTFont(HERE / "fonts" / FONTS[key][1])
    return f.getBestCmap(), f["hmtx"], f["head"].unitsPerEm


def width(key: str, text: str, size: float) -> float:
    if key == "serif":  # system serif: rough average advance
        return len(text) * size * 0.5
    cmap, hmtx, upm = _font(key)
    return sum(hmtx[cmap.get(ord(c), "space")][0] for c in text) * size / upm


def fit(key: str, text: str, max_w: float, max_size: float) -> float:
    return min(max_size, max_size * max_w / max(width(key, text, max_size), 1))


def style(keys) -> str:
    out = []
    for k in dict.fromkeys(keys):
        data = base64.b64encode((HERE / "fonts" / FONTS[k][1]).read_bytes()).decode()
        out.append(f"@font-face{{font-family:'{FONTS[k][2]}';src:url(data:font/woff;base64,{data}) format('woff');}}")
    return "<style>" + "".join(out) + "</style>"


# ---------- motifs: small ink-and-hatch vector art, drawn around (0,0), roughly 80 units wide ----------

def m_donut(c):
    rnd = random.Random(3)
    sp = "".join(f'<rect x="{rnd.uniform(-26, 22):.0f}" y="{rnd.uniform(-14, 10):.0f}" width="6" height="2" fill="{rnd.choice([CREAM, MUSTARD, GREEN])}" transform="rotate({rnd.randint(0, 170)})"/>' for _ in range(12))
    return (f'<ellipse cx="0" cy="4" rx="38" ry="24" fill="#a8741c" stroke="{INK}" stroke-width="3"/><ellipse rx="38" ry="24" fill="#e0a43a" stroke="{INK}" stroke-width="3"/>'
            f'<path d="M-34 0q10-22 34-20t34 20q-10 18-18 10t-16 3-18-4-16-9z" fill="{c}" stroke="{INK}" stroke-width="2"/><ellipse rx="11" ry="7" fill="{PAPER}" stroke="{INK}" stroke-width="2.5"/>'
            f'<ellipse rx="38" ry="24" fill="url(#hatch)"/>{sp}')


def m_washer(c):
    return (f'<rect x="-32" y="-36" width="64" height="72" rx="5" fill="{PAPER}" stroke="{INK}" stroke-width="3"/><rect x="-32" y="-36" width="64" height="14" fill="{c}" stroke="{INK}" stroke-width="3"/>'
            f'<circle cx="-18" cy="-29" r="3" fill="{PAPER}"/><circle cx="-8" cy="-29" r="3" fill="{PAPER}"/><circle cx="2" cy="6" r="22" fill="#6f664f" stroke="{INK}" stroke-width="3.5"/>'
            f'<circle cx="2" cy="6" r="16" fill="{GREEN}" stroke="{INK}" stroke-width="2"/><path d="M-10 8q6-8 12 0t12 0" fill="none" stroke="{PAPER}" stroke-width="2.5"/><circle cx="2" cy="6" r="22" fill="url(#hatch)" opacity=".5"/>')


def m_cassette(c):
    return (f'<rect x="-40" y="-26" width="80" height="52" rx="5" fill="{c}" stroke="{INK}" stroke-width="3"/><rect x="-30" y="-20" width="60" height="22" rx="3" fill="{PAPER}" stroke="{INK}" stroke-width="2"/>'
            f'<circle cx="-14" cy="-9" r="7" fill="{INK}"/><circle cx="14" cy="-9" r="7" fill="{INK}"/><circle cx="-14" cy="-9" r="3" fill="{PAPER}"/><circle cx="14" cy="-9" r="3" fill="{PAPER}"/>'
            f'<path d="M-22 26l6-14h32l6 14z" fill="{INK}"/><rect x="-40" y="-26" width="80" height="52" rx="5" fill="url(#hatch)" opacity=".35"/>')


def m_lighthouse(c):
    return (f'<path d="M-14 36L-8-14h16l6 50z" fill="{PAPER}" stroke="{INK}" stroke-width="3"/><path d="M-11 22h22l-2 9h-18zM-9.5-3h19l-2 9h-15z" fill="{c}"/><rect x="-10" y="-24" width="20" height="10" fill="{INK}"/>'
            f'<path d="M-12-24l12-14 12 14z" fill="{c}" stroke="{INK}" stroke-width="2.5"/><circle cy="-19" r="3" fill="{MUSTARD}"/><path d="M12-19l30-9v18zM-12-19l-30-9v18z" fill="{MUSTARD}" opacity=".8"/>'
            f'<path d="M-30 36q30-10 60 0" stroke="{INK}" stroke-width="3" fill="none"/>')


def m_bowl(c):
    return (f'<path d="M-34-2h68q-4 30-34 30t-34-30z" fill="{c}" stroke="{INK}" stroke-width="3"/><path d="M-34-2h68" stroke="{INK}" stroke-width="3"/><path d="M-34-2h68q-4 30-34 30t-34-30z" fill="url(#hatch)" opacity=".5"/>'
            f'<path d="M-14-8q-6-10 0-18t0-14M2-8q-6-10 0-18t0-14M18-8q-6-10 0-18t0-14" fill="none" stroke="{INK}" stroke-width="2.5" stroke-linecap="round"/>'
            f'<path d="M-24 34h48" stroke="{INK}" stroke-width="3"/>')


def m_book(c):
    return (f'<path d="M-38-24q19-8 38 0v46q-19-8-38 0z" fill="{PAPER}" stroke="{INK}" stroke-width="3"/><path d="M38-24q-19-8-38 0v46q19-8 38 0z" fill="{c}" stroke="{INK}" stroke-width="3"/>'
            f'<path d="M-30-14q12-4 24 0M-30-6q12-4 24 0M-30 2q12-4 24 0" stroke="{INK}" stroke-width="1.6" fill="none"/>'
            f'<path d="M19-14l3.5 7 7.5 1-5.5 5 1.5 7.5-7-3.8-7 3.8 1.5-7.5-5.5-5 7.5-1z" fill="{MUSTARD}" stroke="{INK}" stroke-width="1.5"/>')


def m_barber(c):
    return (f'<rect x="-12" y="-36" width="24" height="68" rx="4" fill="{PAPER}" stroke="{INK}" stroke-width="3"/><path d="M-12-26l24-8M-12-12l24-8M-12 2l24-8M-12 16l24-8M-12 30l24-8" stroke="{c}" stroke-width="6"/>'
            f'<rect x="-12" y="-36" width="24" height="68" rx="4" fill="none" stroke="{INK}" stroke-width="3"/><rect x="-16" y="-44" width="32" height="9" rx="3" fill="{INK}"/><rect x="-16" y="30" width="32" height="9" rx="3" fill="{INK}"/>'
            f'<path d="M26-6l24 24M26 18l24-24" stroke="{INK}" stroke-width="3.5"/><circle cx="24" cy="-8" r="5" fill="none" stroke="{INK}" stroke-width="3"/><circle cx="24" cy="20" r="5" fill="none" stroke="{INK}" stroke-width="3"/>')


def m_fish(c):
    return (f'<path d="M-38 0q22-26 52-10l22-14v48l-22-14q-30 16-52-10z" fill="{c}" stroke="{INK}" stroke-width="3"/><circle cx="-22" cy="-4" r="3.5" fill="{PAPER}" stroke="{INK}" stroke-width="1.5"/>'
            f'<path d="M-6-10q8 10 0 20M6-9q8 9 0 18" stroke="{INK}" stroke-width="1.8" fill="none"/><path d="M-38 0q22-26 52-10l22-14v48l-22-14q-30 16-52-10z" fill="url(#hatch)" opacity=".4"/>')


def m_thimble(c):
    return (f'<path d="M-22 26l-3-34q0-26 25-26t25 26l-3 34z" fill="{c}" stroke="{INK}" stroke-width="3"/><path d="M-26 26h52v8h-52z" fill="{INK}"/>'
            f'<g fill="{INK}" opacity=".55"><circle cx="-10" cy="-14" r="2.2"/><circle cx="0" cy="-18" r="2.2"/><circle cx="10" cy="-14" r="2.2"/><circle cx="-14" cy="-4" r="2.2"/><circle cx="-4" cy="-6" r="2.2"/><circle cx="6" cy="-6" r="2.2"/><circle cx="16" cy="-4" r="2.2"/><circle cx="-12" cy="8" r="2.2"/><circle cx="-2" cy="6" r="2.2"/><circle cx="8" cy="8" r="2.2"/></g>'
            f'<path d="M30-30l-18 44" stroke="{INK}" stroke-width="3"/><ellipse cx="31" cy="-31" rx="2" ry="4" fill="none" stroke="{INK}" stroke-width="2" transform="rotate(20 31 -31)"/><path d="M-22 26l-3-34q0-26 25-26t25 26l-3 34z" fill="url(#hatch)" opacity=".4"/>')


def m_gull(c):
    return (f'<path d="M-36 6q16-30 36-6 20-24 36 6-18-8-36 6-18-14-36-6z" fill="{PAPER}" stroke="{INK}" stroke-width="3"/><path d="M-6 4l6 14 6-14z" fill="{MUSTARD}" stroke="{INK}" stroke-width="2"/>'
            f'<circle cx="0" cy="-2" r="5" fill="{PAPER}" stroke="{INK}" stroke-width="2.5"/><circle cx="1.5" cy="-3" r="1.2" fill="{INK}"/>')


MOTIFS = {"donut": m_donut, "washer": m_washer, "cassette": m_cassette, "lighthouse": m_lighthouse, "bowl": m_bowl,
          "book": m_book, "barber": m_barber, "fish": m_fish, "thimble": m_thimble, "gull": m_gull}

# ---------- the library: edit here ----------
# panel: paper | green | ink | ox ; band/band2: accent colours ; lines: up to 2 short lines
ADS = [
    dict(id="crust-bucket", phone="207-555-0142", name="The Crust Bucket", tag="HOT PIE.", lines=["Rotating coupons.", "No fixed clock."], foot="CLIP & SAVE",
         display="slab", tagf="bebas", bodyf="serif", panel="paper", band=OX, band2=GREEN, motif="chef", variant="A", accent=OX),
    dict(id="tonys-donuts", phone="207-555-0177", name="Tony’s Donuts", tag="Morning boxes.", lines=["Warm coffee.", "Open at dawn."], foot="OPEN MORNINGS",
         display="lobster", tagf="patua", bodyf="patua", panel="green", band=None, band2=None, motif="donut", variant="A", accent=MUSTARD, mc=OX),
    dict(id="myrtle-suds", phone="207-555-0123", name="Myrtle St. Suds", tag="OPEN LATE.", lines=["Wash, dry, fold.", "Quarters inside."], foot="24 HOURS ON FRIDAYS",
         display="bungee", tagf="bungee", bodyf="serif", panel="paper", band=GREEN, band2=OX, motif="washer", variant="B", accent=GREEN, mc=OX),
    dict(id="foghorn-tapes", phone="207-555-0188", name="Foghorn Tapes", tag="USED & LOUD.", lines=["Cassettes, 45s, posters.", "We buy collections."], foot="TRADE-INS WELCOME",
         display="righteous", tagf="righteous", bodyf="serif", panel="ink", band=MUSTARD, band2=OX, motif="cassette", variant="A", accent=MUSTARD, mc=OX),
    dict(id="harbor-lantern", phone="207-555-0109", name="Harbor Lantern Hardware", tag="WE KEEP THE LIGHTS ON.", lines=["Bulbs, rope, nails.", "Ask for Dot."], foot="SINCE 1948",
         display="anton", tagf="stencil", bodyf="serif", panel="paper", band=INK, band2=OX, motif="lighthouse", variant="B", accent=OX, mc=OX),
    dict(id="gull-ladle", phone="207-555-0164", name="The Gull & Ladle", tag="CHOWDER.", lines=["Hot bowls. Cold harbor.", "Bring your own spoon."], foot="CASH ONLY",
         display="rye", tagf="rye", bodyf="serif", panel="ox", band=INK, band2=MUSTARD, motif="bowl", variant="A", accent=MUSTARD, mc=MUSTARD),
    dict(id="cassiopeia-books", phone="207-555-0131", name="Cassiopeia Books", tag="Used. Odd. Mapped.", lines=["Charts, atlases, paperbacks.", "Browse till the fog lifts."], foot="STAIRS TO THE LEFT",
         display="fell", tagf="fell", bodyf="fell", panel="paper", band=GREEN, band2=MUSTARD, motif="book", variant="B", accent=GREEN, mc=OX),
    dict(id="quality-cuts", phone="207-555-0156", name="Quality Cuts", tag="TRIM • SHAVE • GOSSIP", lines=["Walk-ins welcome.", "Ask about the ferry."], foot="OLD PORT",
         display="limelight", tagf="anton", bodyf="serif", panel="green", band=None, band2=None, motif="barber", variant="A", accent=MUSTARD, mc=OX),
    dict(id="ferry-bait", phone="207-555-0120", name="Ferry Fare Bait", tag="Live bait. Hot coffee.", lines=["Worms, minnows, doughnuts.", "Dock-side at 5 a.m."], foot="NO REFUNDS ON FISH",
         display="pirata", tagf="pirata", bodyf="serif", panel="paper", band=OX, band2=GREEN, motif="fish", variant="A", accent=OX, mc=GREEN),
    dict(id="alice-alterations", phone="207-555-0195", name="Alice’s Alterations", tag="Hems, zips & mending.", lines=["Same-day if you ask nicely.", "Buttons by the jar."], foot="MYRTLE STREET",
         display="playball", tagf="playball", bodyf="serif", panel="ox", band=None, band2=None, motif="thimble", variant="B", accent=CREAM, mc=MUSTARD),
    dict(id="gull-taxi", phone="207-555-0100", name="Seagull Cab Co.", tag="RIDES BY WING.", lines=["Fares as the crow flies.", "Never a straight line."], foot="CALL THE HARBOR",
         display="stencil", tagf="stencil", bodyf="serif", panel="ink", band=MUSTARD, band2=OX, motif="gull", variant="B", accent=MUSTARD, mc=OX),
]

PANELS = {"paper": ("#ffffff", INK, OX), "green": (GREEN, CREAM, MUSTARD), "ink": ("#211c16", CREAM, MUSTARD), "ox": (OX, CREAM, MUSTARD)}


def esc(t: str) -> str:
    return t.replace("&", "&amp;")


def css(key: str) -> str:
    return SERIF if key == "serif" else FONTS[key][0]


def art(ad, chef, x, y, scale):
    if ad["motif"] == "chef":
        w = 120 * scale
        return (f'<g mask="url(#my)"><image mask="url(#mx)" x="{x - w / 2:.1f}" y="{y - w * .26:.1f}" width="{w:.1f}" height="{w * 475 / 935:.1f}" preserveAspectRatio="xMidYMid slice" '
                f'xlink:href="data:image/jpeg;base64,{chef}" href="data:image/jpeg;base64,{chef}"/></g>')
    return f'<g transform="translate({x} {y}) scale({scale})">{MOTIFS[ad["motif"]](ad.get("mc", ad["accent"]))}</g>'


def mini(ad, chef) -> str:
    """236 x 104 block."""
    fill, text, accent = PANELS[ad["panel"]]
    A = ad["variant"] == "A"
    tx, tw = (14, 140) if A else (84, 134)
    mx = 190 if A else 40
    ns = fit(ad["display"], ad["name"], tw, 26)
    parts = [f'<rect width="236" height="104" fill="{fill}" stroke="{INK}" stroke-width="3"/><rect width="236" height="104" fill="url({"#dots" if ad["panel"] == "paper" else "#screen"})"/>',
             f'<rect x="5" y="5" width="226" height="94" fill="none" stroke="{accent if ad["panel"] != "paper" else ad["accent"]}" stroke-width="1.6" stroke-dasharray="6 3"/>']
    if ad["band"]:
        parts.append(f'<path d="M{tx - 8} 12L{tx + tw + 4} 9 {tx + tw + 8} 34 {tx - 8} 38z" fill="{ad["band"]}"/>')
        name_fill = CREAM if ad["band"] in (OX, GREEN, INK) else INK
    else:
        name_fill = CREAM if ad["panel"] in ("green", "ink", "ox") else INK
    parts.append(f'<text x="{tx}" y="33" font-family="{css(ad["display"])}" font-size="{ns:.1f}" fill="{name_fill}">{esc(ad["name"])}</text>')
    tg = fit(ad["tagf"], ad["tag"], tw, 15)
    parts.append(f'<text x="{tx}" y="53" font-family="{css(ad["tagf"])}" font-size="{tg:.1f}" fill="{accent if ad["panel"] != "paper" else ad["accent"]}">{esc(ad["tag"])}</text>')
    for i, line in enumerate(ad["lines"][:2]):
        s = fit(ad["bodyf"], line, tw, 12)
        parts.append(f'<text x="{tx}" y="{70 + i * 14}" font-family="{css(ad["bodyf"])}" font-size="{s:.1f}" fill="{text}">{esc(line)}</text>')
    foot = f'TEL. {ad["phone"]}'
    fs = 8
    parts.append(f'<text x="{tx}" y="97" font-family="{MONO}" font-size="{fs:.1f}" font-weight="700" fill="{accent if ad["panel"] != "paper" else INK}">{esc(foot)}</text>')
    parts.append(f'<text x="226" y="16" text-anchor="end" font-family="{MONO}" font-size="4.6" letter-spacing=".6" fill="{text}" opacity=".7">ADVERTISEMENT</text>')
    parts.append(art(ad, chef, mx, 62, 0.62 if ad["motif"] != "chef" else 0.62))
    return "".join(parts)


def big(ad, chef) -> str:
    """476 x 280 block."""
    fill, text, accent = PANELS[ad["panel"]]
    dark = ad["panel"] != "paper"
    acc = accent if dark else ad["accent"]
    name_fill = CREAM if (ad["band"] in (OX, GREEN, INK) or (not ad["band"] and dark)) else INK
    ns = fit(ad["display"], ad["name"], 330, 46)
    p = [f'<rect x="2" y="2" width="472" height="276" fill="{fill}" stroke="{INK}" stroke-width="4"/><rect x="12" y="12" width="452" height="256" fill="url({"#dots" if not dark else "#screen"})" stroke="{acc}" stroke-width="2.5" stroke-dasharray="9 5"/>']
    if ad["band"]:
        p.append(f'<path d="M16 20L300 14 456 22 440 56 22 76z" fill="{ad["band"]}"/>')
        if ad["band2"]:
            p.append(f'<path d="M110 66L460 44 456 80 90 86z" fill="{ad["band2"]}"/>')
    p.append(f'<text x="28" y="62" font-family="{css(ad["display"])}" font-size="{ns:.1f}" fill="{name_fill}" stroke="{INK}" stroke-width="{1.3 if ad["band"] else 0}" paint-order="stroke" transform="rotate(-2 28 62)">{esc(ad["name"])}</text>')
    A = ad["variant"] == "A"
    ax, tx, tw = (122, 254, 196) if A else (352, 26, 236)
    p.append(art(ad, chef, ax, 160, 1.9 if ad["motif"] != "chef" else 1.9))
    tgs = fit(ad["tagf"], ad["tag"], tw, 40)
    p.append(f'<text x="{tx}" y="124" font-family="{css(ad["tagf"])}" font-size="{tgs:.1f}" fill="{acc if dark else INK}">{esc(ad["tag"])}</text>')
    for i, line in enumerate(ad["lines"][:2]):
        s = fit(ad["bodyf"], line, tw, 19)
        p.append(f'<text x="{tx}" y="{150 + i * 26}" font-family="{css(ad["bodyf"])}" font-size="{s:.1f}" fill="{text}">{esc(line)}</text>')
    p.append(f'<rect x="16" y="236" width="444" height="28" fill="{ad["band2"] or acc}" stroke="{INK}" stroke-width="2"/>'
             f'<text x="238" y="255" text-anchor="middle" font-family="{MONO}" font-size="11" font-weight="700" letter-spacing="1.5" fill="{CREAM if (ad["band2"] or acc) in (OX, GREEN, INK) else INK}">ADVERTISEMENT • {esc(ad["foot"])} • {ad["phone"]}</text>')
    return "".join(p)


def svg(w, h, title, body, fonts) -> str:
    title = esc(title).replace("\"", "&quot;")
    return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {w} {h}" role="img" aria-label="{title}"><title>{title}</title>{style(fonts)}'
            '<defs><pattern id="dots" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".8" fill="#17130f" opacity=".13"/></pattern>'
            '<pattern id="screen" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="1.6" cy="1.6" r=".75" fill="#efe2bd" opacity=".42"/></pattern>'
            '<pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><path d="M0 0v4" stroke="#17130f" stroke-width=".8" opacity=".45"/></pattern>'
            '<linearGradient id="fy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".08" stop-color="#fff"/><stop offset=".78" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
            '<linearGradient id="fx" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".07" stop-color="#fff"/><stop offset=".93" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
            '<mask id="my" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#fy)"/></mask><mask id="mx" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#fx)"/></mask></defs>'
            f'{body}</svg>\n')


def fonts_of(*ads):
    return [k for a in ads for k in (a["display"], a["tagf"], a["bodyf"]) if k != "serif"]


def by_id(i):
    return next(a for a in ADS if a["id"] == i)


def build(chef_source: Path, outdir: Path, rotation: Path | None) -> None:
    chef = re.search(r"base64,([A-Za-z0-9+/=]+)", chef_source.read_text()).group(1)
    (outdir / "ads").mkdir(parents=True, exist_ok=True)
    for ad in ADS:
        (outdir / "ads" / f"{ad['id']}-big.svg").write_text(svg(476, 280, ad["name"], big(ad, chef), fonts_of(ad)))
        (outdir / "ads" / f"{ad['id']}-mini.svg").write_text(svg(236, 104, ad["name"], mini(ad, chef), fonts_of(ad)))
    if rotation:
        r = json.loads(rotation.read_text())
        b = by_id(r["big"])
        (outdir / "crust-bucket.svg").write_text(svg(476, 280, b["name"], big(b, chef), fonts_of(b)))
        top, bottom = by_id(r["mini"][0]), by_id(r["mini"][1])
        body = (f'<rect x="2" y="2" width="256" height="244" fill="{PAPER}" stroke="{INK}" stroke-width="4"/>'
                f'<g transform="translate(12 12)">{mini(top, chef)}</g><g transform="translate(12 132)">{mini(bottom, chef)}</g>')
        (outdir / "mini-ads.svg").write_text(svg(260, 248, "Two mini advertisements", body, fonts_of(top, bottom)))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("chef_source", type=Path)
    ap.add_argument("outdir", type=Path)
    ap.add_argument("--rotation", type=Path, help='JSON like {"big": "crust-bucket", "mini": ["myrtle-suds", "tonys-donuts"]}')
    a = ap.parse_args()
    build(a.chef_source, a.outdir, a.rotation)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
