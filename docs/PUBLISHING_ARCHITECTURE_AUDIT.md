# Underground Press — Publishing Architecture & Source-of-Truth Audit

**Status:** Proposed documentation for editorial review (not a new canon decision)  
**Scope:** Repository `main` as inspected 2026-11-03  
**Purpose:** Document the *existing* system, separate implemented reproducibility from planned production, and identify the smallest path to a source-built Issue 001.

## 1. Existing authority and boundaries

| Concern | Existing repository authority | Observed state |
| --- | --- | --- |
| Locked decisions | `docs/DECISIONS.md`, `docs/CANON.md` | Portland setting, Sliding Time, canon-by-publication and publication preservation are recorded; do not silently amend. |
| World and businesses | `world/WORLD_BIBLE.md`, `world/businesses/`, `docs/BUSINESS_BIBLE.md` | World Bible expressly governs continuity unless superseded by a later locked decision. |
| Editorial voice and visual language | `docs/NEWSROOM_CHARTER.md`, `docs/STYLE_BIBLE.md`, golden image under `design-system/references/` | Golden image is a protected visual reference, not a literal source for Portland story content. |
| Reusable editorial data | `content/*/inventory.json` | Committed inventories are described in `README.md` as publication source of truth. `tools/build_editorial_inventory.py` checks drift by default and writes only with `--write`. |
| Reusable layout | `design-system/`, `templates/puzzle-dojo/v1/` | Design tokens, SVG components, page furniture, editable Puzzle Dojo master and layout contract exist. |
| Advertisements and artwork | `ads/`, `art/`, `sewer-caps/` | Reusable source assets are separated from the issue-specific material in `issues/issue_001/`. |
| Issue material | `issues/issue_001/` | Issue 001 has an issue tree and a production-linked Puzzle Dojo Pages 8–9 spread. This is **not** evidence of a complete Volume 1 newspaper build. |
| Puzzle data | `puzzles/`, `issues/issue_001/assets/puzzle-dojo/` | Puzzle source and validation manifest are distinct from layout placement. |
| Validation | `tools/validate_repo.py`, `tools/validate_editorial_inventory.py`, `tools/validate_puzzle_dojo.py`, tests, `.github/workflows/puzzle-grinder-validation.yml` | Local repository-wide validation entry point exists. The checked workflow is path-filtered and conditionally runs Puzzle Grinder checks; it is not proof of a complete newspaper release pipeline. |
| Production decisions and status | `docs/DECISIONS.md`, `docs/ROADMAP.md` | Editable SVG sources and untracked generated exports are established. Full issue assembly and vendor print pipeline are still listed as planned work. |

**No parallel inventory, canon register, asset directory or issue manifest is introduced by this audit.** Where documents express overlapping authority, keep their explicit hierarchy rather than silently choosing a replacement.

## 2. Present build and validation contracts

From a clean clone with an appropriate Python installation, the repository documents:

```sh
python tools/validate_repo.py
python tools/validate_editorial_inventory.py
python tools/validate_puzzle_dojo.py
```

The first command already invokes the editorial-inventory and Puzzle Dojo validators and checks JSON, SVG/XML, inventory drift, references, hygiene and other repository contracts. The latter two commands are useful focused diagnostics, not a separate independent publication pipeline.

Issue 001 Puzzle Dojo composition is documented as:

```sh
python templates/puzzle-dojo/v1/compose.py issues/issue_001/assets/puzzle-dojo/composition.json issues/issue_001/production/puzzle-dojo/issue_001_pages_8_9.svg
python tools/validate_puzzle_dojo.py
```

The compositor uses approved linked assets and writes a JSON sidecar with source paths/hashes. The tracked production-linked Puzzle Dojo spread is a **component-level production artifact**, not a proven complete-issue export. Generated proofs are normally ignored; historical publication snapshots require explicit editorial release decisions.

**Audit limitation:** This is repository source inspection; a fresh-clone build, visual proof, press-quality check, and machine-independent reproducibility comparison have **not** been executed or certified by this document.

## 3. Source → composition → publication lifecycle

1. **Propose:** Draft copy, character, business, ad or puzzle content in its existing owned directory; label candidate vs accepted status.
2. **Editorial approval:** Check `docs/CANON.md`, the World Bible and applicable design/puzzle authorities. Record accepted continuity or changed policy through the existing decision and canon records. Appearance in an ad or draft is **not** automatic canon.
3. **Compose:** Reuse design-system components and issue-specific composition data. Keep editorial content and mutable characters separate from reusable page templates.
4. **Validate:** Run the existing repository validator, focused validators and any relevant tests. Review visual layout, textual completeness, asset licensing and print suitability separately.
5. **Proof:** Preserve a reviewable issue proof and evidence of editorial acceptance through the established issue production workflow. Do not equate valid SVG/XML with press approval.
6. **Publish/archive:** Create an explicitly approved immutable issue milestone with recoverable committed source identity and production artifacts or their documented retention location. Append corrections; do not overwrite published history.

This sequence is a proposed clarification of existing repository conventions; it does not claim that a complete end-to-end Issue 001 build/release command currently exists.

## 4. Proposed governance clarification for approval

- Accepted lore, artwork, editorial policy, and production specifications must be durable in this GitHub repository; chat messages and uncommitted local files are working context, not authoritative records.
- Reuse `content/*/inventory.json`, `docs/DECISIONS.md`, `docs/CANON.md`, `world/`, `design-system/` and `issues/` rather than creating competing systems.
- An issue's content and characters must be changeable independently of its reusable page template.
- Preserve accepted assets, working prototypes, issue proofs and published snapshots; do not overwrite historical work in place.
- Reproducibility means an independent clean checkout can validate and build a specified issue from pinned source with documented tools; **this requirement is a target, not yet verified for all of Volume 1**.
- Fictional businesses, character identities, relationships, and locations do not enter locked canon without editorial approval. Existing locked canon remains authoritative.

**Approval gate:** These governance clarifications should be accepted through normal review and then recorded as a numbered decision in `docs/DECISIONS.md`. This audit alone does not lock new policy.

## 5. Volume 1 as the acceptance test

The first meaningful production milestone is not another architecture document. It is a reproducible **Issue 001/Volume 1 assembly** from committed source.

Before declaring the system complete, establish and demonstrate:

- A single documented issue composition manifest specifying content and approved assets.
- A complete issue build command (not only Puzzle Dojo Pages 8–9).
- Deterministic source identity and output verification on a separate clean checkout.
- Editorial/canon validation, visual proof and physical print preflight.
- Explicitly approved release snapshot and corrections procedure.

Keep these as gaps to close in the **existing** `issues/issue_001/`, `scripts/`, and `docs/ROADMAP.md` workstreams. Do not move the established folders or rewrite approved artwork as part of architecture work.

## 6. Audit verdict and next change

**Existing architecture: useful and partially reproducible. Full newspaper release pipeline: not yet demonstrated.**

Review this map, approve or revise the governance clarification, then work on the smallest missing part of the Issue 001 composition/release path. No canon, art, puzzles, issue proofs, publication status, or template sources are changed by this audit.
