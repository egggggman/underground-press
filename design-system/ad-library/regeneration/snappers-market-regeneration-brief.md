# The Snapper's Market: regeneration brief (candidate replacement master)

Status: **needed, not yet produced.** HQ (2026-11-02) rejected the v3 cleanup as final art; it stays as a documented experiment (`revisions/snappers-market-v3-lettering.png`), not in the approved library. The approved sheet remains the source of truth. The regenerated ad is a candidate replacement that needs visual approval before promotion.

Claude's workspace has no image-generation model, so this brief is for whoever regenerates it (the ad was originally made with ChatGPT image generation).

## This is a restoration, not a redesign
HQ (2026-11-03): the next master is a faithful regeneration of the approved Snapper's Market advertisement. Only the lettering, border defects and resolution are corrected. Do not redesign the business. Two attempts have already been rejected for doing so (`candidates/snappers-market-alt-turtle.png`: turtle grocer, new copy; `rejected/snappers-market-attempt-nyc-2026-11-03.png`: one lobster, New York, invented copy, TMNT logo).

## Reference images (attach all three; the approved panel is the primary reference)
1. **Primary:** `approved_v2/snappers-market-v2.png`, the approved Snapper's panel as a tight crop. Match its composition, characters, colors and style.
2. `approved_sheets/five_new_ads_approved_sheet.png`, bottom-middle panel (the same design in context).
3. `revisions/snappers-market-v3-lettering.png` (shows the defects and the partial fix; do not copy its M).

## Keep (do not change)
- Character and composition: two red lobster grocers in white chef hats, the left holding a wooden crate of produce, the right waving a raised claw; harbor lighthouse and skyline strip at lower right; white banner across the bottom.
- Colors, 1991 gritty newspaper-ad print texture, cream aged paper, red/white checkerboard border, heavy black outlines.
- Copy, exactly (straight apostrophe, no extra words): **The Snapper's Market** / FRESH PRODUCE / GROCERIES / COLD DRINKS / LOCAL GOODS / **GOOD FOOD FOR PORTLAND PEOPLE.**

## Do NOT (explicit exclusions)
- No New York imagery (no NYC skyline, bridge, "New York" copy). The setting is Portland, Maine.
- No TMNT trademark lettering or logo, and no manhole-cover logo.
- No new advertising copy, slogans, speech bubbles or taglines. Only the copy listed above, exactly.
- Do not replace or reduce the two lobster grocers; do not swap in a turtle or any other character.
- No "TM" marks, no comic-cover framing, no new scene elements.
- Keep the red/white checkerboard border and the white bottom banner.

## Fix
- "The Snapper's Market" fully legible: every letter complete, the "M" of "Market" a clean letterform in the same brush-script weight, nothing smearing across the chef hat or the letters.
- Lettering must not overlap the checker border: leave clear paper between the title and the border squares.
- Keep the Portland lighthouse and skyline strip, the product list, and the bottom banner "GOOD FOOD FOR PORTLAND PEOPLE." exactly as in the approved panel.
- Single advertisement only: full plaque with its own border, no neighbouring panels, no dark gutter, no sheet edge.

## Deliverable spec (see `PRINT_RESOLUTION.md`)
- Lossless PNG, sRGB, about **2,400 x 2,500 px** (near-square, same aspect as the approved panel, about 0.96), at least 2,120 x 2,200 px.
- Full plaque including border; nothing cropped.
- Send back the untouched original output file (no upscaling, recompression or editing) so its SHA-256 can be recorded.

## After it arrives
Claude will hash it, check dimensions and copy against this brief, place it in `candidates/` (not `approved/`), and return a side-by-side with the approved panel. Promotion needs HQ visual approval.
