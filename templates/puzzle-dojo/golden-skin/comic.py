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


MAKERS = {"shuriken": shuriken, "pizza": pizza, "canister": canister, "sparkle": sparkle, "speed": speed, "burst": burst}


def layer(items: list[dict]) -> str:
    return "".join(MAKERS[i["type"]](**{k: v for k, v in i.items() if k != "type"}) for i in items)
