# Puzzle Board v0.1

Puzzle Board proves that immutable puzzle content can be placed into several
newspaper geometries without editing the puzzle. It does not redesign Puzzle
Dojo Pages 8–9 and deliberately contains no Underground Press styling.

The contract is intentionally small: puzzle structure and canonical source
identity, plus mode dimensions, padding, header allowance, minimum writable cell
size, rule weights, and an open/boxed boundary. The renderer calculates a square
cell grid from that structure and configuration. It rejects a board whose cells
would fall below 14 points instead of silently shrinking it.

The canonical SVG is an opaque data layer guarded by its normalized SHA-256.
The contract records the canonical vector grid bounds; the renderer maps and
clips that square grid uniformly into the calculated board grid. A transparent,
deterministic coordinate map therefore coincides with every printed cell without
altering givens, answers, crossword numbering, clues, or source files. Theme and
newspaper personality belong to a future host module outside this renderer.

Run `python tools/puzzle_board.py` to regenerate the six mode proofs and their
combined `proof-sheet.svg`. Compact, standard, and feature modes are physically
viable for both current puzzles.

Minimum calculated cell sizes:

| Puzzle | Compact | Standard | Feature |
| --- | ---: | ---: | ---: |
| Sudoku | 26.00 pt | 35.33 pt | 48.00 pt |
| Crossword | 15.60 pt | 21.20 pt | 28.80 pt |

PR #16 remains the preserved evidence of the prior page-layout approach; this
prototype neither incorporates nor rewrites those page artifacts.
