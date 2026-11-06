"""Original vector spot art for Issue 001 editorial pages (generic objects only, no characters).

Same ink-outlined flat-colour style as the Puzzle Dojo comic props. Every function returns an
inline <svg> string sized in pt so it can sit in HTML flow or be absolutely positioned."""
from __future__ import annotations

INK, RED, GREEN, PAPER, CREAM, MUSTARD = "#171812", "#8c2118", "#1f4d36", "#ecdcb0", "#f4e8c6", "#d9a441"
SW = 2.2


def svg(w, h, body, vb=None, style=""):
    vb = vb or f"0 0 {w} {h}"
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}pt" height="{h}pt" viewBox="{vb}" style="overflow:visible;{style}">{body}</svg>'


def lantern(w=34, rot=0):
    b = (f'<g transform="rotate({rot} 20 30)"><path d="M13 9 Q20 -3 27 9" fill="none" stroke="{INK}" stroke-width="2.4"/>'
         f'<rect x="12" y="8" width="16" height="5" rx="1.5" fill="#3b3d42" stroke="{INK}" stroke-width="{SW}"/>'
         f'<path d="M12 13 H28 L31 44 H9 Z" fill="#f3c648" stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round"/>'
         f'<path d="M20 18 C25 25 25 33 20 39 C15 33 15 25 20 18Z" fill="#fff3b0" stroke="{INK}" stroke-width="1.4"/>'
         f'<path d="M14 15 L12 42 M26 15 L28 42" stroke="{INK}" stroke-width="1.4"/>'
         f'<rect x="8" y="44" width="24" height="5" rx="1.5" fill="#3b3d42" stroke="{INK}" stroke-width="{SW}"/></g>')
    return svg(w, w * 1.45, b, "0 -4 40 58")


def bell(w=34, rot=0):
    b = (f'<g transform="rotate({rot} 20 8)"><circle cx="20" cy="6" r="3.2" fill="#b5b8bf" stroke="{INK}" stroke-width="{SW}"/>'
         f'<path d="M20 9 C9 9 9 26 6 33 H34 C31 26 31 9 20 9Z" fill="{MUSTARD}" stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round"/>'
         f'<path d="M14 15 C12 20 12 26 11 30" fill="none" stroke="#fff3c8" stroke-width="2" stroke-linecap="round"/>'
         f'<circle cx="20" cy="38" r="3.6" fill="#6b4a22" stroke="{INK}" stroke-width="{SW}"/>'
         f'<path d="M3 20 Q0 24 3 28 M37 20 Q40 24 37 28" fill="none" stroke="{INK}" stroke-width="1.6" stroke-linecap="round"/></g>')
    return svg(w, w * 1.2, b, "-2 0 44 46")


def cloud(w=40, drizzle=True):
    b = (f'<path d="M10 26 C2 26 2 14 11 14 C12 5 26 4 29 12 C38 10 42 22 34 26 Z" fill="#dfe3e8" stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round"/>'
         f'<path d="M14 21 q4 -3 8 -1" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>')
    if drizzle:
        b += "".join(f'<path d="M{x} 30 l-2 6" stroke="#3f6fa0" stroke-width="2.4" stroke-linecap="round"/>' for x in (13, 21, 29))
    return svg(w, w * .95, b, "0 0 44 40")


def crate(w=36):
    b = (f'<path d="M3 12 H37 V36 H3 Z" fill="#c98a3a" stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round"/>'
         f'<path d="M3 20 H37 M3 28 H37 M12 12 V36 M28 12 V36" stroke="{INK}" stroke-width="1.4"/>'
         f'<path d="M6 12 L10 5 H30 L34 12" fill="#e0b070" stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round"/>')
    return svg(w, w * .9, b, "0 2 40 38")


def pencil(w=60, rot=-20):
    b = (f'<g transform="rotate({rot} 30 8)"><rect x="8" y="2" width="42" height="12" fill="#e4572e" stroke="{INK}" stroke-width="{SW}"/>'
         f'<path d="M50 2 L62 8 L50 14 Z" fill="#f3d9a4" stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round"/>'
         f'<path d="M57 6 L62 8 L57 10 Z" fill="{INK}"/><rect x="2" y="2" width="8" height="12" rx="2" fill="#e8858f" stroke="{INK}" stroke-width="{SW}"/>'
         f'<rect x="10" y="2" width="3" height="12" fill="#c9c9c9" stroke="{INK}" stroke-width="1"/></g>')
    return svg(w, w * .45, b, "-4 -12 70 36")


def pin(color=RED, r=4):
    return f'<circle r="{r}" fill="{color}" stroke="{INK}" stroke-width="1.6"/><circle cx="{-r*.3}" cy="{-r*.3}" r="{r*.3}" fill="#fff" opacity=".7"/>'


def latch(x, y, rot=0):
    return (f'<g transform="translate({x} {y}) rotate({rot})"><rect x="-16" y="-6" width="32" height="12" rx="2" fill="#9a9ca3" stroke="{INK}" stroke-width="{SW}"/>'
            f'<path d="M-10 -2 L4 -2 Q11 -2 11 5 L11 14" fill="none" stroke="#585b62" stroke-width="3.4" stroke-linecap="round"/>'
            f'<circle cx="-11" cy="0" r="2" fill="{INK}"/><circle cx="12" cy="0" r="2" fill="{INK}"/></g>')


def mud_marks(x, y):
    return "".join(f'<ellipse cx="{x + dx}" cy="{y + dy}" rx="6" ry="3.4" fill="#5a3f26" stroke="{INK}" stroke-width="1.2" transform="rotate({r} {x + dx} {y + dy})"/>'
                   for dx, dy, r in ((0, 0, -12), (14, 7, 8), (28, 1, -4)))


def shadow_figures(x, y, n, scale=1.0, color="#2a2b2f"):
    out = ""
    for i in range(n):
        cx = x + i * 15 * scale
        out += (f'<g transform="translate({cx:.1f} {y}) scale({scale})"><circle cx="0" cy="-17" r="4.6" fill="{color}" stroke="{INK}" stroke-width="1.2"/>'
                f'<path d="M-6 -11 H6 L8 6 H3 L2 18 H-2 L-3 6 H-8 Z" fill="{color}" stroke="{INK}" stroke-width="1.2" stroke-linejoin="round"/></g>')
    return out


def cloth_strip(x, y, rot=-10):
    return (f'<g transform="translate({x} {y}) rotate({rot})"><path d="M-22 -5 Q-8 -9 6 -4 T26 -2 L24 7 Q8 11 -6 6 T-24 4 Z" fill="#3a3c42" stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round"/>'
            f'<path d="M-16 -1 q8 -3 16 0 M-12 3 q8 -3 16 0" stroke="#5b5e66" stroke-width="1.2" fill="none"/>'
            f'<circle cx="-20" cy="-1" r="2.6" fill="#c9c9c9" stroke="{INK}" stroke-width="1.4"/></g>')


def evidence_board(w=470, h=300):
    """Corkboard with three evidence tags, built only from facts in the Page 3 copy."""
    tag_w, tag_h = 130, 138
    xs = [22, 170, 318]
    labels = [("WATERFRONT", "SERVICE DOOR", "REPORTED"), ("GREEN-LAMP", "APPROACH", "DISPUTED COUNT"), ("DELIVERY", "TURN", "FOUND ITEM")]
    cork = ('<defs><filter id="cork" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7"/>'
            '<feColorMatrix values="0 0 0 0 .45  0 0 0 0 .3  0 0 0 0 .15  0 0 0 .55 0"/><feComposite in2="SourceGraphic" operator="in"/></filter></defs>')
    b = (cork + f'<rect x="3" y="3" width="{w-6}" height="{h-6}" rx="6" fill="#b98a55" stroke="{INK}" stroke-width="5"/>'
         f'<rect x="3" y="3" width="{w-6}" height="{h-6}" rx="6" fill="#b98a55" filter="url(#cork)"/>'
         f'<rect x="3" y="3" width="{w-6}" height="{h-6}" rx="6" fill="none" stroke="#6b4a22" stroke-width="3" opacity=".6"/>')
    # red string through the three pins, with a question mark between the cards
    oy = -14 if h >= 280 else max((h - 200) / 2 - 10, 0)
    pins = [(xs[i] + tag_w / 2, 38 + oy) for i in range(3)]
    b += f'<path d="M{pins[0][0]} {pins[0][1]} Q{(pins[0][0]+pins[1][0])/2} {62+oy} {pins[1][0]} {pins[1][1]} Q{(pins[1][0]+pins[2][0])/2} {62+oy} {pins[2][0]} {pins[2][1]}" fill="none" stroke="{RED}" stroke-width="2.6" stroke-dasharray="7 4"/>'
    for i, (lx, ly) in enumerate(labels and zip(xs, [0, 0, 0])):
        x0 = xs[i]
        top = 30 + oy + (i % 2) * 6
        b += (f'<g transform="rotate({(-2.2, 1.6, -1.2)[i]} {x0 + tag_w/2} {top + tag_h/2})">'
              f'<rect x="{x0+3}" y="{top+4}" width="{tag_w}" height="{tag_h}" fill="#000" opacity=".28"/>'
              f'<rect x="{x0}" y="{top}" width="{tag_w}" height="{tag_h}" fill="#f4e8c6" stroke="{INK}" stroke-width="{SW}"/>'
              f'<rect x="{x0}" y="{top}" width="{tag_w}" height="22" fill="{(RED, GREEN, INK)[i]}" stroke="{INK}" stroke-width="{SW}"/>'
              f'<text x="{x0+tag_w/2}" y="{top+15}" text-anchor="middle" font-family="\'Bebas Neue\',sans-serif" font-size="14" letter-spacing="1" fill="#fff8df">{labels[i][2]}</text>'
              f'<text x="{x0+tag_w/2}" y="{top+42}" text-anchor="middle" font-family="Bangers,sans-serif" font-size="17" fill="{INK}">{labels[i][0]}</text>'
              f'<text x="{x0+tag_w/2}" y="{top+59}" text-anchor="middle" font-family="Bangers,sans-serif" font-size="17" fill="{INK}">{labels[i][1]}</text>')
        cx, cy = x0 + tag_w / 2, top + 100
        if i == 0:
            b += latch(cx - 18, cy - 8, -8) + mud_marks(cx - 26, cy + 22)
        elif i == 1:
            b += shadow_figures(cx - 38, cy + 6, 4, 1.05) + f'<text x="{cx-8}" y="{cy-22}" font-family="Bangers" font-size="22" fill="{RED}">4?</text><text x="{cx+34}" y="{cy-22}" font-family="Bangers" font-size="22" fill="{GREEN}">1?</text>' + shadow_figures(cx + 38, cy + 6, 1, 1.05, "#44464c")
        else:
            b += cloth_strip(cx, cy, -8) + f'<circle cx="{cx+22}" cy="{cy-8}" r="3" fill="#c9c9c9" stroke="{INK}" stroke-width="1.4"/>'
        b += f'<g transform="translate({x0+tag_w/2} {top+1})">{pin(RED if i != 1 else "#2f7a3a", 5)}</g></g>'
    if h >= 280:
        my = 172
        b += f'<rect x="18" y="{my}" width="{w-36}" height="{h-my-16}" fill="#f4e8c6" stroke="{INK}" stroke-width="{SW}"/>'
        b += f'<rect x="18" y="{my}" width="{w-36}" height="18" fill="{INK}"/><text x="{w/2}" y="{my+13}" text-anchor="middle" font-family="\'Bebas Neue\',sans-serif" font-size="12.5" letter-spacing="1.5" fill="#fff8df">BELOW-STREET APPROACHES</text>'
        ny = my + 62
        nx = [80, w/2, w-80]
        names = ["WATERFRONT SERVICE DOOR", "GREEN-LAMP APPROACH", "DELIVERY TURN"]
        notes = ["2 SETS OF STEPS", "4 SHADOWS? 1 RUNNER?", "CLOTH ON A SCREW"]
        b += f'<path d="M{nx[0]+14} {ny} L{nx[1]-14} {ny} M{nx[1]+14} {ny} L{nx[2]-14} {ny}" stroke="{INK}" stroke-width="2.2" stroke-dasharray="3 6" fill="none"/>'
        for i,x in enumerate(nx):
            b += f'<circle cx="{x}" cy="{ny}" r="10" fill="{(RED,GREEN,INK)[i]}" stroke="{INK}" stroke-width="{SW}"/><text x="{x}" y="{ny+4.5}" text-anchor="middle" font-family="Bangers" font-size="13" fill="#fff8df">{i+1}</text>'
            b += f'<text x="{x}" y="{ny+26}" text-anchor="middle" font-family="\'Bebas Neue\',sans-serif" font-size="12" letter-spacing=".8" fill="{INK}">{names[i]}</text>'
            b += f'<text x="{x}" y="{ny-18}" text-anchor="middle" font-family="\'PT Sans Narrow\',sans-serif" font-weight="bold" font-size="10.5" fill="{RED}">{notes[i]}</text>'
        b += f'<text x="{(nx[0]+nx[1])/2}" y="{ny-5}" text-anchor="middle" font-family="Bangers" font-size="17" fill="{RED}">?</text><text x="{(nx[1]+nx[2])/2}" y="{ny-5}" text-anchor="middle" font-family="Bangers" font-size="17" fill="{RED}">?</text>'
        for x in [22, 170, 318]:
            b += f'<rect x="{x+48}" y="{30+oy-9}" width="34" height="14" fill="#e9d9ab" opacity=".85" stroke="{INK}" stroke-width="1" transform="rotate(-4 {x+65} {30+oy})"/>'
    if h < 280: b += (f'<g transform="translate({w-150} {h-40}) rotate(-6)"><rect x="-4" y="-6" width="126" height="26" fill="{MUSTARD}" stroke="{INK}" stroke-width="{SW}"/>'
          f'<text x="59" y="13" text-anchor="middle" font-family="Bangers" font-size="17" fill="{INK}">UNCONFIRMED</text></g>')
    return svg(w, h, b)
