#!/usr/bin/env python3
"""Build Issue 001 Page 3 Crime & Neighborhood Watch proofs."""
from __future__ import annotations
import html,re,shutil,subprocess,textwrap
from pathlib import Path
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
ROOT=Path(__file__).resolve().parents[1]; BASE=ROOT/"issues/issue_001/production/neighborhood-watch"
COPY=BASE/"COPY.md"; SVG=BASE/"issue_001_page_3_neighborhood_watch.svg"; PDF=ROOT/"output/pdf/issue_001_page_3_neighborhood_watch_proof.pdf"; PNG=ROOT/"output/png/issue_001_page_3_neighborhood_watch_proof.png"
W,H=792,1224; PAPER,INK,RED,GREEN,MUSTARD="#eadcae","#17150f","#8c241c","#16452f","#d39e2b"
def data():
 out={}
 for b in re.split(r"^## ",COPY.read_text(encoding="utf-8"),flags=re.M)[1:]: k,_,v=b.partition("\n"); out[k.strip()]=re.sub(r"\*\*","",v.strip())
 return out
def clean(s): return re.sub(r"\s+"," ",s.replace("—","-").replace("“",'"').replace("”",'"').replace("’","'"))
def txt(c,x,t,s,z,f="Times-Roman",col=INK): c.setFillColor(HexColor(col)); c.setFont(f,z); c.drawString(x,H-t,s)
def para(c,x,t,w,s,z=8.5,l=10,limit=99):
 for i,line in enumerate(textwrap.wrap(clean(s),max(12,int(w/(z*.5))))[:limit]): txt(c,x,t+i*l,line,z)
def box(c,x,t,w,h,title,col):
 c.setStrokeColor(HexColor(INK)); c.rect(x,H-t-h,w,h,fill=0,stroke=1); c.setFillColor(HexColor(col)); c.rect(x,H-t-25,w,25,fill=1,stroke=0); txt(c,x+8,t+18,title,12,"Helvetica-Bold","#fff8df")
def build_pdf(d):
 PDF.parent.mkdir(parents=True,exist_ok=True); c=canvas.Canvas(str(PDF),pagesize=(W,H),pageCompression=1); c.setFillColor(HexColor(PAPER)); c.rect(0,0,W,H,fill=1,stroke=0)
 c.setFillColor(HexColor(RED)); c.rect(14,H-38,764,28,fill=1,stroke=0); txt(c,24,31,"CRIME & NEIGHBORHOOD WATCH / PAGE 3",14,"Helvetica-Bold","#fff8df"); txt(c,686,31,"ISSUE 001",14,"Helvetica-Bold","#fff8df")
 txt(c,20,92,"THREE CORRIDORS,",44,"Helvetica-Bold"); txt(c,20,140,"NO SINGLE STORY",44,"Helvetica-Bold",RED)
 para(c,22,170,520,"Reports of damaged locks and coordinated movement overlap. The witnesses do not. The Underground Press compared their accounts without turning resemblance into certainty.",11,13,4)
 c.setFillColor(HexColor(MUSTARD)); c.rect(570,H-220,208,160,fill=1,stroke=1); txt(c,584,84,"RUMOR STATUS",13,"Helvetica-Bold",RED); txt(c,584,116,"'FOOT CLAN'",24,"Helvetica-Bold"); txt(c,584,144,"UNCONFIRMED",18,"Helvetica-Bold",RED); para(c,584,172,180,"Repeated by neighbors; not established by the desk.",9,11,4)
 lead=d["THREE CORRIDORS, NO SINGLE STORY"].split("Three below-street",1)[-1]; words=clean("Three below-street"+lead).split(); cuts=[0,len(words)//3,2*len(words)//3,len(words)]
 for i,x in enumerate((20,202,384)): para(c,x,242,166," ".join(words[cuts[i]:cuts[i+1]]),8.4,10,53)
 box(c,570,242,208,258,"INCIDENT LEDGER",GREEN); para(c,582,282,184,d["INCIDENT LEDGER"],8.2,10,22)
 box(c,570,514,208,154,"REPORTING LADDER",RED); txt(c,586,554,"1  DIRECT OBSERVATION",9,"Helvetica-Bold"); txt(c,586,582,"2  ATTRIBUTED ACCOUNT",9,"Helvetica-Bold"); txt(c,586,610,"3  CORROBORATED DETAIL",9,"Helvetica-Bold"); txt(c,586,638,"4  CONCLUSION - IF EARNED",9,"Helvetica-Bold")
 box(c,20,500,532,168,"PATTERN / NOT PROOF",GREEN)
 txt(c,38,544,"DARK CLOTHING",13,"Helvetica-Bold"); txt(c,217,544,"QUICK MOVEMENT",13,"Helvetica-Bold"); txt(c,398,544,"DAMAGED LOCKS",13,"Helvetica-Bold")
 txt(c,38,577,"common work cloth",9,"Times-Bold",RED); txt(c,217,577,"counts disputed",9,"Times-Bold",RED); txt(c,398,577,"wear or intent",9,"Times-Bold",RED)
 c.setStrokeColor(HexColor(INK)); c.line(52,H-604,500,H-604); txt(c,122,632,"OVERLAP GUIDES THE NEXT QUESTION. IT DOES NOT ANSWER IT.",10,"Helvetica-Bold")
 c.setStrokeColor(HexColor(INK)); c.setLineWidth(3); c.line(14,H-690,778,H-690)
 box(c,14,706,374,278,"WHAT WE KNOW / DO NOT",RED); para(c,28,748,346,d["WHAT WE KNOW / WHAT WE DO NOT"],10,12,17)
 box(c,402,706,376,278,"WATCH DESK",GREEN); para(c,416,748,348,d["WATCH DESK"],10,12,17)
 c.setFillColor(HexColor(MUSTARD)); c.rect(40,H-1052,520,48,fill=1,stroke=1); txt(c,56,1034,"THREE MARKS ARE NOT THREE PEOPLE.",17,"Helvetica-Bold")
 txt(c,590,1027,"IN-UNIVERSE REPORTING",8,"Helvetica-Bold",RED); txt(c,590,1041,"NOT REAL-WORLD GUIDANCE",7,"Helvetica-Bold")
 c.setFillColor(HexColor(RED)); c.rect(14,H-1178,764,40,fill=1,stroke=0); txt(c,120,1165,"WE'RE ALL LOOKING FOR A PLACE TO LAND.",17,"Helvetica-Bold","#fff8df"); txt(c,18,1202,"THE UNDERGROUND PRESS / ISSUE 001 / PAGE 3",8,"Helvetica-Bold"); c.showPage(); c.save()
def build_svg(d):
 def t(x,y,s,z=10,col=INK): return f'<text x="{x}" y="{y}" font-family="Arial,sans-serif" font-size="{z}" fill="{col}">{html.escape(s)}</text>'
 a=[f'<svg xmlns="http://www.w3.org/2000/svg" width="11in" height="17in" viewBox="0 0 {W} {H}"><title>Issue 001 Page 3 Neighborhood Watch</title><rect width="792" height="1224" fill="{PAPER}"/>',t(20,92,"THREE CORRIDORS,",44),t(20,140,"NO SINGLE STORY",44,RED)]; y=180
 for line in textwrap.wrap(clean(d["THREE CORRIDORS, NO SINGLE STORY"]),105)[:65]: a.append(t(22,y,line,8)); y+=11
 a += [f'<rect x="14" y="1138" width="764" height="40" fill="{RED}"/>',t(120,1165,"WE'RE ALL LOOKING FOR A PLACE TO LAND.",17,"#fff8df"),"</svg>"]; SVG.write_text("".join(a),encoding="utf-8")
def render():
 r=shutil.which("pdftoppm"); p=Path(r)
 if p.suffix.lower() in {".cmd",".bat"}:
  n=p.parents[2]/"native/poppler/Library/bin/pdftoppm.exe"; r=str(n) if n.is_file() else r
 PNG.parent.mkdir(parents=True,exist_ok=True); subprocess.run([r,"-png","-r","144","-singlefile",str(PDF),str(PNG.with_suffix(""))],check=True)
def main(): d=data(); build_svg(d); build_pdf(d); render(); print(SVG); print(PDF); print(PNG)
if __name__=="__main__": main()
