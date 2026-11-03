#!/usr/bin/env python3
"""Place approved ad art into the page-9 ad slots.

The approved PNGs in design-system/ad-library/approved/ are embedded byte-for-byte: never redrawn, recoloured,
reworded, stretched or cropped. Art is fitted proportionally inside a matted frame. Two assets are illustration-only
(no lettering); for those the slot adds the business name only, no invented copy.

  python ad_slots.py ad_assignments.issue_001.json components
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
from functools import lru_cache
from pathlib import Path

from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
LIB = ROOT / "design-system/ad-library"
INK = "#17130f"

# Own lettering for the illustration-only ads (each business keeps its own voice). Name only.
NAME_FONTS = {
    "tonys-donuts": ("Lobster", "Lobster-Regular-subset.woff", "Lobster,'Brush Script MT',cursive", "Tony’s Donuts"),
    "myrtle-suds": ("Bungee", "Bungee-Regular-subset.woff", "Bungee,Impact,sans-serif", "Myrtle St. Suds"),
}


@lru_cache(maxsize=None)
def _metrics(fname: str):
    f = TTFont(HERE / "fonts" / fname)
    return f.getBestCmap(), f["hmtx"], f["head"].unitsPerEm


def fit_size(fname: str, text: str, max_w: float, max_size: float) -> float:
    cmap, hmtx, upm = _metrics(fname)
    w = sum(hmtx[cmap.get(ord(c), "space")][0] for c in text) * max_size / upm
    return min(max_size, max_size * max_w / max(w, 1))


def load_library() -> dict:
    data = json.loads((LIB / "ad_library.json").read_text(encoding="utf-8"))
    return {a["id"]: a for a in data["ads"]}


def cell(ad: dict, x: float, y: float, w: float, h: float, pad: float = 7, base: Path | None = None) -> tuple[str, set]:
    """One matted frame holding one approved ad, fitted proportionally."""
    illustration_only = ad["lettering"] == "illustration-only"
    strip = 24 if illustration_only else 0
    box_w, box_h = w - 2 * pad, h - 2 * pad - strip
    ratio = ad["height_px"] / ad["width_px"]
    iw = min(box_w, box_h / ratio)
    ih = iw * ratio
    ix, iy = x + (w - iw) / 2, y + pad + (box_h - ih) / 2
    data = base64.b64encode(((base / "design-system/ad-library" / ad["file"]).resolve() if base else LIB / ad["file"]).read_bytes()).decode()
    # Ink matte fills the cell edge to edge so the frame lines up with every other box on the page;
    # the approved art sits on it unchanged (never cropped, stretched or filtered).
    parts = [f'<rect x="{x + 1.5}" y="{y + 1.5}" width="{w - 3}" height="{h - 3}" fill="{INK}" stroke="{INK}" stroke-width="3"/>',
             f'<rect x="{x + 5}" y="{y + 5}" width="{w - 10}" height="{h - 10}" fill="none" stroke="#c9b27c" stroke-width="0.8"/>',
             f'<image data-ad="{ad["id"]}" data-sha256="{ad["sha256"]}" x="{ix:.1f}" y="{iy:.1f}" width="{iw:.1f}" height="{ih:.1f}" '
             f'preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,{data}"/>']
    fonts = set()
    if illustration_only:
        family, fname, css, label = NAME_FONTS[ad["id"]]
        size = fit_size(fname, label, w - 40, 20)
        parts.append(f'<text x="{x + w / 2}" y="{y + h - pad - 6}" text-anchor="middle" font-family="{css}" font-size="{size:.1f}" fill="#f4e8c6">{label}</text>')
        fonts.add((family, fname))
    return "".join(parts), fonts


def wrap(w: int, h: int, title: str, body: str, fonts: set) -> str:
    css = "".join(
        f"@font-face{{font-family:'{fam}';src:url(data:font/woff;base64,{base64.b64encode((HERE / 'fonts' / f).read_bytes()).decode()}) format('woff');}}"
        for fam, f in sorted(fonts))
    style = f"<style>{css}</style>" if css else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{title}"><title>{title}</title>{style}{body}</svg>\n')


def build(assign: Path, outdir: Path) -> None:
    lib = load_library()
    slots = json.loads(assign.read_text(encoding="utf-8"))["slots"]
    outdir.mkdir(parents=True, exist_ok=True)
    big = lib[slots["ad"]]
    body, fonts = cell(big, 0, 0, 476, 280, pad=8)
    (outdir / "ad-slot.svg").write_text(wrap(476, 280, big["business"] + " advertisement", body, fonts))
    parts, allfonts = [], set()
    for i, ad_id in enumerate(slots["mini_ads"]):
        part, f = cell(lib[ad_id], 0, i * 128, 260, 120, pad=6)
        parts.append(part)
        allfonts |= f
    # Seagullotine editorial panel (the paper's own art): same ink matte so the art panels read as one family.
    sg = {"id": "seagullotine-panel", "file": "../../issues/issue_001/assets/puzzle-dojo/art/seagullotine-issue-001.png",
          "sha256": hashlib.sha256((HERE.parents[2] / "issues/issue_001/assets/puzzle-dojo/art/seagullotine-issue-001.png").read_bytes()).hexdigest(),
          "width_px": 1536, "height_px": 1024, "lettering": "complete"}
    sg_body, _ = cell(sg, 0, 0, 476, 248, pad=8, base=HERE.parents[2])
    (outdir / "seagullotine-panel.svg").write_text(wrap(476, 248, "Seagullotine editorial panel", sg_body, set()))
    (outdir / "mini-slot.svg").write_text(wrap(260, 248, "Two advertisements", "".join(parts), allfonts))
    print(outdir / "ad-slot.svg", outdir / "mini-slot.svg")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("assignments", type=Path)
    ap.add_argument("outdir", type=Path)
    a = ap.parse_args()
    build(a.assignments, a.outdir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
