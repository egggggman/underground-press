# Puzzle Dojo Golden Skin

Dresses the Puzzle Dojo spread in the print look of the GOLDEN IMAGE (paper stock, grain, ink wear, condensed banners) without touching any hash-locked puzzle source or the v1 compositor.

## Layers

| Layer | Owner | File |
| --- | --- | --- |
| Puzzle data (grids, clues, givens, cipher text) | Puzzle setters | `issues/issue_NNN/assets/puzzle-dojo/*` (immutable) |
| Placement | v1 compositor | `../v1/compose.py` |
| Page furniture (banners, footers, scorecard) | Generated per issue | `build_components.py` + an issue furniture JSON |
| Paper, grain, ink wear | Golden skin | `compose_golden.py` |

## Per-issue build

```text
python templates/puzzle-dojo/golden-skin/build_components.py templates/puzzle-dojo/golden-skin/issue_001_furniture.json templates/puzzle-dojo/golden-skin/components
python templates/puzzle-dojo/golden-skin/compose_golden.py templates/puzzle-dojo/golden-skin/assets.golden.json proofs/puzzle-dojo-golden.svg --seed 1991
python templates/puzzle-dojo/golden-skin/render.py proofs/puzzle-dojo-golden.svg proofs/puzzle-dojo-golden --scale 2
```

For a new issue: copy `issue_001_furniture.json`, copy `assets.golden.json` and repoint the puzzle and art entries at the new issue's assets, and change `--seed` so the paper stock differs each week.

## Ads

Ads come from the approved art library (`design-system/ad-library/`). `ad_slots.py` places them without touching the art:

```
python build_ads.py components                                    # Sewer Cap card (our own vector art)
python ad_slots.py ad_assignments.issue_NNN.json components       # big ad slot + two mini slots
python compose_golden.py assets.golden.json out.svg --seed N      # --ad-treatment faithful (default) | print
```

The approved PNGs are embedded byte-for-byte and fitted proportionally inside a framed mat (no stretching or cropping). Two assets have no lettering, so the slot adds only the business name in that business's own font. `--ad-treatment faithful` puts the art on top of every skin layer so colours are exactly as approved; `print` lets the paper grain sit over it like the rest of the page. Pick ads per issue in the assignments file (`slots`); `pool` lists everything available to rotate. Fonts for the name lines are embedded subsets of open (SIL OFL) typefaces, licences in `fonts/`.

## Layout contract v1.2

`layout_contract.golden.json` keeps every v1 zone ID and adds `scorecard`. Page 8 is re-packed so the page has no dead space: crossword and sudoku side by side, full-width clues (kept at legible size), then Pizza Cipher beside Neighborhood Search, then tip, Seagullotine quote and a compact scorecard. The validator checks that all v1 zone IDs exist, every zone is inside the page and no zones overlap.

## Notes

- The skin applies a multiply blend to the page content, so white puzzle cells take the paper tone. No source file is edited; check `validate_puzzle_dojo.py` for the v1 hash locks.
- Banner and footer text is width-locked with `textLength`, so layout holds whichever condensed face the operator has installed (Impact, Haettenschweiler, Arial Narrow).
- Chromium rasterizes the filters. Review PNG proofs at 100% before sending to press.
