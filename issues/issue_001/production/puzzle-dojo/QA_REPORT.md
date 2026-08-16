# Puzzle Dojo final production QA

## Release state

**BETA.** Digital production gates pass. A real 100%-scale paper-and-pencil play test has not been performed, so the physical gate remains open and the validator forbids promotion to RELEASE CANDIDATE.

## Canonical Big Four freeze

Puzzle presentation links the immutable source files and never embeds, crops, stretches, reflows, regenerates, or rewrites them.

| Canonical puzzle source | Normalized SHA-256 |
| --- | --- |
| `crossword.svg` | `a38e947c768cc280d1f24d71fa70da34b1defc19b440aae7796d7dcfbb68bb9f` |
| `crossword-clues.svg` | `1a6a3db6d9d171033dd86747ab96222c844e565d0fe048aae85d3f0407b7de51` |
| `neighborhood-search.svg` | `608b80cf0a1ee043c97b627657b48a450640b04540f145e2a3cd50d1a784696d` |
| `pizza-cipher.svg` | `aeb98f3d6f6ddf2f390899bb71f528329adb205907854fdedcd28e074d2b07a1` |
| `sudoku.svg` | `0e9adf56396e614b17ee1a7a977093c805b82f3ad95ed30dc3a088c3b898f375` |

The Neighborhood Search machine data validates as a 15 x 15 grid. All 16 words follow straight horizontal, vertical, or diagonal paths (including reverse paths). The 12 marked cells span 11 distinct rows and 9 distinct columns and spell `FOUNDYOURWAY` in recorded reading order.

## Cover-the-puzzles test

**Page 8: PASS.** Covering the Crossword grid and clues, Sudoku, Pizza Cipher, and Neighborhood Search still leaves a full department masthead and folio, a three-module right news rail (Puzzle Desk brief, neighborhood notice, and harbor-weather oddity), the Hidden Shuriken secondary game, Puzzle Tip, Seagullotine quotation, newsprint texture, spot-color rules, and the issue footer. The remaining material has hierarchy, local utility, humor, and a second-look discovery independent of solving.

**Page 9: PASS.** Page 9 contains no Big Four solving geometry. It independently carries The Crust Bucket advertisement/coupon, Sewer Cap No. 001, Puzzle Bench reader form, Cipher Corner, Portland-specific Seagullotine art, two established-business mini ads, a Portland memory fragment, answer-release business, masthead, and folio. It reads as an Underground Press department page without Page 8.

## Golden Image and locked Page One comparison

**PASS - same publication and press run, not an identical layout.** Compared with the publication Golden Image (`d424a2885e763f6bd42e84603004b039931b9576df667eeb720bd996b95f39d9`) and exact locked Issue #1 Page One benchmark (`07d4e8332880a23b947d49ea4ea813ae558f4ada220529d63e5d37cd5bc43691`).

- Density and hierarchy: condensed black display heads, modular rules, a dominant Page 8 Crossword, and a balanced Page 9 ad/collectible lead.
- Spot color: oxblood, sewer green, mustard, black, and warm paper behave consistently across furniture and modules.
- Typography and press character: condensed display, editorial serif, utility sans/monospace, paper grain, halftone dots, coupon perforation, stamps, and uneven clipped geometry.
- Humor and Portland identity: harbor weather, east-stair notice, Portland Beneath Portland, the local memory fragment, Sewer Cap No. 001, and established businesses.
- Second-look discoveries: Hidden Shuriken, coffee ring, clipped-answer language, marginal utility copy, collectible sewer cap, and reader fields.
- Canon correction: the inherited non-Portland Seagullotine image was removed from the production composition and replaced by Portland-specific art. The historical asset remains preserved as evidence but is no longer linked into the production spread.

## 100%-scale physical QA gate

The print-ready proof is two pages, each exactly 792 x 1224 pt (11 x 17 inches). Digital inspection shows no clipping or overlap, and all puzzle source placements use `xMidYMid meet`. This does **not** substitute for a physical test.

Print with scaling set to **100% / Actual Size**, duplex disabled for the test, and all printer “fit” options off. On intended stock, complete and initial every item:

- [ ] Confirm trim is 11 x 17 inches and the 18 pt safe margin is present on all sides.
- [ ] Fold or simulate the intended gutter; confirm no grid, clue, instruction, or writing line enters fold risk.
- [ ] Crossword: solve representative across/down entries; confirm cell size, numbering, black-square contrast, clue size, and pencil legibility.
- [ ] Neighborhood Search: circle at least four directions including a reverse diagonal; confirm every letter and word-list entry is comfortable to read and the marked cells remain subtle.
- [ ] Pizza Cipher: decode the complete phrase; confirm instruction size, coded text, and writing rules provide comfortable space.
- [ ] Sudoku: enter candidates and final digits in corner/center positions; confirm cell size, givens, 3 x 3 rules, and pencil contrast.
- [ ] Inspect minimum type, line weights, spot-color contrast, ink fill, registration, clipping, and paper show-through under actual lighting.
- [ ] Have a second editor solve all four puzzles from the printed production PDF and compare against the canonical answers.
- [ ] Record printer, stock, date, operator, defects, and any presentation-only corrections.
- [ ] Set `physical_print_play_gate.passed` to `true` only after the signed test passes; then and only then promote to RELEASE CANDIDATE.

## Genuine editor decision

After the physical test, the Puzzle Desk editor must decide whether the printed clue type and the three secondary puzzle modules are comfortable on the selected newsprint stock. Any correction must remain presentation-only unless a separate editorial revision explicitly unlocks puzzle data.
