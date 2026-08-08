"""Shared deterministic press primitives for issue page builders."""
from __future__ import annotations
import random
from reportlab.lib.colors import HexColor

PAPER="#eadcae"; INK="#17150f"; RED="#8c241c"; GREEN="#16452f"; MUSTARD="#d39e2b"

def paper(c,width,height,seed):
    c.setFillColor(HexColor(PAPER)); c.rect(0,0,width,height,fill=1,stroke=0)
    rng=random.Random(seed); c.saveState(); c.setFillAlpha(.11); c.setFillColor(HexColor("#705d36"))
    for _ in range(900): c.circle(rng.uniform(5,width-5),rng.uniform(5,height-5),rng.choice((.2,.35,.55,.8)),fill=1,stroke=0)
    c.restoreState(); return rng

def text(c,height,x,top,value,size,font="Times-Roman",color=INK):
    c.setFillColor(HexColor(color)); c.setFont(font,size); c.drawString(x,height-top,value)

def distressed_display(c,height,x,top,value,size,rng,color=INK,dropouts=24):
    text(c,height,x,top,value,size,"Helvetica-Bold",color)
    c.saveState(); c.setFillColor(HexColor(PAPER)); c.setFillAlpha(.75)
    approximate_width=len(value)*size*.57
    for _ in range(dropouts):
        dx=rng.uniform(x,min(x+approximate_width,780)); dy=height-top+rng.uniform(-size*.25,size*.25)
        c.rect(dx,dy,rng.uniform(.8,4),rng.uniform(.35,1.4),fill=1,stroke=0)
    c.restoreState()

def rule(c,height,x,top,width,weight=2,color=INK):
    c.setStrokeColor(HexColor(color)); c.setLineWidth(weight); c.line(x,height-top,x+width,height-top)

def module_header(c,height,x,top,width,label,color):
    c.setFillColor(HexColor(color)); c.rect(x,height-top-24,width,24,fill=1,stroke=0)
    text(c,height,x+8,top+17,label,12,"Helvetica-Bold","#fff8df")

def clipped_note(c,height,x,top,width,line1,line2,rotation=-2):
    c.saveState(); c.translate(x,height-top); c.rotate(rotation); c.setFillColor(HexColor("#d8c995")); c.rect(0,-52,width,52,fill=1,stroke=1)
    c.setFillColor(HexColor(INK)); c.setFont("Helvetica-Bold",11); c.drawString(13,-21,line1); c.setFont("Times-Bold",8); c.drawString(13,-39,line2); c.restoreState()

