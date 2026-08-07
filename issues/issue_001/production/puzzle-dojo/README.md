# Issue #1 Puzzle Dojo production spread

This directory contains the production-linked Pages 8-9 SVG and its compositor sidecar. The spread uses Puzzle Dojo master contract v1 and the immutable compositor; source puzzles remain external, hash-locked assets.

## Final page architecture

Page 8 is the solving workbench. It holds the approved Crossword and clues, Sudoku, Pizza Cipher, and Brain Bender, followed by a Puzzle Tip and Seagullotine quote. Page 9 is the department back page: approved advertisement art, Sewer Cap #001, Puzzle Bench, Cipher Corner, Seagullotine art, two mini advertisements, a labeled Portland memory fragment, and the Last Issue Solutions module.

The composition deliberately preserves the approved Issue #1 puzzle set. The locked source set contains **Brain Bender**, not a Word Search; substituting or inventing a Word Search would violate the immutable-data requirement. Pizza Cipher is the issue's cryptoquip-style cipher. This source-of-truth distinction is recorded here so later production does not silently relabel or regenerate puzzle content.

## Visual language

Reusable department components use warm newsprint, sewer green, oxblood, clipped-paper geometry, stamps, dashed coupon rules, a coffee ring, and pencil-note language. These details implement Found Object Collage and Living Hands without entering puzzle grids or clue fields. The linked compositor uses `xMidYMid meet`, never crops, and never rewrites a source.

## Build

```text
python templates/puzzle-dojo/v1/compose.py issues/issue_001/assets/puzzle-dojo/composition.json issues/issue_001/production/puzzle-dojo/issue_001_pages_8_9.svg
python tools/validate_puzzle_dojo.py
```

Generated output is deterministic apart from absolute paths recorded in the JSON sidecar. Review the SVG with all linked assets available at their repository-relative paths.
