# Ad art prompts (painted art for the ad library)

The vector drawings in `ad_library.py` are stand-ins. For Seagullotine-level detail, generate one painted illustration per ad in your image tool and drop the files in the issue's art folder; the ads pick them up automatically.

## Where files go

`issues/issue_001/assets/puzzle-dojo/ad-art/<ad-id>.png` (for example `myrtle-suds.png`). Then rebuild:

```
python ad_library.py <chef art> components --rotation ads_rotation.issue_001.json --art-dir ../../../issues/issue_001/assets/puzzle-dojo/ad-art
```

Any ad without a file keeps its vector motif, so you can swap them in one at a time. Paper-coloured background is knocked out automatically, so the art sits straight on the newsprint.

## Rules for every image

- Landscape 3:2 (1536 x 1024 works), subject centred with clear margin all round.
- Plain flat cream paper background, no border, no frame, no vignette.
- No text, lettering, logos or numbers anywhere in the image (the ad adds its own type).
- Attach the Seagullotine (`issues/issue_001/assets/puzzle-dojo/art/seagullotine-issue-001.png`) as the style reference.

## Style prompt (paste first, then the subject line)

> Gritty 1991 newspaper-ad illustration of a single subject, in the same style as the reference image: dense black ink linework with cross-hatching and halftone stipple shading, hand-inked contours, slightly grotesque expressive character, limited flat spot colour (oxblood red, forest green, mustard yellow, charcoal black) over cream paper, worn print texture, tiny ink specks. Portland, Maine waterfront mood, 1991. Subject centred on a plain flat cream background. No text, no lettering, no border.

## Subjects

| Ad id | Business | Subject line |
|---|---|---|
| `crust-bucket` | The Crust Bucket | A mustached cook in a chef hat grinning, holding a whole pizza on a tray (already painted: keep the Tony's cook, or regenerate to match). |
| `tonys-donuts` | Tony's Donuts | A pile of three frosted, sprinkled donuts beside a steaming diner mug, one donut with a bite missing. |
| `myrtle-suds` | Myrtle St. Suds | A front-loading washing machine with a sock stuck in the round window, soap bubbles floating up, a wrinkled cat asleep on top. |
| `foghorn-tapes` | Foghorn Tapes | A cassette tape with its ribbon spilling out in a loop, beside a stack of 45 records and a small boombox. |
| `harbor-lantern` | Harbor Lantern Hardware | A striped lighthouse beam sweeping over a toolbox, coil of rope and a hammer in the foreground, a gull on the box. |
| `gull-ladle` | The Gull & Ladle | A big steaming chowder bowl with a ladle, a seagull eyeing it hungrily from the rim, oyster crackers scattered. |
| `cassiopeia-books` | Cassiopeia Books | A leaning stack of old books and rolled sea charts, an open atlas, a candle and a sleepy owl-faced cat on top. |
| `quality-cuts` | Quality Cuts | A barber pole with a pair of open scissors and a straight razor crossed in front, a mustached barber's grinning face behind. |
| `ferry-bait` | Ferry Fare Bait | A big grinning fish hanging off a hook above a coffee thermos and a bucket of wriggling worms. |
| `alice-alterations` | Alice's Alterations | A tailor's dummy half-draped in cloth, a giant needle and thread, a jar of buttons and a measuring tape curling around it. |
| `gull-taxi` | Seagull Cab Co. | A gull in a flat cap and trench coat at the wheel of a checkered cab, wings gripping the steering wheel, tail lights glowing. |

## Notes for the editor

- Business names, taglines and phone numbers are draft canon invented for the library; change them in `ADS` before print.
- If a generated image has a coloured or shaded background instead of flat cream, the knock-out will leave a halo. Regenerate with "plain flat cream paper background" or clean it up first.
