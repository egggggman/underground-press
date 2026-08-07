import json, os, shutil, textwrap, zipfile
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import stringWidth

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "outputs" / "underground_press_component_library_v1"
SRC = PACK / "source"
SVG = PACK / "assets_svg"
TOKENS = PACK / "tokens"
CATALOG = PACK / "catalog"
PREVIEW = PACK / "previews"
REF = Path(r"C:\Users\ckytr\Documents\Codex\2026-08-05\referenced-chatgpt-conversation-this-is-an-4\outputs\editable_assets")

INK="#171812"; PAPER="#EDE0B3"; PANEL="#D9C99B"; RED="#8C2118"; GREEN="#143F2C"; MUSTARD="#D29E2E"; WHITE="#FFFDF3"

for d in [SRC, SVG, TOKENS, CATALOG, PREVIEW]: d.mkdir(parents=True, exist_ok=True)

def esc(s):
    return str(s).replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')

def svg_doc(w,h,body,title,desc="Editable SVG component"):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-labelledby="title desc">
<title id="title">{esc(title)}</title><desc id="desc">{esc(desc)}</desc>
<style>.display{{font-family:Impact,'Arial Narrow',sans-serif;font-weight:900;letter-spacing:.4px}} .sans{{font-family:Arial,Helvetica,sans-serif}} .serif{{font-family:Georgia,'Times New Roman',serif}} .small{{font-size:8px}} .edit{{fill:{GREEN}}}</style>
{body}</svg>'''

def write_svg(path,w,h,body,title,desc="Editable SVG component"):
    target=SVG/path
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(svg_doc(w,h,body,title,desc),encoding='utf-8')

def paper(w,h):
    return f'<rect width="{w}" height="{h}" fill="{PAPER}"/><g opacity=".08" stroke="{INK}" stroke-width=".5">' + ''.join(f'<line x1="8" y1="{y}" x2="{w-8}" y2="{y}"/>' for y in range(12,h,18)) + '</g>'

def rule(kind,w=720,h=32):
    if kind=='heavy': b=f'<line x1="0" y1="16" x2="{w}" y2="16" stroke="{INK}" stroke-width="5"/>'
    elif kind=='double': b=f'<line x1="0" y1="11" x2="{w}" y2="11" stroke="{INK}" stroke-width="2"/><line x1="0" y1="20" x2="{w}" y2="20" stroke="{RED}" stroke-width="4"/>'
    elif kind=='dashed': b=f'<line x1="0" y1="16" x2="{w}" y2="16" stroke="{INK}" stroke-width="2" stroke-dasharray="8 5"/>'
    else: b=f'<line x1="{w/2}" y1="0" x2="{w/2}" y2="{h}" stroke="{INK}" stroke-width="2"/><circle cx="{w/2}" cy="{h/2}" r="4" fill="{RED}"/>'
    return b

for n in ['heavy','double','dashed','pipe_divider']:
    write_svg(Path('decorative_rules')/f'{n}.svg',720,32,rule(n),n.replace('_',' ').title())

typo_body = paper(720,520)+f'''<g fill="{INK}"><text x="28" y="64" class="display" font-size="50">DISPLAY HEADLINE</text>
<text x="28" y="108" class="display" font-size="28">SECTION HEADER</text><line x1="28" y1="116" x2="692" y2="116" stroke="{RED}" stroke-width="4"/>
<text x="28" y="158" class="serif" font-weight="bold" font-size="25">Article Title / Deck</text>
<rect x="28" y="182" width="280" height="30" fill="{RED}"/><text x="168" y="203" text-anchor="middle" fill="{WHITE}" class="display" font-size="17">SIDEBAR HEADER</text>
<text x="28" y="250" class="serif" font-size="15">Body Copy. Direct, local, lightly weathered.</text>
<text x="28" y="282" class="serif" font-size="12" font-style="italic">Caption / photo credit / archival note.</text>
<text x="28" y="314" class="sans" font-size="9">FINE PRINT • ISSUE DATA • LEGAL • SOURCE</text>
<text x="28" y="362" class="display" font-size="34" fill="{RED}">COUPON TEXT</text>
<text x="28" y="404" class="sans" font-weight="bold" font-size="13" fill="{GREEN}">Editable text remains live. Convert to outlines only at final press handoff.</text>
<text x="28" y="448" class="sans" font-size="11">Fallback stack: Impact / Arial Narrow / Georgia / Arial</text></g>'''
write_svg(Path('typography')/'type_specimen.svg',720,520,typo_body,'Typography Styles')

def furniture(name,label,w=720,h=56):
    return paper(w,h)+f'<rect x="1" y="1" width="{w-2}" height="{h-2}" fill="none" stroke="{INK}"/><text x="18" y="35" class="display edit" font-size="20">{esc(label)}</text><text x="{w-18}" y="35" text-anchor="end" class="sans" font-size="10" fill="{INK}">[[SWAP_ME]]</text>'

for name,label in [('page_number','FIRST EDITION • SECTION • 01'),('issue_banner','FIRST EDITION!  NEW YORK’S MOST INDEPENDENT NEWSPAPER  50¢'),('jump_line','CONTINUED ON PAGE [[PAGE]]'),('continued','CONTINUED FROM PAGE [[PAGE]]'),('end_mark','■ END'),('editors_note','EDITOR’S NOTE: [[NOTE]]')]:
    write_svg(Path('page_furniture')/f'{name}.svg',720,56,furniture(name,label),label)

def widget(title,subtitle,fields,icon):
    h=180; w=340
    rows=''.join(f'<text x="20" y="{92+i*22}" class="sans" font-size="11" fill="{INK}">{esc(k)}:</text><text x="112" y="{92+i*22}" class="sans edit" font-weight="bold" font-size="11">[[{esc(v)}]]</text>' for i,(k,v) in enumerate(fields))
    return paper(w,h)+f'<rect x="3" y="3" rx="10" width="334" height="174" fill="{PANEL}" stroke="{INK}" stroke-width="3"/><rect x="3" y="3" width="334" height="38" fill="{RED}"/><text x="18" y="30" class="display" font-size="22" fill="{WHITE}">{esc(title)}</text><text x="315" y="29" text-anchor="end" font-size="22">{icon}</text><text x="20" y="64" class="serif" font-style="italic" font-size="11" fill="{INK}">{esc(subtitle)}</text>{rows}'

widgets={
'weather':('WEATHER','Street level / tunnel level',[('High','HIGH'),('Low','LOW'),('Forecast','FORECAST')],'☂'),
'subway_status':('SUBWAY STATUS','Trust, but verify.',[('Line','LINE'),('Status','STATUS'),('Note','NOTE')],'●'),
'press_status':('PRESS STATUS','The rollers are still turning.',[('Edition','EDITION'),('Deadline','DEADLINE'),('State','STATE')],'▣'),
'calendar':('COMMUNITY CALENDAR','What’s happening below street level.',[('Date','DATE'),('Event','EVENT'),('Place','PLACE')],'▦'),
'next_issue':('NEXT ISSUE','Keep one eye on the newsstand.',[('Drops','DATE'),('Lead','TEASER'),('Price','PRICE')],'➜'),
'puzzle_desk':('FROM THE PUZZLE DESK','A note from the mind gym.',[('Editor','EDITOR'),('Theme','THEME'),('Credit','CREDIT')],'✦')}
for n,(t,s,f,i) in widgets.items(): write_svg(Path('utility_widgets')/f'{n}.svg',340,180,widget(t,s,f,i),t)

tony=paper(420,260)+f'''<rect x="3" y="3" width="414" height="254" fill="none" stroke="{INK}" stroke-width="4"/><rect x="3" y="3" width="414" height="52" fill="{RED}"/>
<text x="210" y="41" text-anchor="middle" class="display" font-size="32" fill="{WHITE}">TONY’S PIZZA</text>
<g id="editable-pizza-art" transform="translate(34 76)"><path d="M10 116 L74 10 L144 120 Z" fill="{MUSTARD}" stroke="{INK}" stroke-width="5"/><path d="M72 12 Q108 3 146 23" fill="none" stroke="{RED}" stroke-width="18" stroke-linecap="round"/><circle cx="76" cy="62" r="12" fill="{RED}"/><circle cx="111" cy="89" r="12" fill="{RED}"/><path d="M44 92 q12-20 25 0" fill="none" stroke="{GREEN}" stroke-width="7"/></g>
<text x="188" y="98" class="display" font-size="24" fill="{INK}">HOT PIZZA.</text><text x="188" y="126" class="display" font-size="24" fill="{INK}">COLD SODA.</text><text x="188" y="154" class="display" font-size="24" fill="{INK}">GOOD PEOPLE.</text>
<text x="188" y="184" class="sans edit" font-weight="bold" font-size="13">[[ADDRESS]]</text><text x="188" y="207" class="sans edit" font-weight="bold" font-size="13">[[OFFER]]</text><rect x="188" y="220" width="196" height="22" fill="{GREEN}"/><text x="286" y="236" text-anchor="middle" class="sans" font-size="10" font-weight="bold" fill="{WHITE}">[[COUPON_CODE]]</text>'''
write_svg(Path('advertisements')/'tonys_pizza_master.svg',420,260,tony,"Tony's Pizza Master Ad","Vector master with editable copy fields")

for n,title,color in [('quarter_page','TONY’S 2 A.M. SLICE',RED),('classified','TONY’S PIZZA • OPEN LATE',GREEN),('coupon','ONE FREE GARLIC KNOT',RED)]:
    body=paper(320,140)+f'<rect x="2" y="2" width="316" height="136" fill="none" stroke="{color}" stroke-width="3"/><rect x="2" y="2" width="316" height="30" fill="{color}"/><text x="160" y="24" text-anchor="middle" class="display" font-size="17" fill="{WHITE}">{title}</text><text x="160" y="68" text-anchor="middle" class="serif" font-size="14" font-weight="bold" fill="{INK}">[[OFFER_COPY]]</text><text x="160" y="94" text-anchor="middle" class="sans edit" font-size="11">[[ADDRESS]] • [[HOURS]]</text><line x1="15" y1="116" x2="305" y2="116" stroke="{INK}" stroke-dasharray="6 4"/><text x="160" y="132" text-anchor="middle" class="sans" font-size="8">CUT ALONG DOTTED LINE</text>'
    write_svg(Path('advertisements')/f'tonys_{n}.svg',320,140,body,title)

cap=paper(300,300)+f'''<circle cx="150" cy="150" r="128" fill="none" stroke="{INK}" stroke-width="3" stroke-dasharray="7 5"/><circle cx="150" cy="150" r="112" fill="{GREEN}" stroke="{INK}" stroke-width="5"/><circle cx="150" cy="150" r="82" fill="none" stroke="{MUSTARD}" stroke-width="5"/><path d="M91 150h118M150 91v118M108 108l84 84M192 108l-84 84" stroke="{INK}" stroke-width="3" opacity=".55"/><text x="150" y="137" text-anchor="middle" class="display" font-size="24" fill="{MUSTARD}">SEWER CAP</text><text x="150" y="170" text-anchor="middle" class="display edit" font-size="30">#[[NUMBER]]</text><text x="150" y="198" text-anchor="middle" class="sans" font-size="10" fill="{WHITE}">[[ISSUE]] • [[RARITY]]</text>'''
write_svg(Path('collectibles')/'sewer_cap_blank.svg',300,300,cap,'Blank Sewer Cap Collectible')
frame=paper(420,520)+f'<rect x="14" y="14" rx="18" width="392" height="492" fill="none" stroke="{INK}" stroke-width="6"/><rect x="30" y="30" width="360" height="55" fill="{RED}"/><text x="210" y="68" text-anchor="middle" class="display" font-size="28" fill="{WHITE}">SEWER CAP FILE</text><circle cx="210" cy="250" r="130" fill="none" stroke="{GREEN}" stroke-width="4" stroke-dasharray="8 6"/><text x="210" y="250" text-anchor="middle" class="sans edit" font-size="15">[[PLACE CAP ART HERE]]</text><text x="42" y="425" class="display" font-size="22" fill="{INK}">#[[NUMBER]] — [[NAME]]</text><text x="42" y="455" class="serif" font-size="13" fill="{INK}">[[LORE / LOCATION / ISSUE NOTE]]</text><text x="42" y="486" class="sans" font-size="9" fill="{GREEN}">COLLECT • CLIP • TRADE • DO NOT FEED TO ALLIGATORS</text>'
write_svg(Path('collectibles')/'collector_frame.svg',420,520,frame,'Sewer Cap Collector Frame')

bird=f'''<g id="seagullotine-art"><ellipse cx="88" cy="91" rx="49" ry="45" fill="{WHITE}" stroke="{INK}" stroke-width="5"/><circle cx="72" cy="81" r="5" fill="{INK}"/><path d="M126 85 L174 102 L128 111 Z" fill="{RED}" stroke="{INK}" stroke-width="4"/><rect x="48" y="127" width="82" height="89" fill="{GREEN}" stroke="{INK}" stroke-width="5"/><path d="M48 160 L16 195M130 160l32 35" stroke="{INK}" stroke-width="8"/><path d="M65 216v32M112 216v32" stroke="{INK}" stroke-width="8"/></g>'''
for n,title,h in [('quote','SEAGULLOTINE SAYS:',300),('editorial','SEAGULLOTINE EDITORIAL:',430),('caption','SEAGULLOTINE:',220)]:
    w=720; body=paper(w,h)+f'<rect x="3" y="3" rx="14" width="714" height="{h-6}" fill="{PANEL}" stroke="{INK}" stroke-width="4"/>{bird}<text x="205" y="58" class="display" font-size="24" fill="{RED}">{title}</text><text x="205" y="96" class="serif edit" font-size="16" font-style="italic">“[[QUOTE_OR_COPY]]”</text><text x="205" y="128" class="sans" font-size="10" fill="{INK}">[[CREDIT / CONTEXT]]</text>'
    if h>300: body += f'<line x1="205" y1="160" x2="682" y2="160" stroke="{INK}"/><text x="205" y="190" class="serif edit" font-size="13">[[BODY_COPY]]</text>'
    write_svg(Path('seagullotine')/f'{n}_panel.svg',w,h,body,title)

def drop(name,w,h,label):
    body=paper(w,h)+f'<rect x="3" y="3" width="{w-6}" height="{h-6}" fill="none" stroke="{INK}" stroke-width="4"/><rect x="16" y="16" width="{w-32}" height="{h-32}" fill="none" stroke="{GREEN}" stroke-width="2" stroke-dasharray="12 8"/><text x="{w/2}" y="{h/2-8}" text-anchor="middle" class="display" font-size="28" fill="{GREEN}">{esc(label)}</text><text x="{w/2}" y="{h/2+22}" text-anchor="middle" class="sans" font-size="11" fill="{INK}">ID: {name} • SAFE: 16 px • [[CONTENT]]</text>'
    write_svg(Path('drop_zones')/f'{name}.svg',w,h,body,label)
for a in [('full_width',720,240,'FULL-WIDTH DROP ZONE'),('two_column',350,300,'TWO-COLUMN MODULE'),('sidebar',240,420,'SIDEBAR MODULE'),('puzzle_square',420,420,'PUZZLE / GRID ZONE'),('photo',520,320,'PHOTO / ART ZONE'),('ad_slot',320,140,'AD SLOT')]: drop(*a)

tokens={"name":"The Underground Press Component Library","version":"1.0","units":"SVG viewBox pixels; catalog uses points/inches","colors":{"ink":INK,"paper":PAPER,"panel":PANEL,"oxblood":RED,"sewer_green":GREEN,"mustard":MUSTARD,"paper_white":WHITE},"type":{"display":"Impact, Arial Narrow, sans-serif","editorial":"Georgia, Times New Roman, serif","utility":"Arial, Helvetica, sans-serif"},"production":{"bleed_in":0.125,"safe_in":0.25,"default_page":"11x17 portrait","editable_field_pattern":"[[FIELD_NAME]]","recommended_svg_editor":"Inkscape, Illustrator, Affinity Designer, Figma"}}
(TOKENS/'design_tokens.json').write_text(json.dumps(tokens,indent=2),encoding='utf-8')
content={"weather":{"HIGH":"72°F","LOW":"58°F","FORECAST":"Steam, then suspicious drizzle"},"subway_status":{"LINE":"CANAL LOCAL","STATUS":"RUNNING","NOTE":"Expect mutant-related delays"},"press_status":{"EDITION":"FIRST","DEADLINE":"2:00 A.M.","STATE":"ROLLERS TURNING"},"calendar":{"DATE":"FRI 8 PM","EVENT":"ROOFTOP SPARRING","PLACE":"WEST 17TH WATER TOWER"},"next_issue":{"DATE":"NEXT THURSDAY","TEASER":"WHO STOLE THE LAST SLICE?","PRICE":"50¢"},"puzzle_desk":{"EDITOR":"THE PUZZLE DOJO","THEME":"BRIDGES & TUNNELS","CREDIT":"RESTORED FROM THE ARCHIVE"},"tonys_pizza":{"ADDRESS":"CANAL ST. BELOW THE TRACKS","OFFER":"ONE FREE GARLIC KNOT","COUPON_CODE":"KOWABUNGA91"}}
(TOKENS/'sample_content.json').write_text(json.dumps(content,indent=2),encoding='utf-8')

readme='''# The Underground Press Component Library v1.0

A reusable production asset pack derived from the established Puzzle Dojo visual system: 1991 mutant-subway tabloid, warm newsprint, oxblood/sewer-green spot color, condensed headlines, strong rules, live editorial type, and modular boxes.

## Quick start

1. Open any file in `assets_svg/` in Illustrator, Inkscape, Affinity Designer, or Figma.
2. Replace every `[[FIELD_NAME]]` token. Keep artwork groups locked; edit only live text and explicitly named editable groups.
3. Resize proportionally. For a new aspect ratio, use the nearest drop-zone module and move its inner safe-area rectangle.
4. Use `tokens/design_tokens.json` for colors, font stacks, bleed, and safe-area values.
5. Use `tokens/sample_content.json` as a content schema. Production code can replace the bracketed tokens before placing the SVG.

## Folder map

- `assets_svg/typography`: type specimen and hierarchy.
- `assets_svg/decorative_rules`: heavy, double, dashed, and pipe rules.
- `assets_svg/page_furniture`: page number, issue banner, jump/continued lines, end mark, editor note.
- `assets_svg/utility_widgets`: weather, subway status, press status, calendar, next issue, puzzle desk.
- `assets_svg/advertisements`: Tony’s Pizza master, quarter-page, classified, and coupon variants.
- `assets_svg/collectibles`: blank Sewer Cap and collector frame.
- `assets_svg/seagullotine`: quote, editorial, and caption panels with editable vector mascot.
- `assets_svg/drop_zones`: full-width, two-column, sidebar, puzzle, photo, and ad modules.
- `source/build_component_library.py`: regenerates the library and catalog.
- `reference_raster`: inherited Puzzle Dojo spot art for visual reference only; not required by the SVG masters.

## Production rules

- SVG is the master format. Text remains live and artwork is vector.
- The green `[[...]]` values are swappable content fields. Change them to ink after merge if desired.
- Preserve oxblood for alerts/headers and sewer green for status/editorial fields.
- Keep rules at 0.75 pt minimum at final size. Keep body copy at 7.5 pt minimum for tabloid print.
- Default trim is 11 × 17 in, portrait; 0.125 in bleed and 0.25 in safe area.
- For one-color output, map oxblood, green, and mustard to black; patterns and borders retain hierarchy.
- Raster spot art is allowed as a linked halftone layer, but it should never contain changeable copy.

## Component use

- Typography: copy styles, not the sample wording.
- Decorative rules: stretch only along the long axis.
- Page furniture: place on master pages; bind `[[PAGE]]`, issue, and section at export.
- Widgets: feed values from JSON; keep title and icon locked.
- Tony’s Pizza: the master is fully vector. Swap address, offer, and coupon code without redrawing the pizza.
- Sewer Cap: replace number/issue/rarity and optionally add art inside the inner ring.
- Seagullotine: keep the bird group; replace quote/body/credit fields.
- Drop zones: compose pages from measured modules first, then inject content.

## Rebuild

Run `python source/build_component_library.py` with ReportLab installed. The script writes the catalog and refreshes all generated SVG masters. The delivered ZIP is a transport copy; work from the unzipped folder.
'''
(PACK/'README.md').write_text(readme,encoding='utf-8')

if REF.exists():
    rd=PACK/'reference_raster'; rd.mkdir(exist_ok=True)
    for n in ['tonys_pizza.png','sewer_cap.png','hidden_dojo_books.png','sewer_bike_repair.png','baxter_stockman.png']:
        p=REF/'assets'/n
        if p.exists(): shutil.copy2(p,rd/n)

shutil.copy2(Path(__file__), SRC/'build_component_library.py')

font_impact=Path(r'C:\Windows\Fonts\impact.ttf')
if font_impact.exists(): pdfmetrics.registerFont(TTFont('Impact',str(font_impact)))
DISPLAY='Impact' if font_impact.exists() else 'Helvetica-Bold'

def wrap(text,font,size,width):
    out=[]; cur=''
    for word in text.split():
        test=(cur+' '+word).strip()
        if stringWidth(test,font,size)<=width: cur=test
        else:
            if cur: out.append(cur)
            cur=word
    if cur: out.append(cur)
    return out

def bg(c):
    c.setFillColor(HexColor(PAPER)); c.rect(0,0,612,792,fill=1,stroke=0)
    c.setStrokeColor(HexColor('#756A49')); c.setLineWidth(.2)
    for y in range(24,780,18): c.line(18,y,594,y)

def header(c,kicker,title,page):
    c.setFillColor(HexColor(RED)); c.rect(24,748,564,20,fill=1,stroke=0)
    c.setFillColor(HexColor(WHITE)); c.setFont('Helvetica-Bold',7); c.drawString(32,755,kicker); c.drawRightString(580,755,f'CATALOG / {page:02d}')
    c.setFillColor(HexColor(INK)); c.setFont(DISPLAY,31); c.drawString(28,706,title)
    c.setStrokeColor(HexColor(GREEN)); c.setLineWidth(4); c.line(28,696,584,696)

def card(c,x,y,w,h,title,body,accent=GREEN):
    c.setFillColor(HexColor(PANEL)); c.setStrokeColor(HexColor(INK)); c.setLineWidth(1.5); c.roundRect(x,y,w,h,7,fill=1,stroke=1)
    c.setFillColor(HexColor(accent)); c.rect(x,y+h-25,w,25,fill=1,stroke=0)
    c.setFillColor(HexColor(WHITE)); c.setFont(DISPLAY,12); c.drawString(x+10,y+h-18,title)
    c.setFillColor(HexColor(INK)); c.setFont('Helvetica',7.5); yy=y+h-40
    for line in wrap(body,'Helvetica',7.5,w-20): c.drawString(x+10,yy,line); yy-=10

pdf=CATALOG/'underground_press_component_catalog_v1.pdf'
c=canvas.Canvas(str(pdf),pagesize=letter,pageCompression=1)
c.setTitle('The Underground Press Component Library v1.0')
bg(c); header(c,'PRODUCTION ASSET PACK','COMPONENT LIBRARY v1.0',1)
c.setFillColor(HexColor(INK)); c.setFont('Times-BoldItalic',18); c.drawString(30,650,'1991 mutant-subway tabloid. Built to swap, scale, and ship.')
c.setFont('Times-Roman',10); yy=620
intro='This library converts the Puzzle Dojo art direction into an editable system. Every component has a stable SVG master, live text, explicit content tokens, and a measured safe area. Artwork survives issue-to-issue changes; data does not get baked into the illustration.'
for l in wrap(intro,'Times-Roman',10,540): c.drawString(30,yy,l); yy-=14
card(c,30,430,260,145,'SYSTEM DNA','Warm aged paper. Oxblood alerts. Sewer-green utility fields. Mustard accents. Condensed headlines. Editorial serif copy. Heavy rules and rounded newsroom boxes.',RED)
card(c,308,430,274,145,'SOURCE DRIVEN','Replace [[FIELD_NAME]] values from JSON or by hand. SVG stays the production master. The PDF is a visual catalog, not the editable source.',GREEN)
card(c,30,230,552,160,'PACK CONTENTS','Typography 1 • Rules 4 • Furniture 6 • Widgets 6 • Tony’s Pizza ads 4 • Sewer Cap templates 2 • Seagullotine panels 3 • Drop-zone modules 6 • JSON token files 2 • README 1',RED)
c.setFont('Helvetica-Bold',8); c.drawString(30,45,'THE UNDERGROUND PRESS • INDEPENDENT. INQUISITIVE. OCCASIONALLY PIZZA-STAINED.')
c.showPage()

pages=[
('TYPE & RULES',[('DISPLAY / 50 px','Impact or Arial Narrow; uppercase; tight leading.'),('SECTION / 28 px','Condensed headline plus oxblood underline.'),('ARTICLE / 25 px','Bold editorial serif.'),('BODY / 15 px','Georgia or Times; short line lengths.'),('HEAVY RULE','5 px ink; major separation.'),('DOUBLE RULE','2 px ink + 4 px oxblood.'),('DASHED RULE','Cut line, coupon, collectible.'),('PIPE DIVIDER','Vertical split with alert dot.')]),
('PAGE FURNITURE',[('PAGE NUMBER','Bind issue, section, and page.'),('ISSUE BANNER','Top-of-page edition, claim, price.'),('JUMP LINE','Bind [[PAGE]] at export.'),('CONTINUED','Use at the start of continuation.'),('END MARK','Small finality marker.'),('EDITOR’S NOTE','Oxblood label with live note field.')]),
('UTILITY WIDGETS',[(x[1][0],x[1][1]+' Fields: '+', '.join(v for _,v in x[1][2])) for x in widgets.items()]),
('TONY’S PIZZA',[("MASTER AD",'420 × 260. Fully vector pizza, address, offer, coupon code.'),("QUARTER PAGE",'320 × 140 late-night offer.'),("CLASSIFIED",'320 × 140 compact announcement.'),("COUPON",'320 × 140 dotted cut line and offer field.')]),
('COLLECTIBLES & CHARACTER',[("SEWER CAP BLANK",'300 × 300. Number, issue, rarity, optional center art.'),("COLLECTOR FRAME",'420 × 520. Card frame and lore field.'),("SEAGULLOTINE QUOTE",'720 × 300. Quote and credit.'),("SEAGULLOTINE EDITORIAL",'720 × 430. Quote, body, credit.'),("SEAGULLOTINE CAPTION",'720 × 220. Compact sidebar voice.')]),
('DROP-ZONE MODULES',[(a[0].replace('_',' ').upper(),f'{a[1]} × {a[2]} SVG viewBox; dashed safe area; [[CONTENT]] binding.') for a in [('full_width',720,240),('two_column',350,300),('sidebar',240,420),('puzzle_square',420,420),('photo',520,320),('ad_slot',320,140)]])]
for pnum,(title,items) in enumerate(pages,2):
    bg(c); header(c,'THE UNDERGROUND PRESS',title,pnum)
    cols=2; cw=270; ch=118; start=560
    for i,(t,b) in enumerate(items):
        x=30+(i%2)*282; y=start-(i//2)*132; card(c,x,y,cw,ch,t,b,RED if i%3==0 else GREEN)
    c.setFillColor(HexColor(INK)); c.setFont('Helvetica',7); c.drawString(30,42,'Master path: assets_svg/ • Green bracketed text is editable content • SVG artwork remains vector')
    c.showPage()

bg(c); header(c,'PRODUCTION HANDOFF','ASSEMBLY & CHECKLIST',8)
checks=[('1. CHOOSE MODULE','Start with a measured drop zone; do not draw the content first.'),('2. BIND CONTENT','Replace bracketed tokens from JSON or with live text.'),('3. PLACE ART','Keep illustration separate from reader-facing copy.'),('4. VERIFY SCALE','Minimum rules 0.75 pt; body 7.5 pt at final size.'),('5. PREFLIGHT','Embed or outline fonts only in the press copy; retain editable masters.'),('6. EXPORT','PDF/X-ready workflow at vendor stage; keep source SVG and JSON together.')]
for i,(t,b) in enumerate(checks): card(c,30,570-i*86,552,70,t,b,RED if i%2==0 else GREEN)
c.save()

zip_path=ROOT/'outputs'/'underground_press_component_library_v1.zip'
if zip_path.exists(): zip_path.unlink()
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED) as z:
    for p in PACK.rglob('*'):
        if p.is_file(): z.write(p,p.relative_to(PACK.parent))
print(PACK)
print(pdf)
print(zip_path)
