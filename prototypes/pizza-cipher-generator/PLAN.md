# Pizza Cipher generator: prototype plan (phase 1)

Status: plan for HQ review. Nothing here changes Issue #1, the locked puzzle files, or the Puzzle Grinder (PR #18).

## Goal
One verified, reproducible Pizza Cipher, produced by code instead of by hand. Weekly production comes only after this passes.

## What is known
- Issue #1's `pizza-cipher.svg` is hash-locked (`aeb98f3d...`) and stays untouched. Its text is not machine-readable (about 5.8 MB of embedded artwork, no `<text>`), so its phrase and key are not recoverable from the repo.
- Cipher Corner on page 9 teaches a Caesar shift of three, keeping spaces ("S → P, K → H").
- The generator therefore makes new puzzles (Issue #2 onward). It does not regenerate Issue #1. If HQ wants Issue #1's plaintext on record, someone supplies it.

## Deliverables
1. `puzzle_spec.json`: issue, puzzle id, plaintext phrase, shift (default 3), theme tag, source note (who wrote the phrase; city-beat link if any).
2. `pizza_cipher.py`: deterministic. Same spec gives byte-identical SVG, solution JSON and proof. No clock, no randomness (or a recorded seed).
3. Outputs per puzzle: `pizza-cipher.svg` (puzzle sheet in the Puzzle Dojo panel size, 367 x 142 to match the locked asset), `solution.json` (plaintext, ciphertext, shift, SHA-256 of each output), `proof.md` (human-readable: the rule, letter-by-letter table, decoded phrase).
4. `validate_pizza_cipher.py` (stdlib only):
   - decode(encode(plaintext)) equals plaintext for every shift in the spec;
   - the ciphertext on the sheet equals the encoder output, read back from the SVG text;
   - phrase is uppercase A-Z plus spaces and basic punctuation, and fits the panel without clipping (line-length and width check);
   - no word of the plaintext is unchanged by the cipher (shift is not 0 or 26);
   - output hashes match `solution.json`; running the generator twice gives identical bytes.
5. `tests/test_pizza_cipher.py`: unit tests for encode/decode, wraparound (X, Y, Z), spaces and punctuation kept, hash stability.

## Rules for the first prototype
- Shift of three, matching Cipher Corner.
- Phrase is short (under 40 characters), original, and clearly in the paper's voice. HQ approves the phrase before it is locked.
- SVG is generated text with the embedded subset fonts already used in the repo; no external files.
- Once approved, the sheet and `solution.json` are hash-locked like the Issue #1 puzzles (added to the puzzle manifest by a deliberate, reviewed change).

## Out of scope (later phases)
- Phase 2: phrase intake and a queue; other cipher types (Atbash, keyword); crossword/sudoku generation.
- Phase 3: an issue builder that composes a weekly spread from locked puzzles and the ad assignments file.
- Any change to the Puzzle Grinder or to PR #18.

## Acceptance for phase 1
- Validator and tests pass locally and in CI (own workflow path filter, so unrelated PRs are not blocked).
- Proof reviewed by a human who decodes the phrase by hand from the sheet.
- Two clean runs produce identical hashes.

## Open questions for HQ
1. Phrase for the first prototype: supplied by HQ, or should Claude propose three to choose from?
2. Should Issue #1's cipher plaintext be recorded so its answer key exists (answers return in Issue #2)?
3. Keep the 367 x 142 panel size, or allow a larger sheet for longer phrases?
