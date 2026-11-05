#!/usr/bin/env python3
"""Issue 001 Pages 2 and 3, rebuilt in the Page One look.

Source of truth for words is each page's COPY.md; nothing is written here except headings that are
verbatim from the copy and a few layout labels. Output (per page): an HTML master with embedded
fonts, a 2x PNG review image, and an 11x17 in PDF proof, plus a fit report (JSON).

    python build_pages_2_3.py            # writes issues/issue_001/production/pages-2-3/
"""
from __future__ import annotations

import base64
import json
import re
from html import escape
from pathlib import Path

import press_props as pp

ROOT = Path(__file__).resolve().parents[2]
FONTS = ROOT / "templates/puzzle-dojo/golden-skin/fonts"
PROD = ROOT / "issues/issue_001/production"
INK, RED, GREEN, PAPER, BOX, MUSTARD = "#171812", "#8c2118", "#1f4d36", "#e9d9ab", "#f2e6c0", "#d9a441"
MOTTO = json.loads((ROOT / "design-system/issue-production-v1/page_contract.json").read_text())["motto"]

FACES = [("Bangers", "Bangers-Regular-latin.woff", "normal", "normal"),
         ("Bebas Neue", "BebasNeue-Regular-latin.woff", "normal", "normal"),
         ("PT Serif", "PTSerif-Regular-latin.woff", "normal", "normal"),
         ("PT Serif", "PTSerif-Bold-latin.woff", "bold", "normal"),
         ("PT Serif", "PTSerif-Italic-latin.woff", "normal", "italic"),
         ("PT Sans Narrow", "PTSansNarrow-Regular-latin.woff", "normal", "normal"),
         ("PT Sans Narrow", "PTSansNarrow-Bold-latin.woff", "bold", "normal")]


def font_css() -> str:
    return "".join(f"@font-face{{font-family:'{n}';font-weight:{w};font-style:{s};src:url(data:font/woff;base64,"
                   f"{base64.b64encode((FONTS / f).read_bytes()).decode()}) format('woff');}}" for n, f, w, s in FACES)


# ---------------------------------------------------------------- copy parsing
def parse_copy(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    title = re.match(r"# (.+)", text).group(1)
    sections: dict[str, list[str]] = {}
    order = []
    cur = None
    for block in re.split(r"\n\s*\n", text):
        block = " ".join(block.split())
        if not block or block.startswith("# "):
            continue
        if block.startswith("## "):
            cur = block[3:].strip(); order.append(cur); sections[cur] = []
        elif cur:
            sections[cur].append(block)
    return {"title": title, "sections": sections, "order": order}


def md_inline(s: str) -> str:
    s = escape(s, quote=False)
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)


def items(paragraphs: list[str]) -> list[tuple[str, str]]:
    out = []
    for p in paragraphs:
        m = re.match(r"\*\*(.+?)\*\*\s*(.*)", p)
        out.append((m.group(1).rstrip("."), m.group(2)) if m else ("", p))
    return out


def sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]


# ---------------------------------------------------------------- page chrome
CSS = """
@page{size:792pt 1224pt;margin:0}
*{box-sizing:border-box}
html,body{margin:0;background:#3a3a3a}
.page{position:relative;width:792pt;height:1224pt;background:%(paper)s;overflow:hidden;font-family:'PT Serif',Georgia,serif;color:%(ink)s}
.grain{position:absolute;inset:0;pointer-events:none;mix-blend-mode:multiply;opacity:.5;
 background-image:url("data:image/svg+xml;utf8,%(grain)s");}
.vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50%% 45%%,rgba(0,0,0,0) 55%%,rgba(90,60,20,.28) 100%%)}
.abs{position:absolute}
.strip{left:14pt;top:10pt;width:764pt;height:23pt;background:%(red)s;color:#fff8df;font-family:'Bebas Neue',sans-serif;font-size:13.5pt;letter-spacing:1.2pt;display:flex;align-items:center;justify-content:space-between;padding:0 10pt;border:1.6pt solid %(ink)s}
.title{font-family:Bangers,Impact,sans-serif;color:%(ink)s;line-height:.9;letter-spacing:.8pt;text-shadow:2.4pt 2.4pt 0 %(mustard)s}
.sub{font-family:'Bebas Neue',sans-serif;letter-spacing:1.6pt;color:%(green)s;font-size:11pt}
.rule2{left:14pt;width:764pt;height:5pt;border-top:2.4pt solid %(ink)s;border-bottom:1pt solid %(ink)s}
.lead{font-family:Bangers,Impact,sans-serif;line-height:.95;letter-spacing:.6pt}
.lead .l1{color:%(ink)s;display:block}.lead .l2{color:%(red)s;display:block;text-shadow:1.6pt 1.6pt 0 rgba(23,24,18,.85)}
.dek{font-family:'PT Serif',serif;font-weight:bold;font-style:italic;font-size:11.4pt;line-height:1.28}
.cols{column-count:3;column-gap:13pt;column-rule:.8pt solid rgba(23,24,18,.55);font-size:10.1pt;line-height:1.3;text-align:justify;hyphens:auto}
.cols p{margin:0 0 6.5pt;text-indent:0}
.cols p:first-child::first-letter{font-family:Bangers,sans-serif;font-size:35pt;float:left;line-height:.8;padding:2pt 3pt 0 0;color:%(red)s}
.box{background:%(box)s;border:2pt solid %(ink)s;box-shadow:inset 0 0 0 1.4pt %(box)s,inset 0 0 0 2.2pt rgba(23,24,18,.55);overflow:hidden}
.box h3{margin:0;font-family:Bangers,sans-serif;font-weight:normal;font-size:15pt;letter-spacing:1pt;color:#fff8df;padding:3pt 8pt 2pt;display:flex;justify-content:space-between;align-items:center}
.box .bd{padding:6pt 9pt 5pt;font-size:10pt;line-height:1.3}
.box .it{margin:0 0 6pt}.box .it b{font-family:'PT Sans Narrow',sans-serif;letter-spacing:.3pt;font-size:10.4pt}
.big .bd{font-size:12.4pt;line-height:1.34}.big .it b{font-size:13pt}.big .it{margin:0 0 9pt}
.red h3{background:%(red)s}.green h3{background:%(green)s}.black h3{background:%(ink)s}
.cap{font-family:'PT Serif',serif;font-style:italic;font-size:9pt;line-height:1.25}
.motto{left:14pt;top:1171pt;width:764pt;height:34pt;background:%(red)s;border:1.6pt solid %(ink)s;color:#fff8df;font-family:Bangers,sans-serif;font-size:19pt;letter-spacing:1.4pt;display:flex;align-items:center;justify-content:center}
.folio{left:14pt;top:1208pt;width:764pt;text-align:center;font-family:'Bebas Neue',sans-serif;letter-spacing:1.6pt;font-size:9pt}
.note{background:%(mustard)s;border:2pt solid %(ink)s;box-shadow:2.4pt 2.4pt 0 rgba(23,24,18,.8);display:flex;align-items:center;justify-content:center;gap:10pt;font-family:Bangers,sans-serif;font-size:21pt;letter-spacing:1pt;color:%(ink)s}
.artwrap{border:2.4pt solid %(ink)s;box-shadow:3pt 3pt 0 rgba(23,24,18,.85);background:%(ink)s;overflow:hidden}
.artwrap img{display:block;width:100%%;height:100%%;object-fit:cover}
.badge{display:flex;align-items:center;gap:5pt;border:2pt solid %(ink)s;background:%(box)s;padding:3pt 9pt 3pt 6pt;font-family:'Bebas Neue',sans-serif;font-size:14pt;letter-spacing:1pt;color:%(red)s;box-shadow:2pt 2pt 0 rgba(23,24,18,.8)}
"""


def grain_uri() -> str:
    svg = ("<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><filter id='n'><feTurbulence type='fractalNoise' "
           "baseFrequency='.85' numOctaves='3' seed='4'/><feColorMatrix values='0 0 0 0 .42 0 0 0 0 .3 0 0 0 0 .14 0 0 0 .9 0'/></filter>"
           "<rect width='400' height='400' filter='url(%23n)'/></svg>")
    return svg.replace('"', "'").replace("<", "%3C").replace(">", "%3E").replace("#", "%23") if False else svg.replace("<", "%3C").replace(">", "%3E")


def page_html(title: str, body: str) -> str:
    css = CSS % {"paper": PAPER, "ink": INK, "red": RED, "green": GREEN, "box": BOX, "mustard": MUSTARD, "grain": grain_uri()}
    return (f"<!doctype html><html lang='en'><head><meta charset='utf-8'><title>{escape(title)}</title>"
            f"<style>{font_css()}{css}</style></head><body><div class='page' id='page'>{body}"
            f"<div class='grain'></div><div class='vig'></div></div></body></html>")


def box(x, y, w, h, colour, title, inner, icon="", cls=""):
    return (f"<div class='abs box {colour} {cls}' style='left:{x}pt;top:{y}pt;width:{w}pt;height:{h}pt' data-fit='1'>"
            f"<h3><span>{escape(title)}</span>{icon}</h3><div class='bd'>{inner}</div></div>")


def item_html(its, with_titles=True) -> str:
    return "".join(f"<p class='it'>{('<b>' + escape(t) + '.</b> ') if (t and with_titles) else ''}{md_inline(x)}</p>" for t, x in its)


def chrome(left, centre, right):
    return (f"<div class='abs strip'><span>{escape(left)}</span><span>{escape(centre)}</span><span>{escape(right)}</span></div>")


def footer(folio):
    return (f"<div class='abs motto'>{escape(MOTTO)}</div><div class='abs folio'>{escape(folio)}</div>")


def pencil_note(x, y, w, h, text, extra=""):
    return (f"<div class='abs note' style='left:{x}pt;top:{y}pt;width:{w}pt;height:{h}pt;transform:rotate(-1.2deg)' data-fit='1'>"
            f"{pp.pencil(54, -18)}<span>{escape(text)}</span>{extra}</div>")


# ---------------------------------------------------------------- Page 2
def page2(copy: dict) -> str:
    s = copy["sections"]
    lead_key = copy["order"][0]
    paras = s[lead_key]
    dek, story = paras[0].strip("*"), paras[1:]
    weather_k = next(k for k in copy["order"] if k.startswith("WEATHER"))
    wk_title, wk_cond = [t.strip() for t in weather_k.split("—", 1)]
    transit = items(s["TRANSIT WATCH"]); calendar = items(s["COMMUNITY CALENDAR"]); notes = items(s["NEIGHBORHOOD NOTES"])
    disc = re.search(r"\*\*(.+?)\*\*", s["DISCOVERY"][0]).group(1)
    l1, l2 = [t.strip() for t in lead_key.split(",")] if "," in lead_key else (lead_key, "")
    parts = [lead_key[:lead_key.index(" MOVES")] + " MOVES IN,"] if False else []
    head1, head2 = "WHEN THE FOG MOVES IN,", "THE BLOCK LISTENS"
    assert lead_key == head1 + " " + head2, "headline must match COPY.md"
    badges = (f"<div class='abs' style='left:470pt;top:44pt;display:flex;gap:9pt'>"
              f"<div class='badge'>{pp.cloud(30, False)}FOG</div><div class='badge'>{pp.cloud(30, True)}LIGHT DRIZZLE</div></div>")
    body = chrome("CITY BEAT / PAGE 2", "PORTLAND ABOVE / PORTLAND BELOW", "ISSUE 001")
    body += ("<div class='abs title' style='left:18pt;top:40pt;font-size:66pt'>CITY BEAT</div>"
             "<div class='abs sub' style='left:20pt;top:104pt'>PORTLAND ABOVE / PORTLAND BELOW / REPORTED BY THE NEIGHBORHOOD</div>" + badges
             + "<div class='abs rule2' style='top:122pt'></div>")
    body += (f"<div class='abs lead' style='left:14pt;top:132pt;width:764pt;height:98pt;font-size:45pt' data-fit='1'><span class='l1'>{escape(head1)}</span><span class='l2'>{escape(head2)}</span></div>")
    body += f"<div class='abs dek' style='left:14pt;top:232pt;width:764pt;height:36pt' data-fit='1'>{md_inline(dek)}</div>"
    body += "<div class='abs' style='left:540pt;top:150pt;display:flex;gap:22pt;align-items:flex-end'>" + pp.lantern(52, -6) + pp.bell(46, 8) + pp.cloud(80, True) + "</div>"
    # art + rail
    body += (f"<div class='abs artwrap' style='left:14pt;top:278pt;width:468pt;height:296pt'><img src='../../assets/art-style-studies/city-beat-fog-lead-study-v1.png' "
             "style='object-position:50% 46%;transform:scale(1.07)'></div>")
    body += (f"<div class='abs cap' style='left:14pt;top:580pt;width:468pt;height:26pt' data-fit='1'>"
             f"{pp.bell(18)}</div>") if False else ""
    quote = "Fog carries sound. It does not carry certainty."
    body += f"<div class='abs cap' style='left:14pt;top:580pt;width:468pt;height:20pt' data-fit='1'><b>&ldquo;{escape(quote)}&rdquo;</b> &mdash; from the lead report.</div>"
    body += box(494, 278, 284, 130, "green", "WEATHER DESK", f"<p class='it'><b>{escape(wk_cond)}.</b> {md_inline(s[weather_k][0])}</p>", pp.cloud(26))
    body += box(494, 416, 284, 200, "red", "TRANSIT WATCH", item_html(transit), pp.bell(18))
    body += f"<div class='abs cols' style='left:14pt;top:622pt;width:764pt;height:232pt' data-fit='1'>{''.join('<p>' + md_inline(p) + '</p>' for p in story)}</div>"
    # lower boxes
    body += box(14, 858, 378, 232, "red", "COMMUNITY CALENDAR", item_html(calendar), pp.lantern(20))
    body += box(400, 858, 378, 232, "green", "NEIGHBORHOOD NOTES", item_html(notes), pp.crate(26))
    body += pencil_note(14, 1104, 764, 52, disc, pp.lantern(30, 8))
    body += footer("THE UNDERGROUND PRESS / ISSUE 001 / CITY BEAT / PAGE 2")
    return page_html("Issue 001 City Beat Page 2", body)


# ---------------------------------------------------------------- Page 3
def page3(copy: dict) -> str:
    s = copy["sections"]
    lead_key = copy["order"][0]
    paras = s[lead_key]
    dek, story = paras[0].strip("*"), paras[1:]
    ledger = items(s["INCIDENT LEDGER"])
    know = " ".join(s["WHAT WE KNOW / WHAT WE DO NOT"])
    conf = [x.strip().rstrip(".") for x in re.search(r"Confirmed[^:]*:\s*(.+?)\s+Unconfirmed", know).group(1).split(";")]
    unconf = [x.strip().rstrip(".") for x in re.search(r"Unconfirmed:\s*(.+)", know).group(1).split(";")]
    watch = sentences(s["WATCH DESK"][0])
    disc = re.search(r"\*\*(.+?)\*\*", s["DISCOVERY"][0]).group(1)
    head1, head2 = "THREE CORRIDORS,", "NO SINGLE STORY"
    assert lead_key == head1 + " " + head2, "headline must match COPY.md"
    badges = ("<div class='abs' style='left:462pt;top:44pt;display:flex;gap:7pt'>"
              + "".join(f"<div class='badge' style='font-size:12.5pt;padding:3pt 8pt'>{t}</div>" for t in ("REPORTED", "DISPUTED", "FOUND ITEM")) + "</div>")
    body = chrome("CRIME & NEIGHBORHOOD WATCH / PAGE 3", "PORTLAND ABOVE / PORTLAND BELOW", "ISSUE 001")
    body += ("<div class='abs title' style='left:18pt;top:40pt;font-size:50pt;line-height:.82'>CRIME &amp;<br>NEIGHBORHOOD WATCH</div>"
             "<div class='abs rule2' style='top:122pt'></div>" + badges
             + "<div class='abs sub' style='left:462pt;top:80pt;width:316pt;line-height:1.35'>THE DESK COMPARED THE ACCOUNTS WITHOUT TURNING RESEMBLANCE INTO CERTAINTY</div>")
    body += (f"<div class='abs lead' style='left:14pt;top:132pt;width:764pt;height:98pt;font-size:45pt' data-fit='1'><span class='l1'>{escape(head1)}</span><span class='l2'>{escape(head2)}</span></div>")
    body += "<div class='abs' style='left:470pt;top:150pt;transform:rotate(-7deg);border:3.5pt double #8c2118;color:#8c2118;padding:2pt 12pt;font-family:Bangers,sans-serif;font-size:34pt;letter-spacing:2pt;opacity:.88;mix-blend-mode:multiply'>UNCONFIRMED</div>"
    body += f"<div class='abs' style='left:640pt;top:176pt'>{pp.shadow_figures(0, 0, 4, 1.1)}</div>"
    body += f"<div class='abs dek' style='left:14pt;top:232pt;width:764pt;height:36pt' data-fit='1'>{md_inline(dek)}</div>"
    body += f"<div class='abs' style='left:14pt;top:278pt;width:470pt;height:300pt'>{pp.evidence_board(470, 300)}</div>"
    body += box(494, 278, 284, 320, "red", "INCIDENT LEDGER", item_html(ledger), pp.lantern(22), cls="big")
    body += f"<div class='abs cols' style='left:14pt;top:622pt;width:764pt;height:232pt' data-fit='1'>{''.join('<p>' + md_inline(p) + '</p>' for p in story)}</div>"
    kn = ("<div style='display:flex;gap:10pt'><div style='flex:1'><p class='it'><b style='color:#1f4d36'>CONFIRMED</b></p>"
          + "".join(f"<p class='it'>&#10003; {escape(x[0].upper() + x[1:])}.</p>" for x in conf)
          + "</div><div style='flex:1'><p class='it'><b style='color:#8c2118'>UNCONFIRMED</b></p>"
          + "".join(f"<p class='it'>? {escape(x[0].upper() + x[1:])}.</p>" for x in unconf) + "</div></div>")
    body += box(14, 858, 400, 232, "green", "WHAT WE KNOW / WHAT WE DO NOT", kn, cls="big")
    body += box(422, 858, 356, 232, "black", "WATCH DESK", "".join(f"<p class='it'>&#9656; {escape(x)}</p>" for x in watch), pp.lantern(20), cls="big")
    body += pencil_note(14, 1104, 764, 52, disc, pp.crate(30))
    body += footer("THE UNDERGROUND PRESS / ISSUE 001 / CRIME & NEIGHBORHOOD WATCH / PAGE 3")
    return page_html("Issue 001 Crime & Neighborhood Watch Page 3", body)


# ---------------------------------------------------------------- render + fit check
def render(html_path: Path, png: Path, pdf: Path) -> dict:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1056, "height": 1632}, device_scale_factor=2)
        pg.goto(html_path.as_uri()); pg.wait_for_timeout(700)
        report = pg.evaluate("""() => [...document.querySelectorAll('[data-fit]')].map(e => {
            const r = e.getBoundingClientRect(); return {cls: e.className.slice(0,40), text: (e.textContent||'').slice(0,28),
              overflow_px: Math.max(e.scrollHeight - e.clientHeight, 0), widthOverflow_px: Math.max(e.scrollWidth - e.clientWidth, 0),
              fill: e.querySelector('.bd') ? (e.querySelector('.bd').scrollHeight + e.querySelector('h3').offsetHeight) / e.clientHeight : null}});""")
        pg.screenshot(path=str(png), clip={"x": 0, "y": 0, "width": 1056, "height": 1632})
        pg.pdf(path=str(pdf), width="11in", height="17in", print_background=True, page_ranges="1")
        b.close()
    return {"fit": report}
