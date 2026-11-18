"""Stage 2 decks: five modules on all three casts, the Spawn cast, the build screen, and what's next.

python tools/riffle/stage2.py  ->  tools/riffle/decks/stage2-*.json
Films from: node tools/film.mjs modules   (folder films/)
"""
import json, pathlib

HERE = pathlib.Path(__file__).resolve().parent
DECKS = HERE / "decks"
F = "../../../films/"


def deck(id_, title, topic, order, cards, **kw):
    d = {"title": title, "topic": topic, "order": order, "cards": cards, **kw}
    (DECKS / f"{id_}.json").write_text(json.dumps(d, indent=1, ensure_ascii=False), encoding="utf-8")


def part(id_, title, text, images=None, videos=None):
    p = {"id": id_, "title": title, "text": text}
    if images: p["images"] = [F + i for i in images]
    if videos: p["videos"] = [F + v for v in videos]
    return p


TEXT = {
    "weapon": {
        "extra": "+1 bolt a level, fanned out.",
        "bounce": "Bounces off walls, once a level.",
        "home": "Curves toward enemies ahead. Turns harder each level.",
        "burn": "Each hit adds burn. Burning enemies take damage over time; at full build-up they Flare: a big hit and a small fire blast.",
        "explode": "A blast where the bolt hits or runs out. Walls block it.",
    },
    "spawn": {
        "extra": "+1 ball a level, fanned out.",
        "bounce": "Rebounds off walls at full speed instead of thudding to a stop, once a level.",
        "home": "Hunts enemies: keeps moving and goes for the nearest one, all its life.",
        "burn": "Every enemy it hits gets burn.",
        "explode": "A big blast when it dies or runs out.",
    },
    "dash": {
        "extra": "Dashes again right after, once a level, steered by the move stick (your answer: dashes in a row, not charges).",
        "bounce": "Rebounds off walls and keeps going, once a level.",
        "home": "Lunges at an enemy ahead instead of going straight.",
        "burn": "Everyone you pass gets burn, plus the small hit every dash now does.",
        "explode": "A blast where the dash ends.",
    },
}
NAMES = {"extra": "Extra", "bounce": "Bounce", "home": "Home", "burn": "Burn", "explode": "Explode"}
CAST = {"weapon": "Weapon (Bolt)", "spawn": "Spawn (Ball)", "dash": "Dash"}


def cast_card(cast, rarity):
    return {"id": "on-" + cast, "kind": "report", "rarity": rarity, "title": f"Modules on the {cast.capitalize()}",
            "text": f"The same five modules on the {CAST[cast]}, each at level 3, alone.",
            "why": "Mark any part that doesn't feel like that module, or comment.",
            "parts": [part(m, NAMES[m], TEXT[cast][m], videos=[f"m-{cast}-{m}.mp4"]) for m in NAMES]}


deck("stage2-build", "Stage 2: modules", "builds", 3, [
    {"id": "how", "kind": "report", "rarity": "rare", "title": "Any module, any cast",
     "text": "Five modules (Extra, Bounce, Home, Burn, Explode) work on all three casts. Build them on the phone.",
     "why": "This is the first test of the module system you said you wanted to try rather than read about.",
     "details": "The films are a simple bot playing, and it plays badly: trying builds yourself shows far more.\n\nPause → Build: a level for each module on each cast, free for now. Chests and level-ups (stage 3) "
                "will hand these out instead.\n\nEach module acts at a shared moment: touching an enemy (Burn), "
                "hitting a wall (Bounce), the end (Explode). That's why one module works on a bolt, a thrown ball "
                "and a dash without a stand-in. A module that has nothing to do on a cast won't be allowed there; "
                "all five fit all three so far.\n\nLevels are 0 to 5 here. Numbers show on the build screen.",
     "parts": [
         part("screen", "Build screen", "Pause, then Build. Levels per cast, and what each one does in numbers.",
              images=["build-screen.png"]),
         part("combo", "All together", "SMG with Burn, Bounce and Extra; Spawn with Burn, Home and Explode; Dash with "
              "Burn, Extra and Explode.", videos=["combo-fire.mp4"]),
     ]},
    {"id": "spawncast", "kind": "report", "rarity": "uncommon", "title": "The Spawn cast",
     "text": "A new stick above the fire stick: throws a ball on a 7 second cooldown.",
     "why": "Your answer: charges over time, a cooldown, reads as a spawn. Mark what's off.",
     "parts": [
         part("throw", "Throw", "Drag to aim (a faint path shows where it lands), let go. A quick tap throws at the "
              "nearest enemy you can see.", videos=["m-spawn-extra.mp4"]),
         part("ball", "The ball", "Hits by touch, harder the faster it goes. Slows to a stop, sits for 15 seconds or "
              "until it's broken. Enemies can't walk through it."),
         part("bait", "Bait", "Enemies near it go for the ball instead of you, so it buys you room."),
     ]},
    cast_card("weapon", "uncommon"),
    cast_card("spawn", "uncommon"),
    cast_card("dash", "uncommon"),
])

deck("stage2-questions", "Stage 2: what's next", "builds", 4, [
    {"id": "chests", "kind": "options", "rarity": "rare", "title": "Where chests go",
     "text": "You said too many chests sat in dead ends. Where should they be?",
     "why": "Chests are what make you explore. Too many and every dead end is a detour you have to take.",
     "pick": "b",
     "options": [{"id": "a", "label": "1 in 3 dead ends", "text": "And none in halls."},
                 {"id": "b", "label": "1 in 4, plus halls", "text": "A quarter of dead ends, and one in each hall, guarded."},
                 {"id": "c", "label": "Halls only", "text": "Dead ends stay empty."},
                 {"id": "d", "label": "From camps", "text": "Clearing a camp drops its chest."}]},
    {"id": "door", "kind": "question", "rarity": "epic", "title": "A door to the next maze",
     "text": "Your idea: keys spread through the maze open a door to a harder maze, and the wave timer resets.",
     "why": "It gives an endless run chapters and a reason to cross the map, without an exit that ends the run.",
     "pick": "Yes: 3 keys, each held by a camp's strongest enemy. The door shows once you hold them. Next maze is harder.",
     "details": "Dying still ends the run. Your build goes with you through the door. Each maze could add a new enemy kind, "
                "so the door is also how the roster grows during a run."},
    {"id": "levelups", "kind": "question", "rarity": "rare", "title": "Level-ups next",
     "text": "Stage 3 next: chests give modules, level-ups offer 4 upgrades for modules you have, rarity caps levels.",
     "why": "That turns the build screen into the real game: you earn your build in the run instead of picking it.",
     "pick": "Yes. The build screen stays as a practice room you can switch on.",
     "details": "Rarity caps levels as you picked (3 / 5 / 7 / 9), with your green Uncommon fitted in at 4. Player upgrades (health, "
                "speed, cooldowns) join the level-up cards, as you asked."},
])
print("decks written")
