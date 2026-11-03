#!/usr/bin/env python3
"""Original comic-book props for Puzzle Dojo pages: ninja stars, pizza slices, ooze canisters,
sparkles, speed lines and POW-style bursts. All art here is drawn from scratch as vector shapes
(generic objects only, no characters). Items are placed from a JSON list (decor.issue_NNN.json)
in page points, origin top-left.

    {"page": 8, "items": [{"type": "shuriken", "x": 60, "y": 200, "r": 22, "rot": 15}, ...]}
"""
from __future__ import annotations

import math
from xml.sax.saxutils import escape

from fontcss import HEAD

INK, RED, CREAM, GREEN, CHEESE, CRUST = "#171812", "#8c2118", "#f4e8c6", "#2f7a3a", "#e5b32e", "#c98a3a"
SW = 2.4  # comic outline weight


def _g(x: float, y: float, rot: float, body: str, scale: float = 1.0) -> str:
    return f'<g transform="translate({x:.1f} {y:.1f}) rotate({rot:.1f}) scale({scale:.3f})">{body}</g>'


def shuriken(x, y, r=20, rot=0, fill="#44464a", **_):
    pts = []
    for i in range(8):
        a = math.pi * i / 4
        rad = r if i % 2 == 0 else r * 0.3
        pts.append(f"{rad * math.sin(a):.1f},{-rad * math.cos(a):.1f}")
    body = (f'<polygon points="{" ".join(pts)}" fill="{fill}" stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round"/>'
            f'<polygon points="0,{-r * .86:.1f} {r * .16:.1f},{-r * .3:.1f} 0,{-r * .2:.1f}" fill="#8a8d93"/>'
            f'<polygon points="{r * .86:.1f},0 {r * .3:.1f},{r * .16:.1f} {r * .2:.1f},0" fill="#8a8d93"/>'
            f'<circle r="{r * .2:.1f}" fill="{CREAM}" stroke="{INK}" stroke-width="{SW * .8:.1f}"/>')
    return _g(x, y, rot, body)


def pizza(x, y, r=24, rot=0, **_):
    s = r
    body = (f'<path d="M{-s * .62:.1f} {-s * .55:.1f} L{s * .62:.1f} {-s * .55:.1f} L0 {s * .8:.1f} Z" fill="{CHEESE}" stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round"/>'
            f'<rect x="{-s * .7:.1f}" y="{-s * .72:.1f}" width="{s * 1.4:.1f}" height="{s * .3:.1f}" rx="{s * .15:.1f}" fill="{CRUST}" stroke="{INK}" stroke-width="{SW}"/>'
            f'<circle cx="{-s * .22:.1f}" cy="{-s * .22:.1f}" r="{s * .17:.1f}" fill="{RED}" stroke="{INK}" stroke-width="1.6"/>'
            f'<circle cx="{s * .25:.1f}" cy="{-s * .12:.1f}" r="{s * .15:.1f}" fill="{RED}" stroke="{INK}" stroke-width="1.6"/>'
            f'<circle cx="0" cy="{s * .33:.1f}" r="{s * .12:.1f}" fill="{RED}" stroke="{INK}" stroke-width="1.6"/>'
            f'<path d="M{-s * .4:.1f} {-s * .4:.1f} q{s * .05:.1f} {s * .3:.1f} {s * .14:.1f} {s * .22:.1f}" fill="none" stroke="#fff3c8" stroke-width="1.6" stroke-linecap="round"/>')
    return _g(x, y, rot, body)


def canister(x, y, r=26, rot=0, **_):
    """Barrel of glowing green ooze, spilling over the top."""
    w, h = r * 1.1, r * 1.35
    body = (f'<ellipse cx="0" cy="{h * .56:.1f}" rx="{w * .8:.1f}" ry="{h * .1:.1f}" fill="{GREEN}" opacity=".6"/>'
            f'<path d="M{-w / 2:.1f} {-h / 2:.1f} h{w:.1f} v{h:.1f} a{w / 2:.1f} {h * .08:.1f} 0 0 1 {-w:.1f} 0z" fill="#7b8562" stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round"/>'
            f'<path d="M{-w / 2:.1f} {-h * .18:.1f} h{w:.1f} M{-w / 2:.1f} {h * .22:.1f} h{w:.1f}" stroke="{INK}" stroke-width="2.2"/>'
            f'<circle cx="0" cy="{h * .02:.1f}" r="{w * .2:.1f}" fill="{CREAM}" stroke="{INK}" stroke-width="1.6"/>'
            f'<path d="M0 {-h * .1:.1f} v{h * .08:.1f} M{-w * .09:.1f} {h * .08:.1f} l{w * .18:.1f} 0" stroke="{INK}" stroke-width="1.6"/>'
            f'<path d="M{-w * .56:.1f} {-h * .5:.1f} q{w * .1:.1f} {-h * .22:.1f} {w * .4:.1f} {-h * .12:.1f} q{w * .35:.1f} {-h * .1:.1f} {w * .6:.1f} {h * .06:.1f}'
            f' q{w * .1:.1f} {h * .3:.1f} {-w * .02:.1f} {h * .5:.1f} q{-w * .09:.1f} {h * .1:.1f} {-w * .16:.1f} 0 q{w * .02:.1f} {-h * .2:.1f} {-w * .1:.1f} {-h * .2:.1f}'
            f' q{-w * .12:.1f} {h * .3:.1f} {-w * .22:.1f} {h * .02:.1f} q{-w * .1:.1f} {-h * .2:.1f} {-w * .14:.1f} {-h * .1:.1f}z" fill="{GREEN}" stroke="{INK}" stroke-width="1.8" stroke-linejoin="round"/>'
            f'<path d="M{-w * .3:.1f} {-h * .56:.1f} q{w * .1:.1f} {-h * .08:.1f} {w * .22:.1f} {-h * .04:.1f}" fill="none" stroke="#c9f5b0" stroke-width="2.2" stroke-linecap="round"/>')
    return _g(x, y, rot, body)


def sparkle(x, y, r=8, rot=0, **_):
    pts = []
    for i in range(8):
        a = math.pi * i / 4
        rad = r if i % 2 == 0 else r * 0.28
        pts.append(f"{rad * math.sin(a):.1f},{-rad * math.cos(a):.1f}")
    return _g(x, y, rot, f'<polygon points="{" ".join(pts)}" fill="{CREAM}" stroke="{INK}" stroke-width="1.6" stroke-linejoin="round"/>')


def speed(x, y, r=30, rot=0, **_):
    """Three parallel motion streaks, length r, trailing left of (x, y)."""
    body = "".join(f'<path d="M0 {dy}h{-r * k:.1f}" stroke="{INK}" stroke-width="{w}" stroke-linecap="round"/>'
                   for dy, k, w in ((-6, .8, 2.2), (0, 1.0, 2.8), (6, .65, 2.2)))
    return _g(x, y, rot, body)


def burst(x, y, r=30, rot=-6, text="POW!", fill=RED, ink=CREAM, spikes=11, **_):
    pts = []
    for i in range(spikes * 2):
        a = math.pi * i / spikes
        rad = r if i % 2 == 0 else r * 0.68
        rad *= 1 + (0.06 if i % 4 == 0 else -0.04)  # deterministic wobble
        pts.append(f"{rad * math.sin(a):.1f},{-rad * math.cos(a):.1f}")
    size = r * (0.62 if len(text) <= 4 else 0.62 * 4 / len(text) * 1.15)
    body = (f'<polygon points="{" ".join(pts)}" fill="{fill}" stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round"/>'
            f'<text y="{size * .34:.1f}" text-anchor="middle" font-family="{HEAD}" font-size="{size:.1f}" letter-spacing="1" '
            f'fill="{ink}" stroke="{INK}" stroke-width="{max(size * .06, .8):.1f}" paint-order="stroke">{escape(text)}</text>')
    return _g(x, y, rot, body)


def pencil(x, y, r=40, rot=-35, **_):
    """Detailed comic pencil, length about 2r, centred on (x, y)."""
    L, w = r * 2.0, r * 0.3
    x0 = -L / 2
    body = (
        f'<rect x="{x0:.1f}" y="{-w / 2:.1f}" width="{L * .1:.1f}" height="{w:.1f}" rx="{w * .35:.1f}" fill="#e8858f" stroke="{INK}" stroke-width="{SW}"/>'
        f'<rect x="{x0 + L * .1:.1f}" y="{-w / 2:.1f}" width="{L * .13:.1f}" height="{w:.1f}" fill="#b9bcc2" stroke="{INK}" stroke-width="{SW}"/>'
        f'<path d="M{x0 + L * .145:.1f} {-w / 2:.1f}v{w:.1f}M{x0 + L * .185:.1f} {-w / 2:.1f}v{w:.1f}" stroke="{INK}" stroke-width="1.2"/>'
        f'<rect x="{x0 + L * .23:.1f}" y="{-w / 2:.1f}" width="{L * .5:.1f}" height="{w:.1f}" fill="{CHEESE}" stroke="{INK}" stroke-width="{SW}"/>'
        f'<path d="M{x0 + L * .25:.1f} {-w * .18:.1f}h{L * .46:.1f}" stroke="#fff0a8" stroke-width="2.2" stroke-linecap="round"/>'
        f'<path d="M{x0 + L * .25:.1f} {w * .3:.1f}h{L * .46:.1f}" stroke="#b07b12" stroke-width="1.6"/>'
        f'<path d="M{x0 + L * .73:.1f} {-w / 2:.1f}L{x0 + L:.1f} 0L{x0 + L * .73:.1f} {w / 2:.1f}z" fill="#e8c48a" stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round"/>'
        f'<path d="M{x0 + L * .9:.1f} {-w * .17:.1f}L{x0 + L:.1f} 0L{x0 + L * .9:.1f} {w * .17:.1f}z" fill="{INK}"/>'
    )
    return _g(x, y, rot, body)


def bulb(x, y, r=12, rot=0, **_):
    """Idea bulb with rays."""
    rays = "".join(f'<path d="M0 {-r * 1.35:.1f}v{-r * .45:.1f}" stroke="{INK}" stroke-width="2" stroke-linecap="round" transform="rotate({a})"/>'
                   for a in (-70, -35, 0, 35, 70))
    body = (f'{rays}<circle r="{r}" fill="#ffe27a" stroke="{INK}" stroke-width="{SW}"/>'
            f'<path d="M{-r * .45:.1f} {-r * .3:.1f} q{r * .1:.1f} {-r * .35:.1f} {r * .4:.1f} {-r * .4:.1f}" fill="none" stroke="#fffbe0" stroke-width="2.2" stroke-linecap="round"/>'
            f'<rect x="{-r * .5:.1f}" y="{r * .85:.1f}" width="{r:.1f}" height="{r * .5:.1f}" rx="2" fill="#9a9ca3" stroke="{INK}" stroke-width="1.8"/>'
            f'<path d="M{-r * .25:.1f} {r * .3:.1f}l{r * .25:.1f} {-r * .35:.1f}l{r * .25:.1f} {r * .35:.1f}" fill="none" stroke="{RED}" stroke-width="1.6"/>')
    return _g(x, y, rot, body)


def pizza_whole(x, y, r=30, rot=0, **_):
    """Whole pie, eight slices, one slice nudged out; reads as 'slices' for the Pizza Cipher."""
    cuts = "".join(f'<path d="M0 0L{r * math.sin(a):.1f} {-r * math.cos(a):.1f}" stroke="{INK}" stroke-width="1.6"/>'
                   for a in [math.pi * k / 4 + math.pi / 8 for k in range(8)])
    peps = "".join(f'<circle cx="{r * d * math.sin(a):.1f}" cy="{-r * d * math.cos(a):.1f}" r="{r * .1:.1f}" fill="{RED}" stroke="{INK}" stroke-width="1.3"/>'
                   for a, d in [(.3, .55), (1.1, .62), (1.9, .5), (2.7, .6), (3.6, .55), (4.4, .62), (5.2, .5), (5.9, .6), (0, 0)])
    body = (f'<circle r="{r:.1f}" fill="{CRUST}" stroke="{INK}" stroke-width="{SW}"/>'
            f'<circle r="{r * .86:.1f}" fill="{CHEESE}" stroke="{INK}" stroke-width="1.4"/>{cuts}{peps}'
            f'<path d="M{-r * .3:.1f} {-r * .55:.1f} q{r * .15:.1f} {-r * .12:.1f} {r * .3:.1f} {-r * .04:.1f}" fill="none" stroke="#fff3c8" stroke-width="2" stroke-linecap="round"/>')
    return _g(x, y, rot, body)


def bridge(x, y, r=50, rot=0, **_):
    """Cartoon suspension bridge over water (r = half width), for 'The Bridge Builder'."""
    w, h = r, r * .62
    body = (f'<path d="M{-w:.1f} {h * .2:.1f} q{w * .5:.1f} {-h * 1.5:.1f} {w * .5:.1f} {-h * .85:.1f}" fill="none" stroke="{INK}" stroke-width="2"/>'
            f'<path d="M{-w * .5:.1f} {-h * .65:.1f} q{w * .5:.1f} {h * .9:.1f} {w:.1f} 0" fill="none" stroke="{INK}" stroke-width="2"/>'
            f'<path d="M{w * .5:.1f} {-h * .65:.1f} q{w * .5:.1f} {-h * .65:.1f} {w * .5:.1f} {h * .85:.1f}" fill="none" stroke="{INK}" stroke-width="2"/>'
            + "".join(f'<path d="M{xx:.1f} {-h * .3:.1f}v{h * .5:.1f}" stroke="{INK}" stroke-width="1"/>' for xx in (-w * .3, -w * .1, w * .1, w * .3))
            + f'<rect x="{-w * .56:.1f}" y="{-h * .8:.1f}" width="{w * .12:.1f}" height="{h * 1.2:.1f}" fill="#8b7a5a" stroke="{INK}" stroke-width="{SW}"/>'
            f'<rect x="{w * .44:.1f}" y="{-h * .8:.1f}" width="{w * .12:.1f}" height="{h * 1.2:.1f}" fill="#8b7a5a" stroke="{INK}" stroke-width="{SW}"/>'
            f'<rect x="{-w:.1f}" y="{h * .2:.1f}" width="{w * 2:.1f}" height="{h * .16:.1f}" fill="{RED}" stroke="{INK}" stroke-width="{SW}"/>'
            f'<path d="M{-w:.1f} {h * .62:.1f} q{w * .12:.1f} {-h * .12:.1f} {w * .25:.1f} 0 t{w * .25:.1f} 0 t{w * .25:.1f} 0 t{w * .25:.1f} 0 t{w * .25:.1f} 0 t{w * .25:.1f} 0 t{w * .25:.1f} 0 t{w * .25:.1f} 0" fill="none" stroke="#2f6f8f" stroke-width="2.4" stroke-linecap="round"/>')
    return _g(x, y, rot, body)


def caption(x, y, size=18, rot=-3, text="", fill=RED, **_):
    return _g(x, y, rot, f'<text text-anchor="middle" font-family="{HEAD}" font-size="{size}" letter-spacing="1.2" fill="{fill}" '
                         f'stroke="{INK}" stroke-width="{size * .05:.1f}" paint-order="stroke">{escape(text)}</text>')


PAPER = "#f6ecca"


def _txt(x, y, size, t, fill=INK):
    return (f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="middle" font-family="{HEAD}" font-size="{size:.1f}" fill="{fill}">{escape(t)}</text>')


def crossword_icon(x, y, r=22, rot=0, **_):
    """Mini crossword: 5x5 with black squares, numbers and two letters."""
    n, c = 5, r * 2 / 5
    o = -r
    blacks = {(0, 2), (1, 2), (2, 0), (3, 3), (4, 3), (2, 4)}
    cells = "".join(f'<rect x="{o + i * c:.1f}" y="{o + j * c:.1f}" width="{c:.1f}" height="{c:.1f}" fill="{INK if (i, j) in blacks else PAPER}" stroke="{INK}" stroke-width="1.1"/>'
                    for j in range(n) for i in range(n))
    body = (f'<rect x="{o - 2:.1f}" y="{o - 2:.1f}" width="{2 * r + 4:.1f}" height="{2 * r + 4:.1f}" fill="{PAPER}" stroke="{INK}" stroke-width="{SW}"/>{cells}'
            + _txt(o + c * .5, o + c * .82, c * .8, "P") + _txt(o + c * 1.5, o + c * 1.82, c * .8, "Z")
            + f'<text x="{o + 1.5:.1f}" y="{o + 5.2:.1f}" font-family="{HEAD}" font-size="4.5" fill="{INK}">1</text>')
    return _g(x, y, rot, body)


def sudoku_icon(x, y, r=22, rot=0, **_):
    """Mini sudoku: 3x3 of 3x3, heavy box lines and a few digits."""
    c = r * 2 / 9
    o = -r
    thin = "".join(f'<path d="M{o + k * c:.1f} {o:.1f}v{2 * r:.1f}M{o:.1f} {o + k * c:.1f}h{2 * r:.1f}" stroke="{INK}" stroke-width=".8"/>' for k in range(1, 9))
    thick = "".join(f'<path d="M{o + k * 3 * c:.1f} {o:.1f}v{2 * r:.1f}M{o:.1f} {o + k * 3 * c:.1f}h{2 * r:.1f}" stroke="{INK}" stroke-width="1.8"/>' for k in (1, 2))
    digs = [(0, 0, "5"), (1, 0, "3"), (4, 0, "7"), (0, 1, "6"), (3, 1, "1"), (4, 1, "9"), (5, 1, "5"), (1, 2, "9"), (2, 2, "8"), (7, 2, "6")]
    nums = "".join(_txt(o + (i + .5) * c, o + (j + .5) * c + c * .3, c * .95, d) for i, j, d in digs)
    body = (f'<rect x="{o:.1f}" y="{o:.1f}" width="{2 * r:.1f}" height="{2 * r:.1f}" fill="{PAPER}" stroke="{INK}" stroke-width="{SW}"/>{thin}{thick}{nums}')
    return _g(x, y, rot, body)


def magnifier(x, y, r=22, rot=0, **_):
    """Magnifying glass over word-search letters."""
    lens = r * .62
    body = (f'<rect x="{lens * .5:.1f}" y="{lens * .9:.1f}" width="{r * .22:.1f}" height="{r * .9:.1f}" rx="{r * .08:.1f}" fill="#8a5a2b" stroke="{INK}" stroke-width="{SW}" transform="rotate(-42 {lens * .6:.1f} {lens * .9:.1f})"/>'
            f'<circle r="{lens:.1f}" fill="#cfe9f2" stroke="{INK}" stroke-width="{SW + .6:.1f}"/>'
            f'<circle r="{lens * .82:.1f}" fill="none" stroke="#fff" stroke-width="1.4" stroke-dasharray="{lens * .9:.1f} {lens * 4:.1f}" transform="rotate(200)"/>'
            + _txt(-lens * .35, -lens * .05, lens * .75, "P") + _txt(lens * .3, -lens * .05, lens * .75, "I") + _txt(-lens * .35, lens * .6, lens * .75, "Z") + _txt(lens * .3, lens * .6, lens * .75, "A", RED))
    return _g(x, y, rot, body)


def jigsaw(x, y, r=20, rot=0, fill="#d9a441", **_):
    s = r * 2
    h, k = s / 2, s / 6
    d = (f"M{-h:.1f} {-h:.1f} H{-k:.1f} A{k:.1f} {k:.1f} 0 1 1 {k:.1f} {-h:.1f} H{h:.1f} V{-k:.1f} A{k:.1f} {k:.1f} 0 1 1 {h:.1f} {k:.1f} "
         f"V{h:.1f} H{k:.1f} A{k:.1f} {k:.1f} 0 1 0 {-k:.1f} {h:.1f} H{-h:.1f} V{k:.1f} A{k:.1f} {k:.1f} 0 1 0 {-h:.1f} {-k:.1f} Z")
    body = (f'<path d="{d}" fill="{fill}" stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round"/>'
            f'<path d="M{-h * .6:.1f} {-h * .55:.1f} q{h * .3:.1f} {-h * .15:.1f} {h * .6:.1f} {-h * .05:.1f}" fill="none" stroke="#fff3c8" stroke-width="2" stroke-linecap="round"/>')
    return _g(x, y, rot, body)


def decoder(x, y, r=26, rot=0, **_):
    """Cipher disc: ring of letters, inner dial with +3."""
    letters = "ABCDEFGHIJKL"
    ring = "".join(f'<text x="0" y="{-r * .78:.1f}" text-anchor="middle" font-family="{HEAD}" font-size="{r * .26:.1f}" fill="{INK}" transform="rotate({i * 30})">{ch}</text>'
                   for i, ch in enumerate(letters))
    body = (f'<circle r="{r:.1f}" fill="{PAPER}" stroke="{INK}" stroke-width="{SW}"/>{ring}'
            f'<circle r="{r * .62:.1f}" fill="{RED}" stroke="{INK}" stroke-width="{SW}"/>'
            f'<circle r="{r * .24:.1f}" fill="{PAPER}" stroke="{INK}" stroke-width="1.6"/>'
            + _txt(0, r * .1, r * .3, "+3")
            + f'<path d="M{r * .62:.1f} 0l{r * .2:.1f} {-r * .1:.1f}v{r * .2:.1f}z" fill="{INK}"/>')
    return _g(x, y, rot, body)


def stopwatch(x, y, r=18, rot=0, **_):
    ticks = "".join(f'<path d="M0 {-r * .82:.1f}v{r * .12:.1f}" stroke="{INK}" stroke-width="1.6" transform="rotate({a})"/>' for a in range(0, 360, 30))
    body = (f'<rect x="{-r * .18:.1f}" y="{-r * 1.3:.1f}" width="{r * .36:.1f}" height="{r * .3:.1f}" fill="#9a9ca3" stroke="{INK}" stroke-width="2"/>'
            f'<circle r="{r:.1f}" fill="#f6ecca" stroke="{INK}" stroke-width="{SW}"/>{ticks}'
            f'<path d="M0 0L{r * .45:.1f} {-r * .4:.1f}" stroke="{RED}" stroke-width="2.6" stroke-linecap="round"/><circle r="2.4" fill="{INK}"/>')
    return _g(x, y, rot, body)


def eraser(x, y, r=16, rot=0, **_):
    w, h = r * 2, r * .9
    body = (f'<rect x="{-w / 2:.1f}" y="{-h / 2:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{h * .2:.1f}" fill="#e8858f" stroke="{INK}" stroke-width="{SW}"/>'
            f'<rect x="{-w * .1:.1f}" y="{-h / 2:.1f}" width="{w * .6:.1f}" height="{h:.1f}" rx="{h * .15:.1f}" fill="#3f6fa0" stroke="{INK}" stroke-width="{SW}"/>'
            f'<path d="M{-w * .4:.1f} {-h * .15:.1f}h{w * .2:.1f}" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>')
    return _g(x, y, rot, body)


MAKERS = {"crossword": crossword_icon, "sudoku": sudoku_icon, "magnifier": magnifier, "jigsaw": jigsaw, "decoder": decoder,
          "stopwatch": stopwatch, "eraser": eraser, "pizza_whole": pizza_whole, "bridge": bridge, "caption": caption, "pencil": pencil, "bulb": bulb, "shuriken": shuriken, "pizza": pizza, "canister": canister, "sparkle": sparkle, "speed": speed, "burst": burst}


def layer(items: list[dict]) -> str:
    return "".join(MAKERS[i["type"]](**{k: v for k, v in i.items() if k != "type"}) for i in items)
