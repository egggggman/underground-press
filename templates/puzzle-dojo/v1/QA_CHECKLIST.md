# Puzzle Dojo v1 QA checklist

## Source integrity

- [ ] Asset map points to the editorially approved Issue source files.
- [ ] Crossword grid and clue artwork are separate, complete, and internally consistent.
- [ ] Sudoku givens, Pizza Cipher text, and Neighborhood Search grid match their approved sources.
- [ ] Neighborhood Search words use straight horizontal, vertical, or diagonal paths, including reverse placements; its marked cells spell `FOUNDYOURWAY` in reading order.
- [ ] No answer key, solution layer, or hidden answer text appears in the reader-facing assets.
- [ ] Compositor sidecar SHA-256 values match an independent preflight hash.
- [ ] `git status --ignored` shows generated proofs under an ignored path.

## Layout contract

- [ ] Output is two 792 × 1224 pt pages (11 × 17 inches each), ordered pages 8 then 9.
- [ ] Every required zone in `layout_contract.json` is populated exactly once.
- [ ] All assets use contain placement with their original aspect ratio.
- [ ] No puzzle is cropped, stretched, reflowed, rasterized, or upscaled.
- [ ] Crossword grid, clues, and all small-print instructions remain legible at final size.
- [ ] Page furniture stays inside the 18 pt safe margin; bleed-sensitive art extends only by editorial instruction.

## Components and editorial review

- [ ] The Crust Bucket, Portland Sewer Cap, Puzzle Desk, and Seagullotine resolve to manifest component IDs.
- [ ] Issue banner, footer, page numbers, issue date, and department name are correct.
- [ ] Page 9 optional furniture has an editorial purpose or is deliberately left empty.
- [ ] Spot colors and type follow `design-system/tokens/design_tokens.json`.
- [ ] A human solver checks every puzzle from the final placed proof.
- [ ] A second editor confirms clues, instructions, credits, provenance, and answer-release language.
- [ ] Lived-In Design details remain outside solving areas and do not obscure puzzle data.

## Export gate

- [ ] Linked source files travel with the production package.
- [ ] Fonts and image resolution pass press preflight.
- [ ] The final export has no debug outlines, bracketed placeholders, or broken links.
- [ ] Only an explicitly approved lightweight reference is tracked; print PDFs and routine proofs remain ignored.

## Stop conditions

Do not publish if any source hash changes during composition, if content must be cropped to fit, if an answer is exposed, or if the final proof has not been solved independently. Escalate these cases to the Puzzle Desk editor; they are editorial decisions, not compositor fixes.
