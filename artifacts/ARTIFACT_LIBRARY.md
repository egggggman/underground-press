# Artifact Library

## Purpose

The Artifact Library is the permanent source and archive for keepsakes created for rare Underground Press Special Editions. An artifact extends the story of its edition beyond the newspaper: it gives readers something meaningful to display, play, build, learn from, collect, or share.

Artifacts are exclusive editorial keepsakes, not promotional giveaways. They must be created for a specific Special Edition, reinforce that edition's reason for existing, and feel like a thank-you to the community. They must never be generic merchandise, an advertisement, or a routine incentive attached to a regular issue.

Special Editions are earned by events, milestones, or stories that change the neighborhood's shared history. They are not holiday issues and must remain rare enough that both the edition and its artifact feel exceptional.

## Artifact principles

Every artifact must fulfill at least one principle. Strong concepts often fulfill several.

- **Display:** Worth placing on a wall, notebook, shelf, or community board.
- **Play:** Creates a satisfying game, puzzle, activity, or moment of discovery.
- **Build:** Invites the reader to fold, assemble, customize, or make something.
- **Learn:** Preserves useful knowledge, local history, craft, or context.
- **Collect:** Rewards keeping and revisiting without manufactured scarcity or pressure.
- **Share:** Encourages a generous exchange, group experience, or community connection.

## Library structure

- `stickers/` - die-cut, kiss-cut, or printable sticker sources
- `pogs/` - collectible milk-cap designs and print specifications
- `postcards/` - single cards and connected postcard sets
- `blueprints/` - diagrams, invention plans, and illustrated how-to sheets
- `printable-models/` - cut-and-assemble paper models
- `origami/` - folding diagrams and printable sheets
- `maps/` - fold-outs, routes, historical maps, and illustrated guides
- `bonus-puzzles/` - edition-exclusive puzzles and answer material
- `digital/` - digital-first artifacts and downloadable companion packages

Create a dedicated folder within the relevant category for each approved artifact. If an artifact spans categories, choose its primary reader experience and cross-reference it in the manifest rather than duplicating source files.

## Creation standards

1. Start with a written connection to the Special Edition's editorial theme and name the primary artifact principle.
2. Give the artifact an edition-specific identity; avoid interchangeable logos, generic slogans, and sponsor-led concepts.
3. Match the publication's 1991, handmade, Portland-neighborhood character while keeping instructions, folds, cuts, clues, and safety notes legible.
4. Separate editable source files, production-ready exports, proofs, and reader downloads.
5. Use only original, licensed, or properly documented material. Record required credits and usage restrictions in the artifact manifest.
6. Design physical artifacts for their actual trim size, stock, finish, color mode, bleed, safe area, and production method.
7. Make digital artifacts accessible, durable, and useful without unnecessary accounts, tracking, or expiring services.
8. For QR-delivered artifacts, print a human-readable destination or retrieval note alongside the code and preserve the downloadable file in this repository.

## Required artifact record

Each artifact folder must include a `README.md` manifest containing:

- artifact title and unique ID;
- Special Edition title and issue ID;
- status: `concept`, `approved`, `production`, `released`, or `retired`;
- primary and secondary artifact principles;
- editorial purpose and intended reader experience;
- creator, reviewer, credits, and rights notes;
- dimensions, materials, finishes, or digital requirements;
- source, proof, production, and download filenames;
- semantic version and release date;
- production vendor or delivery notes when applicable;
- QA results and approval record;
- related URLs, QR destination, and recovery plan when applicable.

## Archival and versioning rules

- Use a stable ID in the form `SE-YYYY-NN-TYPE-NNN`, such as `SE-1992-01-MAP-001`.
- Name versioned deliverables `<artifact-id>_<short-name>_vMAJOR.MINOR.PATCH.<ext>`.
- Increment **MAJOR** for a format, size, construction, or gameplay change; **MINOR** for compatible content or design revisions; and **PATCH** for corrections that do not change the intended experience.
- Never overwrite a released file. Add a new version and preserve the released version with its manifest and proof.
- Treat the final released package as an immutable record after publication. Corrections require a new version and a manifest note explaining the change.
- Keep editable sources, linked assets, fonts/rights notes, production exports, proofs, and reader-facing downloads together in the artifact folder using clearly named subfolders when needed.
- Record external delivery URLs, but never rely on them as the sole archive.

## Production workflow

1. **Commission:** Editorial approves the Special Edition, artifact concept, purpose, category, audience, and owner.
2. **Plan:** Create the artifact folder and manifest; document specifications, budget, schedule, rights, accessibility needs, and delivery method.
3. **Prototype:** Produce a full-scale physical mock-up or test the complete digital experience on representative devices.
4. **Editorial review:** Confirm thematic relevance, voice, accuracy, credits, and alignment with the six principles.
5. **Production review:** Preflight dimensions, bleeds, color, resolution, construction, file packaging, QR behavior, and vendor requirements.
6. **Proof:** Review a physical proof or release-candidate download using the QA checklist. Record defects and approvals in the manifest.
7. **Release:** Lock the approved version, generate production and reader packages, and verify that the issue points to the correct artifact.
8. **Archive:** Preserve sources, proofs, final files, manifest, approvals, and recovery information as the immutable release record.

## QA checklist

- [ ] The artifact belongs specifically to its Special Edition and is not promotional filler.
- [ ] At least one of Display, Play, Build, Learn, Collect, or Share is clearly fulfilled.
- [ ] Copy, facts, credits, instructions, puzzle logic, and answers have been reviewed.
- [ ] Copyright, licensing, privacy, and safety requirements are documented.
- [ ] Physical dimensions, trim, bleed, safe area, stock, finish, and color are correct where applicable.
- [ ] A full-size prototype has been assembled, folded, cut, played, or otherwise tested where applicable.
- [ ] Digital files open on representative devices and use durable, accessible formats.
- [ ] QR codes scan from a printed proof at intended size and contrast; a recovery path is documented.
- [ ] Filenames, artifact ID, version, manifest, and edition references agree.
- [ ] Source, production, proof, and reader-facing files are complete and separated clearly.
- [ ] The released package contains no temporary files, hidden personal data, or undocumented dependencies.
- [ ] Editorial and production approvals are recorded before release.

## Future expansion

Add a new top-level category only when multiple approved artifacts share a distinct production method or reader experience that cannot fit an existing category. Define its scope here before use, add category-specific QA requirements, and preserve the stable IDs and manifest requirements above.

New formats should deepen the Special Edition experience rather than increase release frequency. Emerging digital formats must include an archival export or documented migration path. Partnerships may support production, but editorial ownership and the artifact's non-promotional character are non-negotiable.
