# The Snapper's Market: regeneration brief (candidate replacement master)

Status: **needed, not yet produced.** HQ (2026-11-02) rejected the v3 cleanup as final art; it stays as a documented experiment (`revisions/snappers-market-v3-lettering.png`), not in the approved library. The approved sheet remains the source of truth. The regenerated ad is a candidate replacement that needs visual approval before promotion.

Claude's workspace has no image-generation model, so this brief is for whoever regenerates it (the ad was originally made with ChatGPT image generation).

## Reference images (attach all three)
1. `approved_sheets/five_new_ads_approved_sheet.png`, bottom-middle panel (the approved design).
2. `approved_v2/snappers-market-v2.png` (the same panel, tight crop).
3. `revisions/snappers-market-v3-lettering.png` (shows the defects and the partial fix; do not copy its M).

## Keep (do not change)
- Character and composition: two red lobster grocers in white chef hats, the left holding a wooden crate of produce, the right waving a raised claw; harbor lighthouse and skyline strip at lower right; white banner across the bottom.
- Colors, 1991 gritty newspaper-ad print texture, cream aged paper, red/white checkerboard border, heavy black outlines.
- Copy, exactly (straight apostrophe, no extra words): **The Snapper's Market** / FRESH PRODUCE / GROCERIES / COLD DRINKS / LOCAL GOODS / **GOOD FOOD FOR PORTLAND PEOPLE.**

## Fix
- "The Snapper's Market" fully legible: every letter complete, the "M" of "Market" a clean letterform in the same brush-script weight, nothing smearing across the chef hat or the letters.
- Lettering must not overlap the checker border: leave clear paper between the title and the border squares.
- Single advertisement only: full plaque with its own border, no neighbouring panels, no dark gutter, no sheet edge.

## Deliverable spec (see `PRINT_RESOLUTION.md`)
- Lossless PNG, sRGB, about **2,400 x 2,500 px** (near-square, same aspect as the approved panel, about 0.96), at least 2,120 x 2,200 px.
- Full plaque including border; nothing cropped.
- Send back the untouched original output file (no upscaling, recompression or editing) so its SHA-256 can be recorded.

## After it arrives
Claude will hash it, check dimensions and copy against this brief, place it in `candidates/` (not `approved/`), and return a side-by-side with the approved panel. Promotion needs HQ visual approval.
