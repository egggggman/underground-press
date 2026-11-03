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

## Ad library and rotation

`ad_library.py` holds a dozen local-business ads as data (`ADS`). Each keeps its own lettering and art (slab, diner script, stencil, blackletter, deco...) but shares the paper's frame: ink border, dashed accent rule, paper dots, house palette and an ADVERTISEMENT footer. Every ad renders in two sizes: `big` (476 x 280) and `mini` (236 x 104).

Per issue, copy `ads_rotation.issue_001.json` and pick which ads run: one `big`, two `mini`. Then:

```
python build_ads.py <chef art> components            # sewer cap
python ad_library.py <chef art> components --rotation ads_rotation.issue_NNN.json
```

This writes `components/ads/*` (the whole library) plus `components/crust-bucket.svg` and `components/mini-ads.svg` (the two slots `assets.golden.json` points at). To add an ad, add an entry to `ADS` with its fonts, panel colour, motif and copy. Business names in the library are drafts and need editorial sign-off. Fonts are embedded subsets of open (SIL OFL) typefaces, licences in `fonts/`.

## Layout contract v1.2

`layout_contract.golden.json` keeps every v1 zone ID and adds `scorecard`. Page 8 is re-packed so the page has no dead space: crossword and sudoku side by side, full-width clues (kept at legible size), then Pizza Cipher beside Neighborhood Search, then tip, Seagullotine quote and a compact scorecard. The validator checks that all v1 zone IDs exist, every zone is inside the page and no zones overlap.

## Notes

- The skin applies a multiply blend to the page content, so white puzzle cells take the paper tone. No source file is edited; check `validate_puzzle_dojo.py` for the v1 hash locks.
- Banner and footer text is width-locked with `textLength`, so layout holds whichever condensed face the operator has installed (Impact, Haettenschweiler, Arial Narrow).
- Chromium rasterizes the filters. Review PNG proofs at 100% before sending to press.
