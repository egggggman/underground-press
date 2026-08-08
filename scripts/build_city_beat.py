#!/usr/bin/env python3
"""Build the Issue 001 City Beat editable SVG and review proofs."""
from __future__ import annotations
import html, random, re, shutil, subprocess, textwrap
from pathlib import Path
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas

ROOT=Path(__file__).resolve().parents[1]
COPY=ROOT/"issues/issue_001/production/city-beat/COPY.md"
MASTER=ROOT/"issues/issue_001/production/city-beat/issue_001_page_2_city_beat.svg"
PDF=ROOT/"output/pdf/issue_001_page_2_city_beat_proof.pdf"
PNG=ROOT/"output/png/issue_001_page_2_city_beat_proof.png"
W,H=792,1224
PAPER,INK,RED,GREEN,MUSTARD="#eadcae","#17150f","#8c241c","#16452f","#d39e2b"

def sections():
    raw=COPY.read_text(encoding="utf-8"); out={}
    for block in re.split(r"^## ",raw,flags=re.M)[1:]:
        title,_,body=block.partition("\n"); out[title.strip()]=re.sub(r"\*\*","",body.strip())
    return out

def plain(s): return re.sub(r"\s+"," ",s.replace("—","-").replace("“",'"').replace("”",'"').replace("’","'"))
def ptext(c,x,top,s,size,font="Times-Roman",color=INK):
    c.setFillColor(HexColor(color)); c.setFont(font,size); c.drawString(x,H-top,s)
def para(c,x,top,w,s,size=8.1,leading=9.6,font="Times-Roman",limit=None):
    lines=textwrap.wrap(plain(s),max(12,int(w/(size*.50))))[:limit]
    for i,line in enumerate(lines): ptext(c,x,top+i*leading,line,size,font)
def panel(c,x,top,w,h,title,color):
    c.setStrokeColor(HexColor(INK)); c.setLineWidth(1.2); c.rect(x,H-top-h,w,h,fill=0,stroke=1)
    c.setFillColor(HexColor(color)); c.rect(x,H-top-24,w,24,fill=1,stroke=0)
    ptext(c,x+8,top+17,title,12,"Helvetica-Bold","#fff8df")

def build_pdf(d):
    PDF.parent.mkdir(parents=True,exist_ok=True); c=canvas.Canvas(str(PDF),pagesize=(W,H),pageCompression=1)
    c.setFillColor(HexColor(PAPER)); c.rect(0,0,W,H,fill=1,stroke=0)
    rng=random.Random(2002); c.saveState(); c.setFillAlpha(.09); c.setFillColor(HexColor("#6f5d37"))
    for _ in range(850): c.circle(rng.uniform(8,W-8),rng.uniform(8,H-8),rng.choice((.25,.4,.6)),fill=1,stroke=0)
    c.restoreState(); c.setFillColor(HexColor(RED)); c.rect(14,H-37,764,27,fill=1,stroke=0)
    ptext(c,24,31,"CITY BEAT / PAGE 2",15,"Helvetica-Bold","#fff8df"); ptext(c,273,31,"FOG-SEASON EDITION",14,"Helvetica-Bold","#fff8df"); ptext(c,690,31,"ISSUE 001",14,"Helvetica-Bold","#fff8df")
    ptext(c,22,87,"CITY BEAT",50,"Helvetica-Bold"); ptext(c,22,113,"PORTLAND ABOVE / PORTLAND BELOW / REPORTED BY THE NEIGHBORHOOD",9,"Helvetica-Bold",GREEN)
    c.setStrokeColor(HexColor(INK)); c.setLineWidth(3); c.line(14,H-126,778,H-126)
    ptext(c,18,174,"WHEN THE FOG MOVES IN,",40,"Helvetica-Bold"); ptext(c,18,216,"THE BLOCK LISTENS",40,"Helvetica-Bold",RED)
    dek="On the working waterfront and in the passages below it, shorter sightlines make ordinary sounds carry more of the load. Neighbors agree on caution. They do not always agree on what they heard."
    para(c,20,242,515,dek,11.2,13,"Times-Bold",4)
    c.setFillColor(HexColor("#d8c995")); c.rect(553,H-354,225,216,fill=1,stroke=1); ptext(c,565,158,"SOUND / SIGHTLINE",14,"Helvetica-Bold",GREEN)
    c.setStrokeColor(HexColor(INK)); c.setLineWidth(2)
    for y in (205,252,299): c.line(570,H-y,750,H-y)
    c.setFillColor(HexColor(RED)); c.circle(590,H-205,8,fill=1,stroke=0); ptext(c,650,194,"BELL CARRIES",9,"Helvetica-Bold")
    c.setFillColor(HexColor(GREEN)); c.circle(700,H-252,7,fill=1,stroke=0); ptext(c,575,241,"LOW LAMP SHOWS WHEELS",8,"Helvetica-Bold")
    ptext(c,575,329,"ILLUSTRATIVE / NOT A MUNICIPAL MAP",7,"Helvetica-Bold",RED); ptext(c,565,348,"Fog changes cues, not distance.",8,"Times-Bold")
    lead=d["WHEN THE FOG MOVES IN, THE BLOCK LISTENS"].split("The fog came in",1)[-1]; lead="The fog came in"+lead
    words=plain(lead).split(); cut=len(words)//2
    para(c,18,292,252," ".join(words[:cut]),8.15,9.55,"Times-Roman",47); para(c,282,366,252," ".join(words[cut:]),8.15,9.55,"Times-Roman",39)
    panel(c,553,368,225,132,"WEATHER DESK",GREEN); para(c,565,404,201,d["WEATHER DESK — FOG / LIGHT DRIZZLE"],8.3,10,"Times-Roman",9)
    panel(c,553,510,225,218,"TRANSIT WATCH",RED); para(c,565,546,201,d["TRANSIT WATCH"],8.1,9.7,"Times-Roman",17)
    panel(c,18,612,516,116,"FOG ROUTINE / FOUR SMALL CERTAINTIES",GREEN)
    ptext(c,34,653,"1  SLOW AT BLIND CORNERS",11,"Helvetica-Bold"); ptext(c,282,653,"2  HOLD THE LAMP LOW",11,"Helvetica-Bold")
    ptext(c,34,688,"3  ANSWER A BELL ONCE",11,"Helvetica-Bold"); ptext(c,282,688,"4  WRITE IT DOWN FIRST",11,"Helvetica-Bold")
    ptext(c,34,714,"Sound is evidence of something. It is not proof of everything.",8.5,"Times-Bold",RED)
    c.setStrokeColor(HexColor(INK)); c.setLineWidth(3); c.line(14,H-750,778,H-750)
    panel(c,14,764,360,300,"COMMUNITY CALENDAR",RED); para(c,26,800,336,d["COMMUNITY CALENDAR"],9.1,11.2,"Times-Roman",22)
    panel(c,386,764,392,300,"NEIGHBORHOOD NOTES",GREEN); para(c,398,800,368,d["NEIGHBORHOOD NOTES"],9.2,11.3,"Times-Roman",22)
    c.setFillColor(HexColor(MUSTARD)); c.rect(30,H-1114,285,36,fill=1,stroke=1); ptext(c,43,1101,"RED PENCIL: LOUDER IS NOT CLOSER.",11,"Helvetica-Bold")
    ptext(c,430,1094,"IN-UNIVERSE SERVICE DESK",9,"Helvetica-Bold",RED); ptext(c,430,1108,"NOT REAL-WORLD PORTLAND PUBLIC GUIDANCE",7.5,"Helvetica-Bold")
    c.setFillColor(HexColor(RED)); c.rect(14,H-1177,764,38,fill=1,stroke=0); ptext(c,120,1164,"WE'RE ALL LOOKING FOR A PLACE TO LAND.",17,"Helvetica-Bold","#fff8df")
    ptext(c,18,1201,"THE UNDERGROUND PRESS / ISSUE 001 / CITY BEAT / PAGE 2",8,"Helvetica-Bold"); ptext(c,704,1201,"PASS IT ON",8,"Helvetica-Bold",GREEN)
    c.setTitle("The Underground Press - Issue 001 City Beat Page 2"); c.showPage(); c.save()

def st(x,y,s,size=10,family="Georgia,serif",weight="normal",fill=INK): return f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" font-weight="{weight}" fill="{fill}">{html.escape(s)}</text>'
def build_svg(d):
    a=[f'<svg xmlns="http://www.w3.org/2000/svg" width="11in" height="17in" viewBox="0 0 {W} {H}" role="img" aria-labelledby="title desc"><title id="title">Issue 001 City Beat Page 2</title><desc id="desc">Fog-season fictional-world local reporting with weather, transit, calendar, and neighborhood notes.</desc><rect width="792" height="1224" fill="{PAPER}"/><rect x="14" y="10" width="764" height="27" fill="{RED}"/>',st(24,31,"CITY BEAT / PAGE 2",15,"Arial,sans-serif","bold","#fff8df"),st(22,87,"CITY BEAT",50,"Impact,Arial Narrow,sans-serif","bold"),st(22,113,"PORTLAND ABOVE / PORTLAND BELOW / REPORTED BY THE NEIGHBORHOOD",9,"Arial,sans-serif","bold",GREEN),f'<line x1="14" y1="126" x2="778" y2="126" stroke="{INK}" stroke-width="3"/>',st(18,174,"WHEN THE FOG MOVES IN,",40,"Impact,Arial Narrow,sans-serif","bold"),st(18,216,"THE BLOCK LISTENS",40,"Impact,Arial Narrow,sans-serif","bold",RED)]
    y=250
    for line in textwrap.wrap(plain(d["WHEN THE FOG MOVES IN, THE BLOCK LISTENS"]),92)[:44]: a.append(st(20,y,line,8.2)); y+=10
    for x,top,w,h,title,color,key in [(553,368,225,132,"WEATHER DESK",GREEN,"WEATHER DESK — FOG / LIGHT DRIZZLE"),(553,510,225,218,"TRANSIT WATCH",RED,"TRANSIT WATCH"),(14,764,360,300,"COMMUNITY CALENDAR",RED,"COMMUNITY CALENDAR"),(386,764,392,300,"NEIGHBORHOOD NOTES",GREEN,"NEIGHBORHOOD NOTES")]:
        a += [f'<rect x="{x}" y="{top}" width="{w}" height="{h}" fill="none" stroke="{INK}"/>',f'<rect x="{x}" y="{top}" width="{w}" height="24" fill="{color}"/>',st(x+8,top+17,title,12,"Arial,sans-serif","bold","#fff8df")]; yy=top+40
        for line in textwrap.wrap(plain(d[key]),max(18,int(w/5.1)))[:int((h-48)/10)]: a.append(st(x+10,yy,line,8)); yy+=10
    a += [f'<rect x="14" y="1139" width="764" height="38" fill="{RED}"/>',st(120,1164,"WE'RE ALL LOOKING FOR A PLACE TO LAND.",17,"Arial,sans-serif","bold","#fff8df"),st(18,1201,"THE UNDERGROUND PRESS / ISSUE 001 / CITY BEAT / PAGE 2",8,"Arial,sans-serif","bold"),"</svg>"]
    MASTER.parent.mkdir(parents=True,exist_ok=True); MASTER.write_text("".join(a),encoding="utf-8")
def render_png():
    renderer=shutil.which("pdftoppm")
    if not renderer: raise RuntimeError("pdftoppm is required to render the review image")
    wrapper=Path(renderer)
    if wrapper.suffix.lower() in {".cmd",".bat"}:
        native=wrapper.parents[2]/"native/poppler/Library/bin/pdftoppm.exe"
        if native.is_file(): renderer=str(native)
    PNG.parent.mkdir(parents=True,exist_ok=True)
    prefix=PNG.with_suffix("")
    command=[renderer,"-png","-r","144","-singlefile",str(PDF),str(prefix)]
    subprocess.run(command,check=True)
def main():
    d=sections(); build_svg(d); build_pdf(d); render_png(); print(MASTER); print(PDF); print(PNG); return 0
if __name__=="__main__": raise SystemExit(main())
