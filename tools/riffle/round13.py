"""Round 13 deck: from their chat notes (bigger maze, auto fire, balance, red shards, more shards, laser snap).

python tools/riffle/round13.py  ->  tools/riffle/decks/round13-build.json
"""
import json, pathlib

HERE = pathlib.Path(__file__).resolve().parent
F = "../../../films/"


def part(id_, title, text, images=None, videos=None):
    p = {"id": id_, "title": title, "text": text}
    if images: p["images"] = [F + i for i in images]
    if videos: p["videos"] = [F + v for v in videos]
    return p


deck = {"title": "Bigger, auto, beatable", "topic": "builds", "order": 23, "cards": [
    {"id": "build", "kind": "report", "rarity": "rare", "title": "Your chat notes",
     "text": "Maze 2.5x bigger, camera further out, auto fire, fewer enemies, more shards, red health shards.",
     "why": "Everything you wrote after the last deck. Mark any part that's off.",
     "details": "Version 0.16.0. Close and reopen the app twice to get it. Auto fire is a setting (on).",
     "parts": [
         part("size", "2.5x bigger", "Every 2x2 is now 5x5: corridors 20 to 40 cells wide, walls 10. The camera is "
              "further out (48 rows by default) and you see 70 cells.", images=["maze-overview.png"], videos=["pistol.mp4"]),
         part("auto", "Auto fire", "Your weapon fires at the nearest enemy you can see. Spawn and Burst throw "
              "themselves. Dash dodges when something's about to touch you. Touch the fire stick to aim yourself.",
              videos=["pistol.mp4"]),
         part("balance", "Beatable", "At most 24 wanderers; none come while 8 or more are near you; waves top out "
              "at 28; crowds shove you less, so you can push out of a dead end."),
         part("shards", "More shards", "In most dead ends now, and at some corridor crossings."),
         part("hearts", "Red shards", "7% of kills drop one (30% big ones, always the boss). Pulled in like XP, heals "
              "15. New cards: Heal shards (+5 each) and a rare Regeneration."),
         part("laser", "Laser start", "Points straight at your aim when you start firing, then turns slowly.",
              videos=["p-laser.mp4"]),
     ]},
]}
(HERE / "decks" / "round13-build.json").write_text(json.dumps(deck, indent=1, ensure_ascii=False), encoding="utf-8")
print("deck written")
