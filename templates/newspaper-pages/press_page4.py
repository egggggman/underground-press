#!/usr/bin/env python3
"""Issue 001 Page 4, Editorial & Opinion, in the Pages 2-3 look with its own composition.

Words come verbatim from content/*/inventory.json, chosen by ID in
issues/issue_001/production/editorial/SELECTION.json. This module adds layout labels only.

    python build_page_4.py            # writes issues/issue_001/production/page-4/
"""
from __future__ import annotations

import json
import re
from html import escape

import press_pages as P
import press_props as pp
from press_pages import INK, RED, GREEN, PAPER, BOX, MUSTARD

SELECTION = P.PROD / "editorial/SELECTION.json"


def load_selection() -> dict:
    sel = json.loads(SELECTION.read_text(encoding="utf-8"))
    inv = {}
    for name in ("editorials", "letters", "polls"):
        for item in json.loads((P.ROOT / f"content/{name}/inventory.json").read_text(encoding="utf-8")):
            inv[item["id"]] = item
    missing = [i for i in [sel["lead_editorial"], *sel["board_editorials"], sel["seagullotine"], *sel["letters"],
                           sel["poll"], sel["discovery_from"]] if i not in inv]
    if missing:
        raise SystemExit(f"selection IDs not in inventory: {missing}")
    return {"sel": sel, "inv": inv}


def gull_art() -> str:
    """The Seagullotine figure group from the approved component art/seagullotine/editorial_panel.svg."""
    src = (P.ROOT / "art/seagullotine/editorial_panel.svg").read_text(encoding="utf-8")
    g = re.search(r'<g id="seagullotine-art">.*?</g>', src, re.S).group(0)
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="66pt" height="98pt" viewBox="8 40 172 214">{g}</svg>'


EXTRA_CSS = """
.edlead{background:%(box)s;border:2.4pt solid %(ink)s;box-shadow:3pt 3pt 0 rgba(23,24,18,.85),inset 0 0 0 3pt %(box)s,inset 0 0 0 4pt rgba(23,24,18,.6);padding:18pt 22pt 14pt}
.kick{display:flex;align-items:center;gap:9pt;font-family:'Bebas Neue',sans-serif;letter-spacing:1.6pt;font-size:14pt;color:%(green)s}
.tab{background:%(red)s;color:#fff8df;border:1.6pt solid %(ink)s;padding:1pt 9pt 0;font-size:15pt;letter-spacing:2pt}
.edhead{font-family:Bangers,Impact,sans-serif;font-size:84pt;line-height:.9;letter-spacing:1pt;margin:10pt 0 8pt}
.edhead .l1{display:block;color:%(ink)s;text-shadow:2.4pt 2.4pt 0 %(mustard)s}
.edhead .l2{display:block;color:%(red)s;text-shadow:2pt 2pt 0 rgba(23,24,18,.85)}
.edrule{height:5pt;border-top:2.4pt solid %(ink)s;border-bottom:1pt solid %(ink)s;margin:0 0 12pt}
.edbody{font-size:24pt;line-height:1.36;margin:0}
.edbody::first-letter{font-family:Bangers,sans-serif;font-size:86pt;float:left;line-height:.78;padding:5pt 7pt 0 0;color:%(red)s}
.sig{font-family:'Bebas Neue',sans-serif;letter-spacing:2pt;font-size:16pt;text-align:right;margin-top:12pt;color:%(ink)s}
.sig:before{content:'';display:inline-block;width:46pt;border-top:1.6pt solid %(ink)s;vertical-align:middle;margin-right:8pt}
.artpanel{border:2.4pt solid %(ink)s;box-shadow:3pt 3pt 0 rgba(23,24,18,.85);overflow:hidden;background:#1d2620}
.pq{font-family:Bangers,sans-serif;color:#fff2cf;font-size:30pt;line-height:1.02;letter-spacing:.8pt;text-shadow:2pt 2pt 0 rgba(0,0,0,.55)}
.pq em{font-style:normal;color:%(mustard)s}
.ed .bd{font-size:13pt;line-height:1.36}
.ed .by{font-family:'Bebas Neue',sans-serif;letter-spacing:1.4pt;font-size:11.5pt;color:%(green)s;margin:0 0 5pt}
.ed .hl{font-family:'PT Sans Narrow',sans-serif;font-weight:bold;font-size:17pt;line-height:1.05;margin:0 0 5pt;color:%(ink)s}
.ltrs{column-count:2;column-gap:14pt;column-rule:.8pt solid rgba(23,24,18,.5);font-size:10.8pt;line-height:1.3}
.ltr{break-inside:avoid;margin:0 0 9pt}
.ltr b{font-family:'PT Sans Narrow',sans-serif;font-size:11.4pt;letter-spacing:.2pt;display:block}
.ltr i{display:block;text-align:right;font-size:9.6pt}
.ballot .q{font-family:'PT Sans Narrow',sans-serif;font-weight:bold;font-size:19pt;line-height:1.1;margin:4pt 0 12pt}
.ballot .opt{display:flex;align-items:center;gap:9pt;font-family:'Bebas Neue',sans-serif;font-size:18pt;letter-spacing:1.2pt;margin:0 0 9pt}
.ballot .sq{width:15pt;height:15pt;border:2pt solid %(ink)s;background:#fffaf0;flex:none}
.ballot .wl{flex:1;border-bottom:1.2pt solid %(ink)s;height:13pt}
.ballot .fine{font-style:italic;font-size:9.4pt;line-height:1.25;margin:9pt 0 0;border-top:1pt dashed rgba(23,24,18,.6);padding-top:6pt}
.cut{border:2pt dashed %(ink)s !important}
"""


def fog_scene(w: int, h: int) -> str:
    """Placeholder editorial illustration: a lit lantern and bell on a bracket in harbor fog (vector, generic objects)."""
    bands = "".join(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#e9d9ab" opacity="{o}"/>'
                    for cx, cy, rx, ry, o in [(40, 300, 190, 38, .10), (230, 340, 210, 44, .12), (120, 400, 240, 50, .16),
                                              (260, 250, 150, 26, .07), (60, 200, 160, 22, .06), (150, 455, 260, 40, .2)])
    posts = "".join(f'<rect x="{x}" y="{y}" width="{bw}" height="{bh}" fill="#0f1511" opacity="{o}"/>'
                    for x, y, bw, bh, o in [(22, 250, 9, 220, .55), (250, 270, 7, 200, .4), (205, 300, 5, 170, .3)])
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}pt" height="{h}pt" viewBox="0 0 {w} {h}">'
            '<defs><radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffe9a0" stop-opacity=".95"/>'
            '<stop offset=".35" stop-color="#d9a441" stop-opacity=".45"/><stop offset="1" stop-color="#d9a441" stop-opacity="0"/></radialGradient>'
            '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a231d"/><stop offset="1" stop-color="#3a4436"/></linearGradient></defs>'
            f'<rect width="{w}" height="{h}" fill="url(#sky)"/>{posts}'
            f'<circle cx="150" cy="300" r="150" fill="url(#glow)"/>'
            # wall bracket and post
            f'<rect x="232" y="196" width="22" height="{h - 196}" fill="#121813" stroke="{INK}" stroke-width="2"/>'
            f'<path d="M232 214 H170 M232 238 L192 214" stroke="{INK}" stroke-width="6" stroke-linecap="round" fill="none"/>'
            f'<path d="M232 214 H170 M232 238 L192 214" stroke="#3b3d42" stroke-width="3" stroke-linecap="round" fill="none"/>'
            f'<path d="M150 214 V236" stroke="{INK}" stroke-width="2.5"/>{bands}'
            # cobbles
            + "".join(f'<path d="M{x} {y} q14 -7 28 0" stroke="#e9d9ab" stroke-opacity=".18" stroke-width="2" fill="none"/>'
                      for y in range(470, h, 16) for x in range(-10 + (y % 32), w, 34))
            + "</svg>")


def page4(data: dict) -> str:
    sel, inv = data["sel"], data["inv"]
    lead = inv[sel["lead_editorial"]]
    sents = P.sentences(lead["body"])
    pq = " ".join(sents[i] for i in sel["pull_quote"]["sentences"])
    cap = " ".join(sents[i] for i in sel["art_caption"]["sentences"])
    words = lead["headline"].upper().split()
    h1, h2 = " ".join(words[:-1]), words[-1]

    body = P.chrome("EDITORIAL & OPINION / PAGE 4", "PORTLAND ABOVE / PORTLAND BELOW", "ISSUE 001")
    body += ("<div class='abs title' style='left:18pt;top:40pt;font-size:64pt'>EDITORIAL &amp; OPINION</div>"
             "<div class='abs sub' style='left:20pt;top:104pt'>THE EDITORIAL BOARD / THE SEAGULLOTINE / LETTERS TO THE EDITOR / READER POLL</div>"
             f"<div class='abs' style='left:640pt;top:42pt;transform:rotate(4deg);border:3.5pt double {RED};color:{RED};padding:1pt 12pt;"
             "font-family:Bangers,sans-serif;font-size:32pt;letter-spacing:2pt;opacity:.9;mix-blend-mode:multiply'>OPINION</div>"
             "<div class='abs rule2' style='top:122pt'></div>")

    # dominant: the lead editorial set large, with an illustrated pull-quote panel beside it
    lead_html = (f"<div class='kick'><span class='tab'>{escape(lead['opinion_label'])}</span>"
                 f"<span>{escape(lead['byline'].upper())}</span></div>"
                 f"<div class='edhead'><span class='l1'>{escape(h1)}</span><span class='l2'>{escape(h2)}</span></div>"
                 f"<div class='edrule'></div><p class='edbody'>{escape(lead['body'])}</p>"
                 f"<div class='sig'>{escape(lead['byline'].upper())}</div>")
    body += f"<div class='abs edlead' style='left:14pt;top:134pt;width:470pt;height:452pt' data-fit='1'>{lead_html}</div>"

    aw, ah = 282, 418
    body += (f"<div class='abs artpanel' style='left:496pt;top:134pt;width:{aw}pt;height:{ah}pt'>{fog_scene(aw, ah)}"
             f"<div class='abs' style='left:126pt;top:224pt'>{pp.lantern(48, 0)}</div>"
             f"<div class='abs' style='left:200pt;top:236pt'>{pp.bell(38, -10)}</div>"
             f"<div class='abs pq' style='left:16pt;top:18pt;width:250pt' data-fit='1'>&ldquo;{escape(sents[0])} <em>{escape(' '.join(sents[1:sel['pull_quote']['sentences'][-1] + 1]))}</em>&rdquo;</div>"
             "</div>")
    assert pq.startswith(sents[0])
    body += (f"<div class='abs cap' style='left:496pt;top:558pt;width:282pt;height:30pt' data-fit='1'>"
             f"<b>{escape(cap)}</b> &mdash; {escape(lead['byline'])}.</div>")

    # secondary: two board editorials and the Seagullotine column
    def ed_box(x, w, item, colour, title, art=""):
        inner = (f"{art}<p class='by'>{escape(item['opinion_label'])} &middot; {escape(item['byline'].upper())}</p>"
                 f"<p class='hl'>{escape(item['headline'])}</p><p style='margin:0'>{escape(item['body'])}</p>")
        return P.box(x, 600, w, 206, colour, title, inner, cls="ed")

    e1, e2 = (inv[i] for i in sel["board_editorials"])
    body += ed_box(14, 250, e1, "green", "FROM THE BOARD", "")
    body += ed_box(272, 250, e2, "green", "FROM THE BOARD", "")
    g = inv[sel["seagullotine"]]
    g_title, g_head = [t.strip() for t in g["headline"].split(":", 1)]
    g_item = dict(g, headline=g_head)
    body += ed_box(530, 248, g_item, "black", g_title.upper(),
                   f"<div style='float:right;margin:-2pt -4pt 2pt 6pt'>{gull_art()}</div>")

    # utility: letters and the reader-poll ballot
    letters = "".join(f"<div class='ltr'><b>{escape(l['headline'])}</b>{escape(l['body'])}<i>&mdash; {escape(l['byline'])}</i></div>"
                      for l in (inv[i] for i in sel["letters"]))
    body += P.box(14, 814, 500, 278, "red", "LETTERS TO THE EDITOR", f"<div class='ltrs'>{letters}</div>", pp.pencil(40, -10))
    poll = inv[sel["poll"]]
    opts = "".join(f"<div class='opt'><span class='sq'></span>{escape(o.upper())}"
                   + ("<span class='wl'></span>" if "write-in" in o else "") + "</div>" for o in poll["options"])
    ballot = (f"<div class='ballot'><p class='q'>{escape(poll['prompt'])}</p>{opts}"
              f"<p class='fine'>{escape(poll['method'])} {escape(poll['disclaimer'])}</p></div>")
    body += P.box(522, 814, 256, 278, "green cut", "READER POLL", ballot, pp.bell(18))

    disc = inv[sel["discovery_from"]]
    body += P.pencil_note(14, 1104, 764, 52, disc["headline"].upper() + ".",
                          f"<span style='display:inline-block;transform:scale(.42);transform-origin:center;margin:-30pt -22pt'>{gull_art()}</span>")
    body += P.footer("THE UNDERGROUND PRESS / ISSUE 001 / EDITORIAL & OPINION / PAGE 4")
    return P.page_html("Issue 001 Editorial & Opinion Page 4", body).replace("</style>", css() + "</style>", 1)


def css() -> str:
    return EXTRA_CSS % {"box": BOX, "ink": INK, "red": RED, "green": GREEN, "mustard": MUSTARD}
