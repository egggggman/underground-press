#!/usr/bin/env python3
"""Build the representative Issue 001 Page 2 art-style lock study."""
from pathlib import Path
import random
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
 rng=random.Random(1991); c.saveState(); c.setFillAlpha(.12); c.setFillColor(HexColor("#705d36"))
 for _ in range(520): c.circle(rng.uniform(6,W-6),rng.uniform(6,H-6),rng.choice((.25,.4,.7)),fill=1,stroke=0)
 c.restoreState()
 text(c,24,31,"ISSUE 001 ART-STYLE LOCK STUDY / CITY BEAT LEAD",14,color="#fff8df")
 text(c,18,90,"WHEN THE FOG MOVES IN,",39); text(c,18,132,"THE BLOCK LISTENS",39,color=RED)
 # Paper-colored dropout creates restrained, deterministic press wear in display ink.
 c.saveState(); c.setFillColor(HexColor(PAPER)); c.setFillAlpha(.72)
 for _ in range(58):
  x=rng.uniform(25,520); y=rng.choice((H-88,H-130))+rng.uniform(-13,13); c.rect(x,y,rng.uniform(1,5),rng.uniform(.5,1.8),fill=1,stroke=0)
 c.restoreState()
 text(c,20,159,"Neighbors agree on caution. They do not always agree on what they heard.",12,"Times-Bold")
 c.drawImage(ImageReader(str(ART)),18,H-500,width=520,height=315,preserveAspectRatio=True,anchor="c",mask="auto")
 c.setStrokeColor(HexColor(INK)); c.setLineWidth(2); c.rect(18,H-500,520,315,fill=0,stroke=1)
 text(c,24,516,"A LOW LAMP MARKS THE WALL SIDE AS HARBOR FOG CLOSES THE VIEW.",8)
 c.setFillColor(HexColor(MUSTARD)); c.rect(552,H-300,226,115,fill=1,stroke=1); text(c,566,210,"OVERHEARD",12,color=RED)
 text(c,566,242,"'Louder is not clearer.'",13,"Times-Bold"); text(c,566,266,"- NIGHT DELIVERY RIDER",8)
 c.setFillColor(HexColor(GREEN)); c.rect(552,H-500,226,180,fill=1,stroke=1); text(c,566,344,"FOG ROUTINE",15,color="#fff8df")
 for i,s in enumerate(("1  SLOW AT BLIND CORNERS","2  HOLD THE LAMP LOW","3  ANSWER A BELL ONCE","4  WRITE IT DOWN FIRST")): text(c,566,378+i*27,s,10,color="#fff8df")
 # Handmade bell and pencil marks act as reported spot furniture.
 c.setStrokeColor(HexColor("#fff8df")); c.setLineWidth(2); c.arc(724,H-476,756,H-442,0,180); c.line(724,H-459,724,H-477); c.line(756,H-459,756,H-477); c.line(720,H-477,760,H-477); c.circle(740,H-484,3,fill=0,stroke=1)
 c.setStrokeColor(HexColor(INK)); c.setLineWidth(3); c.line(610,H-525,735,H-546); c.setFillColor(HexColor(RED)); c.circle(610,H-525,3,fill=1,stroke=0)
 # A slightly rotated clipped desk note adds provenance without carrying essential copy.
 c.saveState(); c.translate(555,H-520); c.rotate(-2); c.setFillColor(HexColor("#d8c995")); c.rect(0,0,210,48,fill=1,stroke=1); c.setFillColor(HexColor(INK)); c.setFont("Times-Bold",9); c.drawString(12,29,"DESK NOTE: SOUND IS EVIDENCE."); c.drawString(12,14,"CERTAINTY TAKES ANOTHER SOURCE."); c.restoreState()
 c.setFillColor(HexColor(RED)); c.rect(14,H-566,764,38,fill=1,stroke=0); text(c,185,553,"WE'RE ALL LOOKING FOR A PLACE TO LAND.",16,color="#fff8df")
 text(c,18,600,"LOCK TEST: DOMINANT HALFTONE / PHYSICAL INK / REPORTED OBJECTS / PACKED MODULES",9,color=GREEN)
 text(c,18,628,"Direction approved. Physical treatment remains under lock-proof review.",9,"Times-Bold")
 c.showPage(); c.save(); print(PDF)
if __name__=="__main__": main()
