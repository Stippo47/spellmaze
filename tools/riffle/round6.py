"""Round 6 decks: pockets, tiles, the shared Dash, afterimages, Duration module, flat star shard.

python tools/riffle/round6.py  ->  tools/riffle/decks/round6-*.json
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


deck("round6-build", "Pockets, tiles, one Dash", "builds", 12, [
    {"id": "build", "kind": "report", "rarity": "rare", "title": "Your round 5 notes",
     "text": "Dead-end pockets, 1-cell dark tiles, a shorter Dash shared with darts, afterimages, a flat star.",
     "why": "Everything from the last two decks. Mark any part that's off.",
     "details": "Version 0.8.0. Close and reopen the app twice to get it.",
     "parts": [
         part("pockets", "Dead ends", "Dead ends are back, as pockets: any part behind a single way in holds at most "
              "6 squares. So 1 to 6 square dead ends, never a whole branch.", images=["maze-overview.png"]),
         part("tiles", "Tiles", "One cell each, a darker wall, white for a moment when hit. Arms 2 cells thick, small "
              "clusters, filled-in barriers. In the map they're the bright blue bits.", videos=["blocks.mp4"]),
         part("dash", "Dash 5", "Base dash is 5 cells now (was 6 at first). Duration on the Dash makes it longer."),
         part("dart", "Dart uses the Dash", "The dart aims, then does the same Dash as you, so it goes 5 cells. Its "
              "Dash can carry modules later, same as yours.", videos=["enemies.mp4"]),
         part("ghosts", "Afterimages", "Dashes leave fading copies of the body behind; no squares or lines.",
              images=["dash-ghost.png"], videos=["dash.mp4"]),
         part("duration", "Duration module", "Duration is a module now: on a Weapon it's bolt range, on Spawn its "
              "life, on Dash its length, +20% a level. 'You' cards are 'Stat' cards.", images=["card-level.png"]),
         part("shard", "Shard", "A flat gold four-point star, one colour, turning slowly.", images=["shard-star-game.png"]),
     ]},
])

deck("round6-questions", "One question", "builds", 13, [
    {"id": "oneoption", "kind": "question", "rarity": "common", "title": "Upgrade shows 1 option?",
     "text": "On level-ups you wrote: 'Upgrade will show 1 option.' What should happen?",
     "why": "I can read it a few ways and don't want to guess.",
     "pick": "At most one Upgrade card per level-up, so the other two are new modules or stats.",
     "details": "Other readings: an Upgrade card should let you choose which module to level; or a level-up "
                "should show a single card."},
])
print("decks written")
