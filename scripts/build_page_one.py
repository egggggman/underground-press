#!/usr/bin/env python3
"""Build the Issue 001 Page One editable SVG master and print proof PDF."""

from __future__ import annotations

import argparse
import html
import textwrap
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
PHOTO = ROOT / "issues/issue_001/assets/page-one/art/waterfront-night-watch.png"
MASTER = ROOT / "issues/issue_001/production/page-one/issue_001_page_one.svg"
PROOF = ROOT / "output/pdf/issue_001_page_one_proof.pdf"
W, H = 792, 1224
PAPER, INK, RED, GREEN, MUSTARD = "#eadcae", "#17150f", "#8c241c", "#16452f", "#d39e2b"


def esc(value: str) -> str:
    return html.escape(value, quote=True)


def svg_text(x, y, text, size, family="Georgia,serif", weight="normal", fill=INK, anchor="start", rotate=0):
    transform = f' transform="rotate({rotate} {x} {y})"' if rotate else ""
    return f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}"{transform}>{esc(text)}</text>'


def svg_lines(x, y, width, text, size=10, leading=12, family="Georgia,serif", weight="normal", fill=INK):
    chars = max(12, int(width / (size * .54)))
    return "".join(svg_text(x, y + i * leading, line, size, family, weight, fill) for i, line in enumerate(textwrap.wrap(text, chars)))


def build_svg() -> None:
    parts = [f'''<svg xmlns="http://www.w3.org/2000/svg" width="11in" height="17in" viewBox="0 0 {W} {H}" role="img" aria-labelledby="title desc">
<title id="title">The Underground Press Issue 001 Page One</title>
<desc id="desc">Complete production proof for the Portland crime increase lead story.</desc>
<defs><filter id="paper"><feTurbulence baseFrequency=".52" numOctaves="3" seed="11" type="fractalNoise" result="n"/><feBlend in="SourceGraphic" in2="n" mode="multiply"/></filter><filter id="photo"><feColorMatrix type="saturate" values=".52"/><feComponentTransfer><feFuncR type="gamma" amplitude="1.05" exponent=".94" offset="0"/></feComponentTransfer></filter></defs>
<rect width="792" height="1224" fill="{PAPER}"/><rect width="792" height="1224" fill="#8b7441" opacity=".08" filter="url(#paper)"/>
<rect x="14" y="10" width="764" height="27" fill="{RED}"/>
''']
    parts += [svg_text(25,31,"FIRST EDITION!",17,"Impact,'Arial Narrow',sans-serif","bold","#fff8df"), svg_text(396,31,"PORTLAND'S MOST INDEPENDENT NEWSPAPER",16,"Impact,'Arial Narrow',sans-serif","bold","#fff8df","middle"), svg_text(765,31,"50¢",20,"Impact,'Arial Narrow',sans-serif","bold","#fff8df","end")]
    parts += [svg_text(24,112,"The",39,"Georgia,serif","bold"), svg_text(102,126,"UNDERGROUND PRESS",68,"Impact,'Arial Narrow',sans-serif","bold"), svg_text(396,153,"WE'RE ALL LOOKING FOR A PLACE TO LAND.",13,"Arial,sans-serif","bold",INK,"middle")]
    parts += [f'<line x1="14" y1="166" x2="778" y2="166" stroke="{INK}" stroke-width="3"/>', svg_text(18,181,"VOL. 1, NO. 1",10,"Arial,sans-serif","bold"), svg_text(396,181,"PUBLISHED BY NOBODY / CONTRIBUTORS EVERYBODY / APPROVED BY MYRTLE",9,"Arial,sans-serif","bold",INK,"middle"), svg_text(774,181,"FIRST EDITION",10,"Arial,sans-serif","bold",INK,"end")]
    # utility strip
    utilities=[(14,190,150,"HARBOR WEATHER","FOG / LIGHT RAIN","LOW VISIBILITY BELOW"),(170,190,240,"NEIGHBORHOOD WATCH","3 REPORTS OVERNIGHT","VERIFY BEFORE REPEATING"),(416,190,184,"PRESS STATUS","FIRST RUN","MIND THE WET INK")]
    for x,y,w,title,big,small in utilities:
        parts += [f'<rect x="{x}" y="{y}" width="{w}" height="88" fill="none" stroke="{INK}" stroke-width="1.5"/>',f'<rect x="{x}" y="{y}" width="{w}" height="24" fill="{INK}"/>',svg_text(x+8,y+17,title,12,"Impact,'Arial Narrow',sans-serif","bold","#fff8df"),svg_text(x+w/2,y+55,big,16,"Impact,'Arial Narrow',sans-serif","bold",RED,"middle"),svg_text(x+w/2,y+75,small,8,"Arial,sans-serif","bold",INK,"middle")]
    parts += [f'<rect x="608" y="190" width="170" height="176" fill="none" stroke="{INK}" stroke-width="2" stroke-dasharray="5 3"/>', svg_text(693,213,"THE CRUST BUCKET",14,"Impact,'Arial Narrow',sans-serif","bold",GREEN,"middle"), svg_text(693,239,"MIDNIGHT SLICE",20,"Impact,'Arial Narrow',sans-serif","bold",RED,"middle"), svg_text(693,260,"CLIP THIS BOX",10,"Arial,sans-serif","bold",INK,"middle"), svg_text(693,288,"2 SLICES + SODA",13,"Georgia,serif","bold",INK,"middle"), svg_text(693,309,"ROTATING ISSUE OFFER",9,"Arial,sans-serif","bold",INK,"middle"), svg_text(693,340,"PORTLAND BENEATH PORTLAND",8,"Arial,sans-serif","bold",GREEN,"middle")]
    # lead package
    parts += [svg_text(16,334,"CRIME CLIMBS AS",50,"Impact,'Arial Narrow',sans-serif","bold"), svg_text(16,385,"BLACK-CLAD CREWS MOVE BELOW",42,"Impact,'Arial Narrow',sans-serif","bold"), svg_text(18,411,"Neighbors describe coordinated movement. The 'Foot Clan' name remains rumor, not newsroom-confirmed fact.",15,"Georgia,serif","bold")]
    parts += [f'<image x="165" y="430" width="438" height="343" preserveAspectRatio="xMidYMid slice" href="../../assets/page-one/art/waterfront-night-watch.png" filter="url(#photo)"/>', f'<rect x="165" y="430" width="438" height="343" fill="none" stroke="{INK}" stroke-width="2"/>']
    lead1="Calls logged across three below-street corridors have risen over the last two publication cycles, with residents describing thefts, damaged locks, and coordinated black-clad movement after midnight. No public source has identified a single group behind the incidents."
    lead2="Several neighbors used the name 'Foot Clan.' The Underground Press has not confirmed that claim. What is confirmed: shopkeepers are closing in pairs, delivery routes are changing, and ordinary errands now take a little more planning."
    parts += [svg_text(16,439,"THE LOCAL ANGLE",12,"Impact,'Arial Narrow',sans-serif","bold",RED), svg_lines(16,457,137,lead1,9,11), svg_lines(16,610,137,lead2,9,11), svg_text(16,752,"CONTINUED, PAGE 3",8,"Arial,sans-serif","bold",GREEN)]
    parts += [svg_text(169,786,"Residents watch three unidentified figures near a waterfront service entrance after midnight.",8,"Arial,sans-serif","bold"), svg_text(600,798,"READER PHOTO / NAME WITHHELD",7,"Arial,sans-serif","bold",INK,"end")]
    # right rail secondary
    parts += [f'<line x1="615" y1="382" x2="615" y2="796" stroke="{INK}" stroke-width="2"/>', svg_text(627,407,"PIZZA SALES",25,"Impact,'Arial Narrow',sans-serif","bold"), svg_text(627,435,"SPIKE AFTER",25,"Impact,'Arial Narrow',sans-serif","bold"), svg_text(627,463,"MIDNIGHT",25,"Impact,'Arial Narrow',sans-serif","bold",RED), svg_text(628,484,"Late orders track the same corridors",10,"Georgia,serif","bold")]
    pizza="The Crust Bucket reports an unusual run of large late-night orders, paid in folded bills and collected without names. The shop calls it good business, not evidence. Delivery riders say the orders cluster near the same service passages named in neighborhood reports."
    parts += [svg_lines(628,505,140,pizza,9,11), f'<rect x="628" y="640" width="137" height="70" fill="{MUSTARD}" opacity=".72" stroke="{INK}"/>', svg_text(697,660,"OVERHEARD BY ALICE",10,"Impact,'Arial Narrow',sans-serif","bold",INK,"middle"), svg_lines(637,677,120,"'Twelve pies. No onions. Nobody wanted a receipt.' Alice heard the order; she did not see who carried it.",8,10), svg_text(764,748,"SEE SALES, PAGE 2",8,"Arial,sans-serif","bold",GREEN,"end")]
    # lower modules
    parts += [f'<line x1="14" y1="812" x2="778" y2="812" stroke="{INK}" stroke-width="4"/>']
    modules=[(14,824,230,176,"NEWS BRIEFS",RED),(252,824,250,176,"WHAT NEIGHBORS CAN DO",GREEN),(510,824,268,176,"COMMUNITY CALENDAR",RED)]
    for x,y,w,h,title,color in modules:
        parts += [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="none" stroke="{INK}" stroke-width="1.5"/>',f'<rect x="{x}" y="{y}" width="{w}" height="25" fill="{color}"/>',svg_text(x+10,y+18,title,14,"Impact,'Arial Narrow',sans-serif","bold","#fff8df")]
    parts += [svg_lines(24,865,208,"LOCK CHECKS OFFERED - Volunteer repair crews will inspect shop latches. Page 2\n\nFERRY CART DELAYED - Fog slows the east delivery run. Page 2\n\nMISSING CRATE RETURNED - Contents intact; note unsigned. Page 4",9,12), svg_lines(265,866,224,"Travel in pairs after late shifts. Record times and locations, not guesses. Report damaged locks. Do not follow unidentified groups into restricted corridors. Rumor is not a substitute for a witness.",10,14), svg_text(376,978,"KEEP NOTES. KEEP EACH OTHER CLOSE.",9,"Arial,sans-serif","bold",RED,"middle"), svg_lines(523,865,242,"SAT - LOCK & LANTERN CHECK, community room, 2 PM\n\nSUN - PAPERBACK SWAP, green-lamp corner, noon\n\nTUE - NIGHT ROUTE LISTENING SESSION, press drop, 7 PM\n\nTHU - CRIBBAGE & COFFEE, Great Lost Bear, 6 PM",9,13)]
    # footer
    parts += [f'<rect x="14" y="1010" width="190" height="151" fill="{INK}"/>', svg_text(28,1042,"INSIDE",28,"Impact,'Arial Narrow',sans-serif","bold","#fff8df"), svg_text(28,1073,"THIS ISSUE",28,"Impact,'Arial Narrow',sans-serif","bold","#fff8df"), svg_text(218,1032,"City Beat ................................ 2",10,"Georgia,serif","bold"),svg_text(218,1050,"Crime & Neighborhood Watch ............. 3",10,"Georgia,serif","bold"),svg_text(218,1068,"Editorial ............................... 4",10,"Georgia,serif","bold"),svg_text(218,1086,"Community / Classifieds ................. 7",10,"Georgia,serif","bold"),svg_text(218,1104,"Puzzle Dojo ........................... 8-9",10,"Georgia,serif","bold")]
    parts += [f'<rect x="510" y="1010" width="268" height="151" fill="{GREEN}" stroke="{INK}" stroke-width="2"/>', svg_text(644,1038,"THE CRUST BUCKET",25,"Impact,'Arial Narrow',sans-serif","bold","#fff8df","middle"), svg_text(644,1070,"HOT PIE. FAIR DEAL.",17,"Georgia,serif","bold","#fff8df","middle"), svg_text(644,1100,"BRING THIS PAGE FOR THE",10,"Arial,sans-serif","bold","#fff8df","middle"), svg_text(644,1124,"ISSUE 001 COUNTER SPECIAL",14,"Impact,'Arial Narrow',sans-serif","bold",MUSTARD,"middle"), svg_text(644,1147,"Offer terms posted at the counter.",8,"Arial,sans-serif","normal","#fff8df","middle")]
    parts += [f'<rect x="14" y="1171" width="764" height="35" fill="{RED}"/>', svg_text(396,1195,"NEXT ISSUE: WHO KEEPS LEAVING THE HARBOR LIGHT ON?",15,"Impact,'Arial Narrow',sans-serif","bold","#fff8df","middle"), svg_text(396,1218,"© THE UNDERGROUND PRESS  •  PORTLAND BENEATH PORTLAND  •  PASS IT ON",8,"Arial,sans-serif","bold",INK,"middle"), "</svg>"]
    MASTER.parent.mkdir(parents=True, exist_ok=True)
    MASTER.write_text("".join(parts), encoding="utf-8")


def pdf_text(c, x, top, text, size, font="Helvetica", color=INK):
    c.setFillColor(HexColor(color)); c.setFont(font, size); c.drawString(x, H-top, text)


def build_pdf() -> None:
    PROOF.parent.mkdir(parents=True, exist_ok=True)
    c=canvas.Canvas(str(PROOF), pagesize=(W,H), pageCompression=1)
    c.setFillColor(HexColor(PAPER)); c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColor(HexColor(RED)); c.rect(14,H-37,764,27,fill=1,stroke=0)
    pdf_text(c,24,31,"FIRST EDITION!",16,"Helvetica-Bold","#fff8df"); pdf_text(c,280,31,"PORTLAND'S MOST INDEPENDENT NEWSPAPER",14,"Helvetica-Bold","#fff8df"); pdf_text(c,730,31,"50c",17,"Helvetica-Bold","#fff8df")
    pdf_text(c,24,105,"The",31,"Times-Bold"); pdf_text(c,102,122,"UNDERGROUND PRESS",55,"Helvetica-Bold"); pdf_text(c,255,151,"WE'RE ALL LOOKING FOR A PLACE TO LAND.",12,"Helvetica-Bold")
    c.setStrokeColor(HexColor(INK)); c.setLineWidth(3); c.line(14,H-166,778,H-166)
    pdf_text(c,18,181,"VOL. 1, NO. 1",9,"Helvetica-Bold"); pdf_text(c,222,181,"PUBLISHED BY NOBODY / CONTRIBUTORS EVERYBODY / APPROVED BY MYRTLE",8,"Helvetica-Bold")
    for x,w,title,big in [(14,150,"HARBOR WEATHER","FOG / LIGHT RAIN"),(170,240,"NEIGHBORHOOD WATCH","3 REPORTS OVERNIGHT"),(416,184,"PRESS STATUS","FIRST RUN")]:
        c.rect(x,H-278,w,88,fill=0,stroke=1); c.setFillColor(HexColor(INK)); c.rect(x,H-214,w,24,fill=1,stroke=0); pdf_text(c,x+8,207,title,11,"Helvetica-Bold","#fff8df"); pdf_text(c,x+12,247,big,13,"Helvetica-Bold",RED)
    c.rect(608,H-366,170,176,fill=0,stroke=1); pdf_text(c,625,215,"THE CRUST BUCKET",12,"Helvetica-Bold",GREEN); pdf_text(c,626,243,"MIDNIGHT SLICE",17,"Helvetica-Bold",RED); pdf_text(c,635,286,"2 SLICES + SODA",11,"Times-Bold")
    pdf_text(c,16,334,"CRIME CLIMBS AS",44,"Helvetica-Bold"); pdf_text(c,16,383,"BLACK-CLAD CREWS MOVE BELOW",29,"Helvetica-Bold"); pdf_text(c,18,409,"Neighbors describe coordinated movement. The 'Foot Clan' name remains rumor, not confirmed fact.",12,"Times-Bold")
    c.drawImage(ImageReader(str(PHOTO)),165,H-773,width=438,height=343,preserveAspectRatio=True,anchor='c',mask='auto')
    def para(x,top,w,text,size=8.5,leading=10.5,font="Times-Roman"):
        for i,line in enumerate(textwrap.wrap(text,max(12,int(w/(size*.52))))): pdf_text(c,x,top+i*leading,line,size,font)
    para(16,457,137,"Calls logged across three below-street corridors have risen over the last two publication cycles, with residents describing thefts, damaged locks, and coordinated black-clad movement after midnight. No public source has identified a single group behind the incidents.")
    para(16,610,137,"Several neighbors used the name 'Foot Clan.' The Underground Press has not confirmed that claim. What is confirmed: shopkeepers are closing in pairs, delivery routes are changing, and ordinary errands now take more planning.")
    c.line(615,H-382,615,H-796); pdf_text(c,627,407,"PIZZA SALES",22,"Helvetica-Bold"); pdf_text(c,627,433,"SPIKE AFTER",22,"Helvetica-Bold"); pdf_text(c,627,459,"MIDNIGHT",22,"Helvetica-Bold",RED); para(628,488,140,"The Crust Bucket reports an unusual run of large late-night orders, paid in folded bills and collected without names. The shop calls it good business, not evidence. Delivery riders say the orders cluster near the same service passages named in neighborhood reports.")
    c.setFillColor(HexColor(MUSTARD)); c.rect(628,H-710,137,70,fill=1,stroke=1); pdf_text(c,640,661,"OVERHEARD BY ALICE",9,"Helvetica-Bold"); para(637,679,120,"'Twelve pies. No onions. Nobody wanted a receipt.' Alice heard the order; she did not see who carried it.",7.5,9)
    c.setLineWidth(4); c.line(14,H-812,778,H-812)
    for x,w,title,color in [(14,230,"NEWS BRIEFS",RED),(252,250,"WHAT NEIGHBORS CAN DO",GREEN),(510,268,"COMMUNITY CALENDAR",RED)]:
        c.rect(x,H-1000,w,176,fill=0,stroke=1); c.setFillColor(HexColor(color)); c.rect(x,H-849,w,25,fill=1,stroke=0); pdf_text(c,x+10,842,title,12,"Helvetica-Bold","#fff8df")
    para(24,865,208,"LOCK CHECKS OFFERED - Volunteer repair crews will inspect shop latches. Page 2. FERRY CART DELAYED - Fog slows the east delivery run. Page 2. MISSING CRATE RETURNED - Contents intact; note unsigned. Page 4.",8.5,11)
    para(265,865,224,"Travel in pairs after late shifts. Record times and locations, not guesses. Report damaged locks. Do not follow unidentified groups into restricted corridors. Rumor is not a substitute for a witness.",9,12)
    para(523,865,242,"SAT - Lock & Lantern Check, community room, 2 PM. SUN - Paperback Swap, green-lamp corner, noon. TUE - Night Route Listening Session, press drop, 7 PM. THU - Cribbage & Coffee, Great Lost Bear, 6 PM.",8.5,11)
    c.setFillColor(HexColor(INK)); c.rect(14,H-1161,190,151,fill=1,stroke=0); pdf_text(c,28,1042,"INSIDE",25,"Helvetica-Bold","#fff8df"); pdf_text(c,28,1073,"THIS ISSUE",25,"Helvetica-Bold","#fff8df")
    for top,text in [(1032,"City Beat ............................ 2"),(1050,"Crime & Neighborhood Watch .......... 3"),(1068,"Editorial ........................... 4"),(1086,"Community / Classifieds ............. 7"),(1104,"Puzzle Dojo ....................... 8-9")]: pdf_text(c,218,top,text,9,"Times-Bold")
    c.setFillColor(HexColor(GREEN)); c.rect(510,H-1161,268,151,fill=1,stroke=1); pdf_text(c,555,1038,"THE CRUST BUCKET",21,"Helvetica-Bold","#fff8df"); pdf_text(c,566,1070,"HOT PIE. FAIR DEAL.",14,"Times-Bold","#fff8df"); pdf_text(c,550,1124,"ISSUE 001 COUNTER SPECIAL",12,"Helvetica-Bold",MUSTARD)
    c.setFillColor(HexColor(RED)); c.rect(14,H-1206,764,35,fill=1,stroke=0); pdf_text(c,210,1195,"NEXT ISSUE: WHO KEEPS LEAVING THE HARBOR LIGHT ON?",13,"Helvetica-Bold","#fff8df")
    c.setTitle("The Underground Press - Issue 001 Page One Proof"); c.showPage(); c.save()


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__); parser.parse_args(argv)
    if not PHOTO.is_file(): raise FileNotFoundError(PHOTO)
    build_svg(); build_pdf(); print(MASTER); print(PROOF); return 0


if __name__ == "__main__":
    raise SystemExit(main())
