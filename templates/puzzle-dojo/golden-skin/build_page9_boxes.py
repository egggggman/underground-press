#!/usr/bin/env python3
"""Newspaper-style page-9 boxes (Puzzle Bench, Cipher Corner, Portland Memory,
Last Issue Solutions). Same wording and sizes as the design-system components
they replace; only the visual treatment changes. The originals in
design-system/components/puzzle-dojo/ are not modified. Boxes are transparent
so the page paper shows through."""
from __future__ import annotations
import argparse
from pathlib import Path
from xml.sax.saxutils import escape

DISPLAY = "Impact,Haettenschweiler,'Arial Narrow Bold','Liberation Sans Narrow',sans-serif"
SERIF = "Georgia,'Times New Roman',serif"
SANS = "'Arial Narrow',Arial,Helvetica,sans-serif"
MONO = "'Courier New',Courier,monospace"
INK, RED, GREEN, CREAM = "#171812", "#8c2118", "#173f32", "#f4e8c6"


def frame(w: int, h: int, title: str, bar: str, tw: int) -> str:
    """Double-rule box with a condensed-headline bar and star notch."""
    return (
        f'<rect x="2" y="2" width="{w - 4}" height="{h - 4}" fill="none" stroke="{INK}" stroke-width="3"/>'
        f'<rect x="7" y="7" width="{w - 14}" height="{h - 14}" fill="none" stroke="{INK}" stroke-width="0.8"/>'
        f'<rect x="7" y="7" width="{w - 14}" height="34" fill="{bar}"/>'
        f'<path d="M7 41H{w - 7}" stroke="{INK}" stroke-width="2"/>'
        f'<text x="19" y="33" font-family="{DISPLAY}" font-size="23" fill="{CREAM}" '
        f'textLength="{tw}" lengthAdjust="spacingAndGlyphs">{escape(title)}</text>'
        f'<path d="M{w - 26} 14l2.6 6.2 6.6.6-5 4.4 1.6 6.6-5.8-3.6-5.8 3.6 1.6-6.6-5-4.4 6.6-.6z" fill="{CREAM}" opacity=".85"/>'
    )


def wrap(w: int, h: int, title: str, body: str) -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" '
            f'role="img"><title>{escape(title)}</title>{body}</svg>\n')


def puzzle_bench() -> str:
    w, h = 476, 258
    b = frame(w, h, "PUZZLE BENCH", GREEN, 170)
    b += (f'<text font-family="{SERIF}" font-size="17" fill="{INK}">'
          f'<tspan x="26" y="78">Sharpen a pencil. Trade a clue. Leave the bench</tspan>'
          f'<tspan x="26" y="101">ready for the next solver.</tspan></text>')
    b += f'<path d="M26 113H{w - 26}" stroke="{INK}" stroke-width="1.2"/>'
    b += (f'<text x="26" y="147" font-family="{DISPLAY}" font-size="14" fill="{INK}" letter-spacing=".6">NAME</text>'
          f'<path d="M72 148H250" stroke="{INK}" stroke-width="1" stroke-dasharray="3 3"/>'
          f'<text x="266" y="147" font-family="{DISPLAY}" font-size="14" fill="{INK}" letter-spacing=".6">TIME</text>'
          f'<path d="M306 148H{w - 26}" stroke="{INK}" stroke-width="1" stroke-dasharray="3 3"/>'
          f'<text x="26" y="184" font-family="{DISPLAY}" font-size="14" fill="{INK}" letter-spacing=".6">STUCK ON</text>'
          f'<path d="M100 185H{w - 26}" stroke="{INK}" stroke-width="1" stroke-dasharray="3 3"/>')
    # red rubber stamp band, as in the paper's classifieds
    b += (f'<path d="M26 202H{w - 26}" stroke="{INK}" stroke-width="1.2"/>'
          f'<rect x="26" y="212" width="258" height="26" fill="{RED}"/>'
          f'<text x="155" y="231" text-anchor="middle" font-family="{DISPLAY}" font-size="14.5" fill="{CREAM}" '
          f'textLength="238" lengthAdjust="spacingAndGlyphs">PASS THE PAPER. KEEP THE ANSWERS COVERED.</text>'
          f'<path d="M300 225H{w - 26}" stroke="{RED}" stroke-width="5"/>')
    return wrap(w, h, "Puzzle Bench", b)


def cipher_corner() -> str:
    w, h = 260, 258
    b = frame(w, h, "CIPHER CORNER", GREEN, 150)
    b += (f'<text font-family="{SERIF}" font-size="14.5" fill="{INK}">'
          f'<tspan x="20" y="68">Pizza Cipher uses a</tspan><tspan x="20" y="86">Caesar shift of three.</tspan>'
          f'<tspan x="20" y="112">Move each coded letter</tspan><tspan x="20" y="130">three slices backward.</tspan></text>')
    # cipher wheel (decorative)
    cx, cy = 196, 168
    ticks = "".join(
        f'<path d="M{cx} {cy - 30}v5" stroke="{INK}" stroke-width="1.2" transform="rotate({a} {cx} {cy})"/>'
        for a in range(0, 360, 30))
    b += (f'<circle cx="{cx}" cy="{cy}" r="33" fill="none" stroke="{INK}" stroke-width="3"/>'
          f'<circle cx="{cx}" cy="{cy}" r="24" fill="none" stroke="{INK}" stroke-width="1"/>{ticks}'
          f'<path d="M{cx} {cy}L{cx + 14} {cy - 16}" stroke="{RED}" stroke-width="3"/>'
          f'<circle cx="{cx}" cy="{cy}" r="3.5" fill="{RED}"/>')
    b += (f'<rect x="20" y="152" width="124" height="34" fill="none" stroke="{RED}" stroke-width="2"/>'
          f'<text x="82" y="177" text-anchor="middle" font-family="{MONO}" font-size="16" font-weight="bold" fill="{RED}" textLength="104" lengthAdjust="spacingAndGlyphs">S → P   K → H</text>')
    b += (f'<path d="M20 206H{w - 20}" stroke="{INK}" stroke-width="1.2"/>'
          f'<text x="{w / 2}" y="228" text-anchor="middle" font-family="{DISPLAY}" font-size="13" fill="{INK}" '
          f'textLength="214" lengthAdjust="spacingAndGlyphs">KEEP SPACES. CHECK THE WHOLE PHRASE.</text>')
    return wrap(w, h, "Cipher Corner", b)


def portland_memory() -> str:
    w, h = 476, 204
    b = (f'<rect x="2" y="2" width="{w - 4}" height="{h - 4}" fill="none" stroke="{INK}" stroke-width="3"/>'
         f'<rect x="7" y="7" width="{w - 14}" height="{h - 14}" fill="none" stroke="{INK}" stroke-width="0.8"/>')
    # clipping: slightly skewed, dashed scissor edge
    b += (f'<path d="M20 22l436-8 2 168-434 6z" fill="#fff6dc" fill-opacity=".55" stroke="{INK}" '
          f'stroke-width="1.4" stroke-dasharray="7 4"/>'
          f'<rect x="20" y="22" width="436" height="26" fill="{RED}" transform="rotate(-1 20 22)"/>')
    b += (f'<text x="34" y="41" font-family="{DISPLAY}" font-size="15" fill="{CREAM}" letter-spacing=".8" '
          f'textLength="300" lengthAdjust="spacingAndGlyphs" transform="rotate(-1 20 22)">PORTLAND MEMORY • HEARD NEAR THE STAIRS</text>')
    b += (f'<text font-family="{SERIF}" font-size="18" font-style="italic" fill="{INK}">'
          f'<tspan x="34" y="84">“On wet mornings, the first puzzle copy always</tspan>'
          f'<tspan x="34" y="108">curled at the harbor-facing corner.”</tspan></text>')
    b += (f'<path d="M34 124H{w - 130}" stroke="{INK}" stroke-width="1"/>'
          f'<text font-family="{SANS}" font-size="12" fill="{INK}">'
          f'<tspan x="34" y="146">A neighborhood recollection, not a historical claim.</tspan>'
          f'<tspan x="34" y="164">The teller\'s name was lost under a coffee ring.</tspan></text>')
    # coffee ring over the clipping
    b += (f'<circle cx="408" cy="140" r="29" fill="none" stroke="#6b4a2a" stroke-width="5" opacity=".38"/>'
          f'<circle cx="410" cy="141" r="25" fill="none" stroke="#6b4a2a" stroke-width="1.6" opacity=".3"/>')
    return wrap(w, h, "Portland memory fragment", b)


def last_issue_solutions() -> str:
    w, h = 260, 204
    b = frame(w, h, "LAST ISSUE SOLUTIONS", RED, 202)
    b += (f'<text font-family="{SERIF}" font-size="15" fill="{INK}">'
          f'<tspan x="20" y="70">Issue #1 opens the dojo.</tspan><tspan x="20" y="91">There is no prior answer key.</tspan>'
          f'<tspan x="20" y="120">Issue #1 solutions return</tspan><tspan x="20" y="141">with Issue #2.</tspan></text>')
    b += (f'<path d="M20 156H{w - 20}" stroke="{INK}" stroke-width="1.2" stroke-dasharray="4 3"/>'
          f'<text x="{w / 2}" y="180" text-anchor="middle" font-family="{DISPLAY}" font-size="13" fill="{GREEN}" '
          f'textLength="192" lengthAdjust="spacingAndGlyphs">CLIP • SAVE • CHECK NEXT TIME</text>')
    return wrap(w, h, "Last Issue Solutions", b)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("outdir", type=Path)
    a = p.parse_args()
    a.outdir.mkdir(parents=True, exist_ok=True)
    for name, fn in {"puzzle-bench.svg": puzzle_bench, "cipher-corner.svg": cipher_corner,
                     "portland-memory.svg": portland_memory, "last-solutions.svg": last_issue_solutions}.items():
        (a.outdir / name).write_text(fn(), encoding="utf-8"); print(a.outdir / name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
