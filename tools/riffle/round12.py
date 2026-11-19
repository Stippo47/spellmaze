"""Round 12 deck: laser turn and ramp, bigger deaths, small polish.

python tools/riffle/round12.py  ->  tools/riffle/decks/round12-build.json
"""
import json, pathlib

HERE = pathlib.Path(__file__).resolve().parent
F = "../../../films/"


def part(id_, title, text, images=None, videos=None):
    p = {"id": id_, "title": title, "text": text}
    if images: p["images"] = [F + i for i in images]
    if videos: p["videos"] = [F + v for v in videos]
    return p


deck = {"title": "Laser feel, punchier deaths", "topic": "builds", "order": 22, "cards": [
    {"id": "build", "kind": "report", "rarity": "uncommon", "title": "Your round 11 notes",
     "text": "The Laser swings round slowly and builds up while held. Deaths hit much harder. Small polish.",
     "why": "Everything from the last deck. Mark any part that's off.",
     "details": "Version 0.15.0. Close and reopen the app twice to get it.",
     "parts": [
         part("laser", "Laser", "Turns toward your aim at a limited speed, so sweeping it takes time. Starts at 30% "
              "and builds to full over 1.2 s held, getting wider too.", videos=["p-laser.mp4", "p-laser-mods.mp4"]),
         part("deaths", "Deaths", "A white pop, the body flung hard and spinning, broken bits of its shape, more "
              "sparks, a small shake, and a few frames' freeze.", images=["death-a.png"], videos=["p-hits.mp4"]),
         part("polish", "Small polish", "A small muzzle flash, short tails on bolts, enemies grow in when they "
              "arrive, XP pickups pop.", videos=["p-split.mp4"]),
     ]},
]}
(HERE / "decks" / "round12-build.json").write_text(json.dumps(deck, indent=1, ensure_ascii=False), encoding="utf-8")
print("deck written")
