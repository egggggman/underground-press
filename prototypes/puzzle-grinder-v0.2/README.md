# Puzzle Grinder v0.2 — Big Four Completion Gate

Puzzle Grinder is the official successor to the preserved **Puzzle Board v0.1**
architecture.

Puzzle Board v0.1 remains historical evidence in
`prototypes/puzzle-board-v0.1/` and is not renamed or rewritten. Puzzle Grinder
inherits its central separation:

> Puzzle data owns the puzzle. Puzzle Grinder owns geometry and legibility.
> The Underground Press owns theme and personality.

## v0.2 scope

The v0.2 gate is intentionally narrow:

1. Carry forward Crossword and Sudoku without changing canonical puzzle data.
2. Add Neighborhood Search to the programmable geometry layer.
3. Add Pizza Cipher to the programmable geometry layer.
4. Preserve all five immutable Puzzle Dojo source hashes recorded by the Issue
   #1 validation manifest.
5. Preserve Neighborhood Search's canonical 15×15 data, all 16 placements,
   dispersed marked cells, and hidden answer `FOUNDYOURWAY`.
6. Generate deterministic compact, standard, and feature proofs for all four
   Big Four puzzle types where the geometry is mechanically meaningful.
7. Reject layouts that violate puzzle-specific legibility or writable-area
   requirements instead of silently shrinking them.
8. Do not rebuild Issue #1 Pages 8–9 in this sprint.
9. Do not add Underground Press visual styling to the Grinder.
10. Add new architecture only when Neighborhood Search or Pizza Cipher
    demonstrates a requirement that Puzzle Board v0.1 cannot represent.

## Exit gate

Puzzle Grinder v0.2 is complete when all Big Four can be rendered from their
canonical sources/data through one documented programmable geometry contract,
with deterministic proofs and repository validation passing.

After that gate, puzzle-infrastructure work stops and the project advances to
**Issue #1 Prototype 0.1 assembly**.
