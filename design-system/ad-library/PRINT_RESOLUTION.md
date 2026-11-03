# Print resolution requirements for ad art

Status: **print approval blocked** for the five 2026-11-02 ads. The current crops are for digital proofs only.

## Placement sizes (page 792 x 1224 pt = 11 x 17 in; golden skin)

| Slot | Cell | Art area (after pad) | Source |
|---|---|---|---|
| Large ad (page 9) | 476 x 280 pt | 460 x 264 pt (6.39 x 3.67 in) | `ad_slots.py` `cell(..., pad=8)` |
| Mini ad (two-up) | 260 x 120 pt each | 248 x 108 pt (3.44 x 1.50 in) | `ad_slots.py` `cell(..., pad=6)` |

Art is fitted proportionally (never stretched or cropped), so the printed size depends on the ad's aspect ratio.

## What the current files give

| Ad (v2 tight crop) | px | Large slot: printed / effective ppi | Mini slot: printed / effective ppi |
|---|---|---|---|
| Portland Pipe & Drain Co. | 772 x 481 | 5.88 x 3.67 in / 131 | 2.41 x 1.50 in / 321 |
| Coastal Byte Computers | 734 x 478 | 5.63 x 3.67 in / 130 | 2.30 x 1.50 in / 319 |
| Maine Comics & Collectibles | 500 x 521 | 3.52 x 3.67 in / 142 | 1.44 x 1.50 in / 347 |
| The Snapper's Market | 502 x 522 | 3.53 x 3.67 in / 142 | 1.44 x 1.50 in / 348 |
| Brine & Grinder Records | 506 x 522 | 3.55 x 3.67 in / 142 | 1.45 x 1.50 in / 348 |
| First-handoff ads (1536 x 1024) | 1536 x 1024 | 5.50 x 3.67 in / 279 | 2.25 x 1.50 in / 683 |

## Minimum masters

- Target **300 ppi** at placed size; never accept below **200 ppi** for line art with small lettering.
- Large slot at 300 ppi: **about 1,770 x 1,100 px** for wide ads (Portland, Coastal Byte); **about 1,060 x 1,100 px** for the near-square ads (Maine Comics, Snapper's, Brine & Grinder), which also leave wide matte in the large slot and fit the mini slot better.
- Mini slot at 300 ppi: **about 725 x 450 px** (wide) or **about 435 x 450 px** (square). The v2 crops already meet this, so a mini placement is the safest print use today, still pending the other gates.
- Recommended safe master: **2x the larger figure** (about 3,600 x 2,200 px wide, 2,200 x 2,200 px square) so later layout changes do not force another regeneration.
- Format: lossless PNG (or TIFF), sRGB, the full plaque including its border, no neighbouring-panel pixels, no gutter, with the lettering unchanged from the approved art.
- Masters must be regenerated or re-drawn from the approved composition, not up-sampled: upscaling the current crops does not add detail.
- The Snapper's Market master must be produced from corrected lettering (see `lettering_revision` in `ad_library.json`).
