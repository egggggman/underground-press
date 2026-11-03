# Underground Press — Advertising Artwork Register (2026-11-02)

Status: **Creative approval recorded; binary asset import pending.** This register documents decisions made during the Issue 001 advertising-artwork review. It does **not** imply the PNGs have been committed, printed, or placed into the Replit application.

## Approved artwork roster

| Filename in Claude handoff | Business | Accepted direction |
| --- | --- | --- |
| tonys-donuts.png | Tony's Donuts | Frosted donuts and diner coffee |
| myrtle-suds.png | Myrtle St. Suds | Laundry identity; cat adapted to Myrtle photo reference |
| foghorn-tapes.png | Foghorn Tapes | Distinctive large logo and tagline instead of cassette still life |
| harbor-heights-hardware.png | Harbor Heights Hardware | Gritty pirate identity; renamed from Harbor Lantern Hardware |
| gull-ladle.png | The Gull & Ladle | Bolder, simpler art; “home of the 1 dollar whoopie” and “best soup du jour” |
| cassiopeia-books.png | Cassiopeia Books | Book-cover design, Portland skyline reference |
| quality-cuts.png | Quality Cuts | Simple barber pole and comb logo |
| deez-bait.png | Deez Bait | Chum-bucket identity; renamed from Ferry Fare Bait |
| deez-bait-coupon.png | Deez Bait coupon | Tear-off coupon: “BUY 2, GET NONE FREE!” |
| alice-alterations.png | Alice's Alterations | Whimsical older woman with tiny bifocals, struggling to thread split thread |
| gull-taxi.png | Seagull Cab Co. | Corrected classic taxi proportions, seagull cabbie smoking a cigarette |
| crust-bucket.png | The Crust Bucket | Anthropomorphic pizza-crust bucket, arcade machines, SNES/16-bit pixel-art styling; motto “Any Pizza is Good Pizza!” |

**Count:** 11 businesses, 12 approved image assets including coupon. Approval refers to creative direction and selected image versions, **not** print preflight.

## Style and continuity

Primary visual reference: `design-system/references/the-underground-press-golden-image.png`. Additional references: `issues/issue_001/assets/puzzle-dojo/art/seagullotine-issue-001.png` and `issues/issue_001/assets/puzzle-dojo/art/tonys-pizza-issue-001.png`. These references are historical style references, not permission to import the noncanonical NYC text in example artwork.

Shared visual language: worn 1991 newspaper advertising, expressive inked characters, aged cream paper, strong black outlines, selective red/green/mustard accents and distressed printing. The Crust Bucket intentionally diverges with 16-bit arcade pixel art.

Portland, Maine is the canonical setting. Do not copy NYC addresses, transit systems, phone numbers, or dates from historical reference art into new issue copy.

## Handoff and preservation rules

The conversation handoff archive is named `Underground_Press_Approved_Ads_Claude_Handoff.zip`. It includes `approved_artwork/`, `previous_versions/`, `style_references/`, and `documentation/` with a manifest, checksums and Claude instructions. **This ZIP is currently a separate handoff artifact, not a tracked repository file.**

- Import each approved PNG without recompression or silent regeneration.
- Keep previous versions separately and never overwrite the accepted assets.
- Record source filename, SHA-256, dimensions, approval, placement, and print-preflight status.
- Do not replace Page 1 locked content or change Puzzle Dojo pages 8–9 during ad import.
- Newspaper placement, bleed, trim, legibility and human proofing remain outstanding.
- Any newly invented advertisers or changed canonical business identities require editorial/canon review.

## Next integration gate

1. Import the 12 approved PNGs and the archive's full documentation to a review branch or Replit asset library.
2. Verify each PNG against `documentation/ASSET_MANIFEST.csv` checksums.
3. Confirm layout references and page lock integrity.
4. Request editorial approval and print proofs before promoting to production.

**Authority:** Underground Press art/editorial working record. No automatic merge, production approval, or change to the frozen newspaper front page.
