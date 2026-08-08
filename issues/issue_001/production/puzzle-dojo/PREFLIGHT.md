# Puzzle Dojo preflight checklist

## Content lock

- [x] Crossword grid and clue art match recorded SHA-256 hashes.
- [x] Sudoku givens match the recorded SHA-256 hash.
- [x] Pizza Cipher text matches the recorded SHA-256 hash.
- [x] Neighborhood Search grid, placements, marked cells, and recorded SHA-256 hash validate.
- [x] No puzzle source was regenerated, embedded, cropped, stretched, or rewritten.

## Layout and modules

- [x] Every required contract zone is supplied.
- [x] Crossword, clues, Sudoku, Pizza Cipher, and Neighborhood Search remain in reader-solving space.
- [x] Puzzle Bench, Puzzle Tip, Cipher Corner, Seagullotine quote, Last Issue Solutions, collectible, ads, and Portland memory are present.
- [x] Today's Training presents the permanent Big Four as a completion ritual without entering any solving area.
- [x] Decorative additions are reusable SVG components where appropriate.
- [x] Editorial modules do not overlap puzzle data zones.
- [x] Page numbers and Issue #1 banners are present on both pages.

## Press checks

- [x] All JSON files parse.
- [x] All production and component SVG files parse as XML.
- [x] Contract rectangles stay inside the 11 x 17 inch page bounds.
- [x] Compositor reports zero missing required zones.
- [x] Every linked placement uses contain scaling (`xMidYMid meet`).
- [x] Proof and sidecar zone lists match the composition map.
- [ ] Print operator: open the linked SVG with repository paths intact and inspect both pages at 100%.
- [ ] Print operator: confirm minimum puzzle type size and line weight on the intended newsprint stock.
- [x] Editorial: permanent Big Four locked as Crossword, Neighborhood Search, Pizza Cipher, and Sudoku; Brain Bender preserved as a reusable bonus puzzle.
