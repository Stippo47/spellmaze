"""Write the Spellmaze design decks for Riffle.

python tools/riffle/build.py  ->  tools/riffle/decks/*.json  (then: riffle check / riffle deck)
"""
import json, pathlib

HERE = pathlib.Path(__file__).resolve().parent
DECKS = HERE / "decks"
DECKS.mkdir(exist_ok=True)
A = "../../../art/out/"  # pictures, relative to the deck files


def img(name):
    return A + name + ".png"


def deck(id_, title, topic, order, cards, **kw):
    d = {"title": title, "topic": topic, "order": order, "cards": cards, **kw}
    (DECKS / f"{id_}.json").write_text(json.dumps(d, indent=1, ensure_ascii=False), encoding="utf-8")


def q(id_, title, text, why, pick, rarity="common", details=None, images=None):
    c = {"id": id_, "kind": "question", "rarity": rarity, "title": title, "text": text, "why": why, "pick": pick}
    if details: c["details"] = details
    if images: c["images"] = images
    return c


def opts(id_, title, text, why, pick, options, rarity="uncommon", details=None, images=None):
    c = {"id": id_, "kind": "options", "rarity": rarity, "title": title, "text": text, "why": why, "pick": pick,
         "options": [{"id": o[0], "label": o[1], "text": o[2]} for o in options]}
    if details: c["details"] = details
    if images: c["images"] = images
    return c


def report(id_, title, text, why, parts=None, images=None, details=None, rarity="common"):
    c = {"id": id_, "kind": "report", "rarity": rarity, "title": title, "text": text, "why": why}
    if parts: c["parts"] = parts
    if images: c["images"] = images
    if details: c["details"] = details
    return c


def part(id_, title, text, images=None):
    p = {"id": id_, "title": title, "text": text}
    if images: p["images"] = images
    return p


# ---------------- Start here ----------------
deck("start-overview", "Spellmaze in one minute", "start", 1, priority=1, cards=[
    report("pitch", "The game in one minute",
           "Survive endless waves in a dark square maze. Build your own attacks from modules found in dead-end chests.",
           "Everything else in this pack hangs off this. Mark any part that's off.",
           images=[img("key-C")],
           parts=[
               part("you", "You", "A 2×2-cell glowing ring in a square labyrinth. You only see what's in your line of sight."),
               part("waves", "Waves", "Enemies pour in from the dark, more every minute, like Vampire Survivors. Kills drop XP."),
               part("chests", "Chests", "Dead ends hold chests. Each has one module: a part that changes an attack (Bounce, Burn, Split…). The deeper the dead end, the better the chest."),
               part("levels", "Level-ups", "Each level-up shows 4 upgrades for modules you already have (Bounce 2 → 3 bounces). Pick one. Chests give new effects; XP makes them stronger."),
               part("casts", "Three casts", "Weapon, Summon and Dash. Each is a shape with module slots, and any module works in any of them. That's the build."),
               part("exit", "The exit", "An exit opens at 10:00. Leave to bank your shards, or stay longer for more until you die."),
               part("meta", "Between runs", "Shards buy more slots, more modules in the chests, new shapes, and a practice room for building big spells."),
           ]),
    report("scope", "What this pack is", "Design only. Nothing is built yet. Every call in here is my pick until you answer it.",
           "Start with Look and Spell system: they decide the most. Statuses, enemies and the maze can wait if you're short on time.",
           details="The full design is in docs/DESIGN.md in the new Spellmaze folder.\n\nIt borrows the building blocks and rules from your maze roguelike design doc (the projectile/line/zone/entity atoms, what children inherit, Piercing and Bouncy, the stacking maths) and cuts them down to what a phone survivor game can show.\n\nYour Wings spell, the Lightning arena and the 21 pressure tests are mapped against it in the Spell system topic."),
    q("go", "Start building?", "Once the Look and Spell system answers are in, start stage 1?",
      "Stage 1 is the maze, line of sight, the three sticks, the Bolt and the Mite, playable on your phone. Stage 2 adds the Ball, the Dash and five modules on all three, which proves the system. Nothing past that until you've played it.",
      "Yes: stage 1 as soon as Look and Spell system are answered, then stage 2.", rarity="epic",
      details="Build order:\n1. Maze, line of sight, movement, the three sticks, Bolt, Mite. Feel on the phone.\n2. Ball and Dash, five modules (Bounce, Burn, Extra, Explode, Home) on all three casts.\n3. Chests, level-ups, rarity, the build screen.\n4. All enemies, statuses, waves, the exit, the first boss.\n5. The rest of the modules, Runes, between-run unlocks, the practice room.\n\nSame setup as Delve: an offline web app on GitHub Pages, landscape, added to the home screen."),
])

# ---------------- Look and controls ----------------
deck("look-style", "The look", "look", 1, priority=2, cards=[
    {"id": "style", "kind": "board", "rarity": "rare", "title": "Pick a style",
     "text": "The same moment drawn four ways. Tick the ones you like.",
     "why": "This sets every picture in the game. They differ in how shapes and walls are drawn, not in colours. Colours are the next card.",
     "pick": ["C"],
     "items": [
         {"id": "A", "label": "A: thin line", "image": img("key-A"), "text": "Outlines only, strong glow, no floor grid. Most 'vector'."},
         {"id": "B", "label": "B: solid", "image": img("key-B"), "text": "Filled glowing shapes, bright solid walls."},
         {"id": "C", "label": "C: line + soft fill", "image": img("key-C"), "text": "Outline plus a faint fill, double-line walls, faint grid. My pick: reads fast, glow stays cheap."},
         {"id": "D", "label": "D: flat", "image": img("key-D"), "text": "No glow at all, thick lines, flat fills. Cheapest to run on the phone."},
     ]},
    report("colours", "One job per colour", "Each colour means one thing, so a glance tells you what's dangerous.",
           "From your maze doc: each visual channel gets one job. Mark anything that clashes.",
           images=[img("key-C")],
           parts=[
               part("you", "You: cyan and white", "The player, your shots, your summon. Enemy shots are never cyan."),
               part("foes", "Enemies: red and magenta", "Enemy bodies are red or magenta. Enemy shots are red and always drawn on top of yours."),
               part("loot", "Green and gold", "XP gems are mint green. Chests and gold are amber, and glow through the dark."),
               part("status", "Statuses in their colours", "Burn orange, Chill pale ice, Shock yellow, Poison lime, Mark pink."),
               part("size", "Size = health", "A bigger enemy has more HP. Rings and particles show modules."),
               part("rarity", "Rarity", "Common white, Rare blue, Epic purple, Legendary gold."),
           ]),
    q("name", "Working title", "Call it Spellmaze for now?",
      "Only so files and the Riffle pack have a name. Plain, says what it's about, no neon in it.",
      "Spellmaze until you think of better."),
])

deck("look-controls", "Controls", "look", 2, cards=[
    report("hud", "The screen", "Brawl Stars layout in landscape. Mark any part that's off.",
           "This is what your thumbs do every second, so it matters more than anything else on screen.",
           images=[img("key-C")],
           parts=[
               part("move", "Move stick", "Anywhere on the left half. It appears under your thumb."),
               part("fire", "Fire stick", "Bottom right. Drag to see the aim line, release to fire. A quick tap fires at the nearest enemy you can see. Keep holding to keep firing."),
               part("summon", "Summon stick", "Above-left of Fire. It fills as your hits land (like a Super) and slowly on its own. Drag to aim the throw, release to throw."),
               part("dash", "Dash button", "Left of Fire. Tap to dash where you're moving, or drag to aim it. 2 charges, shown as dots."),
               part("top", "Top bar", "XP bar and level, the clock, pause (opens the build screen), and the minimap with the exit."),
               part("ammo", "Ammo bars", "Three bars under you that reload one at a time."),
           ]),
    opts("firing", "How firing works", "Twin-stick aim, but survivor games usually fire by themselves. Which?",
         "Brawl Stars fires on release; Vampire Survivors fires by itself. Manual aim makes Bounce and Pierce feel earned.",
         "a", [
             ("a", "Release + hold", "Release fires, keep holding to repeat, tap = nearest. My pick."),
             ("b", "Auto-fire", "Fires at the nearest enemy by itself; the stick only steers it."),
             ("c", "Release only", "One shot per release, like Brawl Stars exactly."),
             ("d", "Both, a setting", "Release + hold by default, auto-fire as an option."),
         ], rarity="rare"),
    q("ammo", "Ammo bars", "Every weapon shape uses 3 ammo bars that reload, like Brawl Stars?",
      "It gives a bolt, a beam and a bomb the same rhythm on the Fire stick, and makes Haste and +1 ammo upgrades mean something. Without it, every shape needs its own rate rule.",
      "Yes, 3 bars. A beam drains a bar per second while held.", rarity="uncommon"),
    q("aim", "No aim assist", "Keep the maze roguelike's rule: no aim assist, apart from tap-to-nearest?",
      "Home and Follow modules already help aim. More help would make them pointless.",
      "Yes, no aim assist."),
])

# ---------------- Spell system ----------------
deck("spells-how", "How spells are built", "spells", 1, priority=3, stack="spells", cards=[
    report("casts", "Casts, shapes, modules", "Three casts. Each is one shape plus slots. Any module in any slot.",
           "This is the core of the game. Mark any part that doesn't sit right.",
           images=[img("ui-build")],
           parts=[
               part("casts", "Casts", "What you trigger: Weapon (Fire stick), Summon (Summon stick), Dash (Dash button)."),
               part("shapes", "Five shapes", "Bolt: a fast shot. Beam: a held line. Burst: a lobbed bomb that blasts a circle. Ball: a thrown body with HP that hits by contact, harder when faster. Self: the dash, your own body moving."),
               part("start", "Starting kit", "Weapon = Bolt, Summon = Ball, Dash = Self. Beam and Burst come from unlocks and from shape cards in chests."),
               part("shapecards", "Shape cards", "A shape card swaps a cast's shape and keeps its modules. Bolt + Bounce + Burn becomes Beam + Bounce + Burn: a burning beam that reflects."),
               part("slots", "Slots", "Weapon 3, Summon 2, Dash 2 at the start. Unlocks raise them to 6, 5 and 4."),
           ]),
    report("channels", "Any module, any shape",
           "Every shape answers the same seven questions. Modules are written against those, never against a shape.",
           "This is your 'make modules generic' test. If a module ever had no answer on a shape, this is where it would break.",
           images=[img("mod-bounce")],
           parts=[
               part("count", "Count", "How many per cast. Bolts, beams, bombs, balls, or dash charges."),
               part("size", "Size", "Bolt radius, beam width, blast radius, ball size and HP, dash width."),
               part("speed", "Speed", "Flight speed and reload, beam reach and tick rate, throw speed, ball speed and charge rate, dash length and recharge."),
               part("path", "Path", "How it moves: the flight, the line, the lob, the throw then drift, the dash line."),
               part("contact", "Contact", "Touching an enemy: the hit, each beam tick, everything in the blast, each ball collision, everyone you dash through or shove."),
               part("wall", "Wall", "Touching a wall: a bolt dies, a beam stops, a blast is blocked, a ball thuds, a dash stops."),
               part("end", "End", "When it's over: a bolt runs out, a beam is released, a blast fades, a ball dies, a dash ends."),
               part("fallback", "Fallbacks", "Where the obvious answer is 'nothing', the module names a fallback. Shrapnel on a dash: a ring of bolts where you land. No module ever does nothing."),
           ]),
    report("inherit", "What children inherit",
           "Some modules make new things: a blast, small bolts, copies. Those carry some of the parent's modules.",
           "This is your maze doc's rule 20, unchanged. It's what lets a burning ball's turret shots burn without you adding Burn twice.",
           parts=[
               part("yes", "Payloads pass down", "Burn, Chill, Shock, Poison, Mark, Knock, Pull and Leech pass to children. A burning ball's Gunner shots burn; its death blast is a fire blast."),
               part("no", "Nothing else does", "Path, count and spawner modules don't pass down. That stops endless chains and keeps the screen readable."),
               part("split", "Splits stop", "Split children never split again."),
               part("depth", "Depth limit", "Things making things making things: 2 deep in a run, 3 with an unlock."),
           ]),
    report("runes", "Runes: spells in spells",
           "A Rune is a module with a trigger and an empty socket. Put a shape card in it, and 2 modules of its own.",
           "This is how your Wings-sized spells become buildable. Fixed spawners (Explode, Gunner…) are runes that come pre-filled.",
           images=[img("mod-rune")],
           parts=[
               part("how", "How it works", "'On wall: cast ___'. Drop in Burst, add Pull and Chill: every time your bolt hits a wall, a freezing blast sucks enemies in."),
               part("triggers", "Triggers", "On hit, On wall, On end, Every 1 s, On kill. The trigger is fixed when the Rune drops; it's printed on the card."),
               part("rarity", "Rarity", "Epic or better only. A run might see two or three."),
           ]),
    report("levels", "Levels, rarity, slots", "How modules grow and how many you carry.",
           "The questions after this card are about these numbers.",
           images=[img("ui-levelup"), img("ui-chest")],
           parts=[
               part("numbers", "Numbers shown", "Upgrade cards show the number: 'Bounce 2 → 3'."),
               part("caps", "Rarity caps levels", "Common 3, Rare 5, Epic 7, Legendary 9."),
               part("dupes", "Duplicates", "The same module at a higher rarity promotes yours, keeping levels. Same or lower rarity: +1 level, or scrap it for XP."),
               part("full", "When full", "A new module can replace one you have (the old one is scrapped for XP), or be scrapped itself."),
               part("move", "Moving", "On the build screen you can move any module between casts. Its level goes with it."),
               part("levelup", "Level-up", "4 cards, mostly modules below their cap. When everything's capped: vitals like +10 max HP."),
           ]),
])

deck("spells-yours", "Your spells, mapped", "spells", 2, stack="spells", cards=[
    report("arena", "Lightning arena", "Burst + Link + Shock + Gunner + Knock. All four modules are in the first set.",
           "Your Lightning arena falls out of generic modules, with no special code. That's the test passing.",
           images=[img("spell-arena")],
           parts=[
               part("ring", "The ring", "Link on a Burst turns the blast's edge into a ring of linked points. Enemies that touch it join the ring."),
               part("strikes", "Sky strikes", "Gunner on a Burst keeps the area for 2 s and drops strikes inside it."),
               part("push", "Knockback", "Knock pushes them back out, the way they came."),
               part("gap", "What's not exact", "Your version kept 6 even anchors and re-sorted by angle when someone joined. Mine adds them where they touch. Close, not the same."),
           ]),
    report("summon", "Your three summons", "Explosive, pet that shoots, swarm. Each is the starting Ball plus modules.",
           "These were your examples for why the summon is the base for many things.",
           images=[img("spell-pet")],
           parts=[
               part("bomb", "Explosive", "Ball + Explode: it blasts when it dies."),
               part("pet", "Pet", "Ball + Follow + Gunner: Follow makes it find its way to you through the maze; Gunner makes it shoot."),
               part("swarm", "Swarm", "Ball + Swarm: 6 small homing balls that hit by contact."),
           ]),
    report("wings", "Wings, the big test", "About 14 modules on one Weapon. The engine can hold it; one run can't.",
           "Honest scope. A run's Weapon has 6 slots at most, so the full Wings lives in the practice room, and a run builds a smaller Wings.",
           details="Weapon = Bolt (big and slow), with:\n• Charge — the orb grows while held. ✔\n• Gunner — side streams while it flies. ✔\n• Home, Bounce ×3, Pierce, Pull — the released orb. ✔\n• Rune Every 1 s → Bolt — the trail of small orbs. ✔\n• Rune On hit → Bolt + Shrapnel — 12 radial. ✔\n• Rune On kill → Ball + Follow + Gunner — the spirit. ✔ except healing allies (no allies yet).\n• Rune On end → Burst + Grow + Rune Every 1 s → Burst — death blast and the star-lobbing aura. ✔ at depth 3.\n• Rune On wall → Bolt ×20 — the wall of shots. Partly: 'a perpendicular row, each slower than the last' needs a later Row module.\n• The laser out of the charging orb that forks at stage 2 — needs a later 'On charge level' trigger.",
           parts=[
               part("fits", "Fits now", "Charging orb, side streams, homing bouncing piercing pull orb, hit burst, spirit summon, death blast and aura."),
               part("later", "Needs later pieces", "The perpendicular 20-shot wall (a Row pattern), and the laser from the charging orb that forks (an 'On charge level' trigger)."),
               part("size", "Too big for a run", "About 14 modules. A run tops out at 6 on the Weapon. The practice room has no slot limit."),
           ]),
    report("tests", "The 21 pressure tests", "About a third fit fully, a third partly, a third need four later systems.",
           "The later systems all fit the same model without changing it. They're listed by how much they add.",
           details="Fit fully: fire tornado that throws fire summons; stomp; rapier lunge; bouncing pet orb; chained homing bomb (minus the tug on you).\n\nPartly: held lightning (no damage scaling down the chain yet); bouncing laser (no head-on split or merge yet); hammer slam (no backflip or spike chains); arrow rain (no flare targeting); rocket boots; spinning black hole; helix ladder (no helix or transform).\n\nLater: steal-and-throw ability, grab ray, curse and bless, smart sticky, water wave, figure-eight boomerang, projectile from the cursor, teleport knife.",
           parts=[
               part("capture", "1. Capture and throw", "Grab enemies or shots and launch them. Unlocks the grab ray, the steal ability, smack-to-launch."),
               part("origin", "2. Origin", "Fire from the aim point, a mark or a flare instead of from you. Arrow rain, cursor shots, airstrikes."),
               part("pattern", "3. Patterns", "Rows, helixes, figure eights, formations. Wings' wall, the helix ladder, the water wave."),
               part("stage", "4. Stage triggers", "On charge level, on speed below X. Wings' laser, the orb pet that drifts back."),
           ]),
])

deck("spells-questions", "Spell system questions", "spells", 3, stack="spells", cards=[
    q("numbers", "Show the numbers", "Show numbers on modules and upgrades ('Bounce 2 → 3')?",
      "Your maze doc said hidden numbers, visible results. Your brief here says '+1 bounces on a bounce module'. Survivor games live on reading the upgrade, so I went with shown.",
      "Shown here. The maze roguelike keeps its hidden rule.", rarity="uncommon"),
    opts("caps", "Rarity caps", "Rarity limits how far a module levels. Which caps?",
         "Low caps make finding a rare copy exciting; high caps make XP matter more than chests.",
         "a", [
             ("a", "3 / 5 / 7 / 9", "Common to Legendary. My pick."),
             ("b", "2 / 3 / 4 / 5", "Tighter. Chests matter more."),
             ("c", "5 / 5 / 5 / 5 + perks", "Same cap; rarity adds a bonus effect instead."),
         ]),
    q("dupes", "Duplicates promote", "A higher-rarity copy of a module you own promotes yours and keeps its levels?",
      "Without it, finding a better Bounce means throwing away the levels on the old one, which feels bad.",
      "Yes, promote and keep levels; a lower copy gives +1 level."),
    q("move", "Move modules freely", "On the build screen, move any module between Weapon, Summon and Dash at any time?",
      "Building is the point, so trying Explode on the Dash instead of the Ball should cost nothing. The cost is that slots per cast matter less.",
      "Yes, free, any time you pause.", rarity="uncommon"),
    q("shapecards", "Shape cards in chests", "Rare chests can hold a shape card that swaps a cast's shape mid-run?",
      "Turning your Bolt build into a Beam build halfway through a run is the clearest proof that modules are generic. It's also how Runes get filled.",
      "Yes, rare and up."),
    q("runesv1", "Runes in the first version", "Include Runes (open sockets) from the start, at Epic and up?",
      "They're how big spells get built, which you said is the main goal. They're also the most complex screen to make on a phone.",
      "Yes, in stage 5, Epic and up. The fixed spawners come first.", rarity="rare"),
    q("depth", "How deep spells nest", "Things that make things: 2 deep in a run, 3 with an unlock?",
      "Deeper means bigger spells and a busier screen. 3 is enough for Wings' death aura.",
      "2, and 3 with an unlock. No limit in the practice room."),
])

# ---------------- Modules ----------------
MOD = {
    "path": ("Path modules", "How it moves. Cyan.", ["home", "bounce", "pierce", "orbit", "return"]),
    "form": ("Form modules", "How many, how big, how fast. White.", ["extra", "grow", "haste", "split", "swarm"]),
    "payload": ("Payload modules", "What a touch does. Element colours.", ["burn", "chill", "shock", "poison", "mark", "knock", "pull", "leech"]),
    "spawn": ("Spawner modules", "Make something at a moment. Yellow.", ["explode", "shrapnel", "gunner", "trail", "echo"]),
    "rule": ("Rule modules", "Bend a rule. Purple.", ["link", "follow", "charge", "ghost", "rune"]),
}
LINE = {
    "home": "Curves to the nearest enemy | bends toward enemies | the bomb steers onto one | hunts, re-targets after each hit | the dash curves into one (a lunge).",
    "bounce": "Reflects off walls | reflects | the bomb hops, blasting each hop | pinball, no speed lost | the dash rebounds and keeps going. +1 bounce a level.",
    "pierce": "Through enemies | through enemies | the blast reaches through one wall | through at full speed | dash through enemies, hitting each. +1 a level.",
    "orbit": "Circles you, then flies out | sweeps a full circle | blasts in a ring around you | guards you, blocking shots | the dash arcs around an enemy.",
    "return": "Boomerang | swings out and back | blast expands then collapses, hitting twice | flies back; catch it for half the charge | you snap back to your start after 1 s.",
    "extra": "+1 bolt | +1 beam | +1 bomb | +1 ball | +1 dash charge.",
    "grow": "Bigger bolt | wider beam | bigger blast | bigger, tougher, slower ball | wider dash that shoves more.",
    "haste": "Faster shots and reload | faster ticks, longer reach | faster throw and cooldown | faster ball and summon charge | longer dash, faster recharge.",
    "split": "Splits in two at its end | forks partway | two small bombs after the blast | two small balls on death | two echo dashes at ±35°. Children never split.",
    "swarm": "6 tiny homing bolts | 6 thin homing threads | 6 homing bomblets | 6 small homing balls | 6 homing sparks along the dash. Rare or better.",
    "burn": "Sets enemies on fire. At 100: Flare.",
    "chill": "Slows. At 100: Freeze; a hard hit on a frozen enemy shatters it into icicles.",
    "shock": "Each hit arcs to a neighbour. At 100: Overload.",
    "poison": "Slow damage. At 100: Rot; it dies into gas.",
    "mark": "+25% damage taken. At 5 marks: Detonate.",
    "knock": "Push far | push along the beam | hurl outward | enemies fly and bowl others over | dash shoves become a shockwave.",
    "pull": "Drags enemies to its line | drags them toward you | sucks in, then blasts | a magnet that gathers them | pulls them to where you land.",
    "leech": "Hits heal you a little. The ball's hits heal it too. Each enemy you dash through heals you.",
    "explode": "Blast on hit | blast at the beam's end every 0.5 s | a second blast | blast on death | blast where you land.",
    "shrapnel": "A ring of small bolts where it ends, on every shape. +2 bolts a level.",
    "gunner": "Side-shots while flying | sparks jump off the beam | the area stays and strikes fall | turret pet | 2 s of auto-fire after a dash.",
    "trail": "Leaves a strip that carries its payloads (Burn makes fire): behind the bolt, the beam's sweep, a pool, behind the ball, along the dash.",
    "echo": "The whole cast repeats 0.4 s later from where it was cast. A ghost ball; a ghost of you dashing.",
    "link": "Bolts in a volley joined by a damaging line (alone: a whip to you) | beam ends joined | the Lightning arena ring | balls linked (alone: a flail on you) | a 1 s tripwire along the dash.",
    "follow": "Bolts hover by you, then fire at what comes near | the beam locks onto what it hits | the blast becomes an aura that moves with you | finds its way to you through the maze | dash to your ball.",
    "charge": "Hold to charge before release. Bigger and stronger with no cap, but less each second. Every shape.",
    "ghost": "Through walls: bolt, beam, blast, ball. The dash goes through one wall if the far side is open. Legendary only.",
    "rune": "On a trigger, cast the shape in its socket, with 2 slots of its own. Epic or better.",
}
NAMES = {m: m.capitalize() for m in LINE}
mod_cards = [report("read", "How to read these", "Each picture shows one module on all five shapes: Bolt, Beam, Burst, Ball, Dash.",
                    "Mark a module part as a problem if one of its five versions is wrong or boring. That's the pressure test you asked for.",
                    images=[img("icons")],
                    details="Text order is always Bolt | Beam | Burst | Ball | Dash.\n\nRed circles are enemies, the cyan ring is you, the cyan ball with a green health arc is your summon. Faded rings are where the dash was.")]
for fam, (title, sub, ids) in MOD.items():
    mod_cards.append(report(fam, title, sub, "One part per module, each with its picture.",
                            parts=[part(m, NAMES[m], LINE[m], [img("mod-" + m)]) for m in ids]))
mod_cards.append(q("ghost", "Ghost in a maze", "Keep Ghost (through walls) as a Legendary-only module?",
                   "It breaks the maze: bolts through walls, a dash through one wall. That's a big, fun moment once a run, but common Ghost would make the maze pointless.",
                   "Yes, Legendary only, and the dash goes through one wall at a time.", rarity="uncommon"))
mod_cards.append(q("dashpay", "Payloads on the Dash", "The Dash shoves enemies and does no damage until a module gives it some?",
                   "Then Burn on the Dash means 'everyone you shove burns', and Pierce gives the dash a real hit. A dash that always hurts would make those modules less special.",
                   "Yes: no damage by default; Pierce, Explode, Trail and payloads give it some."))
mod_cards.append(q("missing", "Modules you want", "Any module you expected that isn't here? Add a comment.",
                   "28 is the first set. The four later systems (capture, origin, patterns, stage triggers) bring more.",
                   "Ship these 28; add yours to the later list."))
deck("modules-all", "All 28 modules", "modules", 1, priority=4, cards=mod_cards)

# ---------------- Statuses ----------------
deck("statuses-v1", "Status effects", "statuses", 1, cards=[
    report("all", "Five statuses", "Same model as Delve: each hit builds up to 100, then something bigger happens.",
           "Delve's statuses already work this way, so it's tested. Mark any part that's off.",
           parts=[
               part("burn", "Burn → Flare", "Damage over time. At 100 it drops to 20, a big hit, and a small fire blast that burns those nearby.", [img("status-burn")]),
               part("chill", "Chill → Freeze → Shatter", "Slows up to 60%. At 100: frozen 2 s. A hard hit on a frozen enemy shatters it into icicles that chill others.", [img("status-chill")]),
               part("shock", "Shock → Overload", "Each hit arcs a small jump to one nearby enemy. At 100: stunned 0.6 s and arcs to 3.", [img("status-shock")]),
               part("poison", "Poison → Rot", "Slow damage. At 100: loses 15% of max HP at once. Dies leaving a gas cloud that poisons.", [img("status-poison")]),
               part("mark", "Mark → Detonate", "No damage. Marked enemies take +25% from your hits. At 5 marks it pops for heavy damage.", [img("status-mark")]),
               part("mixes", "Three mixes", "Thaw: Burn on chill clears both for a burst. Ignite: fire in gas explodes. Conduct: Shock arcs prefer marked enemies and jump twice as far between them.", [img("status-mixes")]),
               part("hard", "Hard effects", "Knockback, stun (from Freeze and Overload) and slow (from Chill). These don't build up."),
           ]),
    q("beam", "Beams build slower", "Beams and trails add less build-up per tick than a bolt hit?",
      "A beam ticks 8 times a second. At full strength, Burn on a beam would Flare everything instantly and other shapes would never be worth it.",
      "Yes: each shape has a strength for statuses; beams and trails are low, the Ball and charged shots are high."),
    q("enemyfx", "Enemies use statuses", "Elite enemies can burn, chill or shock you?",
      "Elites carry modules (see Enemies), so an elite with Burn would set you on fire. It keeps one system both ways. The cost: you need a way to shake statuses off.",
      "Yes, from elites only; a dash clears half your build-up.", rarity="uncommon"),
])

# ---------------- Enemies ----------------
deck("enemies-v1", "Enemies", "enemies", 1, cards=[
    report("roster", "Ten enemies", "One simple shape each. The shape tells you what it does.",
           "From your maze doc: most enemies share a shape and differ by behaviour. Mark any that's dull or unfair.",
           parts=[part(e, n, t, [img("enemy-" + e)]) for e, n, t in [
               ("mite", "Mite", "Small red circle. Swarms toward you. The fodder."),
               ("dart", "Dart", "Thin triangle. When it sees you it flashes, then charges in a straight line until a wall. Dash sideways."),
               ("brute", "Brute", "Big square. Slow and tanky, shoves smaller enemies along, hard to knock back."),
               ("spitter", "Spitter", "Diamond. Keeps its distance, needs line of sight, lobs slow orbs. Break line of sight."),
               ("splitter", "Splitter", "Hexagon. Splits into 2, then 4 small ones. Blasts and Pierce."),
               ("bomber", "Bomber", "Runs at you, swells, blows up. Its blast hurts enemies too: kill it in a crowd."),
               ("crawler", "Crawler", "Half-circle stuck to a wall. Slides along it and fires across the corridor. Bounce and Ghost."),
               ("drifter", "Drifter", "Faded outline that floats through walls slowly. Can only be hit while solid; it flickers in and out."),
               ("shield", "Shield", "Square with a front bar that blocks shots. Turns slowly. Go around: Bounce, Home, Orbit, blasts."),
               ("nest", "Nest", "Spiky star in a dead end, making Mites. Kill it for a chest."),
           ]]),
    report("big", "Elites and bosses", "Elites carry your modules. A boss every 5 minutes.",
           "Elites tie enemies to the module system: same parts both ways.",
           parts=[
               part("elite", "Elites", "A normal enemy with a module, shown as a coloured ring. An elite Spitter with Burn throws fire. Killing it drops that module.", [img("enemy-elite")]),
               part("hulk", "Hulk, 5:00", "A square as wide as a corridor that rolls through the maze. You can't get past, so you route around and hit it from behind.", [img("enemy-hulk")]),
               part("queen", "Queen, 10:00", "Sits in a hall spawning waves, behind a ring of shields that open in turn.", [img("enemy-queen")]),
               part("mirror", "Mirror, 15:00", "A copy of you built from your own casts and modules. Your build fights you.", [img("enemy-mirror")]),
           ]),
    q("elites", "Elites drop modules", "Killing an elite always drops the module it carried?",
      "It gives a second way to find modules besides chests, and makes elites worth chasing. The risk: fewer reasons to explore dead ends.",
      "Yes, always, but at common rarity. Chests stay the way to rare ones.", rarity="uncommon"),
    q("mirror", "The Mirror boss", "A boss built from your own build?",
      "It's the strongest proof the system is generic: the same modules run on an enemy. The risk is a build that's unbeatable against itself, like heavy Ghost or Leech.",
      "Yes, at 15:00, with half your levels."),
])

# ---------------- Maze and runs ----------------
deck("runs-maze", "The maze and a run", "runs", 1, cards=[
    report("maze", "The maze", "A square labyrinth, 24×24 squares. Dead ends hold chests; deeper ones are better.",
           "Mark any part that's off.",
           images=[img("maze")],
           parts=[
               part("size", "Sizes", "Corridors 6 cells wide (three of you side by side), walls 2 cells thick. The screen shows about 6×3 squares."),
               part("loops", "Loops and halls", "A maze with many dead ends, plus 15% of walls knocked out so you can't be trapped forever, plus 4–6 open halls for big fights and bosses."),
               part("los", "Line of sight", "Simple, from your centre. Outside it is dark; walls you've seen stay faint. Enemies outside it are hidden, but close ones show a small tick at the screen edge."),
               part("chests", "Chests", "At most dead ends. The longer the tunnel, the better the rarity. They glow through the dark within about 12 cells, so you notice side tunnels."),
               part("waves", "Waves", "Enemies spawn out of sight, 20–35 cells away along the paths. Every minute adds more and new kinds. Hordes come down one corridor at set times."),
               part("exit", "The exit", "Opens at 10:00 somewhere far away, shown on the minimap. Leave to bank all shards. Stay for a growing multiplier and a boss every 5 minutes. Dying banks half."),
           ]),
    opts("width", "Corridor width", "How wide are corridors, in player widths?",
         "Narrow corridors make a horde a wall and dead ends deadly. Wide ones give room to kite like Vampire Survivors.",
         "b", [
             ("a", "2 wide", "4 cells. Tight, every dead end is a trap."),
             ("b", "3 wide", "6 cells. Room to dodge one enemy. My pick."),
             ("c", "4 wide", "8 cells. Plenty of kiting room, less maze-like."),
             ("d", "Mixed", "Mostly 3, some 2-wide tunnels and 4-wide main roads."),
         ], rarity="rare"),
    q("hidden", "Hide unseen enemies", "Enemies outside your line of sight are fully hidden (with a small edge tick when close)?",
      "Hiding them makes the maze tense and corners scary. Showing them makes it fairer but the dark means less.",
      "Hidden, with the edge tick.", rarity="uncommon"),
    q("beacon", "Chest glow", "Chests glow through the dark when you're within about 12 cells?",
      "You wanted chests to make players explore. A glow says 'there's something down there' without a map marker.",
      "Yes, a faint glow; seen chests stay on the minimap."),
    q("runend", "When a run ends", "Exit opens at 10:00; stay for more until you die; dying banks half?",
      "It gives a clear goal, a greed choice, and keeps the endless survivor feel for those who want it.",
      "Yes.", rarity="rare"),
    q("selfhit", "Your blasts and you", "Your own blasts never hurt you, but enemy Bomber blasts hurt enemies?",
      "Your maze doc says explosions hit everything. In a survivor game with blasts everywhere, hurting yourself would mean never picking Explode.",
      "Yours never hurt you. Enemy blasts hit everything, you included."),
])

# ---------------- Between runs ----------------
deck("meta-shards", "Between runs", "meta", 1, cards=[
    {"id": "shards", "kind": "design", "rarity": "rare", "title": "What shards buy",
     "text": "Shards come from kills, chests and time survived. They buy mostly new options, few raw stats.",
     "why": "You prefer upgrades that change how you play over +20% numbers. So most of this is more slots, more modules and more shapes.",
     "pick": "These seven, in this order of importance.",
     "parts": [
         part("slots", "Slots", "+1 slot to a cast. Up to Weapon 6, Summon 5, Dash 4."),
         part("pool", "Module pool", "Runs start with 14 of the 28 modules in chests. Some unlock by shards, some by doing (kill 300 burning enemies)."),
         part("shapes", "Shapes", "Beam and Burst as starting weapons, and in chests."),
         part("kit", "Start kit", "Begin a run with one module you've found before, at common."),
         part("depth", "Depth", "Runes nest one level deeper."),
         part("rerolls", "Rerolls and bans", "Reroll a level-up, or ban a module from showing up."),
         part("vitals", "A few vitals", "Small max HP and pickup range. Kept small on purpose."),
     ]},
    q("practice", "Practice room", "Unlock a practice room early: build anything from modules you've found, no slot limits, on dummies?",
      "This is where Wings-sized spells get made. A run caps a Weapon at 6 modules; here there's no cap. It's also where players learn the system.",
      "Yes, after the first run, with spawnable enemies.", rarity="rare"),
    q("codex", "Codex", "A codex page per module, showing it on all five shapes like the pictures in this pack?",
      "The five-shapes picture is the clearest way to teach that modules work everywhere.",
      "Yes, filled in as you find them."),
    q("bydoing", "Unlock by doing", "Some modules unlock by doing something, not by spending shards?",
      "It ties unlocks to how you play (earned, not bought). The risk is grinding a weird challenge.",
      "Yes for about a third of them, with plain goals."),
])
print("decks:", sorted(p.name for p in DECKS.glob("*.json")))
