# Issue #1 Puzzle Dojo production spread

This directory contains the production-linked Pages 8-9 SVG and its compositor sidecar. The spread uses Puzzle Dojo master contract v1 and the immutable compositor; source puzzles remain external, hash-locked assets.

## Final page architecture

Page 8 is the solving workbench. It holds the approved Crossword and clues, Sudoku, Pizza Cipher, and Neighborhood Search, followed by a Puzzle Tip and Seagullotine quote. Page 9 is the department back page: approved advertisement art, Sewer Cap #001, Puzzle Bench, Cipher Corner, Seagullotine art, two mini advertisements, a labeled Portland memory fragment, and the Last Issue Solutions module.

The permanent Big Four are **Crossword, Neighborhood Search, Pizza Cipher, and Sudoku**. The Issue #1 Neighborhood Search is a canonical 15x15 grid for “Welcome to Portland Beneath Portland”; its JSON records every straight-line placement and the marked-cell hidden message `FOUNDYOURWAY`. Brain Bender remains preserved as a reusable bonus puzzle outside the Issue #1 production composition.

## Visual language

Reusable department components use warm newsprint, sewer green, oxblood, clipped-paper geometry, stamps, dashed coupon rules, a coffee ring, and pencil-note language. These details implement Lived-In Design without entering puzzle grids or clue fields. The linked compositor uses `xMidYMid meet`, never crops, and never rewrites a source.

## Build

```text
python templates/puzzle-dojo/v1/compose.py issues/issue_001/assets/puzzle-dojo/composition.json issues/issue_001/production/puzzle-dojo/issue_001_pages_8_9.svg
python tools/validate_puzzle_dojo.py
```

Generated output is deterministic apart from absolute paths recorded in the JSON sidecar. Review the SVG with all linked assets available at their repository-relative paths.
