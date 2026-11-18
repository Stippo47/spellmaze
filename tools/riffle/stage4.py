"""Stage 4 part 1 decks: camps and the first three new enemies.

python tools/riffle/stage4.py  ->  tools/riffle/decks/stage4-*.json
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


deck("stage4-build", "Stage 4: camps and enemies", "builds", 9, [
    {"id": "camps", "kind": "report", "rarity": "rare", "title": "Camps and three enemies",
     "text": "Rooms now hold camps guarding their shard. Darts, Spitters and Brutes join the mites.",
     "why": "First part of stage 4, as you said go: camps first, then enemies a few at a time. Mark any part that's off.",
     "details": "Version 0.6.0, on top of the fixes deck. Close and reopen the app twice to get it.\n\n"
                "Next in stage 4: statuses, the first boss at 5:00, breakable walls, then keys and the door.",
     "parts": [
         part("camps", "Camps", "Every room away from the start has a camp around its shard, resting (dim) until one "
              "sees you close or gets hit; then they all wake. Near rooms are easy, far ones hold brutes.",
              videos=["camp.mp4"]),
         part("dart", "Dart", "Magenta triangle. When it sees you it stops, shows its aim as a line, then charges "
              "straight until a wall. Hits hard. Dash sideways.", videos=["enemies.mp4"]),
         part("spitter", "Spitter", "Green diamond. Keeps its distance with you in sight and lobs slow orbs. "
              "A dash through an orb deletes it; your spawns block them."),
         part("brute", "Brute", "Amber square, wider than you. Slow and tough, barely knocked back, shoves "
              "smaller enemies and you along."),
         part("waves", "Who comes when", "Wave 2 brings darts, wave 3 spitters, from wave 4 a brute leads. "
              "Between waves the new ones start wandering in from 1:30."),
     ]},
])
print("decks written")
