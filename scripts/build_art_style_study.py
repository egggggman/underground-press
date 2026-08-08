#!/usr/bin/env python3
"""Build the representative Issue 001 Page 2 art-style lock study."""
from pathlib import Path
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/"issues/issue_001/assets/art-style-studies/city-beat-fog-lead-study-v1.png"
PDF=ROOT/"output/pdf/issue_001_art_style_lock_page_2_lead_study.pdf"
W,H=792,720; PAPER,INK,RED,GREEN,MUSTARD="#eadcae","#17150f","#8c241c","#16452f","#d39e2b"
def text(c,x,top,s,size,font="Helvetica-Bold",color=INK): c.setFillColor(HexColor(color)); c.setFont(font,size); c.drawString(x,H-top,s)
def main():
 PDF.parent.mkdir(parents=True,exist_ok=True); c=canvas.Canvas(str(PDF),pagesize=(W,H),pageCompression=1)
 c.setFillColor(HexColor(PAPER)); c.rect(0,0,W,H,fill=1,stroke=0); c.setFillColor(HexColor(RED)); c.rect(14,H-38,764,28,fill=1,stroke=0)
 text(c,24,31,"ISSUE 001 ART-STYLE LOCK STUDY / CITY BEAT LEAD",14,color="#fff8df")
 text(c,18,90,"WHEN THE FOG MOVES IN,",39); text(c,18,132,"THE BLOCK LISTENS",39,color=RED)
 text(c,20,159,"Neighbors agree on caution. They do not always agree on what they heard.",12,"Times-Bold")
 c.drawImage(ImageReader(str(ART)),18,H-500,width=520,height=315,preserveAspectRatio=True,anchor="c",mask="auto")
 c.setStrokeColor(HexColor(INK)); c.setLineWidth(2); c.rect(18,H-500,520,315,fill=0,stroke=1)
 text(c,24,516,"A LOW LAMP MARKS THE WALL SIDE AS HARBOR FOG CLOSES THE VIEW.",8)
 c.setFillColor(HexColor(MUSTARD)); c.rect(552,H-300,226,115,fill=1,stroke=1); text(c,566,210,"OVERHEARD",12,color=RED)
 text(c,566,242,"'Louder is not clearer.'",13,"Times-Bold"); text(c,566,266,"- NIGHT DELIVERY RIDER",8)
 c.setFillColor(HexColor(GREEN)); c.rect(552,H-500,226,180,fill=1,stroke=1); text(c,566,344,"FOG ROUTINE",15,color="#fff8df")
 for i,s in enumerate(("1  SLOW AT BLIND CORNERS","2  HOLD THE LAMP LOW","3  ANSWER A BELL ONCE","4  WRITE IT DOWN FIRST")): text(c,566,378+i*27,s,10,color="#fff8df")
 c.setFillColor(HexColor(RED)); c.rect(14,H-566,764,38,fill=1,stroke=0); text(c,185,553,"WE'RE ALL LOOKING FOR A PLACE TO LAND.",16,color="#fff8df")
 text(c,18,600,"LOCK TEST: DOMINANT HALFTONE / PHYSICAL INK / REPORTED OBJECTS / PACKED MODULES",9,color=GREEN)
 text(c,18,628,"Candidate only. Approval governs the complete Issue 001 production pass.",9,"Times-Bold")
 c.showPage(); c.save(); print(PDF)
if __name__=="__main__": main()
