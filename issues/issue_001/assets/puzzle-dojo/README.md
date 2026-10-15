# Issue #1 Puzzle Dojo canonical assets

These are the canonical immutable puzzle source assets for Issue #1. The approved Crossword, Sudoku, and Pizza Cipher were extracted on 2026-08-06 from page 1 of the validated vector production PDF `source_pages_8_9.pdf` (SHA-256 `3e2e2daec656621c7fb5990c5e4f9fcd69b4886bd54fe003e395aff8754a7aab`). The canonical Neighborhood Search was created from the locked Issue #1 brief and its machine-readable placement data lives beside the SVG.

## Extraction method

PyMuPDF 1.28.2 applied fixed crop rectangles in the PDF's native 792 × 1224 point, top-left coordinate system and exported the published vector display list with text converted to paths. No OCR, redrawing, regeneration, correction, reflow, or puzzle-content editing was performed.

| Asset | Crop `(x0, y0, x1, y1)` pt | SHA-256 |
| --- | --- | --- |
| `crossword.svg` | `(22, 107, 490, 490)` | `a38e947c768cc280d1f24d71fa70da34b1defc19b440aae7796d7dcfbb68bb9f` |
| `crossword-clues.svg` | `(22, 490, 490, 664)` | `1a6a3db6d9d171033dd86747ab96222c844e565d0fe048aae85d3f0407b7de51` |
| `sudoku.svg` | `(498, 107, 770, 430)` | `0e9adf56396e614b17ee1a7a977093c805b82f3ad95ed30dc3a088c3b898f375` |
| `pizza-cipher.svg` | `(22, 675, 389, 817)` | `aeb98f3d6f6ddf2f390899bb71f528329adb205907854fdedcd28e074d2b07a1` |
| `neighborhood-search.svg` | Canonical 15x15 generated source | `608b80cf0a1ee043c97b627657b48a450640b04540f145e2a3cd50d1a784696d` |

The permanent Big Four are Crossword, Neighborhood Search, Pizza Cipher, and Sudoku. `brain-bender.svg` remains preserved in this directory as a reusable bonus puzzle, but it is not an Issue #1 production slot.

SVG hashes are calculated with line endings normalized to LF so the same approved vector bytes validate on every checkout platform. Treat any other hash change as a new editorial revision requiring validation. The compositor may link and scale these files according to the layout contract but must never rewrite them.

