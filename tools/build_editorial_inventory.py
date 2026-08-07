import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def item(id_, type_, category, season, district, business, callback, **copy):
    return {
        "id": id_, "type": type_, "department": type_, "category": category,
        "season": season, "district": district, "related_business": business,
        "canon_impact": "none", "callback": callback, "status": "approved-inventory", **copy,
    }

def write(name, rows):
    path = ROOT / "content" / name / "inventory.json"
    path.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

classified_specs = [
 ("marketplace", "evergreen", "Pair of iron bookends, heavy enough to discourage even the most ambitious shelf. Scratched, sound, five dollars.", "Ask for June at the corner bulletin board."),
 ("marketplace", "winter", "Two wool blankets, one red and one nearly red. Clean, warm, and acquainted with long nights.", "Trade considered for a working thermos."),
 ("marketplace", "evergreen", "Milk crates wanted for record storage. No cracks, no mysteries stuck to the bottom.", "Leave word marked CRATES at the Press desk."),
 ("marketplace", "summer", "Box fan for sale. Three speeds; second speed sounds like a ferry leaving but works fine.", "Eight dollars or a fair offer."),
 ("marketplace", "evergreen", "Manual typewriter, ribbon faint but spirit willing. Includes hard case and one stubborn key.", "Sample typing available before purchase."),
 ("help-wanted", "evergreen", "Early riser needed to stack the morning edition before the kettles start whistling.", "Reliable hands more important than fast feet."),
 ("help-wanted", "winter", "Two shovelers wanted after the next honest snowfall. Cocoa and cash at job's end.", "Bring gloves and your own opinion about where snow belongs."),
 ("help-wanted", "summer", "Saturday counter help wanted. Must count change, wrap parcels, and ignore gull commentary.", "Apply in person after the lunch bell."),
 ("help-wanted", "autumn", "Leaf-raking crew seeks one more rake and the person attached to it.", "One afternoon; weather permitting."),
 ("help-wanted", "evergreen", "Careful reader wanted for handwritten club minutes. Penmanship patience required.", "Modest pay; tea supplied."),
 ("services", "evergreen", "Bicycle chains cleaned and tightened while you wait. No racing promises, just quieter pedaling.", "Rates posted on the workshop door."),
 ("services", "evergreen", "Buttons replaced, hems rescued, coat pockets restored to useful citizenship.", "Small jobs welcome."),
 ("services", "winter", "Radiator knocking translated. Most complaints solved with a wrench and respectful listening.", "Evening calls by arrangement."),
 ("services", "spring", "Window boxes repaired and lined before planting season.", "Scrap cedar accepted toward payment."),
 ("services", "evergreen", "Cassette tapes labeled in clear block letters. Mixtape judgment strictly withheld.", "Ten tapes minimum."),
 ("community", "evergreen", "Chess partner sought for slow Tuesday games. Beginners welcome; clocks are not.", "Meet beneath the green lamp at seven."),
 ("community", "summer", "Gardeners swapping tomato starts for herbs, jars, or reliable advice.", "No miracle claims, please."),
 ("community", "winter", "Soup-pot circle forming for neighbors who cook too much on Sundays.", "Bring a container and an ingredient list."),
 ("community", "evergreen", "Readers wanted for a paperback exchange: take one, leave one, return neither guiltily.", "Mysteries especially needed."),
 ("community", "autumn", "Neighborhood chorus seeks altos and anyone willing to stand near the altos.", "Thursday rehearsal; no audition."),
 ("lost-found", "evergreen", "FOUND: Brass key on blue string near a warm pipe. Describe the tag.", "Held at the Press counter for two weeks."),
 ("lost-found", "winter", "LOST: One green mitten, left hand, repaired thumb. Its partner is taking this badly.", "Reward: gratitude and a cinnamon roll."),
 ("lost-found", "evergreen", "FOUND: Shopping list containing onions, lamp oil, and 'the good crackers.'", "Owner may reclaim without explaining the crackers."),
 ("lost-found", "spring", "LOST: Folding umbrella with a wooden duck handle. Last seen resisting the wind.", "Please leave word with M. Bell."),
 ("lost-found", "evergreen", "FOUND: One domino, double-six, beside the west stair.", "Claim by naming the rest of the set."),
 ("oddities", "evergreen", "WANTED: Quiet clock that loses no more than five minutes a week and has no opinions at midnight.", "Cash or trade."),
 ("oddities", "evergreen", "FOR TRADE: Jar of smooth gray stones for a jar of less serious-looking stones.", "No geologists necessary."),
 ("oddities", "autumn", "Seeking the owner of a small wooden ladder found where no ladder was needed.", "It is safe and increasingly conspicuous."),
 ("oddities", "evergreen", "Collector buys matchbooks from closed diners, provided the stories are included free.", "Duplicates welcome if the story changes."),
 ("oddities", "spring", "WANTED: Waterproof notebook tested by someone who walks in real rain.", "Advertisements need not reply."),
 ("personals", "evergreen", "To the stranger who returned my bus fare: the coffee I promised remains promised.", "Friday, same bench, six o'clock."),
 ("personals", "winter", "Snow-day cribbage player seeks gracious winner or inventive loser.", "Pegboard supplied."),
 ("personals", "evergreen", "Night-shift reader seeks book recommendations shorter than the shift and better than the coffee.", "Notes may be left unsigned."),
 ("personals", "summer", "Harbor walker seeks company comfortable with long silences and sudden fog.", "Sunday mornings."),
 ("personals", "autumn", "Accordion beginner seeks patient neighbor or unusually tolerant walls.", "Lessons or soundproofing advice considered."),
 ("housing", "evergreen", "Small furnished room available above a quiet storeroom. Quietness not guaranteed on delivery day.", "References requested; cat negotiable."),
 ("housing", "winter", "House-sitter needed for three cold weekends. Duties include plants, pipes, and one suspicious fern.", "Heat and pantry privileges included."),
 ("housing", "spring", "Dry storage corner wanted for six boxes of books and no furniture.", "Month-to-month preferred."),
 ("housing", "evergreen", "Workshop bench to share with tidy repairer. Hand tools welcome; solvents are not.", "Daylight hours only."),
 ("housing", "summer", "Roommate sought for breezy third-floor walk-up. Must appreciate cross-ventilation and stairs.", "No smoking."),
 ("wanted", "evergreen", "Wanted: Back issues with intact weather corners. Smudges acceptable; missing pages are not.", "Fair price paid."),
 ("wanted", "summer", "Wanted: Folding chairs for a block supper. Matching is discouraged.", "Borrow or buy up to twelve."),
 ("wanted", "winter", "Wanted: Sled with honest runners. Paint and name unimportant.", "Will collect before the next storm."),
 ("wanted", "spring", "Wanted: Rhubarb crowns and practical planting advice.", "Can trade compost or jars."),
 ("wanted", "evergreen", "Wanted: A lamp bright enough for fine print and ugly enough to be affordable.", "Shade optional."),
 ("free", "evergreen", "FREE: Stack of clean jars with lids that mostly know where they belong.", "First careful carrier takes all."),
 ("free", "autumn", "FREE: Rake missing one tooth but not its work ethic.", "Beside the rear steps until dusk."),
 ("free", "spring", "FREE: Seed catalogues, clipped but still dangerously persuasive.", "Bundle tied with string."),
 ("free", "evergreen", "FREE: Piano stool, sturdy, spins farther than good sense recommends.", "Pickup requires two hands."),
 ("free", "winter", "FREE: Box of mismatched mugs for a meeting room or ambitious cupboard.", "No single-mug selection."),
]
classifieds = [item(f"CLS-{i:03}", "classified", c, s, None, None, False, copy=b, contact=n) for i,(c,s,b,n) in enumerate(classified_specs,1)]

ads_data = {
 "The Crust Bucket": [("Two-Slice Truce", "Two slices and a fountain drink at a price fit for a folded bill. Clip the coupon; settle topping disputes at the counter."),("Rainy-Night Pie", "When the bricks shine and nobody wants to cook, bring this ad for a rotating whole-pie offer."),("Last-Call Slice", "Late edition, hot slice, no speech required. Ask which tray just came out."),("Crew Supper", "Feeding four? The Crew Supper bundles a large pie, garlic knots, and enough napkins for optimism."),("Coupon Bucket", "This space changes every issue, but the promise stays put: a square deal, a hot pie, and a coupon worth clipping.")],
 "Quality Shop": [("The Italian", "The Shamos family stacks the Italian the neighborhood way: generous, careful, and wrapped tight enough for the walk home."),("Brown-Bag Lunch", "Bring this notice at midday for the rotating sandwich-and-drink lunch special."),("Counter Advice", "Not sure what you want? Tell the counter whether you're hungry or very hungry. The Shamos family will take it from there."),("Rain Check", "A wet day calls for a dry wrapper and an outstanding Italian sandwich. Umbrellas may drip by the door."),("Family Table", "Neighborhood institution, family counter, sandwiches made to be carried two blocks and remembered all afternoon.")],
 "Great Lost Bear": [("Ranch Forecast", "Tonight's outlook: a strong chance of legendary ranch with the weekly special."),("Weekly Chalkboard", "The special changes; the welcome does not. Check the chalkboard before choosing your usual anyway."),("After-Meeting Table", "Bring the minutes, lose the argument, order something for the table. Ranch strongly advised."),("Cold-Night Booth", "Warm booth, weekly special, and the sort of ranch people cross town to defend."),("Bear Necessities", "Good supper. Good company. Legendary ranch. The rest can wait until morning.")],
 "Tony's Donuts": [("First-Shift Dozen", "A rotating dozen for early crews, late crews, and anyone whose morning began before the sun agreed."),("Coffee Partner", "Pick the donut special; pour the coffee; let the day make its case."),("Weather Glaze", "Rain, snow, or harbor wind: the glaze stays cheerful. Ask for today's rotating special."),("Pink-Box Diplomacy", "Meetings improve when somebody arrives carrying a box that rustles."),("Early Edition", "Fresh donuts for ink-stained thumbs and breakfast tables. Today's special is posted at the counter.")],
}
ads=[]
for biz, rows in ads_data.items():
    for title, copy in rows:
        ads.append(item(f"ADV-{len(ads)+1:03}", "advertisement", "campaign-copy", "evergreen", None, biz, False, headline=title, copy=copy, offer_terms="Rotating offer; price and validity must be set for the issue.", placement_note="Interior modular ad; do not alter approved art masters."))

letters_specs = [
 ("Fog Is Not a Shortcut", "M. Dyer", "waterfront", "To the editor: If the end of the block has disappeared, that is not permission to bicycle faster. Bells are cheap. Bandages are not."),
 ("In Praise of the Late Counter", "A third-shift reader", None, "The warmest light in town is sometimes the one over a counter that has every right to be closed. Thank you to the people who keep it on."),
 ("The Case for Better String", "Nora P.", None, "Your bundle at the east drop came apart in my hands. The paper was excellent. The string had other plans. Please investigate."),
 ("Keep the Small Notices", "E. Walsh", None, "I read the front page first and the classifieds second. That is where you learn who needs a rake, who found a mitten, and whether the city still has neighbors."),
 ("A Quieter Tuesday", "Name withheld", "below-street", "Could the Tuesday drumming circle stop one song earlier? Some of us rise with the bakery carts. This is not a complaint about rhythm, only arithmetic."),
 ("Salt on the Steps", "C. Bell", None, "A cup of sand at the top of an icy stair is a small civic miracle. Whoever keeps filling ours: we notice, and we thank you."),
 ("Let the Gulls Lose", "P. Ames", "waterfront", "Please stop feeding gulls beside the lunch benches. They do not need encouragement, and they have begun to organize."),
 ("Library Pencil", "Ruth S.", None, "To whoever sharpened every pencil at the reading table: an unnecessary kindness is still a kindness."),
 ("On Ranch Portions", "A loyal skeptic", None, "The Great Lost Bear's ranch may indeed be legendary, but must every table discuss it at full volume? I concede the ranch. I dispute the volume."),
 ("Italian Sandwich Etiquette", "D. K.", None, "Quality Shop wraps an Italian for travel. That does not mean it should travel through a crowded meeting before being opened. Have mercy on the hungry."),
 ("The Bell Works", "Tuesday cyclist", None, "A reader complained about bicycle bells. Mine prevented a collision with a handcart last week. The bell is not rude. The bell is information."),
 ("Save the Stubs", "Mae L.", None, "Ticket stubs make fine bookmarks and better memories. Before sweeping them away after community nights, put out a jar for collectors."),
 ("Weather Corner Fan", "J. Pike", None, "Your weather notes tell me more than a row of numbers. 'Laundry will not forgive you' was exactly the forecast I needed."),
 ("No Shame in Decaf", "Anonymous before noon", None, "The breakfast crowd's treatment of decaf drinkers has become theatrical. Some of us enjoy warm cups without making a constitutional issue of it."),
 ("A Bench for Waiting", "Helen R.", None, "The transfer corner needs a bench, even a plain one. Waiting is part of transit and should not require balancing against a cold wall."),
 ("Correction Appreciated", "T. Moss", None, "Thank you for correcting the choir time without blaming the choir, the printer, or the moon. A plain correction builds trust."),
 ("Keep Scores in Pencil", "Former champion", None, "Tournament boards should be written in pencil until the last game ends. Ink has confidence. Pencil has experience."),
 ("Storm-Day Neighbors", "L. Green", None, "During the last hard weather, three people checked our basement drain before checking their own supper. That is the city I mean when I say home."),
 ("Coupon Clipping Is Reading", "A careful shopper", None, "My children say clipping coupons is not reading. It involves print, judgment, and scissors. I ask the editorial board to rule in my favor."),
 ("Leave One Light", "Night walker", "waterfront", "A single shop light after closing makes a wet street feel inhabited. I know electricity costs money. I also know what welcome looks like."),
]
letters=[item(f"LTR-{i:03}","letter","reader-mail","evergreen",d,None,False,headline=h,byline=a,body=b,editor_note="Identity and factual claims require issue-level verification before publication.") for i,(h,a,d,b) in enumerate(letters_specs,1)]

correction_specs = [
 ("meeting time", "The knitting circle was listed at 6 p.m.", "It begins at 7 p.m."), ("name spelling", "We printed the surname 'Morse.'", "The correct spelling is 'Moss.'"),
 ("photo caption", "A handcart was identified as a wheelbarrow.", "It is a handcart."), ("coupon day", "The offer was described as valid Tuesday.", "It is valid Thursday."),
 ("room number", "The repair clinic was listed in Room 3.", "It meets in Room 2."), ("score", "The final score was printed as 8–6.", "The final score was 8–5."),
 ("ingredient", "A calendar note said the supper was nut-free.", "Organizers advise that nuts may be present."), ("route direction", "The notice directed riders to the north stair.", "Riders should use the south stair."),
 ("business attribution", "A sandwich special was attributed to The Crust Bucket.", "The special belongs to Quality Shop."), ("weather unit", "Rainfall was printed in feet.", "The figure was measured in inches."),
 ("day of week", "The cleanup was listed for Sunday.", "It takes place Saturday."), ("quotation", "A speaker was quoted as saying 'faster.'", "The speaker said 'safer.'"),
 ("poll sample", "The poll was reported as 240 responses.", "The correct sample was 24 responses."), ("donut count", "The notice promised a baker's dozen.", "The rotating offer is one dozen unless the issue coupon says otherwise."),
 ("location", "The chess tables were placed near the west door.", "They will be near the east door."),
]
corrections=[item(f"COR-{i:03}","correction",c,"evergreen",None,("Quality Shop" if i==9 else "Tony's Donuts" if i==14 else None),False,source_issue="{{issue_number}}",source_item="{{page_or_headline}}",error=e,correction=x,continuity_note="No continuity change; operational detail only.") for i,(c,e,x) in enumerate(correction_specs,1)]

calendar_activities = ["Paperback swap","Mending circle","Chess night","Community supper","Bicycle repair clinic","Window-box workshop","Storm-drain cleanup","Cribbage table","Local history listening hour","Open sketch table","Soup exchange","Board-game afternoon","Coat drive sorting","Neighborhood chorus rehearsal","Tool-sharpening clinic","Seed swap","Poetry reading","Lantern repair hour","Youth puzzle club","Community noticeboard refresh","Rain-barrel workshop","First-aid refresher","Recipe exchange","Quiet reading hour","Handcart tune-up","Winter boot exchange","Spring broom brigade","Summer shade walk","Autumn leaf crew","Fog-safety talk","Public minutes review","Cassette swap","Typewriter clinic","Map-free walking club","Lunch-pail show-and-tell","Button jar sorting","Radio repair demonstration","Story circle","Newspaper folding lesson","Coffee-can planter workshop","Umbrella repair table","Snow-shovel labeling","Picnic table sanding","Lost-and-found amnesty","Pencil sharpening bee","Porch-light check","Thermos testing","Rope-knot practice","Community calendar planning","Closing-time singalong"]
calendar=[]
for i,a in enumerate(calendar_activities,1):
    season = ["evergreen","evergreen","spring","summer","autumn","winter"][i%6]
    calendar.append(item(f"CAL-{i:03}","community-calendar","community-event",season,None,None,False,title=a,schedule="{{day}}, {{date}}, {{time}}",location="{{verified_location}}",description=f"Neighbors are invited to the {a.lower()}. Bring only what the issue listing requests; newcomers are welcome.",verification_note="Confirm date, time, organizer, accessibility, and location before publication."))

weather_lines = [
 ("fog","Fog may erase the far end of the block before breakfast. Use bells, lamps, and patience."),("rain","Steady rain will darken the brick and find the weak seam in every umbrella."),("wind","Harbor wind will turn loose handbills into a second edition. Tie bundles twice."),("snow","Snow begins politely, then gets down to business. Clear steps before the gray bank forms."),("cold","Cold iron, loud pipes, short errands. Check on the radiator and the neighbor beside it."),("thaw","The thaw is working from the gutters downward. Watch for falling ice and ambitious puddles."),("drizzle","A fine drizzle will make everything damp without accepting credit for rain."),("heat","Warm, close air aboveground; warmer still below. Carry water and give the fans room."),("ice","Black ice favors shaded corners and confident walkers. Short steps win."),("clearing","Clouds should lift late enough to make everyone doubt the forecast first."),
 ("fog","Morning fog will carry every horn farther than the view. Listen before crossing."),("rain","Laundry hung outdoors today will learn a hard lesson."),("wind","A northwest push will rattle signs and improve no one's hair."),("snow","Flurries at dusk may dust the tracks without slowing the determined."),("cold","The pipes will complain before dawn. Let them; then check them."),("thaw","Meltwater is gathering at low doors. Keep a broom and a clear drain."),("drizzle","Intermittent drizzle: too little for drama, plenty for wet cuffs."),("heat","The afternoon will hold its heat between brick walls. Seek shade without apology."),("ice","Refreeze after sundown will turn today's slush into tomorrow's argument."),("clearing","A narrow bright spell may appear over the water. Enjoy it promptly."),
 ("fog","Patchy fog near the waterfront, thicker wherever someone says it is lifting."),("rain","Rain arrives sideways after lunch. Newspaper carriers should use inner wrapping."),("wind","Gusts may move empty barrels and full opinions."),("snow","Wet snow will cling to railings and surrender under boots."),("cold","Clear and sharp tonight; keys will feel colder than necessary."),("thaw","Roofs drip, snowbanks shrink, and every curb becomes a small river."),("drizzle","Mist through noon, with salt air settling on windows."),("heat","A sticky evening ahead. Open windows on opposite sides if the building allows."),("ice","Freezing spray near exposed edges; handrails earn their keep."),("clearing","By evening, the distance may return one rooftop at a time."),
]
weather=[item(f"WTH-{i:03}","weather-note",c,(["winter"] if c in {"snow","cold","ice","thaw"} else ["summer"] if c=="heat" else ["evergreen"])[0],"waterfront" if c in {"fog","wind"} else None,None,False,headline=f"{c.title()} note",note=n,utility="Issue editors should pair with verified forecast data; this copy describes lived conditions only.") for i,(c,n) in enumerate(weather_lines,1)]

poll_specs = [
 ("Best use for a clean coffee can?",["Pencil cup","Planter","String keeper"]),("Which sound says morning first?",["Radiator knock","Delivery wheels","Coffee pouring"]),("Most trustworthy community-board fastener?",["Thumbtack","Staple","String"]),("Ideal number of chairs at a card table?",["Four","Five","One more than fits"]),("Should soup be traded by bowl or by jar?",["Bowl","Jar","Potluck ladle"]),("Which weather deserves its own pencil?",["Fog","Snow","Sideways rain"]),("Best place to read the last page?",["Kitchen table","Counter stool","Waiting bench"]),("What belongs beside every basement door?",["Broom","Flashlight","Dry boots"]),("Which donut disappears first from a mixed dozen?",["Glazed","Jelly","The unmarked one"]),("Is a bicycle bell polite, necessary, or both?",["Polite","Necessary","Both"]),("Best reward for a cleanup crew?",["Soup","Donuts","First pick of the chairs"]),("How early is too early for accordion practice?",["Before eight","Before ten","Any time next door"]),("Which sandwich wrapper fold holds best?",["Tucked ends","Double roll","Trust the counter"]),("What item is most often lent and least often returned?",["Umbrella","Pen","Casserole dish"]),("Should meeting minutes include snack decisions?",["Always","Only disputes","Separate appendix"]),("Best defense against a stubborn umbrella?",["Repair it","Retire it","Walk into the wind"]),("Which classified do you read first?",["Lost and found","Free","Oddities"]),("What makes a waiting bench tolerable?",["A backrest","A dry seat","Good company"]),("Should chess clocks be allowed at community night?",["Yes","No","Only after nine"]),("Which small kindness improves a wet day?",["Holding a door","Sharing an umbrella","Saving a dry newspaper"]),
]
polls=[item(f"POL-{i:03}","poll","informal-community-poll","evergreen",None,("Tony's Donuts" if i==9 else None),False,prompt=p,options=o+["Other / write-in"],response_window="{{open_date}}–{{close_date}}",sample_size="{{count_after_close}}",method="Paper ballots collected at listed neighborhood drop boxes.",disclaimer="Informal reader poll; not a scientific sample.") for i,(p,o) in enumerate(poll_specs,1)]

transit_specs = [
 ("access","West stair handrail loose; use the east stair until the repair notice comes down."),("delay","Delivery handcarts may run ten minutes late while the narrow passage is cleared."),("weather","Fog is reducing sightlines at street crossings near the waterfront. Listen for bells."),("maintenance","Fresh paint on the south rail. It is dry when the sign says it is dry, not before."),("closure","Service corridor closed for pipe work; follow posted arrows and do not improvise."),("access","Elevator out of service at the marked transfer point. Assistance is available by bell."),("obstruction","Crates awaiting pickup narrow the loading lane. Single file until noon."),("schedule","First newspaper bundle departs fifteen minutes early on press-maintenance night."),("weather","Refreeze expected after dusk; treated steps may still be slick."),("courtesy","Keep doorways clear while passengers fold umbrellas and recover their dignity."),
 ("maintenance","Lanterns are being replaced along the lower passage. Carry a small light."),("delay","Bridge lift aboveground may bunch traffic; allow one extra song on the radio."),("access","North entrance open for foot traffic only; carts should use the signed ramp."),("obstruction","A stalled handcart is being unloaded at the bend. Do not squeeze past the wheel."),("schedule","Saturday service follows the posted weekend card, not weekday habit."),("weather","Wind may push bicycles sideways on exposed corners. Walk them if needed."),("courtesy","Offer the dry end of the bench to anyone carrying newsprint."),("maintenance","Track inspection underway. Expect short pauses and loud, ordinary tools."),("closure","The basement cut-through is private access this week. Use the public route."),("access","Temporary plank at the work zone is narrow; one traveler at a time."),
 ("delay","A delivery convoy will occupy the east lane shortly after dawn."),("weather","Standing water reported at the low doorway. Waterproof boots advised."),("schedule","Last evening connection leaves at the time printed on the current card."),("maintenance","Bell testing between two and three may sound like repeated arrivals."),("obstruction","Loose papers near the fan grate have been cleared; bundles must remain tied."),("courtesy","Let riders exit before boarding, even when your coffee is cooling."),("access","The green door is an exit during repairs, not a new shortcut."),("delay","Snow clearing will pause service briefly after each heavy burst."),("maintenance","Step-edge stripes are being repainted; follow the cones."),("weather","Heat in the lower corridor is building. Carry water and shorten waits where possible."),
]
transit=[item(f"TRN-{i:03}","transit-watch",c,"winter" if any(w in n.lower() for w in ["snow","refreeze"]) else "evergreen",("waterfront" if "waterfront" in n else None),None,False,headline=c.title(),notice=n,effective_window="{{verified_start}}–{{verified_end}}",route_scope="Local access description only; not a complete infrastructure map.",verification_note="Confirm current conditions before publication.") for i,(c,n) in enumerate(transit_specs,1)]

spotlights_specs = [
 ("The Crust Bucket","pizza-shop","The Oven Light Stays On","The Crust Bucket earns its place in the neighborhood one hot pie and one clipped coupon at a time. The counter is practical, the offers rotate, and nobody pretends a topping dispute is more serious than supper. Its permanent role is simple: this is the paper's recurring pizza advertiser, ready with flexible specials that never need to become history."),
 ("Quality Shop","sandwich-shop","Wrapped for the Walk Home","At Quality Shop, the Shamos family runs a neighborhood institution built around outstanding Italian sandwiches. The work is visible at the counter: careful layers, tight paper, familiar exchanges, and lunch moving out the door in capable hands. Specials may change, but ownership and reputation do not; editorial coverage should keep the family and the craft ahead of sales copy."),
 ("Great Lost Bear","restaurant-and-bar","The Table After the Meeting","Great Lost Bear is where a weekly special can become the second item on an unofficial agenda. Neighbors gather, compare notes, and make a persuasive case for the legendary ranch. The chalkboard may rotate, but the place works best on the page as a recurring gathering spot—reported with appetite, never mistaken for an advertisement."),
 ("Tony's Donuts","breakfast-shop","Before the City Is Ready","Tony's Donuts belongs to the hour when delivery crews, early readers, and late workers briefly share a counter. Rotating donut specials keep the display case changing without forcing continuity to do the same. The lasting story is the morning institution: paper box, warm coffee, and a little light before the street has decided what kind of day it will be."),
]
spotlights=[item(f"BSP-{i:03}","business-spotlight",c,"evergreen",None,b,False,headline=h,dek="A reported inventory profile for future issue adaptation.",body=body,reporting_note="Verify quotations and current operational details before publication; this profile contains only locked business facts and atmosphere.",paid_placement=False) for i,(b,c,h,body) in enumerate(spotlights_specs,1)]

editorial_specs = [
 ("The Useful Inch","newsroom","A neighborhood paper should measure itself by the useful inch: the meeting time corrected, the stair warning noticed, the lost mitten reunited. Big ink has its place. So does the small notice that gets somebody home dry."),
 ("In Defense of the Bulletin Board","seagullotine","A bulletin board is democracy with thumbtacks. It is also chaos with thumbtacks. We support both conditions, provided expired notices come down before they become wallpaper."),
 ("Fog Requires Manners","newsroom","Fog does not make the city smaller. It makes every choice closer. Ring the bell, slow the cart, leave a light, and do not assume the person ahead can see your confidence coming."),
 ("The Seagullotine: Crumb Policy","seagullotine","The gulls have submitted no petition requesting our sandwiches, yet enforcement remains aggressive. Keep your crumbs. Keep your lunch. Let the opposition organize elsewhere."),
 ("Corrections Are Part of the Record","newsroom","A correction is not a trapdoor beneath a mistake. It is a lamp placed beside it. We will state the error, print the right fact, and leave the record intact enough for readers to trust it."),
 ("Meetings Need Endings","seagullotine","Every public meeting deserves an agenda, a pot of coffee, and a final sentence. If nobody can find the final sentence, the chair should appoint a search party at nine o'clock sharp."),
 ("Buy the Ordinary Thing Nearby","newsroom","Neighborhood shops keep more than goods behind the counter. They keep directions, spare string, weather opinions, and the name of the person who can fix what broke. Spend locally when you can; report honestly always."),
 ("The Bench Is Transit","newsroom","A route is more than motion. It is also the place where a tired rider waits, the rail they hold, and the sign that tells the truth. A plain bench can be serious public equipment."),
 ("The Seagullotine: Umbrella Amnesia","seagullotine","Every rain ends with three ownerless umbrellas leaning in a doorway. We propose a cooling-off period, a clear label, and clemency for anyone who returns with an accurate description of the handle."),
 ("Leave Room for Discovery","newsroom","A good front page tells readers what matters. A good whole paper also rewards the turn: a small joke, a careful notice, a name spelled right. The Gold Standard is not shine. It is attention."),
]
editorials=[item(f"EDT-{i:03}","editorial",c,"evergreen",None,None,False,headline=h,body=b,byline="The Editorial Board" if c=="newsroom" else "The Seagullotine",opinion_label="OPINION",editorial_note="Institutional or signed opinion; verify issue context before publication.") for i,(h,c,b) in enumerate(editorial_specs,1)]

for name, rows in [("classifieds",classifieds),("advertisements",ads),("letters",letters),("corrections",corrections),("community_calendar",calendar),("weather",weather),("polls",polls),("transit_watch",transit),("business_spotlights",spotlights),("editorials",editorials)]:
    write(name, rows)
