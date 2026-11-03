# Issue #1 puzzle assets, v2 typeset (PROPOSED, not adopted)

Re-typeset copies of the five Issue #1 puzzle assets in the Puzzle Dojo fonts (Bangers headers, Bebas Neue digits and cipher letters, PT Sans Narrow clues, PT Serif body). They sit **beside** the locked originals one folder up. The originals, their hashes and `validation_manifest.json` are untouched, and nothing in the production proof, layout contract or validators points here unless the v2 assets map is used.

## How v2 was made
The originals are PDF extractions whose lettering is outline glyphs, each tagged with its character (`data-text`). `templates/puzzle-dojo/typeset-v2/typeset_v2.py` drops those outlines and sets the same characters as live text at the same baselines and positions. Every other element (grid lines, black squares, backgrounds, images) is copied byte-for-byte. Neighborhood Search is hand-structured SVG, so its faces are swapped in place and each grid letter keeps its original x/y pitch.

## Proof
`python templates/puzzle-dojo/typeset-v2/verify_v2.py` (exit 0 required):
- each locked original still matches its recorded SHA-256;
- v2 text equals the original's tagged glyphs, run for run;
- all non-text elements of each original appear unchanged, in order, in v2;
- Neighborhood Search's 15x15 grid and 16 words equal `neighborhood-search.json`.

It fails if one character is changed (tested).

## Adopting v2 (needs HQ approval)
Adopting v2 for Issue #1 is a new editorial revision under the immutability rule: HQ approves, the v2 hashes are recorded, `assets.golden.json` is pointed at `v2/`, and the layout contract and manifest are updated in one reviewed change. Until then the proof built from `assets.golden.v2type.json` (`*_v2type.svg`) is for review only.
